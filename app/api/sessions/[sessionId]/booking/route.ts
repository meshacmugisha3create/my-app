import { getCurrentMember } from "@/lib/auth";
import { getDatabase } from "@/lib/database";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const member = await getCurrentMember();
  if (!member) return Response.json({ error: "Please sign in to manage your reservations." }, { status: 401 });

  const sessionId = Number((await params).sessionId);
  if (!Number.isSafeInteger(sessionId) || sessionId < 1) {
    return Response.json({ error: "Choose a valid session." }, { status: 400 });
  }

  const database = getDatabase();
  const session = database
    .prepare("SELECT starts_at AS startsAt FROM club_sessions WHERE id = ? AND is_cancelled = 0")
    .get(sessionId) as { startsAt: string } | undefined;
  if (!session || session.startsAt <= new Date().toISOString()) {
    return Response.json({ error: "This reservation can no longer be changed." }, { status: 409 });
  }

  const result = database
    .prepare("UPDATE session_bookings SET status = 'cancelled' WHERE session_id = ? AND member_id = ? AND status = 'booked'")
    .run(sessionId, member.id);
  if (result.changes === 0) {
    return Response.json({ error: "Reservation not found." }, { status: 404 });
  }

  return Response.json({ message: "Your reservation was cancelled." });
}