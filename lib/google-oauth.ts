import { randomBytes } from "node:crypto";
import * as oidc from "openid-client";
import { hashPassword, type Member } from "@/lib/auth";
import { getDatabase } from "@/lib/database";

let configurationPromise: Promise<oidc.Configuration> | undefined;

export function getGoogleConfiguration(): Promise<oidc.Configuration> | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  configurationPromise ??= oidc.discovery(
    new URL("https://accounts.google.com"),
    clientId,
    undefined,
    oidc.ClientSecretPost(clientSecret),
  );
  return configurationPromise;
}

export function getGoogleRedirectUri(): string {
  const baseUrl = process.env.AUTH_BASE_URL ?? "http://127.0.0.1:3000";
  const url = new URL("/api/auth/google/callback", baseUrl);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("AUTH_BASE_URL must use HTTPS in production.");
  }
  return url.toString();
}

export class GoogleAccountLinkRequiredError extends Error {}

export class GoogleAccountMismatchError extends Error {}

export function linkGoogleIdentity(memberId: number, email: string, subject: string): Member {
  const database = getDatabase();
  const member = database
    .prepare("SELECT id, name, email FROM members WHERE id = ?")
    .get(memberId) as Member | undefined;
  if (!member || member.email !== email) throw new GoogleAccountMismatchError();

  const linkedIdentity = database
    .prepare(
      "SELECT member_id AS memberId FROM member_identities WHERE provider = 'google' AND provider_subject = ?",
    )
    .get(subject) as { memberId: number } | undefined;
  if (linkedIdentity && linkedIdentity.memberId !== member.id) {
    throw new GoogleAccountMismatchError();
  }
  if (linkedIdentity) return member;

  const memberIdentity = database
    .prepare(
      "SELECT provider_subject AS providerSubject FROM member_identities WHERE member_id = ? AND provider = 'google'",
    )
    .get(member.id) as { providerSubject: string } | undefined;
  if (memberIdentity && memberIdentity.providerSubject !== subject) {
    throw new GoogleAccountMismatchError();
  }

  database
    .prepare(
      `INSERT INTO member_identities (member_id, provider, provider_subject)
       VALUES (?, 'google', ?)`,
    )
    .run(member.id, subject);
  return member;
}

export async function findOrCreateGoogleMember(
  subject: string,
  email: string,
  googleName: string,
): Promise<Member> {
  const database = getDatabase();
  const linkedMember = database
    .prepare(
      `SELECT members.id, members.name, members.email
       FROM member_identities
       JOIN members ON members.id = member_identities.member_id
       WHERE member_identities.provider = 'google'
         AND member_identities.provider_subject = ?`,
    )
    .get(subject) as Member | undefined;
  if (linkedMember) return linkedMember;

  const existingMember = database
    .prepare("SELECT id, name, email FROM members WHERE email = ?")
    .get(email) as Member | undefined;

  if (existingMember) throw new GoogleAccountLinkRequiredError();

  const name = googleName.trim().slice(0, 100) || email.split("@")[0].slice(0, 100);
  const unusablePasswordHash = await hashPassword(randomBytes(32).toString("base64url"));
  const createMember = database.transaction(() => {
    const result = database
      .prepare("INSERT INTO members (name, email, password_hash) VALUES (?, ?, ?)")
      .run(name, email, unusablePasswordHash);
    database
      .prepare(
        "INSERT INTO member_identities (member_id, provider, provider_subject) VALUES (?, 'google', ?)",
      )
      .run(Number(result.lastInsertRowid), subject);
    return { id: Number(result.lastInsertRowid), name, email };
  });

  try {
    return createMember();
  } catch (error) {
    const concurrentlyLinkedMember = database
      .prepare(
        `SELECT members.id, members.name, members.email
         FROM member_identities
         JOIN members ON members.id = member_identities.member_id
         WHERE member_identities.provider = 'google'
           AND member_identities.provider_subject = ?`,
      )
      .get(subject) as Member | undefined;
    if (concurrentlyLinkedMember) return concurrentlyLinkedMember;
    throw error;
  }
}