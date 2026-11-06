import { revokeMemberSession } from "@/lib/auth";

export async function POST() {
  await revokeMemberSession();
  return Response.json({ message: "Signed out." });
}