import { getCurrentMember, isStaffMember } from "@/lib/auth";
import { getDatabase } from "@/lib/database";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const member = await getCurrentMember();
  if (!member) return Response.json({ error: "Please sign in." }, { status: 401 });
  if (!isStaffMember(member)) return Response.json({ error: "Staff access is required." }, { status: 403 });

  const requestId = Number((await params).requestId);
  if (!Number.isSafeInteger(requestId) || requestId < 1) {
    return Response.json({ error: "Choose a valid inquiry." }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Please submit a valid update." }, { status: 400 });
  }
  if (
    typeof payload !== "object" || payload === null || Array.isArray(payload) ||
    !["new", "contacted", "closed"].includes(String((payload as Record<string, unknown>).status))
  ) {
    return Response.json({ error: "Choose a valid inquiry status." }, { status: 400 });
  }

  const result = getDatabase()
    .prepare("UPDATE join_requests SET status = ? WHERE id = ?")
    .run((payload as { status: string }).status, requestId);
  if (result.changes === 0) return Response.json({ error: "Inquiry not found." }, { status: 404 });

  return Response.json({ message: "Inquiry updated." });
}