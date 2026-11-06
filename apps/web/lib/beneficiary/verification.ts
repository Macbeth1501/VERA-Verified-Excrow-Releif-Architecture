import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "../db";
import { beneficiaries, beneficiaryAttestations } from "../db/schema";
import { getEnv } from "../env";

/**
 * Whether a beneficiary is "verified" is derived, never stored: it is the number of distinct attestors
 * who confirmed them, compared with `BENEFICIARY_REQUIRED_ATTESTATIONS` (default 1). This is enforced
 * by the app and the database only; no contract checks it (that would be future scope C6).
 */

/** Attestors needed per beneficiary. Falls back to the default of 1 where the environment is not configured (unit tests). */
export function beneficiaryRequiredAttestations(): number {
  try {
    return getEnv().BENEFICIARY_REQUIRED_ATTESTATIONS;
  } catch {
    return 1;
  }
}

/**
 * Whether attestations are also recorded on-chain (the V2 registry, C6). In that mode only a row the
 * chain confirmed counts, since the Disbursement V2 contract refuses anyone else; otherwise every row
 * is app-level and counts. Falls back to false where the environment is not configured (unit tests).
 */
export function beneficiaryVerifiesOnChain(): boolean {
  try {
    return getEnv().BENEFICIARY_REGISTRY_V2;
  } catch {
    return false;
  }
}

/** How many distinct attestors confirmed each of these beneficiaries (ids with none are absent). */
export function attestationCounts(db: Db, beneficiaryIds: string[], onChain = beneficiaryVerifiesOnChain()): Map<string, number> {
  const counts = new Map<string, number>();
  if (beneficiaryIds.length === 0) return counts;
  const rows = db
    .select({ beneficiaryId: beneficiaryAttestations.beneficiaryId })
    .from(beneficiaryAttestations)
    .where(
      and(
        inArray(beneficiaryAttestations.beneficiaryId, beneficiaryIds),
        inArray(beneficiaryAttestations.chainStatus, onChain ? ["CONFIRMED"] : ["none", "CONFIRMED"]),
      ),
    )
    .all();
  for (const r of rows) counts.set(r.beneficiaryId, (counts.get(r.beneficiaryId) ?? 0) + 1);
  return counts;
}

/** Distinct attestors who confirmed one beneficiary. */
export function attestationCount(db: Db, beneficiaryId: string): number {
  return attestationCounts(db, [beneficiaryId]).get(beneficiaryId) ?? 0;
}

/** Counts for a campaign's confirmed (registered on-chain) beneficiaries: how many exist, how many are verified, and the requirement. */
export function campaignVerification(db: Db, campaignId: string): { registered: number; verified: number; required: number } {
  const required = beneficiaryRequiredAttestations();
  const rows = db
    .select({ id: beneficiaries.id })
    .from(beneficiaries)
    .where(and(eq(beneficiaries.campaignId, campaignId), eq(beneficiaries.chainStatus, "CONFIRMED")))
    .all();
  const counts = attestationCounts(db, rows.map((r) => r.id));
  return { registered: rows.length, verified: rows.filter((r) => (counts.get(r.id) ?? 0) >= required).length, required };
}
