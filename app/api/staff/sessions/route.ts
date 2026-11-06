import { getCurrentMember, isStaffMember } from "@/lib/auth";
import { getDatabase } from "@/lib/database";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function getStaff() {
  const member = await getCurrentMember();
  if (!member) return { response: Response.json({ error: "Please sign in." }, { status: 401 }) };
  if (!isStaffMember(member)) return { response: Response.json({ error: "Staff access is required." }, { status: 403 }) };
  return { member };
}

export async function GET() {
  const access = await getStaff();
  if ("response" in access) return access.response;

  const sessions = getDatabase()
    .prepare(
      `SELECT s.id, s.activity_type AS activityType, s.title, s.starts_at AS startsAt,
              s.duration_minutes AS durationMinutes, s.location, s.capacity, s.description,
              s.is_cancelled AS isCancelled, COUNT(b.id) AS bookedCount
       FROM club_sessions s
       LEFT JOIN session_bookings b ON b.session_id = s.id AND b.status = 'booked'
       GROUP BY s.id
       ORDER BY s.starts_at DESC
       LIMIT 100`,
    )
    .all() as Array<Record<string, unknown>>;
  return Response.json({ sessions });
}

export async function POST(request: Request) {
  const access = await getStaff();
  if ("response" in access) return access.response;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Please submit a valid session." }, { status: 400 });
  }
  if (!isRecord(payload)) return Response.json({ error: "Please submit a valid session." }, { status: 400 });

  const activityType = typeof payload.activityType === "string" ? payload.activityType : "";
  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const startsAt = typeof payload.startsAt === "string" ? payload.startsAt : "";
  const location = typeof payload.location === "string" ? payload.location.trim() : "";
  const description = typeof payload.description === "string" ? payload.description.trim() : "";
  const durationMinutes = Number(payload.durationMinutes);
  const capacity = Number(payload.capacity);
  const parsedStart = new Date(startsAt);

  if (!["run-club", "strength", "recovery"].includes(activityType)) {
    return Response.json({ error: "Choose a valid activity type." }, { status: 400 });
  }
  if (title.length < 2 || title.length > 120) {
    return Response.json({ error: "Session titles must be 2 to 120 characters." }, { status: 400 });
  }
  if (!startsAt.endsWith("Z") || Number.isNaN(parsedStart.getTime()) || parsedStart.toISOString() !== startsAt || parsedStart <= new Date()) {
    return Response.json({ error: "Choose a future session date and time." }, { status: 400 });
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 720) {
    return Response.json({ error: "Duration must be between 1 and 720 minutes." }, { status: 400 });
  }
  if (location.length < 2 || location.length > 160) {
    return Response.json({ error: "Location must be 2 to 160 characters." }, { status: 400 });
  }
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100) {
    return Response.json({ error: "Capacity must be between 1 and 100." }, { status: 400 });
  }
  if (description.length > 600) {
    return Response.json({ error: "Session details must be 600 characters or fewer." }, { status: 400 });
  }

  const result = getDatabase()
    .prepare(
      `INSERT INTO club_sessions
        (activity_type, title, starts_at, duration_minutes, location, capacity, description, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(activityType, title, startsAt, durationMinutes, location, capacity, description, access.member.id);

  return Response.json({ id: Number(result.lastInsertRowid) }, { status: 201 });
}