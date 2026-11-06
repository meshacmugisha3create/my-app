import { getCurrentMember, isStaffMember } from "@/lib/auth";
import { getDatabase } from "@/lib/database";

const activityTypes = new Set(["run-club", "strength", "recovery", "other"]);
const activityPageSize = 50;

type ActivitySummary = {
  activityCount: number;
  attendedCount: number;
  totalMinutes: number;
  totalDistance: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addDays(dateValue: string, days: number): string {
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function currentWeekStart(): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function GET(request: Request) {
  const member = await getCurrentMember();
  if (!member) return Response.json({ error: "Please sign in to view your progress." }, { status: 401 });

  const query = new URL(request.url).searchParams;
  const beforeDate = query.get("beforeDate");
  const beforeIdValue = query.get("beforeId");
  const beforeId = beforeIdValue === null ? null : Number(beforeIdValue);
  if (
    (beforeDate === null) !== (beforeId === null) ||
    (beforeDate !== null && !isValidDateKey(beforeDate)) ||
    (beforeId !== null && (!Number.isSafeInteger(beforeId) || beforeId < 1))
  ) {
    return Response.json({ error: "Choose a valid activity cursor." }, { status: 400 });
  }

  const requestedWeekStart = query.get("weekStart");
  const weekStart = requestedWeekStart && isValidDateKey(requestedWeekStart) && new Date(`${requestedWeekStart}T00:00:00.000Z`).getUTCDay() === 1
    ? requestedWeekStart
    : currentWeekStart();
  const weekEnd = addDays(weekStart, 49);
  const database = getDatabase();
  const summary = database
    .prepare(
      `SELECT COUNT(*) AS activityCount,
              COALESCE(SUM(attended), 0) AS attendedCount,
              COALESCE(SUM(duration_minutes), 0) AS totalMinutes,
              COALESCE(SUM(distance_km), 0) AS totalDistance
       FROM activities WHERE member_id = ?`,
    )
    .get(member.id) as ActivitySummary;

  const weeklyCounts = database
    .prepare(
      `SELECT date(activity_date, '-' || ((CAST(strftime('%w', activity_date) AS INTEGER) + 6) % 7) || ' days') AS weekStart,
              COUNT(*) AS count
       FROM activities
       WHERE member_id = ? AND attended = 1 AND activity_date >= ? AND activity_date < ?
       GROUP BY weekStart`,
    )
    .all(member.id, weekStart, weekEnd) as Array<{ weekStart: string; count: number }>;

  const cursorClause = beforeDate === null ? "" : " AND (activity_date < ? OR (activity_date = ? AND id < ?))";
  const activityQuery = database.prepare(
    `SELECT id, activity_type AS activityType, activity_date AS activityDate,
            duration_minutes AS durationMinutes, distance_km AS distanceKm,
            attended, notes
     FROM activities
     WHERE member_id = ?${cursorClause}
     ORDER BY activity_date DESC, id DESC
     LIMIT ?`,
  );
  const rows = (beforeDate === null
    ? activityQuery.all(member.id, activityPageSize + 1)
    : activityQuery.all(member.id, beforeDate, beforeDate, beforeId, activityPageSize + 1)) as Array<{
      id: number;
      activityType: string;
      activityDate: string;
      durationMinutes: number;
      distanceKm: number | null;
      attended: number;
      notes: string;
    }>;
  const hasMore = rows.length > activityPageSize;
  const activities = rows.slice(0, activityPageSize);

  return Response.json({
    member: { ...member, isStaff: isStaffMember(member) },
    activities: activities.map((activity) => ({ ...activity, attended: activity.attended === 1 })),
    summary,
    weeklyCounts,
    hasMore,
  });
}

export async function POST(request: Request) {
  const member = await getCurrentMember();
  if (!member) return Response.json({ error: "Please sign in to log an activity." }, { status: 401 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Please submit a valid activity." }, { status: 400 });
  }

  if (!isRecord(payload)) {
    return Response.json({ error: "Please submit a valid activity." }, { status: 400 });
  }

  const activityType = typeof payload.activityType === "string" ? payload.activityType : "";
  const activityDate = typeof payload.activityDate === "string" ? payload.activityDate : "";
  const durationMinutes = Number(payload.durationMinutes);
  const distanceInput = payload.distanceKm;
  const distanceKm = distanceInput === "" || distanceInput === null || distanceInput === undefined
    ? null
    : Number(distanceInput);
  const attended = payload.attended;
  const notes = typeof payload.notes === "string" ? payload.notes.trim() : "";

  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(activityDate)
    ? new Date(`${activityDate}T00:00:00.000Z`)
    : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== activityDate) {
    return Response.json({ error: "Choose a valid activity date." }, { status: 400 });
  }
  if (!activityTypes.has(activityType)) {
    return Response.json({ error: "Choose a valid activity type." }, { status: 400 });
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440) {
    return Response.json({ error: "Duration must be between 1 and 1440 minutes." }, { status: 400 });
  }
  if (distanceKm !== null && (!Number.isFinite(distanceKm) || distanceKm < 0 || distanceKm > 1000)) {
    return Response.json({ error: "Distance must be between 0 and 1000 km." }, { status: 400 });
  }
  if (typeof attended !== "boolean") {
    return Response.json({ error: "Please choose whether you attended the activity." }, { status: 400 });
  }
  if (notes.length > 500) {
    return Response.json({ error: "Notes must be 500 characters or fewer." }, { status: 400 });
  }

  const result = getDatabase()
    .prepare(
      `INSERT INTO activities
        (member_id, activity_type, activity_date, duration_minutes, distance_km, attended, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(member.id, activityType, activityDate, durationMinutes, distanceKm, attended ? 1 : 0, notes);

  return Response.json(
    {
      activity: {
        id: Number(result.lastInsertRowid),
        activityType,
        activityDate,
        durationMinutes,
        distanceKm,
        attended,
        notes,
      },
    },
    { status: 201 },
  );
}