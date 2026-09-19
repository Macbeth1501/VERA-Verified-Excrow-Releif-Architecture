import { requireUser } from "@/lib/api/guards";
import { getDb } from "@/lib/db";
import { getProfileByUser } from "@/lib/organizers/service";

/** GET /api/v1/organizers/me: the signed-in user's own application, or null if none. */
export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const profile = getProfileByUser(getDb(), auth.user.id);
  return Response.json({ kyb_status: profile?.kybStatus ?? null, profile });
}
