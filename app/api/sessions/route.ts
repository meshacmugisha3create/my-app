import { getCurrentMember } from "@/lib/auth";
import { getDatabase } from "@/lib/database";

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
              MAX(CASE WHEN mine.status = 'booked' THEN 1 ELSE 0 END) AS isBooked
       FROM club_sessions s
       LEFT JOIN session_bookings b ON b.session_id = s.id AND b.status = 'booked'
       LEFT JOIN session_bookings mine ON mine.session_id = s.id AND mine.member_id = ?
       WHERE s.is_cancelled = 0 AND s.starts_at > ?
       GROUP BY s.id
       ORDER BY s.starts_at ASC`,
    )
    .all(member.id, new Date().toISOString()) as Array<{
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
    }>;

  return Response.json({
    sessions: sessions.map((session) => ({
      ...session,
      isBooked: session.isBooked === 1,
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
      .prepare("SELECT starts_at AS startsAt, capacity, is_cancelled AS isCancelled FROM club_sessions WHERE id = ?")
      .get(id) as { startsAt: string; capacity: number; isCancelled: number } | undefined;
    if (!session) return "missing";
    if (session.isCancelled || session.startsAt <= new Date().toISOString()) return "closed";

    const currentBooking = database
      .prepare("SELECT status FROM session_bookings WHERE session_id = ? AND member_id = ?")
      .get(id, member.id) as { status: string } | undefined;
    if (currentBooking?.status === "booked") return "already-booked";

    const bookedCount = database
      .prepare("SELECT COUNT(*) AS count FROM session_bookings WHERE session_id = ? AND status = 'booked'")
      .get(id) as { count: number };
    if (bookedCount.count >= session.capacity) return "full";

    database
      .prepare(
        `INSERT INTO session_bookings (session_id, member_id, status)
         VALUES (?, ?, 'booked')
         ON CONFLICT (session_id, member_id)
         DO UPDATE SET status = 'booked', booked_at = CURRENT_TIMESTAMP`,
      )
      .run(id, member.id);
    return "booked";
  });

  const result = reserveSpot.immediate(sessionId);
  if (result === "missing") return Response.json({ error: "Session not found." }, { status: 404 });
  if (result === "closed") return Response.json({ error: "This session is no longer available." }, { status: 409 });
  if (result === "full") return Response.json({ error: "This session is full." }, { status: 409 });
  if (result === "already-booked") return Response.json({ message: "You already have a spot." });
  return Response.json({ message: "Your spot is reserved." }, { status: 201 });
}