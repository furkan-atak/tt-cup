import { clearAdminSession } from "@/lib/cookies";

export async function POST() {
  await clearAdminSession();
  return Response.json({ ok: true });
}
