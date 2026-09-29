import type { Db } from "../db";
import { allCursors, eventsForVault, knownVaults } from "./store";
import type { ChainReader, EventName } from "./types";

export interface LedgerEntry {
  /** Unique per event: txHash:logIndex. */
  id: string;
  type: EventName;
  /** Which milestone a milestone event is about (0-based), otherwise null. */
  milestoneIndex: number | null;
  blockNumber: number;
  timestamp: string;
  txHash: string;
  /** Donor, organizer, attestor, council member or payout recipient, depending on the event. */
  actor: string;
  /** mINR minor units (6 decimals); only donations, releases and payouts carry one. */
  amount: string | null;
}

export interface VaultTotals {
  vault: string;
  /** Sum of all indexed donations, in mINR minor units. Derived, never stored. */
  totalDonated: string;
  /** Sum of all indexed milestone releases, in mINR minor units. Derived, never stored. */
  totalReleased: string;
  /** What the vault should hold: donations minus releases. */
  balance: string;
  /** Sum of all indexed PayoutRecorded events: released money the organizer paid to beneficiaries. */
  totalPaidOut: string;
  payoutCount: number;
  donationCount: number;
  /** Unique beneficiaries registered on the BeneficiaryRegistry for this vault, from indexed events. */
  beneficiaryCount: number;
  /** Highest block this vault has been indexed through, or null if never indexed. */
  indexedThroughBlock: number | null;
}

const ACTOR_KEY: Partial<Record<EventName, string>> = {
  DonationReceived: "donor",
  CampaignCreated: "organizer",
  MilestoneAttested: "attestor",
  CouncilApproved: "member",
  MilestoneReleased: "recipient",
  PayoutRecorded: "organizer",
};

/** The event argument naming a milestone's position; a beneficiary's `index` is not one. */
const MILESTONE_INDEX_ARG: Partial<Record<EventName, string>> = {
  MilestoneDefined: "index",
  MilestoneAttested: "index",
  MilestoneVerified: "index",
  CouncilApproved: "index",
  MilestoneReleased: "index",
  PayoutRecorded: "milestoneIndex",
};

const HAS_AMOUNT: ReadonlySet<EventName> = new Set(["DonationReceived", "MilestoneReleased", "PayoutRecorded"]);

/**
 * One payout to a beneficiary, as the Disbursement contract recorded it (FR-ESC-02). The beneficiary
 * appears only as their registry fingerprint and the off-ramp reference only as its hash, exactly as
 * they are public on-chain; neither can be turned back into a name or an account number.
 */
export interface PayoutEntry {
  id: string;
  milestoneIndex: number;
  amount: string;
  identityHash: string;
  payoutRef: string;
  organizer: string;
  blockNumber: number;
  timestamp: string;
  txHash: string;
}

/**
 * The money-and-milestone trail. Beneficiary registrations are counted (`vaultTotals`) but not listed:
 * each fingerprint is already public on the registry, and the ledger's columns are for actors and amounts.
 */
export function vaultLedger(db: Db, vault: string): LedgerEntry[] {
  return eventsForVault(db, vault).filter((e) => e.eventName !== "BeneficiaryRegistered").map((e) => {
    const args = JSON.parse(e.args) as Record<string, string>;
    const indexArg = MILESTONE_INDEX_ARG[e.eventName];
    return {
      id: e.id,
      type: e.eventName,
      milestoneIndex: indexArg && args[indexArg] !== undefined ? Number(args[indexArg]) : null,
      blockNumber: e.blockNumber,
      timestamp: e.blockTimestamp,
      txHash: e.txHash,
      actor: args[ACTOR_KEY[e.eventName] ?? ""] ?? "",
      amount: HAS_AMOUNT.has(e.eventName) ? (args.amount ?? "0") : null,
    };
  });
}

/** Every recorded payout for a vault, oldest first. */
export function vaultPayouts(db: Db, vault: string): PayoutEntry[] {
  return eventsForVault(db, vault)
    .filter((e) => e.eventName === "PayoutRecorded")
    .map((e) => {
      const args = JSON.parse(e.args) as Record<string, string>;
      return {
        id: e.id,
        milestoneIndex: Number(args.milestoneIndex),
        amount: args.amount,
        identityHash: args.identityHash,
        payoutRef: args.payoutRef,
        organizer: args.organizer,
        blockNumber: e.blockNumber,
        timestamp: e.blockTimestamp,
        txHash: e.txHash,
      };
    });
}

export function vaultTotals(db: Db, vault: string): VaultTotals {
  const events = eventsForVault(db, vault);
  const sum = (name: EventName) =>
    events.filter((e) => e.eventName === name).reduce((acc, e) => acc + BigInt((JSON.parse(e.args) as { amount: string }).amount), 0n);
  const donated = sum("DonationReceived");
  const released = sum("MilestoneReleased");
  const paidOut = sum("PayoutRecorded");
  const cursor = allCursors(db).find((c) => c.stream === `vault:${vault.toLowerCase()}`);
  return {
    vault: vault.toLowerCase(),
    totalDonated: donated.toString(),
    totalReleased: released.toString(),
    balance: (donated - released).toString(),
    totalPaidOut: paidOut.toString(),
    payoutCount: events.filter((e) => e.eventName === "PayoutRecorded").length,
    donationCount: events.filter((e) => e.eventName === "DonationReceived").length,
    beneficiaryCount: events.filter((e) => e.eventName === "BeneficiaryRegistered").length,
    indexedThroughBlock: cursor?.lastBlock ?? null,
  };
}

export interface IndexerStatus {
  /** Lowest block that every stream has been read through: all data is complete up to here. */
  indexedThroughBlock: number | null;
  headBlock: number | null;
  /** Blocks between the chain head and the indexed data, or null if unknown. */
  lagBlocks: number | null;
  vaultsTracked: number;
  lastUpdatedAt: string | null;
}

/** "Data as of block N" (SPDD 9.5): the dashboard shows this instead of silently serving stale data. */
export async function indexerStatus(db: Db, reader: Pick<ChainReader, "headBlock"> | null): Promise<IndexerStatus> {
  const cursors = allCursors(db);
  const indexedThroughBlock = cursors.length ? Math.min(...cursors.map((c) => c.lastBlock)) : null;
  let headBlock: number | null = null;
  try {
    headBlock = reader ? await reader.headBlock() : null;
  } catch {
    headBlock = null;
  }
  return {
    indexedThroughBlock,
    headBlock,
    lagBlocks: headBlock !== null && indexedThroughBlock !== null ? headBlock - indexedThroughBlock : null,
    vaultsTracked: knownVaults(db).length,
    lastUpdatedAt: cursors.length ? cursors.map((c) => c.updatedAt).sort().at(-1) ?? null : null,
  };
}

export interface ReconciliationRow {
  vault: string;
  checkedAtBlock: number;
  indexedBalance: string;
  vaultTrackedBalance: string;
  tokenBalance: string;
  /** Payouts, checked separately because they leave the organizer's wallet, not the vault. */
  payouts: PayoutCheck;
  /**
   * True only if the three vault balances agree exactly and the payout check passes. Any difference
   * is a release-blocking defect.
   */
  match: boolean;
}

export interface PayoutCheck {
  /** Every stream involved has been read through this block; both sides are counted up to it. */
  checkedAtBlock: number;
  indexedPaidOut: string;
  indexedReleased: string;
  /** `Disbursement.disbursedTotal(vault)` at that block; null when no payout contract is configured. */
  chainPaidOut: string | null;
  /** Payouts never exceed what the manager released (the contract enforces it; this proves it). */
  withinReleases: boolean;
  /** Indexed payouts equal the contract's own total; null when it could not be compared. */
  match: boolean | null;
}

/**
 * SPDD 21 / NFR-17: compare what the app derived from events against the chain itself, at the
 * same block, with zero tolerance. Reads both the vault's own accounting and the token balance.
 */
export async function reconcileVault(
  db: Db,
  reader: ChainReader,
  vault: string,
  disbursementStartBlock?: number,
): Promise<ReconciliationRow | null> {
  const totals = vaultTotals(db, vault);
  if (totals.indexedThroughBlock === null) return null;
  const { tracked, token } = await reader.vaultBalancesAt(vault, totals.indexedThroughBlock);
  const indexed = BigInt(totals.balance);
  const payouts = await checkPayouts(db, reader, vault, totals.indexedThroughBlock, disbursementStartBlock);
  return {
    vault: totals.vault,
    checkedAtBlock: totals.indexedThroughBlock,
    indexedBalance: indexed.toString(),
    vaultTrackedBalance: tracked.toString(),
    tokenBalance: token.toString(),
    payouts,
    match: indexed === tracked && tracked === token && payouts.withinReleases && payouts.match !== false,
  };
}

/**
 * Payouts <= releases, and indexed payouts == the Disbursement contract's own total, at one block.
 * The streams are read separately, so both sides are counted only up to the lowest block that the
 * vault, manager and disbursement streams have all reached; a lagging stream cannot fake a mismatch.
 */
async function checkPayouts(db: Db, reader: ChainReader, vault: string, vaultBlock: number, disbursementStartBlock?: number): Promise<PayoutCheck> {
  const cursors = allCursors(db);
  const reached = (stream: string) => cursors.find((c) => c.stream === stream)?.lastBlock;
  const block = Math.min(vaultBlock, ...[reached("manager"), reached("disbursement")].filter((b): b is number => b !== undefined));
  const upTo = eventsForVault(db, vault).filter((e) => e.blockNumber <= block);
  const sum = (name: EventName) =>
    upTo.filter((e) => e.eventName === name).reduce((acc, e) => acc + BigInt((JSON.parse(e.args) as { amount: string }).amount), 0n);
  const paidOut = sum("PayoutRecorded");
  const released = sum("MilestoneReleased");

  let chainPaidOut: bigint | null = null;
  if (disbursementStartBlock !== undefined && reader.disbursedTotalAt) {
    // Before the contract existed nothing could have been paid out through it (and reading it would fail).
    chainPaidOut = block >= disbursementStartBlock ? await reader.disbursedTotalAt(vault, block) : 0n;
  }
  return {
    checkedAtBlock: block,
    indexedPaidOut: paidOut.toString(),
    indexedReleased: released.toString(),
    chainPaidOut: chainPaidOut === null ? null : chainPaidOut.toString(),
    withinReleases: paidOut <= released,
    match: chainPaidOut === null ? null : chainPaidOut === paidOut,
  };
}
