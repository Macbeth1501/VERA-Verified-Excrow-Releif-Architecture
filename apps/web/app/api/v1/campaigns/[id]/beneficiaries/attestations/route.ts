import { apiError } from "@/lib/api/errors";
import { readJson, requireUser } from "@/lib/api/guards";
import { attestBeneficiary } from "@/lib/beneficiary/attestation";
import { beneficiaryError, limitedAttestations } from "@/lib/beneficiary/http";
import { attestBeneficiarySchema } from "@/lib/beneficiary/validation";
import { beneficiaryChain } from "@/lib/chain/registry";
import { getDb } from "@/lib/db";

/**
 * POST /api/v1/campaigns/:id/beneficiaries/attestations (C5): an attestor confirms that a registered
 * beneficiary exists. The body carries the salted fingerprint made in the attestor's browser, never
 * identity text. Answers `{ matched: false }` when no beneficiary has that fingerprint, and otherwise
 * how many attestors have now confirmed that person. App-enforced; no contract checks it.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request, "attestor");
  if (auth.response) return auth.response;
  const blocked = limitedAttestations(auth.user.id);
  if (blocked) return blocked;

  const json = await readJson(request);
  if (json.response) return json.response;
  const parsed = attestBeneficiarySchema.safeParse(json.body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_FAILED", "Check the fingerprint and try again.", parsed.error.flatten().fieldErrors);
  }

  const { id } = await params;
  const { identityHash, evidenceHash, evidenceData, evidenceMimeType, evidenceName } = parsed.data;
  const result = await attestBeneficiary(getDb(), beneficiaryChain(), auth.user, id, {
    identityHash,
    evidenceHash,
    evidence: evidenceData && evidenceMimeType ? { data: evidenceData, mimeType: evidenceMimeType, name: evidenceName ?? "evidence" } : undefined,
  });
  if (!result.ok) return beneficiaryError(result);
  return Response.json(
    result.matched
      ? { matched: true, attestations: result.attestations, required: result.required, verified: result.verified }
      : { matched: false },
    { status: result.matched ? 201 : 200 },
  );
}
