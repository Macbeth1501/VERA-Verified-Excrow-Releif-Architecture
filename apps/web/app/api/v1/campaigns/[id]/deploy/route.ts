import { apiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/api/guards";
import { findUserById, getWalletKeyEnc } from "@/lib/auth/users";
import { deployCampaignVault } from "@/lib/chain/campaigns";
import { getCampaign, ownerUserId, recordVaultDeploy } from "@/lib/campaigns/service";
import { getDb } from "@/lib/db";

/**
 * POST /api/v1/campaigns/:id/deploy — deploy this campaign's vault through CampaignFactory.
 * Called right after creation and again by the retry button. Safe to call twice: an already
 * deployed campaign is returned unchanged rather than deploying a second vault.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  const { id } = await params;
  const db = getDb();
  const campaign = getCampaign(db, id);
  if (!campaign) return apiError(404, "CAMPAIGN_NOT_FOUND", "Campaign not found.");
  const owner = ownerUserId(db, id);
  if (auth.user.id !== owner && auth.user.role !== "admin") {
    return apiError(403, "FORBIDDEN", "Only the organizer can publish this campaign.");
  }
  if (campaign.chainStatus === "deployed") return Response.json({ campaign });

  // Always sign as the organizer, never as the caller: the Factory records msg.sender as the
  // campaign's organizer, so an admin retrying must still produce the organizer's campaign.
  const organizer = owner ? findUserById(db, owner) : null;
  if (!organizer) return apiError(404, "CAMPAIGN_NOT_FOUND", "This campaign has no organizer account.");

  const result = await deployCampaignVault({
    organizerAddress: organizer.walletAddress,
    organizerWalletKeyEnc: getWalletKeyEnc(db, organizer.id),
    category: campaign.category,
    fundingGoalMinorUnits: campaign.fundingGoalMinorUnits,
    adminExpenseCapPct: campaign.adminExpenseCapPct,
    milestonePcts: campaign.milestones.map((m) => m.targetPct),
  });
  return Response.json({ campaign: recordVaultDeploy(db, id, result) });
}
