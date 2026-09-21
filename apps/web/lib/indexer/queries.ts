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
  /** mINR minor units (6 decimals); only donations and releases carry one. */
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
};

/** Events whose `index` argument is a milestone's position (a beneficiary's `index` is not). */
const MILESTONE_EVENTS: ReadonlySet<EventName> = new Set([
  "MilestoneDefined", "MilestoneAttested", "MilestoneVerified", "CouncilApproved", "MilestoneReleased",
]);

/**
 * The money-and-milestone trail. Beneficiary registrations are counted (`vaultTotals`) but not listed:
 * each fingerprint is already public on the registry, and the ledger's columns are for actors and amounts.
 */
export function vaultLedger(db: Db, vault: string): LedgerEntry[] {
  return eventsForVault(db, vault).filter((e) => e.eventName !== "BeneficiaryRegistered").map((e) => {
    const args = JSON.parse(e.args) as Record<string, string>;
    const hasAmount = e.eventName === "DonationReceived" || e.eventName === "MilestoneReleased";
    return {
      id: e.id,
      type: e.eventName,
      milestoneIndex: MILESTONE_EVENTS.has(e.eventName) && args.index !== undefined ? Number(args.index) : null,
      blockNumber: e.blockNumber,
      timestamp: e.blockTimestamp,
      txHash: e.txHash,
      actor: args[ACTOR_KEY[e.eventName] ?? ""] ?? "",
      amount: hasAmount ? (args.amount ?? "0") : null,
    };
  });
}

export function vaultTotals(db: Db, vault: string): VaultTotals {
  const events = eventsForVault(db, vault);
  const sum = (name: EventName) =>
    events.filter((e) => e.eventName === name).reduce((acc, e) => acc + BigInt((JSON.parse(e.args) as { amount: string }).amount), 0n);
  const donated = sum("DonationReceived");
  const released = sum("MilestoneReleased");
  const cursor = allCursors(db).find((c) => c.stream === `vault:${vault.toLowerCase()}`);
  return {
    vault: vault.toLowerCase(),
    totalDonated: donated.toString(),
    totalReleased: released.toString(),
    balance: (donated - released).toString(),
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
  /** True only if all three agree exactly. Any difference is a release-blocking defect. */
  match: boolean;
}

/**
 * SPDD 21 / NFR-17: compare what the app derived from events against the chain itself, at the
 * same block, with zero tolerance. Reads both the vault's own accounting and the token balance.
 */
export async function reconcileVault(db: Db, reader: ChainReader, vault: string): Promise<ReconciliationRow | null> {
  const totals = vaultTotals(db, vault);
  if (totals.indexedThroughBlock === null) return null;
  const { tracked, token } = await reader.vaultBalancesAt(vault, totals.indexedThroughBlock);
  const indexed = BigInt(totals.balance);
  return {
    vault: totals.vault,
    checkedAtBlock: totals.indexedThroughBlock,
    indexedBalance: indexed.toString(),
    vaultTrackedBalance: tracked.toString(),
    tokenBalance: token.toString(),
    match: indexed === tracked && tracked === token,
  };
}
