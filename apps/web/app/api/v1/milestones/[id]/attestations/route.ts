import { apiError } from "@/lib/api/errors";
import { readJson, requireUser } from "@/lib/api/guards";
import { escrowChain } from "@/lib/chain/manager";
import { getDb } from "@/lib/db";
import { submitAttestation } from "@/lib/escrow/attestationCollector";
import { escrowError, limited } from "@/lib/escrow/http";
import { attestationSchema } from "@/lib/escrow/validation";

/**
 * POST /api/v1/milestones/:id/attestations (FR-ESC-01): a registered attestor confirms the
 * milestone with a hash of their evidence. Returns the milestone as the contract now reports it,
 * including whether the confirmation threshold has been met.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request, "attestor");
  if (auth.response) return auth.response;
  const blocked = limited(request);
  if (blocked) return blocked;

  const json = await readJson(request);
  if (json.response) return json.response;
  const parsed = attestationSchema.safeParse(json.body);
  if (!parsed.success) return apiError(400, "VALIDATION_FAILED", "Please attach your evidence.", parsed.error.flatten().fieldErrors);

  const { id } = await params;
  const result = await submitAttestation(getDb(), escrowChain(), auth.user, id, parsed.data.proofHash);
  if (!result.ok) return escrowError(result);
  const { state } = result.milestone;
  return Response.json({
    attestation_status: result.action.status,
    milestone: result.milestone,
    threshold_met: state ? state.status !== "Pending" : false,
  });
}
