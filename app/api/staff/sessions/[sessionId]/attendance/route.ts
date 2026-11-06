import { getCurrentMember, isStaffMember } from "@/lib/auth";
import { getDatabase } from "@/lib/database";

async function getStaff() {
  const member = await getCurrentMember();
  if (!member) return { response: Response.json({ error: "Please sign in." }, { status: 401 }) };
  if (!isStaffMember(member)) return { response: Response.json({ error: "Staff access is required." }, { status: 403 }) };
  return { member };
}

function parseSessionId(value: string): number | null {
  const sessionId = Number(value);
  return Number.isSafeInteger(sessionId) && sessionId > 0 ? sessionId : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const access = await getStaff();
  if ("response" in access) return access.response;

  const sessionId = parseSessionId((await params).sessionId);
  if (!sessionId) return Response.json({ error: "Choose a valid session." }, { status: 400 });

  const database = getDatabase();
  const session = database.prepare("SELECT id, title FROM club_sessions WHERE id = ?").get(sessionId);
  if (!session) return Response.json({ error: "Session not found." }, { status: 404 });

  const attendees = database
    .prepare(
      `SELECT b.member_id AS memberId, m.name, m.email, b.attended AS attended
       FROM session_bookings b
       JOIN members m ON m.id = b.member_id
       WHERE b.session_id = ? AND b.status = 'booked'
       ORDER BY m.name COLLATE NOCASE ASC`,
    )
    .all(sessionId) as Array<{
      memberId: number;
      name: string;
      email: string;
      attended: number | null;
    }>;

  return Response.json({
    session,
    attendees: attendees.map((attendee) => ({
      ...attendee,
      attended: attendee.attended === null ? null : attendee.attended === 1,
    })),
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const access = await getStaff();
  if ("response" in access) return access.response;

  const sessionId = parseSessionId((await params).sessionId);
  if (!sessionId) return Response.json({ error: "Choose a valid session." }, { status: 400 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Submit a valid attendance update." }, { status: 400 });
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return Response.json({ error: "Submit a valid attendance update." }, { status: 400 });
  }

  const memberId = Number((payload as Record<string, unknown>).memberId);
  const attended = (payload as Record<string, unknown>).attended;
  if (!Number.isSafeInteger(memberId) || memberId < 1 || typeof attended !== "boolean") {
    return Response.json({ error: "Submit a valid member and attendance status." }, { status: 400 });
  }

  const result = getDatabase()
    .prepare("UPDATE session_bookings SET attended = ? WHERE session_id = ? AND member_id = ? AND status = 'booked'")
    .run(attended ? 1 : 0, sessionId, memberId);
  if (result.changes === 0) {
    return Response.json({ error: "No active booking was found for this member." }, { status: 404 });
  }

  return Response.json({ message: "Attendance updated." });
}