import { getCurrentMember } from "@/lib/auth";
import { getDatabase } from "@/lib/database";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ activityId: string }> },
) {
  const member = await getCurrentMember();
  if (!member) return Response.json({ error: "Please sign in to manage your progress." }, { status: 401 });

  const activityId = Number((await params).activityId);
  if (!Number.isSafeInteger(activityId) || activityId < 1) {
    return Response.json({ error: "Choose a valid activity." }, { status: 400 });
  }

  const result = getDatabase()
    .prepare("DELETE FROM activities WHERE id = ? AND member_id = ?")
    .run(activityId, member.id);
  if (result.changes === 0) {
    return Response.json({ error: "Activity not found." }, { status: 404 });
  }

  return Response.json({ message: "Activity removed." });
}