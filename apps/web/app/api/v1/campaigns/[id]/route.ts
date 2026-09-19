import { apiError } from "@/lib/api/errors";
import { getRequestUser } from "@/lib/auth/request-user";
import { getCampaign, ownerUserId } from "@/lib/campaigns/service";
import { getDb } from "@/lib/db";

/**
 * GET /api/v1/campaigns/:id — a LIVE campaign is public (it has a real on-chain vault anyone can
 * inspect); a DRAFT is visible only to its organizer and to admins.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const campaign = getCampaign(db, id);
  if (!campaign) return apiError(404, "CAMPAIGN_NOT_FOUND", "Campaign not found.");

  if (campaign.status !== "LIVE") {
    const user = await getRequestUser(request, db);
    const owner = ownerUserId(db, id);
    if (!user || (user.id !== owner && user.role !== "admin")) {
      return apiError(404, "CAMPAIGN_NOT_FOUND", "Campaign not found.");
    }
  }
  return Response.json({ campaign });
}
