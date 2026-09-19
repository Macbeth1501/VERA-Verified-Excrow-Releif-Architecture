import { apiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/api/guards";
import { allow } from "@/lib/api/rate-limit";
import { createDonationChain, donationsConfigured } from "@/lib/chain/donations";
import { getDb } from "@/lib/db";
import { advanceDonation } from "@/lib/donations/advance";
import { DonationNotFoundError } from "@/lib/donations/service";
import { getEnv } from "@/lib/env";

/** How long a request waits for a just-sent transaction before reporting "still pending". */
const WAIT_MS = 6_000;

/**
 * POST /api/v1/donations/:id/advance: run the donation's next on-chain step. Safe to call again
 * and again (the browser polls it): a step already in progress or already done is never repeated,
 * and the donation only becomes CONFIRMED once the chain says so.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  if (!donationsConfigured()) {
    return apiError(503, "DONATIONS_NOT_CONFIGURED", "Donations are switched off on this server right now.");
  }
  if (!allow(`advance:${auth.user.id}`, { capacity: 120, refillPerSecond: 2 })) {
    return apiError(429, "RATE_LIMITED", "Slow down a little.");
  }

  const { id } = await params;
  try {
    const donation = await advanceDonation(getDb(), createDonationChain(), id, auth.user.id, {
      waitMs: WAIT_MS,
      feeAddress: getEnv().PLATFORM_FEE_ADDRESS,
    });
    return Response.json({ donation });
  } catch (err) {
    if (err instanceof DonationNotFoundError) return apiError(404, "DONATION_NOT_FOUND", "Donation not found.");
    console.error(JSON.stringify({ event: "donation_advance_failed", message: err instanceof Error ? err.message : "unknown" }));
    return apiError(500, "INTERNAL_ERROR", "Something went wrong. Your donation was not lost; try again.");
  }
}
