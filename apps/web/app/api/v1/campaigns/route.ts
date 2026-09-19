import { apiError } from "@/lib/api/errors";
import { readJson, requireUser } from "@/lib/api/guards";
import { allow } from "@/lib/api/rate-limit";
import { createCampaign, listByOrganizer } from "@/lib/campaigns/service";
import { createCampaignSchema } from "@/lib/campaigns/validation";
import { getDb } from "@/lib/db";
import { OrganizerNotVerifiedError, getProfileByUser, requireVerifiedOrganizer } from "@/lib/organizers/service";

/**
 * POST /api/v1/campaigns — create a campaign (FR-CMP-01).
 *
 * This is the authoritative business check of the three defence-in-depth layers (SPDD §19.2):
 * the browser validates for fast feedback and `CampaignFactory` re-checks non-bypassably, but a
 * request that reaches here is validated again regardless of what the UI did.
 *
 * The campaign is saved as DRAFT with no vault; deploying the vault is a separate, retryable
 * call to `/api/v1/campaigns/:id/deploy`, so a slow or failing chain never loses the campaign.
 */
export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const db = getDb();

  let profileId: string;
  try {
    profileId = requireVerifiedOrganizer(db, auth.user.id).id;
  } catch (err) {
    if (err instanceof OrganizerNotVerifiedError) {
      return apiError(403, "ORGANIZER_NOT_VERIFIED", "Only verified organizers can create campaigns.", {
        kyb_status: err.status,
      });
    }
    throw err;
  }

  if (!allow(`campaign:${auth.user.id}`, { capacity: 10, refillPerSecond: 10 / 300 })) {
    return apiError(429, "RATE_LIMITED", "Too many campaigns created. Please wait a few minutes.");
  }

  const json = await readJson(request);
  if (json.response) return json.response;
  const parsed = createCampaignSchema.safeParse(json.body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_FAILED", "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  try {
    const campaign = createCampaign(db, profileId, parsed.data);
    return Response.json({ campaign_id: campaign.id, campaign }, { status: 201 });
  } catch (err) {
    console.error(JSON.stringify({ event: "campaign_create_failed", message: err instanceof Error ? err.message : "unknown" }));
    return apiError(500, "INTERNAL_ERROR", "Something went wrong creating the campaign.");
  }
}

/** GET /api/v1/campaigns — the signed-in organizer's own campaigns. */
export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const db = getDb();
  const profile = getProfileByUser(db, auth.user.id);
  return Response.json({ campaigns: profile ? listByOrganizer(db, profile.id) : [] });
}
