import { apiError } from "@/lib/api/errors";
import { readJson, requireUser } from "@/lib/api/guards";
import { disbursementChain } from "@/lib/chain/disbursement";
import { getDb } from "@/lib/db";
import { disbursementError } from "@/lib/disbursement/http";
import { disburseMilestone } from "@/lib/disbursement/service";
import { disburseSchema } from "@/lib/disbursement/validation";
import { limited } from "@/lib/escrow/http";

/**
 * POST /api/v1/milestones/:id/disburse (FR-ESC-02): record the simulated payout of a released
 * milestone to one registered beneficiary. The campaign's organizer or an admin may ask; both
 * transactions (approve, then disburse) are always signed by the campaign's organizer. 201 when
 * confirmed, 202 when sent but not yet confirmed (repeat the call later to settle it).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request, "organizer", "admin");
  if (auth.response) return auth.response;
  const blocked = limited(request);
  if (blocked) return blocked;

  const json = await readJson(request);
  if (json.response) return json.response;
  const parsed = disburseSchema.safeParse(json.body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_FAILED", "Check the payout details and try again.", parsed.error.flatten().fieldErrors);
  }

  const { id } = await params;
  const result = await disburseMilestone(getDb(), disbursementChain(), { actor: auth.user, milestoneId: id, ...parsed.data });
  if (!result.ok) return disbursementError(result);
  return Response.json({ disbursement: result.disbursement }, { status: 201 });
}
