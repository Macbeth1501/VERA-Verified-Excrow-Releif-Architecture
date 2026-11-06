import type { Db } from "../db";
import type { EscrowChain } from "./chain-port";
import { countSyncedRole, fail, listMilestoneViews, type Outcome } from "./service";
import { thresholdRefusal } from "./threshold-effect";

/**
 * The global council threshold K on the MilestoneManager. Unlike the release limit it is NOT
 * snapshotted: `release()` compares against the current K, so a change reaches every milestone that
 * is already waiting. Hence the in-flight list the admin sees before confirming. The contract
 * enforces the floor of 2; the app also refuses a K above the council size (the contract cannot
 * count members), which would freeze every large release.
 */

/** A verified milestone that is above its limit and waiting for council approvals. */
export interface InFlightMilestone {
  milestoneId: string;
  campaignId: string;
  campaignTitle: string;
  index: number;
  councilApprovals: number;
}

/** Current K, the active synced council size and the milestones K would affect. `threshold: null` = unreadable. */
export async function getThreshold(
  db: Db,
  chain: EscrowChain,
): Promise<{ configured: boolean; threshold: number | null; councilMembers: number; inFlight: InFlightMilestone[] }> {
  const councilMembers = countSyncedRole(db, "council");
  if (!chain.configured()) return { configured: false, threshold: null, councilMembers, inFlight: [] };
  const threshold = await chain.readCouncilThreshold();
  const views = await listMilestoneViews(db, chain);
  const inFlight = views
    .filter((v) => v.state?.status === "Verified" && BigInt(v.state.releasableAmount) > BigInt(v.state.autoReleaseLimit))
    .map((v) => ({
      milestoneId: v.id,
      campaignId: v.campaignId,
      campaignTitle: v.campaignTitle,
      index: v.index,
      councilApprovals: v.state!.councilApprovals,
    }));
  return { configured: true, threshold, councilMembers, inFlight };
}

/** Sets K from the sponsor wallet after the app-level checks. An unknown outcome is pending, never failed. */
export async function setThreshold(
  db: Db,
  chain: EscrowChain,
  threshold: number,
): Promise<Outcome<{ txHash: string | null; pending: boolean }>> {
  if (!chain.configured()) return fail(503, "ESCROW_NOT_CONFIGURED", "The milestone manager is not configured on this server.");
  const refusal = thresholdRefusal(threshold, countSyncedRole(db, "council"));
  if (refusal) return fail(422, "VALIDATION_FAILED", refusal);
  const tx = await chain.setCouncilThreshold(threshold);
  if (tx.ok) return { ok: true, txHash: tx.txHash, pending: false };
  if (tx.pending) return { ok: true, txHash: null, pending: true };
  return fail(502, "CHAIN_FAILED", `Could not change the threshold on the contract: ${tx.error}`);
}
