import type { Db } from "../db";
import { freshness, type Freshness } from "../indexer/freshness";
import { indexerStatus, reconcileVault, vaultLedger, vaultPayouts, vaultTotals, type LedgerEntry, type PayoutEntry } from "../indexer/queries";
import { syncWithinBudget, type IndexerRuntime } from "../indexer/runtime";
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
    /** Refunded to donors after the campaign closed. */
    totalRefundedMinorUnits: string;
    donationCount: number;
    /** Progress toward the goal in basis points (10000 = 100%); may exceed 10000. */
    goalReachedBps: number;
  };
  /**
   * Beneficiaries registered for this campaign, counted from indexed BeneficiaryRegistered events. The
   * registry reverts on a repeat, so each is a distinct fingerprint. `registry` is its address, when
   * configured, so anyone can check the count themselves; the fingerprints hold no identity data.
   */
  beneficiaries: { uniqueCount: number; registry: string | null };
  /**
   * Payouts to beneficiaries (FR-ESC-02), from indexed PayoutRecorded events: every one is a public
   * line item naming the milestone, the amount, the beneficiary's fingerprint and the hash of the
   * off-ramp reference. `contract` is the Disbursement address when configured, so anyone can check.
   */
  payouts: { entries: PayoutEntry[]; totalMinorUnits: string; contract: string | null };
  milestones: CampaignWithMilestones["milestones"];
  ledger: LedgerEntry[];
  /** The campaign's end date, inactivity rule and refund state; `enabled` is false for campaigns published before expiry existed. */
  expiry: ExpiryInfo;
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
    /**
     * Payouts never exceed releases and equal the payout contract's own total. "not_checked" when no
     * payout contract is configured (payouts <= releases is still part of `status`).
     */
    payouts: "match" | "mismatch" | "not_checked";
    /** Why a comparison could not be made, so the page can say so in plain words (only with status "unavailable"). */
    reason?: UnavailableReason;
  };
  generatedAt: string;
}

export interface ExpiryInfo {
  /** False for campaigns whose vault has no deadline (published before expiry existed): nothing below applies. */
  enabled: boolean;
  /** open: taking donations; ended: past the deadline but not yet closed; closed: refunds are open. */
  state: "open" | "ended" | "closed";
  deadlineAt: string | null;
  inactivityDays: number;
  /** When the campaign becomes closable for lack of progress: the last release (or publishing) plus the inactivity window. */
  inactivityDeadlineAt: string | null;
  /** Why anyone could close it right now, or null if it cannot be closed (yet, or already closed, or nothing is held). */
  closableReason: "deadline" | "inactivity" | "completed" | null;
  closed: { reason: "deadline" | "inactivity" | "completed"; refundPool: string; timestamp: string } | null;
  refundCount: number;
}

const DAY_MS = 86_400_000;

/**
 * Derives the expiry picture from the campaign's record and the indexed events, mirroring the vault's
 * own rules (the contract is the authority: a close request that is not yet allowed is refused there).
 */
export function buildExpiry(
  campaign: CampaignWithMilestones,
  totals: ReturnType<typeof vaultTotals>,
  ledger: LedgerEntry[],
  now: Date,
): ExpiryInfo {
  if (!campaign.deadlineAt) {
    return { enabled: false, state: "open", deadlineAt: null, inactivityDays: campaign.inactivityDays, inactivityDeadlineAt: null, closableReason: null, closed: null, refundCount: 0 };
  }
  const deadline = new Date(campaign.deadlineAt);
  const published = new Date(deadline.getTime() - campaign.durationDays * DAY_MS);
  const releases = ledger.filter((e) => e.type === "MilestoneReleased");
  const lastProgress = releases.reduce((latest, e) => (new Date(e.timestamp) > latest ? new Date(e.timestamp) : latest), published);
  const inactivityDeadline = new Date(lastProgress.getTime() + campaign.inactivityDays * DAY_MS);
  const allReleased = campaign.milestones.length > 0 && releases.length >= campaign.milestones.length;
  const held = BigInt(totals.balance) > 0n;

  let closableReason: ExpiryInfo["closableReason"] = null;
  if (!totals.closed && held) {
    if (allReleased) closableReason = "completed";
    else if (now > deadline) closableReason = "deadline";
    else if (now > inactivityDeadline) closableReason = "inactivity";
  }
  return {
    enabled: true,
    state: totals.closed ? "closed" : now > deadline ? "ended" : "open",
    deadlineAt: deadline.toISOString(),
    inactivityDays: campaign.inactivityDays,
    inactivityDeadlineAt: inactivityDeadline.toISOString(),
    closableReason,
    closed: totals.closed ? { reason: totals.closed.reason, refundPool: totals.closed.refundPool, timestamp: totals.closed.timestamp } : null,
    refundCount: totals.refundCount,
  };
}

/** Why the chain comparison failed: the node no longer keeps state that old, no node answered, or something else. */
export type UnavailableReason = "state_pruned" | "unreachable" | "other";

export function classifyReconcileError(err: unknown): UnavailableReason {
  const text = (err instanceof Error ? `${err.message} ${(err as { details?: string }).details ?? ""}` : String(err)).toLowerCase();
  if (/historical state|missing trie node|state .* is not available|pruned|header not found/.test(text)) return "state_pruned";
  if (/timeout|timed out|fetch failed|econn|enotfound|network|http request failed|unreachable|aborted/.test(text)) return "unreachable";
  return "other";
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
  now: Date = new Date(),
): Promise<DashboardData | null> {
  const campaign = getCampaign(db, campaignId);
  if (!campaign || campaign.status !== "LIVE" || !campaign.vaultContractAddress) return null;
  const vault = campaign.vaultContractAddress;

  if (runtime) await syncWithinBudget(db, runtime);
  const status = await indexerStatus(db, runtime?.reader ?? null);
  const totals = vaultTotals(db, vault);
  const donated = BigInt(totals.totalDonated);

  let reconciliation: DashboardData["reconciliation"] = { status: "not_checked", checkedAtBlock: null, payouts: "not_checked" };
  if (runtime) {
    try {
      const row = await reconcileVault(db, runtime.reader, vault, runtime.config.disbursementStartBlock);
      if (row) {
        const payoutsOk = row.payouts.withinReleases && row.payouts.match !== false;
        reconciliation = {
          status: row.match ? "match" : "mismatch",
          checkedAtBlock: row.checkedAtBlock,
          payouts: !payoutsOk ? "mismatch" : row.payouts.match === null ? "not_checked" : "match",
        };
      }
    } catch (err) {
      const reason = classifyReconcileError(err);
      console.warn(`[reconcile] vault ${vault} could not be compared (${reason}): ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
      reconciliation = { status: "unavailable", checkedAtBlock: null, payouts: "not_checked", reason };
    }
  }

  const organizer = getPublicProfile(db, campaign.organizerProfileId);
  const ledger = vaultLedger(db, vault);
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
      totalRefundedMinorUnits: totals.totalRefunded,
      totalDonatedMinorUnits: donated.toString(),
      donationCount: totals.donationCount,
      goalReachedBps: goalReachedBps(donated, BigInt(campaign.fundingGoalMinorUnits)),
    },
    beneficiaries: { uniqueCount: totals.beneficiaryCount, registry: runtime?.registryAddress ?? null },
    payouts: { entries: vaultPayouts(db, vault), totalMinorUnits: totals.totalPaidOut, contract: runtime?.disbursementAddress ?? null },
    milestones: campaign.milestones,
    ledger,
    expiry: buildExpiry(campaign, totals, ledger, now),
    indexer: {
      configured: runtime !== null,
      dataAsOfBlock: status.indexedThroughBlock,
      headBlock: status.headBlock,
      lagBlocks: status.lagBlocks,
      freshness: freshness(runtime !== null, status.lagBlocks),
    },
    reconciliation,
    generatedAt: now.toISOString(),
  };
}
