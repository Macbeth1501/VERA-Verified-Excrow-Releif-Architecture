import { apiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/api/guards";
import { getCampaign, ownerUserId } from "@/lib/campaigns/service";
import { escrowChain } from "@/lib/chain/manager";
import { getDb } from "@/lib/db";
import { limited } from "@/lib/escrow/http";
import { defineMilestonesOnChain } from "@/lib/escrow/service";

/**
 * POST /api/v1/campaigns/:id/milestones/define: register a published campaign's milestones with
 * the MilestoneManager, signed by the organizer. Called after publishing and again to retry;
 * milestones already registered are not sent twice.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const blocked = limited(request);
  if (blocked) return blocked;

  const { id } = await params;
  const db = getDb();
  if (!getCampaign(db, id)) return apiError(404, "CAMPAIGN_NOT_FOUND", "Campaign not found.");
  if (auth.user.id !== ownerUserId(db, id) && auth.user.role !== "admin") {
    return apiError(403, "FORBIDDEN", "Only the organizer can do this.");
  }
  const result = await defineMilestonesOnChain(db, escrowChain(), id);
  return Response.json({ result, campaign: getCampaign(db, id) });
}
