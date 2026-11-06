import { createMemberSession, hashPassword } from "@/lib/auth";
import { getDatabase } from "@/lib/database";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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

  const name = text(payload.name);
  const email = text(payload.email).toLowerCase();
  const password = typeof payload.password === "string" ? payload.password : "";

  if (name.length < 2 || name.length > 100) {
    return Response.json({ error: "Enter a name between 2 and 100 characters." }, { status: 400 });
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8 || password.length > 128) {
    return Response.json({ error: "Your password must be 8 to 128 characters." }, { status: 400 });
  }

  const database = getDatabase();
  const existing = database.prepare("SELECT id FROM members WHERE email = ?").get(email);
  if (existing) {
    return Response.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  try {
    const result = database
      .prepare("INSERT INTO members (name, email, password_hash) VALUES (?, ?, ?)")
      .run(name, email, await hashPassword(password));
    await createMemberSession(Number(result.lastInsertRowid));

    return Response.json(
      { member: { id: Number(result.lastInsertRowid), name, email } },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      return Response.json({ error: "An account with that email already exists." }, { status: 409 });
    }
    console.error("Unable to register Mesh Sports member:", error);
    return Response.json({ error: "We couldn’t create your account right now." }, { status: 503 });
  }
}