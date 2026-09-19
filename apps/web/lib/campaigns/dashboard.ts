import type { Db } from "../db";
import { freshness, type Freshness } from "../indexer/freshness";
import { indexerStatus, reconcileVault, vaultLedger, vaultTotals, type LedgerEntry } from "../indexer/queries";
import { syncIfStale, type IndexerRuntime } from "../indexer/runtime";
import { getPublicProfile } from "../organizers/service";
import { getCampaign, type CampaignWithMilestones } from "./service";

export interface DashboardData {
  campaign: {
    id: string;
    title: string;
    summary: string;
    category: CampaignWithMilestones["category"];
    fundingGoalMinorUnits: string;
    adminExpenseCapPct: number;
    createdAt: string;
  };
  organizer: { id: string; legalName: string; jurisdiction: string } | null;
  vault: string;
  escrow: {
    /** What the vault holds, derived from indexed events: donations minus releases. */
    heldMinorUnits: string;
    totalDonatedMinorUnits: string;
    /** Paid out to the organizer through released milestones. */
    totalReleasedMinorUnits: string;
    donationCount: number;
    /** Progress toward the goal in basis points (10000 = 100%); may exceed 10000. */
    goalReachedBps: number;
  };
  milestones: CampaignWithMilestones["milestones"];
  ledger: LedgerEntry[];
  indexer: {
    configured: boolean;
    dataAsOfBlock: number | null;
    headBlock: number | null;
    lagBlocks: number | null;
    freshness: Freshness;
  };
  reconciliation: {
    /** "match" only if the indexed total equals both the vault's accounting and the token balance. */
    status: "match" | "mismatch" | "unavailable" | "not_checked";
    checkedAtBlock: number | null;
  };
  generatedAt: string;
}

/** Progress toward the goal in basis points, using exact integer math. */
export function goalReachedBps(donated: bigint, goal: bigint): number {
  return goal > 0n ? Number((donated * 10_000n) / goal) : 0;
}

/**
 * The single source for everything the public dashboard shows: the page, the live-refresh API
 * and the exports all read this, so they cannot disagree. Only LIVE campaigns have a dashboard.
 * Every money figure is derived from indexed chain events (SPDD 11.1); nothing here is stored.
 */
export async function buildDashboard(
  db: Db,
  runtime: IndexerRuntime | null,
  campaignId: string,
): Promise<DashboardData | null> {
  const campaign = getCampaign(db, campaignId);
  if (!campaign || campaign.status !== "LIVE" || !campaign.vaultContractAddress) return null;
  const vault = campaign.vaultContractAddress;

  if (runtime) await syncIfStale(db, runtime);
  const status = await indexerStatus(db, runtime?.reader ?? null);
  const totals = vaultTotals(db, vault);
  const donated = BigInt(totals.totalDonated);

  let reconciliation: DashboardData["reconciliation"] = { status: "not_checked", checkedAtBlock: null };
  if (runtime) {
    try {
      const row = await reconcileVault(db, runtime.reader, vault);
      if (row) reconciliation = { status: row.match ? "match" : "mismatch", checkedAtBlock: row.checkedAtBlock };
    } catch {
      reconciliation = { status: "unavailable", checkedAtBlock: null };
    }
  }

  const organizer = getPublicProfile(db, campaign.organizerProfileId);
  return {
    campaign: {
      id: campaign.id,
      title: campaign.title,
      summary: campaign.summary,
      category: campaign.category,
      fundingGoalMinorUnits: campaign.fundingGoalMinorUnits,
      adminExpenseCapPct: campaign.adminExpenseCapPct,
      createdAt: campaign.createdAt,
    },
    organizer: organizer
      ? { id: organizer.id, legalName: organizer.legalName, jurisdiction: organizer.jurisdiction }
      : null,
    vault,
    escrow: {
      heldMinorUnits: totals.balance,
      totalReleasedMinorUnits: totals.totalReleased,
      totalDonatedMinorUnits: donated.toString(),
      donationCount: totals.donationCount,
      goalReachedBps: goalReachedBps(donated, BigInt(campaign.fundingGoalMinorUnits)),
    },
    milestones: campaign.milestones,
    ledger: vaultLedger(db, vault),
    indexer: {
      configured: runtime !== null,
      dataAsOfBlock: status.indexedThroughBlock,
      headBlock: status.headBlock,
      lagBlocks: status.lagBlocks,
      freshness: freshness(runtime !== null, status.lagBlocks),
    },
    reconciliation,
    generatedAt: new Date().toISOString(),
  };
}
