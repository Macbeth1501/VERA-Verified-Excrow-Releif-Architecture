import { apiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/api/guards";
import { syncOrganizerVerification } from "@/lib/chain/factory";
import { getDb } from "@/lib/db";
import { getProfileById, recordChainSync } from "@/lib/organizers/service";

/** POST /api/v1/admin/organizers/:id/sync: retry mirroring a verified organizer on-chain. Admin only. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request, "admin");
  if (auth.response) return auth.response;

  const { id } = await params;
  const db = getDb();
  const profile = getProfileById(db, id);
  if (!profile) return apiError(404, "ORGANIZER_NOT_FOUND", "Organizer application not found.");
  if (profile.kybStatus !== "verified") {
    return apiError(409, "ORGANIZER_NOT_VERIFIED", "Only verified organizers can be synced on-chain.");
  }

  recordChainSync(db, id, await syncOrganizerVerification(profile.walletAddress));
  return Response.json({ profile: getProfileById(db, id) });
}
