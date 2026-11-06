import { getCurrentMember, isStaffMember } from "@/lib/auth";
import { getDatabase } from "@/lib/database";

const activityTypes = new Set(["run-club", "strength", "recovery", "other"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET() {
  const member = await getCurrentMember();
  if (!member) return Response.json({ error: "Please sign in to view your progress." }, { status: 401 });

  const activities = getDatabase()
    .prepare(
      `SELECT id, activity_type AS activityType, activity_date AS activityDate,
              duration_minutes AS durationMinutes, distance_km AS distanceKm,
              attended, notes
       FROM activities
       WHERE member_id = ?
       ORDER BY activity_date DESC, id DESC`,
    )
    .all(member.id) as Array<{
      id: number;
      activityType: string;
      activityDate: string;
      durationMinutes: number;
      distanceKm: number | null;
      attended: number;
      notes: string;
    }>;

  return Response.json({
    member: { ...member, isStaff: isStaffMember(member) },
    activities: activities.map((activity) => ({ ...activity, attended: activity.attended === 1 })),
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