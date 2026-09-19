import { apiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/api/guards";
import { getDb } from "@/lib/db";
import { listProfiles, type KybStatus } from "@/lib/organizers/service";

const STATUSES: KybStatus[] = ["pending", "verified", "rejected"];

/** GET /api/v1/admin/organizers?status=pending: admin review queue. Admin only. */
export async function GET(request: Request) {
  const auth = await requireUser(request, "admin");
  if (auth.response) return auth.response;

  const status = new URL(request.url).searchParams.get("status");
  if (status !== null && !STATUSES.includes(status as KybStatus)) {
    return apiError(400, "VALIDATION_FAILED", "status must be pending, verified or rejected.");
  }
  return Response.json({ organizers: listProfiles(getDb(), (status as KybStatus | null) ?? undefined) });
}
