import { and, count, desc, eq, type SQL } from "drizzle-orm";
import type { Db } from "../db";
import { campaigns, chainEvents, type ChainEventRow } from "../db/schema";
import { formatMinorUnits } from "../campaigns/money";
import type { EventName } from "../indexer/types";

/** Every kind of on-chain event the indexer reads, in the order a campaign's life usually runs. */
export const ACTIVITY_TYPES: readonly EventName[] = [
  "CampaignCreated",
  "DonationReceived",
  "MilestoneDefined",
  "MilestoneAttested",
  "MilestoneVerified",
  "CouncilApproved",
  "MilestoneReleased",
  "BeneficiaryRegistered",
  "PayoutRecorded",
];

export const ACTIVITY_TITLE: Record<EventName, string> = {
  CampaignCreated: "Campaign escrow created",
  DonationReceived: "Donation received",
  MilestoneDefined: "Milestone registered",
  MilestoneAttested: "Milestone confirmed by an attestor",
  MilestoneVerified: "Milestone verified",
  CouncilApproved: "Council approval",
  MilestoneReleased: "Funds released",
  BeneficiaryRegistered: "Beneficiary registered",
  PayoutRecorded: "Payout to a beneficiary",
};

/** The deployed contracts, so a row can say which one emitted the event. */
export interface KnownContracts {
  factory?: string;
  manager?: string;
  registry?: string;
  disbursement?: string;
}

export interface ActivityRow {
  /** Unique per event: txHash:logIndex. */
  id: string;
  type: EventName;
  title: string;
  /** One plain sentence about what happened. */
  detail: string;
  /** Which contract emitted it: CampaignFactory, MilestoneManager, ..., or "Campaign vault". */
  contract: string;
  contractAddress: string;
  vault: string;
  /** The app campaign this vault belongs to, or null for a vault the app did not publish. */
  campaignId: string | null;
  campaignTitle: string | null;
  /** 1-based, as a person counts milestones; null for events that are not about one. */
  milestoneNumber: number | null;
  actor: string | null;
  /** mINR minor units; only donations, releases and payouts carry one. */
  amount: string | null;
  blockNumber: number;
  timestamp: string;
  txHash: string;
}

export interface ActivityQuery {
  campaignId?: string;
  type?: EventName;
  /** Page size, 1 to 200 (default 50). */
  limit?: number;
  offset?: number;
}

export interface ActivityPage {
  rows: ActivityRow[];
  /** Events matching the filter, across all pages. */
  total: number;
  limit: number;
  offset: number;
  /** How many events of each type exist in total (ignores the filter), for the filter menu. */
  countsByType: Record<EventName, number>;
}

const short = (address: string) => (address.length > 12 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address);

const ACTOR_KEY: Partial<Record<EventName, string>> = {
  DonationReceived: "donor",
  CampaignCreated: "organizer",
  MilestoneAttested: "attestor",
  CouncilApproved: "member",
  MilestoneReleased: "recipient",
  PayoutRecorded: "organizer",
};

const MILESTONE_INDEX_ARG: Partial<Record<EventName, string>> = {
  MilestoneDefined: "index",
  MilestoneAttested: "index",
  MilestoneVerified: "index",
  CouncilApproved: "index",
  MilestoneReleased: "index",
  PayoutRecorded: "milestoneIndex",
};

const HAS_AMOUNT: ReadonlySet<EventName> = new Set(["DonationReceived", "MilestoneReleased", "PayoutRecorded"]);

function contractLabel(row: ChainEventRow, known: KnownContracts): string {
  const at = row.contractAddress.toLowerCase();
  if (known.factory && at === known.factory.toLowerCase()) return "CampaignFactory";
  if (known.manager && at === known.manager.toLowerCase()) return "MilestoneManager";
  if (known.registry && at === known.registry.toLowerCase()) return "BeneficiaryRegistry";
  if (known.disbursement && at === known.disbursement.toLowerCase()) return "Disbursement";
  if (at === row.vaultAddress.toLowerCase()) return "Campaign vault";
  return "Contract";
}

const capitalise = (s: string) => `${s[0].toUpperCase()}${s.slice(1)}`;

/** A plain-language sentence for an event. Identity fingerprints and payout references are never repeated here. */
export function describeEvent(
  type: EventName,
  p: { actor: string | null; amount: string | null; milestoneNumber: number | null; campaignTitle: string | null },
): string {
  const who = p.actor ? short(p.actor) : "someone";
  const ms = p.milestoneNumber !== null ? `milestone ${p.milestoneNumber}` : "a milestone";
  const amt = p.amount !== null ? formatMinorUnits(p.amount) : "";
  const camp = p.campaignTitle ? ` for "${p.campaignTitle}"` : "";
  switch (type) {
    case "CampaignCreated":
      return `An escrow account was opened${camp} by organizer ${who}.`;
    case "DonationReceived":
      return `${amt} was donated${camp} by ${who}.`;
    case "MilestoneDefined":
      return `${capitalise(ms)} was registered on the milestone manager${camp}.`;
    case "MilestoneAttested":
      return `Attestor ${who} confirmed ${ms}${camp}.`;
    case "MilestoneVerified":
      return `${capitalise(ms)} reached its required confirmations${camp}.`;
    case "CouncilApproved":
      return `Council member ${who} approved the release of ${ms}${camp}.`;
    case "MilestoneReleased":
      return `${amt} was released to the organizer${p.actor ? ` (${who})` : ""} for ${ms}${camp}.`;
    case "BeneficiaryRegistered":
      return `A beneficiary was registered${camp}. Only an anonymous fingerprint is stored, never their identity.`;
    case "PayoutRecorded":
      return `${amt} was paid to a registered beneficiary for ${ms}${camp}.`;
  }
}

function toRow(e: ChainEventRow, known: KnownContracts, byVault: Map<string, { id: string; title: string }>): ActivityRow {
  const args = JSON.parse(e.args) as Record<string, string>;
  const indexArg = MILESTONE_INDEX_ARG[e.eventName];
  const milestoneNumber = indexArg && args[indexArg] !== undefined ? Number(args[indexArg]) + 1 : null;
  const actor = args[ACTOR_KEY[e.eventName] ?? ""] ?? null;
  const amount = HAS_AMOUNT.has(e.eventName) ? (args.amount ?? "0") : null;
  const campaign = byVault.get(e.vaultAddress.toLowerCase()) ?? null;
  return {
    id: e.id,
    type: e.eventName,
    title: ACTIVITY_TITLE[e.eventName],
    detail: describeEvent(e.eventName, { actor, amount, milestoneNumber, campaignTitle: campaign?.title ?? null }),
    contract: contractLabel(e, known),
    contractAddress: e.contractAddress,
    vault: e.vaultAddress,
    campaignId: campaign?.id ?? null,
    campaignTitle: campaign?.title ?? null,
    milestoneNumber,
    actor,
    amount,
    blockNumber: e.blockNumber,
    timestamp: e.blockTimestamp,
    txHash: e.txHash,
  };
}

/** All indexed on-chain activity across every campaign and contract, newest first. Reads only the indexer's events. */
export function listActivity(db: Db, known: KnownContracts, query: ActivityQuery = {}): ActivityPage {
  const limit = Math.min(Math.max(Math.trunc(query.limit ?? 50), 1), 200);
  const offset = Math.max(Math.trunc(query.offset ?? 0), 0);

  const campaignRows = db.select({ id: campaigns.id, title: campaigns.title, vault: campaigns.vaultContractAddress }).from(campaigns).all();
  const byVault = new Map<string, { id: string; title: string }>();
  for (const c of campaignRows) if (c.vault) byVault.set(c.vault.toLowerCase(), { id: c.id, title: c.title });

  const countsByType = Object.fromEntries(ACTIVITY_TYPES.map((t) => [t, 0])) as Record<EventName, number>;
  for (const r of db.select({ name: chainEvents.eventName, n: count() }).from(chainEvents).groupBy(chainEvents.eventName).all()) countsByType[r.name] = r.n;

  const conditions: SQL[] = [];
  if (query.type) conditions.push(eq(chainEvents.eventName, query.type));
  if (query.campaignId) {
    const vault = campaignRows.find((c) => c.id === query.campaignId)?.vault;
    // An unknown campaign, or one with no vault yet, matches nothing rather than everything.
    if (!vault) return { rows: [], total: 0, limit, offset, countsByType };
    conditions.push(eq(chainEvents.vaultAddress, vault.toLowerCase()));
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const total = db.select({ n: count() }).from(chainEvents).where(where).get()?.n ?? 0;
  const events = db.select().from(chainEvents).where(where).orderBy(desc(chainEvents.blockNumber), desc(chainEvents.logIndex)).limit(limit).offset(offset).all();

  return { rows: events.map((e) => toRow(e, known, byVault)), total, limit, offset, countsByType };
}

export function isEventName(value: string | null | undefined): value is EventName {
  return typeof value === "string" && (ACTIVITY_TYPES as readonly string[]).includes(value);
}
