import { apiError } from "@/lib/api/errors";
import { readJson, requireUser } from "@/lib/api/guards";
import { beneficiaryError, limitedRegistrations } from "@/lib/beneficiary/http";
import { listBeneficiaries, registerBeneficiary } from "@/lib/beneficiary/service";
import { registerBeneficiarySchema } from "@/lib/beneficiary/validation";
import { beneficiaryChain } from "@/lib/chain/registry";
import { getDb } from "@/lib/db";

/**
 * GET /api/v1/campaigns/:id/beneficiaries: the campaign's registered beneficiaries as hashes and
 * statuses (organizer or admin only). There is no identity data to return: the platform never has it.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request, "organizer", "admin");
  if (auth.response) return auth.response;
  const { id } = await params;
  const result = listBeneficiaries(getDb(), auth.user, id);
  return result.ok ? Response.json({ beneficiaries: result.beneficiaries }) : beneficiaryError(result);
}

/**
 * POST /api/v1/campaigns/:id/beneficiaries (FR-IDN-03): register one beneficiary from a fingerprint
 * made in the browser. A repeat in the same campaign is refused with 409 DUPLICATE_BENEFICIARY,
 * which says only that a duplicate exists. The body carries hashes only; anything else is dropped.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request, "organizer", "admin");
  if (auth.response) return auth.response;
  const blocked = limitedRegistrations(auth.user.id);
  if (blocked) return blocked;

  const json = await readJson(request);
  if (json.response) return json.response;
  const parsed = registerBeneficiarySchema.safeParse(json.body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_FAILED", "Check the beneficiary details and try again.", parsed.error.flatten().fieldErrors);
  }

  const { id } = await params;
  const result = await registerBeneficiary(getDb(), beneficiaryChain(), { actor: auth.user, campaignId: id, ...parsed.data });
  if (!result.ok) return beneficiaryError(result);
  return Response.json({ beneficiary: result.beneficiary }, { status: 201 });
}
