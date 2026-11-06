import { getCurrentMember } from "@/lib/auth";
import { getDatabase } from "@/lib/database";
import { notifyStaff, sendEmail } from "@/lib/email";

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
  const cancelAndPromote = database.transaction((id: number) => {
    const session = database
      .prepare("SELECT title, starts_at AS startsAt, location FROM club_sessions WHERE id = ? AND is_cancelled = 0")
      .get(id) as { title: string; startsAt: string; location: string } | undefined;
    if (!session || session.startsAt <= new Date().toISOString()) return "closed";

    const result = database
      .prepare("UPDATE session_bookings SET status = 'cancelled' WHERE session_id = ? AND member_id = ? AND status = 'booked'")
      .run(id, member.id);
    if (result.changes === 0) {
      const waitlistResult = database
        .prepare("DELETE FROM session_waitlist WHERE session_id = ? AND member_id = ?")
        .run(id, member.id);
      return waitlistResult.changes > 0 ? "left-waitlist" : "not-booked";
    }

    const nextInLine = database
      .prepare(
        `SELECT w.member_id AS memberId, m.name, m.email
         FROM session_waitlist w
         JOIN members m ON m.id = w.member_id
         WHERE w.session_id = ?
         ORDER BY w.id ASC
         LIMIT 1`,
      )
      .get(id) as { memberId: number; name: string; email: string } | undefined;

    if (nextInLine) {
      database
        .prepare(
          `INSERT INTO session_bookings (session_id, member_id, status, attended)
           VALUES (?, ?, 'booked', NULL)
           ON CONFLICT (session_id, member_id)
           DO UPDATE SET status = 'booked', booked_at = CURRENT_TIMESTAMP, attended = NULL`,
        )
        .run(id, nextInLine.memberId);
      database.prepare("DELETE FROM session_waitlist WHERE session_id = ? AND member_id = ?").run(id, nextInLine.memberId);
    }

    return { session, promoted: nextInLine };
  });

  const result = cancelAndPromote.immediate(sessionId);
  if (result === "closed") {
    return Response.json({ error: "This reservation can no longer be changed." }, { status: 409 });
  }
  if (result === "left-waitlist") {
    await notifyStaff("Mesh Sports waitlist update", `${member.name} left a session waitlist.`);
    return Response.json({ message: "You left the session waitlist." });
  }
  if (result === "not-booked") return Response.json({ error: "Reservation not found." }, { status: 404 });

  const sessionDetails = `${result.session.title}\n${new Date(result.session.startsAt).toLocaleString()} · ${result.session.location}`;
  const notifications = [
    sendEmail({
      to: member.email,
      subject: "Your Mesh Sports reservation was cancelled",
      text: `Hi ${member.name},\n\nYour reservation was cancelled for:\n${sessionDetails}\n\nMesh Sports`,
    }),
    notifyStaff("Mesh Sports session booking cancelled", `${member.name} cancelled their booking for ${result.session.title}.`),
  ];

  if (result.promoted) {
    notifications.push(
      sendEmail({
        to: result.promoted.email,
        subject: "A spot opened up for your Mesh Sports session",
        text: `Hi ${result.promoted.name},\n\nA spot opened and is now reserved for you:\n${sessionDetails}\n\nMesh Sports`,
      }),
      notifyStaff("Mesh Sports waitlist promotion", `${result.promoted.name} was promoted from the waitlist for ${result.session.title}.`),
    );
  }

  await Promise.all(notifications);
  return Response.json({
    message: result.promoted ? "Your reservation was cancelled. The next member on the waitlist has been booked." : "Your reservation was cancelled.",
  });
}