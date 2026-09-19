import { apiError } from "@/lib/api/errors";
import { readJson, requireUser } from "@/lib/api/guards";
import { allow } from "@/lib/api/rate-limit";
import { donationsConfigured } from "@/lib/chain/donations";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import {
  CampaignNotOpenError, FeeChoiceRequiredError, WalletNotManagedError, createDonation, listDonations,
} from "@/lib/donations/service";
import { createDonationSchema } from "@/lib/donations/validation";

/**
 * POST /api/v1/donations: start a donation (FR-CMP-02). This only records the intent as PENDING;
 * the browser then calls /advance repeatedly to run the on-chain steps, so no request has to
 * outlive a serverless timeout. Nothing is ever reported as complete until the chain confirms it.
 */
export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  if (!donationsConfigured()) {
    return apiError(503, "DONATIONS_NOT_CONFIGURED", "Donations are switched off on this server right now.");
  }
  if (!allow(`donate:${auth.user.id}`, { capacity: 10, refillPerSecond: 10 / 60 })) {
    return apiError(429, "RATE_LIMITED", "Too many donations started. Please wait a minute.");
  }

  const json = await readJson(request);
  if (json.response) return json.response;
  const parsed = createDonationSchema.safeParse(json.body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_FAILED", "Please check the donation amount.", parsed.error.flatten().fieldErrors);
  }

  try {
    const donation = createDonation(getDb(), { userId: auth.user.id, ...parsed.data }, BigInt(getEnv().PLATFORM_FEE_MINOR_UNITS));
    return Response.json({ donation_id: donation.id, donation }, { status: 201 });
  } catch (err) {
    if (err instanceof CampaignNotOpenError) return apiError(409, "CAMPAIGN_NOT_OPEN", "This campaign is not open for donations.");
    if (err instanceof FeeChoiceRequiredError) return apiError(400, "FEE_CHOICE_REQUIRED", err.message);
    if (err instanceof WalletNotManagedError) {
      return apiError(422, "WALLET_NOT_MANAGED", "Your account uses your own wallet, which we cannot send donations from yet.");
    }
    console.error(JSON.stringify({ event: "donation_create_failed", message: err instanceof Error ? err.message : "unknown" }));
    return apiError(500, "INTERNAL_ERROR", "Something went wrong starting your donation.");
  }
}

/** GET /api/v1/donations: the signed-in donor's own donations, newest first. */
export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  return Response.json({ donations: listDonations(getDb(), auth.user.id) });
}
