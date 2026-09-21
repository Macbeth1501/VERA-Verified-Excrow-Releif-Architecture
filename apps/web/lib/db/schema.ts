import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * USERS table (SPDD §11.2). Column names are snake_case per SPDD §14.
 * Fund-related figures are never stored here (SPDD §11.1) — balances are read from the chain.
 */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  /** sha256 of the normalised email; UNIQUE, backs the duplicate-account check. */
  emailHash: text("email_hash").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  walletAddress: text("wallet_address").notNull(),
  /** "generated" = created in-app (key stored encrypted); "external" = donor's own address. */
  walletType: text("wallet_type", { enum: ["generated", "external"] }).notNull(),
  /** AES-GCM encrypted private key; null for external wallets. */
  walletKeyEnc: text("wallet_key_enc"),
  role: text("role", { enum: ["donor", "organizer", "attestor", "council", "admin"] })
    .notNull()
    .default("donor"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
});

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;

/**
 * ORGANIZER_PROFILES table (SPDD §11.2), the mock-KYB record behind FR-IDN-02.
 * `kybStatus` is the authority for "may this user create campaigns". The supporting document is
 * hashed in the browser; only the hash and file name are stored, never the file itself.
 */
export const organizerProfiles = sqliteTable("organizer_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id),
  legalName: text("legal_name").notNull(),
  registrationNumber: text("registration_number").notNull(),
  jurisdiction: text("jurisdiction").notNull(),
  documentHash: text("document_hash").notNull(),
  documentName: text("document_name").notNull(),
  kybStatus: text("kyb_status", { enum: ["pending", "verified", "rejected"] })
    .notNull()
    .default("pending"),
  rejectionReason: text("rejection_reason"),
  reviewedBy: text("reviewed_by").references(() => users.id),
  reviewedAt: text("reviewed_at"),
  /** Result of mirroring an approval to CampaignFactory.setOrganizerVerified on-chain. */
  chainSync: text("chain_sync", { enum: ["none", "not_configured", "synced", "failed"] })
    .notNull()
    .default("none"),
  chainTxHash: text("chain_tx_hash"),
  chainError: text("chain_error"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
});

export type OrganizerProfileRow = typeof organizerProfiles.$inferSelect;

/**
 * CAMPAIGNS table (SPDD §11.2). Descriptive metadata only: no balances or totals raised, which
 * are read-only projections from the chain (SPDD §11.1). `fundingGoal` is stored as a decimal
 * string in mINR minor units (6 decimals) per SPDD §12.1.
 */
export const campaigns = sqliteTable("campaigns", {
  id: text("id").primaryKey(),
  organizerProfileId: text("organizer_profile_id")
    .notNull()
    .references(() => organizerProfiles.id),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  category: text("category", { enum: ["DISASTER_RELIEF", "MEDICAL", "COMMUNITY"] }).notNull(),
  fundingGoal: text("funding_goal").notNull(),
  adminExpenseCapPct: integer("admin_expense_cap_pct").notNull(),
  /** Null until the on-chain vault deploy succeeds. */
  vaultContractAddress: text("vault_contract_address"),
  /** Campaign id assigned by CampaignFactory, null until deployed. */
  onchainCampaignId: integer("onchain_campaign_id"),
  status: text("status", { enum: ["DRAFT", "VERIFIED", "LIVE", "PAUSED", "COMPLETED"] })
    .notNull()
    .default("DRAFT"),
  /** Result of deploying the vault through CampaignFactory. */
  chainStatus: text("chain_status", { enum: ["pending", "not_configured", "deployed", "failed"] })
    .notNull()
    .default("pending"),
  chainTxHash: text("chain_tx_hash"),
  chainError: text("chain_error"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
});

/**
 * MILESTONES table (SPDD §11.2). `targetPct` values for one campaign must sum to exactly 100 —
 * enforced in the UI, in the API, and authoritatively by CampaignFactory (SPDD §19.2).
 * `attestationCount` is deliberately absent: it is chain-derived (Step 11).
 */
export const milestones = sqliteTable("milestones", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id")
    .notNull()
    .references(() => campaigns.id),
  description: text("description").notNull(),
  targetPct: integer("target_pct").notNull(),
  requiredAttestations: integer("required_attestations").notNull(),
  status: text("status", { enum: ["PENDING", "VERIFIED", "RELEASED"] })
    .notNull()
    .default("PENDING"),
  sequenceOrder: integer("sequence_order").notNull(),
  /**
   * Whether this milestone has been defined on the MilestoneManager. It is defined in order, so
   * once "defined" its on-chain index equals `sequenceOrder`.
   */
  chainStatus: text("chain_status", { enum: ["none", "defined", "failed"] })
    .notNull()
    .default("none"),
  chainTxHash: text("chain_tx_hash"),
  chainError: text("chain_error"),
});

export type CampaignRow = typeof campaigns.$inferSelect;
export type MilestoneRow = typeof milestones.$inferSelect;

/**
 * CHAIN_EVENTS: an append-only copy of on-chain events (SPDD §9.5, §11.1). This is the ONLY
 * source of money figures in the app: totals are computed from these rows, never stored or
 * edited elsewhere. Only `lib/indexer` writes to this table. `id` is `txHash:logIndex`, so
 * re-reading the same range is idempotent.
 */
export const chainEvents = sqliteTable("chain_events", {
  id: text("id").primaryKey(),
  eventName: text("event_name", {
    enum: [
      "CampaignCreated",
      "DonationReceived",
      "MilestoneDefined",
      "MilestoneAttested",
      "MilestoneVerified",
      "CouncilApproved",
      "MilestoneReleased",
    ],
  }).notNull(),
  /** Contract that emitted the event. */
  contractAddress: text("contract_address").notNull(),
  /** The campaign vault this event belongs to (the emitter for vault events). */
  vaultAddress: text("vault_address").notNull(),
  blockNumber: integer("block_number").notNull(),
  blockTimestamp: text("block_timestamp").notNull(),
  txHash: text("tx_hash").notNull(),
  logIndex: integer("log_index").notNull(),
  /** Decoded event arguments as JSON; bigints are decimal strings. */
  args: text("args").notNull(),
});

/**
 * INDEXER_CURSORS: how far each stream has been read. `stream` is "factory" or
 * "vault:<address>". Blocks up to and including `lastBlock` have been fully read.
 */
export const indexerCursors = sqliteTable("indexer_cursors", {
  stream: text("stream").primaryKey(),
  lastBlock: integer("last_block").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type ChainEventRow = typeof chainEvents.$inferSelect;

/**
 * DONATIONS table (SPDD §11.2). A record of a donor's intent and its progress through the
 * mint -> approve -> deposit steps. It is NOT a source of money figures: totals are derived from
 * chain events (SPDD §11.1). `status` becomes CONFIRMED only after the deposit transaction's
 * receipt is read from the chain and its DonationReceived event is verified (SPDD §8.9).
 */
export const donations = sqliteTable("donations", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id")
    .notNull()
    .references(() => campaigns.id),
  donorUserId: text("donor_user_id")
    .notNull()
    .references(() => users.id),
  /** Amount going to the vault, in mINR minor units (6 decimals), as a string. */
  amountMinorUnits: text("amount_minor_units").notNull(),
  /** Flat fee paid on top, or "0". */
  feeMinorUnits: text("fee_minor_units").notNull().default("0"),
  status: text("status", { enum: ["PENDING", "CONFIRMED", "FAILED"] })
    .notNull()
    .default("PENDING"),
  /** The next thing to do; "done" once the deposit is confirmed. */
  step: text("step", { enum: ["gas", "mint", "approve", "deposit", "fee", "done"] })
    .notNull()
    .default("gas"),
  gasTxHash: text("gas_tx_hash"),
  mintTxHash: text("mint_tx_hash"),
  approveTxHash: text("approve_tx_hash"),
  /** UNIQUE (SPDD §11.4): a deposit can never be counted as two donations. */
  onchainTxHash: text("onchain_tx_hash").unique(),
  feeTxHash: text("fee_tx_hash"),
  error: text("error"),
  /** Epoch ms until which one worker owns this donation; stops two requests running one step twice. */
  lockedUntil: integer("locked_until").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  confirmedAt: text("confirmed_at"),
});

export type DonationRow = typeof donations.$inferSelect;

/**
 * ROLE_GRANTS: who the admin has made an attestor or council member (SPDD 8.7), and whether that
 * was mirrored on the MilestoneManager (the contract, not this table, decides who may act).
 */
export const roleGrants = sqliteTable(
  "role_grants",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role", { enum: ["attestor", "council"] }).notNull(),
    chainSync: text("chain_sync", { enum: ["none", "not_configured", "synced", "failed"] })
      .notNull()
      .default("none"),
    chainTxHash: text("chain_tx_hash"),
    chainError: text("chain_error"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  },
  (t) => [uniqueIndex("role_grants_user_role").on(t.userId, t.role)],
);

export type RoleGrantRow = typeof roleGrants.$inferSelect;

/**
 * MILESTONE_ACTIONS: every attestation, council approval and release someone asked the app to
 * send (SPDD ATTESTATIONS table, extended for Step 12). A record of the request and its
 * transaction; the counts and status that matter are read from the chain, never from here.
 * One row per (milestone, kind, actor), so nobody is counted twice; a FAILED row is reused on retry.
 */
export const milestoneActions = sqliteTable(
  "milestone_actions",
  {
    id: text("id").primaryKey(),
    milestoneId: text("milestone_id")
      .notNull()
      .references(() => milestones.id),
    kind: text("kind", { enum: ["attestation", "council_approval", "release"] }).notNull(),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => users.id),
    actorAddress: text("actor_address").notNull(),
    /** Attestations only: hash of the evidence the attestor reviewed (the file stays in the browser). */
    proofHash: text("proof_hash"),
    status: text("status", { enum: ["PENDING", "CONFIRMED", "FAILED"] })
      .notNull()
      .default("PENDING"),
    txHash: text("tx_hash"),
    error: text("error"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  },
  (t) => [uniqueIndex("milestone_actions_once").on(t.milestoneId, t.kind, t.actorAddress)],
);

export type MilestoneActionRow = typeof milestoneActions.$inferSelect;

/**
 * CAMPAIGN_SALTS: the random per-campaign ("program") salt that beneficiary fingerprints are hashed
 * with in the browser (SPDD 17.2). It lives in its own table, not as a column on `campaigns`, because
 * routes return campaign rows wholesale and the salt must only ever be handed to the campaign's
 * organizer. One row per campaign, created on first use so older campaigns get one too.
 */
export const campaignSalts = sqliteTable("campaign_salts", {
  campaignId: text("campaign_id")
    .primaryKey()
    .references(() => campaigns.id),
  salt: text("salt").notNull(),
});

/**
 * BENEFICIARIES (SPDD 11.2, FR-IDN-03). `identityHash` is a client-side salted SHA-256 (0x plus 64
 * hex): the platform never receives or stores raw beneficiary PII. The unique index is the database
 * half of defence in depth; BeneficiaryRegistry re-checks it on-chain. `chainStatus` follows the
 * same rule as milestone actions: the hash is saved before waiting, and an unknown outcome stays PENDING.
 */
export const beneficiaries = sqliteTable(
  "beneficiaries",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    identityHash: text("identity_hash").notNull(),
    /** Optional fingerprint of a photo; the photo itself is never uploaded. */
    photoHash: text("photo_hash"),
    /** Provider-agnostic label for the simulated off-ramp (e.g. "bank transfer"). */
    payoutMethod: text("payout_method").notNull(),
    registeredByUserId: text("registered_by_user_id")
      .notNull()
      .references(() => users.id),
    chainStatus: text("chain_status", { enum: ["PENDING", "CONFIRMED", "FAILED"] })
      .notNull()
      .default("PENDING"),
    chainTxHash: text("chain_tx_hash"),
    chainError: text("chain_error"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  },
  (t) => [uniqueIndex("beneficiaries_once").on(t.campaignId, t.identityHash)],
);

export type BeneficiaryRow = typeof beneficiaries.$inferSelect;
