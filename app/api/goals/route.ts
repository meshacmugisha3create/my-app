import { getCurrentMember } from "@/lib/auth";
import { getDatabase } from "@/lib/database";

const defaultWeeklyActivityGoal = 3;

export async function GET() {
  const member = await getCurrentMember();
  if (!member) return Response.json({ error: "Please sign in to view your goal." }, { status: 401 });

  const goal = getDatabase()
    .prepare("SELECT weekly_activity_goal AS weeklyActivityGoal FROM member_goals WHERE member_id = ?")
    .get(member.id) as { weeklyActivityGoal: number } | undefined;

  return Response.json({
    weeklyActivityGoal: goal?.weeklyActivityGoal ?? defaultWeeklyActivityGoal,
    currentDate: new Date().toISOString(),
  });
}

export async function PUT(request: Request) {
  const member = await getCurrentMember();
  if (!member) return Response.json({ error: "Please sign in to update your goal." }, { status: 401 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Submit a valid weekly goal." }, { status: 400 });
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return Response.json({ error: "Submit a valid weekly goal." }, { status: 400 });
  }

  const weeklyActivityGoal = (payload as Record<string, unknown>).weeklyActivityGoal;
  if (typeof weeklyActivityGoal !== "number" || !Number.isInteger(weeklyActivityGoal) || weeklyActivityGoal < 1 || weeklyActivityGoal > 14) {
    return Response.json({ error: "Choose a weekly goal from 1 to 14 activities." }, { status: 400 });
  }

  getDatabase()
    .prepare(
      `INSERT INTO member_goals (member_id, weekly_activity_goal)
       VALUES (?, ?)
       ON CONFLICT (member_id)
       DO UPDATE SET weekly_activity_goal = excluded.weekly_activity_goal, updated_at = CURRENT_TIMESTAMP`,
    )
    .run(member.id, weeklyActivityGoal);

  return Response.json({ weeklyActivityGoal });
}