import { getCurrentMember, isStaffMember } from "@/lib/auth";
import { getDatabase } from "@/lib/database";

export async function GET() {
  const member = await getCurrentMember();
  if (!member) return Response.json({ error: "Please sign in." }, { status: 401 });
  if (!isStaffMember(member)) return Response.json({ error: "Staff access is required." }, { status: 403 });

  const requests = getDatabase()
    .prepare(
      `SELECT id, name, email, phone, program, status, created_at AS createdAt
       FROM join_requests
       ORDER BY CASE status WHEN 'new' THEN 0 WHEN 'contacted' THEN 1 ELSE 2 END,
                created_at DESC
       LIMIT 200`,
    )
    .all();
  return Response.json({ requests });
}