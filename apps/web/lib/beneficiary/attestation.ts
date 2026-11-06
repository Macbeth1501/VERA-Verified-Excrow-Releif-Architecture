import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { PublicUser } from "../auth/users";
import { getCampaign, ownerUserId } from "../campaigns/service";
import type { Db } from "../db";
import { beneficiaries, beneficiaryAttestations, type BeneficiaryAttestationRow } from "../db/schema";
import { roleIsSynced, signerFor } from "../escrow/service";
import { saveDocument } from "../files/service";
import type { BeneficiaryChain } from "./chain-port";
import { fail, type Outcome } from "./service";
import { attestationCount, beneficiaryRequiredAttestations, beneficiaryVerifiesOnChain } from "./verification";

/**
 * C5/C6: an attestor confirms that a registered beneficiary really exists. The attestor types the
 * person's identity detail in their own browser, which fingerprints it with the campaign's salt
 * (`clientHasher.ts`); only that fingerprint arrives here, so no identity text ever reaches the
 * server. If it matches a confirmed beneficiary of the campaign, one attestation is recorded.
 *
 * With the original contracts that is the whole story: the rule is enforced by the app and database
 * only. With `BENEFICIARY_REGISTRY_V2=1` (C6) the attestor's own wallet also sends
 * `attestBeneficiary` to the V2 registry, so DisbursementV2 can refuse an unconfirmed beneficiary
 * itself, and only a confirmed row counts. The hash is saved before waiting and an unknown outcome
 * stays PENDING, like every other chain action.
 */

/** What an attestor learns: only whether their fingerprint matched, and (on a match) how verified that person now is. */
export type AttestationResult =
  | { matched: false }
  | { matched: true; attestations: number; required: number; verified: boolean };

type Actor = Pick<PublicUser, "id" | "role" | "walletAddress">;

function isUniqueViolation(err: unknown): boolean {
  for (let e: unknown = err; e instanceof Error; e = (e as { cause?: unknown }).cause) {
    if (/UNIQUE constraint failed/i.test(e.message)) return true;
  }
  return false;
}

const ALREADY = () => fail(409, "ALREADY_ATTESTED", "You have already confirmed this beneficiary.");

/**
 * Records `actor`'s confirmation of the beneficiary with this fingerprint. Only attestors may do it,
 * never the campaign's own organizer, and each attestor counts once per beneficiary. A fingerprint
 * that matches nobody is a plain `matched: false`; it reveals nothing else about the campaign.
 */
export async function attestBeneficiary(
  db: Db,
  chain: BeneficiaryChain,
  actor: Actor,
  campaignId: string,
  input: { identityHash: string; evidenceHash?: string; evidence?: { data: string; mimeType: string; name: string } },
): Promise<Outcome<AttestationResult>> {
  const campaign = getCampaign(db, campaignId);
  if (!campaign) return fail(404, "CAMPAIGN_NOT_FOUND", "Campaign not found.");
  if (actor.role !== "attestor") return fail(403, "FORBIDDEN", "Only attestors can confirm beneficiaries.");
  if (ownerUserId(db, campaignId) === actor.id) return fail(403, "FORBIDDEN", "You cannot confirm beneficiaries of your own campaign.");
  if (campaign.status !== "LIVE" || !campaign.vaultContractAddress) return fail(409, "CAMPAIGN_NOT_LIVE", "This campaign is not live.");
  const vault = campaign.vaultContractAddress;
  const onChain = beneficiaryVerifiesOnChain();

  const identityHash = input.identityHash.toLowerCase();
  const beneficiary = db
    .select()
    .from(beneficiaries)
    .where(and(eq(beneficiaries.campaignId, campaignId), eq(beneficiaries.identityHash, identityHash), eq(beneficiaries.chainStatus, "CONFIRMED")))
    .get();
  if (!beneficiary) return { ok: true, matched: false };

  const existing = db
    .select()
    .from(beneficiaryAttestations)
    .where(and(eq(beneficiaryAttestations.beneficiaryId, beneficiary.id), eq(beneficiaryAttestations.attestorUserId, actor.id)))
    .get();

  const result = (): Outcome<AttestationResult> => {
    const attestations = attestationCount(db, beneficiary.id);
    const required = beneficiaryRequiredAttestations();
    return { ok: true, matched: true, attestations, required, verified: attestations >= required };
  };

  if (!onChain) {
    // App-level only (original contracts): one row per attestor, nothing on-chain.
    if (existing) return ALREADY();
    const saved = saveEvidence(db, actor, input);
    if (!saved.ok) return saved.failure;
    const inserted = insertRow(db, beneficiary.id, actor.id, input.evidenceHash, saved.documentId, "none");
    if (!inserted.ok) return inserted.failure;
    return result();
  }

  // ---- V2: the attestor's own wallet also confirms on the registry contract.
  if (!chain.configured()) {
    return fail(503, "REGISTRY_NOT_CONFIGURED", "Beneficiary verification is switched off: the registry or the sponsor wallet is not configured.");
  }
  if (!roleIsSynced(db, actor.id, "attestor")) {
    return fail(403, "FORBIDDEN", "You are not a registered attestor on the blockchain yet. Ask an admin to sync your role.");
  }
  const signer = signerFor(db, actor);
  if (!signer) return fail(409, "FORBIDDEN", "This account uses its own wallet, which the server cannot sign for.");

  if (existing?.chainStatus === "CONFIRMED") return ALREADY();
  if (existing?.chainStatus === "PENDING" && existing.chainTxHash) {
    const state = await chain.txState(existing.chainTxHash);
    if (state === "success") {
      settle(db, existing.id, { chainStatus: "CONFIRMED", chainError: null });
      return result();
    }
    if (state === "pending") return fail(202, "ATTESTATION_PENDING", "Your earlier confirmation is still being recorded. Give it a minute.");
  }

  let rowId: string;
  if (existing) {
    // A failed (or unsent, or app-level-only) row is retried on the same row.
    rowId = existing.id;
    settle(db, rowId, { chainStatus: "PENDING", chainTxHash: null, chainError: null });
  } else {
    const saved = saveEvidence(db, actor, input);
    if (!saved.ok) return saved.failure;
    const inserted = insertRow(db, beneficiary.id, actor.id, input.evidenceHash, saved.documentId, "PENDING");
    if (!inserted.ok) return inserted.failure;
    rowId = inserted.id;
  }

  const tx = await chain.attest(signer, vault, identityHash, (hash) => settle(db, rowId, { chainTxHash: hash }));
  if (tx.ok) {
    settle(db, rowId, { chainStatus: "CONFIRMED", chainTxHash: tx.txHash, chainError: null });
    return result();
  }
  if (tx.pending) {
    settle(db, rowId, { chainError: tx.error }); // stays PENDING
    return fail(202, "ATTESTATION_PENDING", "Sent, but the confirmation was not seen yet. It will settle shortly.");
  }
  settle(db, rowId, { chainStatus: "FAILED", chainError: tx.error });
  return fail(422, "CHAIN_FAILED", tx.error);
}

function settle(db: Db, id: string, set: Partial<BeneficiaryAttestationRow>) {
  db.update(beneficiaryAttestations).set(set).where(eq(beneficiaryAttestations.id, id)).run();
}

type Saved = { ok: true; documentId: string | null } | { ok: false; failure: ReturnType<typeof fail> };

/** Stores the optional evidence file; only called once the fingerprint matched, so a wrong guess never leaves a file behind. */
function saveEvidence(
  db: Db,
  actor: Actor,
  input: { evidenceHash?: string; evidence?: { data: string; mimeType: string; name: string } },
): Saved {
  if (!input.evidence) return { ok: true, documentId: null };
  if (!input.evidenceHash) return { ok: false, failure: fail(400, "VALIDATION_FAILED", "Attach the evidence so its fingerprint can be computed.") };
  try {
    const documentId = saveDocument(db, {
      purpose: "beneficiary_evidence",
      filename: input.evidence.name,
      mimeType: input.evidence.mimeType,
      base64Data: input.evidence.data,
      expectedHash: input.evidenceHash,
      uploadedByUserId: actor.id,
    });
    return { ok: true, documentId };
  } catch (err) {
    return { ok: false, failure: fail(400, "VALIDATION_FAILED", err instanceof Error ? err.message : "Could not save the evidence file.") };
  }
}

function insertRow(
  db: Db,
  beneficiaryId: string,
  attestorUserId: string,
  evidenceHash: string | undefined,
  evidenceDocumentId: string | null,
  chainStatus: "none" | "PENDING",
): { ok: true; id: string } | { ok: false; failure: ReturnType<typeof fail> } {
  const id = randomUUID();
  try {
    db.insert(beneficiaryAttestations)
      .values({ id, beneficiaryId, attestorUserId, evidenceHash: evidenceHash?.toLowerCase() ?? null, evidenceDocumentId, chainStatus })
      .run();
    return { ok: true, id };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, failure: ALREADY() }; // a concurrent request won the race
    throw err;
  }
}
