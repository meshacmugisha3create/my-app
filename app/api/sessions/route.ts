import { getCurrentMember } from "@/lib/auth";
import { getDatabase } from "@/lib/database";
import { notifyStaff, sendEmail } from "@/lib/email";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET() {
  const member = await getCurrentMember();
  if (!member) return Response.json({ error: "Please sign in to browse sessions." }, { status: 401 });

  const sessions = getDatabase()
    .prepare(
      `SELECT s.id, s.activity_type AS activityType, s.title, s.starts_at AS startsAt,
              s.duration_minutes AS durationMinutes, s.location, s.capacity, s.description,
              COUNT(b.id) AS bookedCount,
              MAX(CASE WHEN mine.status = 'booked' THEN 1 ELSE 0 END) AS isBooked,
              MAX(CASE WHEN waitlist.member_id IS NOT NULL THEN 1 ELSE 0 END) AS isWaitlisted
       FROM club_sessions s
       LEFT JOIN session_bookings b ON b.session_id = s.id AND b.status = 'booked'
       LEFT JOIN session_bookings mine ON mine.session_id = s.id AND mine.member_id = ?
            LEFT JOIN session_waitlist waitlist ON waitlist.session_id = s.id AND waitlist.member_id = ?
       WHERE s.is_cancelled = 0 AND s.starts_at > ?
       GROUP BY s.id
       ORDER BY s.starts_at ASC`,
    )
    .all(member.id, member.id, new Date().toISOString()) as Array<{
      id: number;
      activityType: string;
      title: string;
      startsAt: string;
      durationMinutes: number;
      location: string;
      capacity: number;
      description: string;
      bookedCount: number;
      isBooked: number;
      isWaitlisted: number;
    }>;

  return Response.json({
    sessions: sessions.map((session) => ({
      ...session,
      isBooked: session.isBooked === 1,
      isWaitlisted: session.isWaitlisted === 1,
      spotsLeft: Math.max(0, session.capacity - session.bookedCount),
    })),
  });
}

export async function POST(request: Request) {
  const member = await getCurrentMember();
  if (!member) return Response.json({ error: "Please sign in to reserve a session." }, { status: 401 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Please submit a valid session." }, { status: 400 });
  }
  if (!isRecord(payload)) {
    return Response.json({ error: "Please submit a valid session." }, { status: 400 });
  }

  const sessionId = Number(payload.sessionId);
  if (!Number.isSafeInteger(sessionId) || sessionId < 1) {
    return Response.json({ error: "Choose a valid session." }, { status: 400 });
  }

  const database = getDatabase();
  const reserveSpot = database.transaction((id: number) => {
    const session = database
      .prepare("SELECT title, starts_at AS startsAt, location, capacity, is_cancelled AS isCancelled FROM club_sessions WHERE id = ?")
      .get(id) as { title: string; startsAt: string; location: string; capacity: number; isCancelled: number } | undefined;
    if (!session) return "missing";
    if (session.isCancelled || session.startsAt <= new Date().toISOString()) return "closed";

    const currentBooking = database
      .prepare("SELECT status FROM session_bookings WHERE session_id = ? AND member_id = ?")
      .get(id, member.id) as { status: string } | undefined;
    if (currentBooking?.status === "booked") return "already-booked";

    const currentWaitlistEntry = database
      .prepare("SELECT 1 FROM session_waitlist WHERE session_id = ? AND member_id = ?")
      .get(id, member.id);
    if (currentWaitlistEntry) return "already-waitlisted";

    const bookedCount = database
      .prepare("SELECT COUNT(*) AS count FROM session_bookings WHERE session_id = ? AND status = 'booked'")
      .get(id) as { count: number };
    if (bookedCount.count >= session.capacity) {
      database.prepare("INSERT INTO session_waitlist (session_id, member_id) VALUES (?, ?)").run(id, member.id);
      return { status: "waitlisted" as const, session };
    }

    database
      .prepare(
        `INSERT INTO session_bookings (session_id, member_id, status)
         VALUES (?, ?, 'booked')
         ON CONFLICT (session_id, member_id)
         DO UPDATE SET status = 'booked', booked_at = CURRENT_TIMESTAMP`,
      )
      .run(id, member.id);
    return { status: "booked" as const, session };
  });

  const result = reserveSpot.immediate(sessionId);
  if (result === "missing") return Response.json({ error: "Session not found." }, { status: 404 });
  if (result === "closed") return Response.json({ error: "This session is no longer available." }, { status: 409 });
  if (result === "already-booked") return Response.json({ message: "You already have a spot." });
  if (result === "already-waitlisted") return Response.json({ message: "You are already on the waitlist." });

  const sessionDetails = `${result.session.title}\n${new Date(result.session.startsAt).toLocaleString()} · ${result.session.location}`;
  if (result.status === "waitlisted") {
    await sendEmail({
      to: member.email,
      subject: "You’re on the Mesh Sports waitlist",
      text: `Hi ${member.name},\n\nYou’re on the waitlist for:\n${sessionDetails}\n\nWe’ll email you if a spot opens.\n\nMesh Sports`,
    });
    await notifyStaff("New Mesh Sports waitlist entry", `${member.name} joined the waitlist for ${result.session.title}.`);
    return Response.json({ message: "The session is full. You’re on the waitlist." }, { status: 201 });
  }

  await Promise.all([
    sendEmail({
      to: member.email,
      subject: "Your Mesh Sports spot is reserved",
      text: `Hi ${member.name},\n\nYour spot is reserved for:\n${sessionDetails}\n\nMesh Sports`,
    }),
    notifyStaff("New Mesh Sports session booking", `${member.name} reserved a spot for ${result.session.title}.`),
  ]);
  return Response.json({ message: "Your spot is reserved." }, { status: 201 });
}