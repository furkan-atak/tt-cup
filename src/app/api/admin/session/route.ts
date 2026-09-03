import { isAdmin } from "@/lib/cookies";

export async function GET() {
  return Response.json({ admin: await isAdmin() });
}
