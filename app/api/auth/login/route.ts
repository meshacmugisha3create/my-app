import { createMemberSession, verifyPassword } from "@/lib/auth";
import { getDatabase } from "@/lib/database";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Please submit a valid form." }, { status: 400 });
  }

  if (!isRecord(payload)) {
    return Response.json({ error: "Please submit a valid form." }, { status: 400 });
  }

  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const password = typeof payload.password === "string" ? payload.password : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length > 128) {
    return Response.json({ error: "Email or password is incorrect." }, { status: 401 });
  }

  const member = getDatabase()
    .prepare("SELECT id, name, email, password_hash AS passwordHash FROM members WHERE email = ?")
    .get(email) as { id: number; name: string; email: string; passwordHash: string } | undefined;

  if (!member || !(await verifyPassword(password, member.passwordHash))) {
    return Response.json({ error: "Email or password is incorrect." }, { status: 401 });
  }

  await createMemberSession(member.id);
  return Response.json({ member: { id: member.id, name: member.name, email: member.email } });
}