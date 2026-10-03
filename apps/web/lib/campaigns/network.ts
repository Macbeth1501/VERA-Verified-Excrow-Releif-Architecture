import type { Db } from "../db";
import { allCursors, eventsForVaults } from "../indexer/store";
import { vaultTotals } from "../indexer/queries";
import { listLive } from "./service";

export interface NetworkTotals {
  campaigns: number;
  /** All in mINR minor units, derived from indexed chain events, never stored. */
  donated: string;
  held: string;
  released: string;
  paidOut: string;
  /** Milestones that reached their required confirmations. */
  confirmedMilestones: number;
  indexedThroughBlock: number | null;
}

/**
 * What the whole platform has done so far, summed over the published (LIVE) campaigns' vaults only,
 * so test vaults the app never published do not inflate it. Returns null when there is nothing to
 * show, so a page can fall back to describing the mechanism without inventing a figure.
 */
export function networkTotals(db: Db): NetworkTotals | null {
  const vaults = listLive(db).flatMap((c) => (c.vaultContractAddress ? [c.vaultContractAddress] : []));
  if (vaults.length === 0) return null;

  let donated = 0n;
  let released = 0n;
  let paidOut = 0n;
  for (const vault of vaults) {
    const t = vaultTotals(db, vault);
    donated += BigInt(t.totalDonated);
    released += BigInt(t.totalReleased);
    paidOut += BigInt(t.totalPaidOut);
  }
  const confirmedMilestones = eventsForVaults(db, vaults).filter((e) => e.eventName === "MilestoneVerified").length;
  const cursors = allCursors(db);
  return {
    campaigns: vaults.length,
    donated: donated.toString(),
    held: (donated - released).toString(),
    released: released.toString(),
    paidOut: paidOut.toString(),
    confirmedMilestones,
    indexedThroughBlock: cursors.length ? Math.min(...cursors.map((c) => c.lastBlock)) : null,
  };
}
