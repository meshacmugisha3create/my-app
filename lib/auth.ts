import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getDatabase } from "@/lib/database";

const sessionCookie = "mesh_session";
const sessionLifetimeSeconds = 60 * 60 * 24 * 14;

export type Member = {
  id: number;
  name: string;
  email: string;
};

export function isStaffMember(member: Member): boolean {
  const staffEmails = new Set(
    (process.env.MESH_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
  return staffEmails.has(member.email.toLowerCase());
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function derivePasswordKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (error, key) => {
      if (error) {
        reject(error);
      } else {
        resolve(key as Buffer);
      }
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derivePasswordKey(password, salt);
  return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, saltValue, keyValue] = storedHash.split("$");
  if (algorithm !== "scrypt" || !saltValue || !keyValue) return false;

  const expectedKey = Buffer.from(keyValue, "base64url");
  const actualKey = await derivePasswordKey(password, Buffer.from(saltValue, "base64url"));
  return expectedKey.length === actualKey.length && timingSafeEqual(expectedKey, actualKey);
}

export async function createMemberSession(memberId: number): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Math.floor(Date.now() / 1000) + sessionLifetimeSeconds;

  getDatabase()
    .prepare("INSERT INTO member_sessions (token_hash, member_id, expires_at) VALUES (?, ?, ?)")
    .run(hashToken(token), memberId, expiresAt);

  const cookieStore = await cookies();
  cookieStore.set(sessionCookie, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionLifetimeSeconds,
  });
}

export async function getCurrentMember(): Promise<Member | null> {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token) return null;

  const member = getDatabase()
    .prepare(
      `SELECT members.id, members.name, members.email
       FROM member_sessions
       JOIN members ON members.id = member_sessions.member_id
       WHERE member_sessions.token_hash = ? AND member_sessions.expires_at > ?`,
    )
    .get(hashToken(token), Math.floor(Date.now() / 1000)) as Member | undefined;

  return member ?? null;
}

export async function revokeMemberSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookie)?.value;
  if (token) {
    getDatabase()
      .prepare("DELETE FROM member_sessions WHERE token_hash = ?")
      .run(hashToken(token));
  }
  cookieStore.delete(sessionCookie);
}