import { getCurrentMember, isStaffMember } from "@/lib/auth";
import { getDatabase } from "@/lib/database";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const member = await getCurrentMember();
  if (!member) return Response.json({ error: "Please sign in." }, { status: 401 });
  if (!isStaffMember(member)) return Response.json({ error: "Staff access is required." }, { status: 403 });

  const sessionId = Number((await params).sessionId);
  if (!Number.isSafeInteger(sessionId) || sessionId < 1) {
    return Response.json({ error: "Choose a valid session." }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Please submit a valid update." }, { status: 400 });
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return Response.json({ error: "Please submit a valid update." }, { status: 400 });
  }

  const data = payload as Record<string, unknown>;
  const database = getDatabase();
  if (typeof data.isCancelled === "boolean") {
    const result = database
      .prepare("UPDATE club_sessions SET is_cancelled = ? WHERE id = ?")
      .run(data.isCancelled ? 1 : 0, sessionId);
    if (result.changes === 0) return Response.json({ error: "Session not found." }, { status: 404 });
    return Response.json({ message: data.isCancelled ? "Session cancelled." : "Session restored." });
  }

  const activityType = typeof data.activityType === "string" ? data.activityType : "";
  const title = typeof data.title === "string" ? data.title.trim() : "";
  const startsAt = typeof data.startsAt === "string" ? data.startsAt : "";
  const location = typeof data.location === "string" ? data.location.trim() : "";
  const description = typeof data.description === "string" ? data.description.trim() : "";
  const durationMinutes = Number(data.durationMinutes);
  const capacity = Number(data.capacity);
  const parsedStart = new Date(startsAt);

  if (!["run-club", "strength", "recovery"].includes(activityType)) {
    return Response.json({ error: "Choose a valid activity type." }, { status: 400 });
  }
  if (title.length < 2 || title.length > 120 || location.length < 2 || location.length > 160) {
    return Response.json({ error: "Enter a valid session title and location." }, { status: 400 });
  }
  if (!startsAt.endsWith("Z") || Number.isNaN(parsedStart.getTime()) || parsedStart.toISOString() !== startsAt || parsedStart <= new Date()) {
    return Response.json({ error: "Choose a future session date and time." }, { status: 400 });
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 720) {
    return Response.json({ error: "Duration must be between 1 and 720 minutes." }, { status: 400 });
  }
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100 || description.length > 600) {
    return Response.json({ error: "Enter a capacity from 1 to 100 and details up to 600 characters." }, { status: 400 });
  }

  const bookedCount = database
    .prepare("SELECT COUNT(*) AS count FROM session_bookings WHERE session_id = ? AND status = 'booked'")
    .get(sessionId) as { count: number };
  if (capacity < bookedCount.count) {
    return Response.json({ error: "Capacity cannot be lower than the current number of reservations." }, { status: 409 });
  }

  const result = database
    .prepare(
      `UPDATE club_sessions
       SET activity_type = ?, title = ?, starts_at = ?, duration_minutes = ?,
           location = ?, capacity = ?, description = ?
       WHERE id = ? AND starts_at > ?`,
    )
    .run(activityType, title, startsAt, durationMinutes, location, capacity, description, sessionId, new Date().toISOString());
  if (result.changes === 0) return Response.json({ error: "Session not found." }, { status: 404 });

  return Response.json({ message: "Session updated." });
}