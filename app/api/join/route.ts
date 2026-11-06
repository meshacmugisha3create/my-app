import { getDatabase } from "@/lib/database";
import { notifyStaff, sendEmail } from "@/lib/email";

const programs = new Set(["run-club", "strength", "recovery", "not-sure"]);

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
  const phone = text(payload.phone);
  const program = text(payload.program);

  if (name.length < 2 || name.length > 100) {
    return Response.json(
      { error: "Please enter a name between 2 and 100 characters." },
      { status: 400 },
    );
  }

  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return Response.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  if (phone.length > 40) {
    return Response.json(
      { error: "Phone numbers must be 40 characters or fewer." },
      { status: 400 },
    );
  }

  if (!programs.has(program)) {
    return Response.json({ error: "Please choose a valid program." }, { status: 400 });
  }

  try {
    const database = getDatabase();
    database
      .prepare(
        `INSERT INTO join_requests (name, email, phone, program)
         VALUES (?, ?, ?, ?)`,
      )
      .run(name, email, phone || null, program);

    const programLabel = program === "not-sure" ? "Open to suggestions" : program.replace("-", " ");
    await Promise.all([
      sendEmail({
        to: email,
        subject: "We received your Mesh Sports request",
        text: `Hi ${name},\n\nThanks for reaching out about ${programLabel}. A member of our team will be in touch soon.\n\nMesh Sports`,
      }),
      notifyStaff(
        "New Mesh Sports join request",
        `${name} requested information about ${programLabel}.\nEmail: ${email}${phone ? `\nPhone: ${phone}` : ""}`,
      ),
    ]);

    return Response.json(
      { message: "Thanks for reaching out. We’ll be in touch soon." },
      { status: 201 },
    );
  } catch (error) {
    console.error("Unable to save Mesh Sports join request:", error);
    return Response.json(
      { error: "We couldn’t save your request right now. Please try again later." },
      { status: 503 },
    );
  }
}
