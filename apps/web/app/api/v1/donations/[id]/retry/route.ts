import { apiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/api/guards";
import { getDb } from "@/lib/db";
import { DonationNotFoundError, retryDonation } from "@/lib/donations/service";

/** POST /api/v1/donations/:id/retry: resume a FAILED donation from the step that failed. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const { id } = await params;
  try {
    return Response.json({ donation: retryDonation(getDb(), id, auth.user.id) });
  } catch (err) {
    if (err instanceof DonationNotFoundError) return apiError(404, "DONATION_NOT_FOUND", "Donation not found.");
    throw err;
  }
}
