import { apiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/api/guards";
import { getDb } from "@/lib/db";
import { DonationNotFoundError, getDonation } from "@/lib/donations/service";

/** GET /api/v1/donations/:id: one of the signed-in donor's donations. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const { id } = await params;
  try {
    return Response.json({ donation: getDonation(getDb(), id, auth.user.id) });
  } catch (err) {
    if (err instanceof DonationNotFoundError) return apiError(404, "DONATION_NOT_FOUND", "Donation not found.");
    throw err;
  }
}
