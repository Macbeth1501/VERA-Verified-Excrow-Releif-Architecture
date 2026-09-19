import { randomUUID } from "node:crypto";
import { asc, desc, eq } from "drizzle-orm";
import type { Db } from "../db";
import { campaigns, milestones, organizerProfiles, type CampaignRow, type MilestoneRow } from "../db/schema";
import type { CreateCampaignInput } from "./validation";

export type ChainStatus = CampaignRow["chainStatus"];

export interface VaultDeployResult {
  status: ChainStatus;
  vaultAddress?: string;
  onchainCampaignId?: number;
  txHash?: string;
  error?: string;
}

export interface CampaignWithMilestones {
  id: string;
  organizerProfileId: string;
  title: string;
  summary: string;
  category: CampaignRow["category"];
  /** mINR minor units (6 decimals) as a string, per SPDD §12.1. */
  fundingGoalMinorUnits: string;
  adminExpenseCapPct: number;
  vaultContractAddress: string | null;
  onchainCampaignId: number | null;
  status: CampaignRow["status"];
  chainStatus: ChainStatus;
  chainTxHash: string | null;
  chainError: string | null;
  createdAt: string;
  milestones: Array<{
    id: string;
    description: string;
    targetPct: number;
    requiredAttestations: number;
    status: MilestoneRow["status"];
    sequenceOrder: number;
    /** Whether the MilestoneManager contract knows this milestone yet. */
    chainStatus: MilestoneRow["chainStatus"];
    chainError: string | null;
  }>;
}

export class CampaignNotFoundError extends Error {
  constructor() {
    super("Campaign not found");
  }
}

function toCampaign(row: CampaignRow, milestoneRows: MilestoneRow[]): CampaignWithMilestones {
  return {
    id: row.id,
    organizerProfileId: row.organizerProfileId,
    title: row.title,
    summary: row.summary,
    category: row.category,
    fundingGoalMinorUnits: row.fundingGoal,
    adminExpenseCapPct: row.adminExpenseCapPct,
    vaultContractAddress: row.vaultContractAddress,
    onchainCampaignId: row.onchainCampaignId,
    status: row.status,
    chainStatus: row.chainStatus,
    chainTxHash: row.chainTxHash,
    chainError: row.chainError,
    createdAt: row.createdAt,
    milestones: milestoneRows.map((m) => ({
      id: m.id,
      description: m.description,
      targetPct: m.targetPct,
      requiredAttestations: m.requiredAttestations,
      status: m.status,
      sequenceOrder: m.sequenceOrder,
      chainStatus: m.chainStatus,
      chainError: m.chainError,
    })),
  };
}

function milestonesFor(db: Db, campaignId: string): MilestoneRow[] {
  return db.select().from(milestones).where(eq(milestones.campaignId, campaignId)).orderBy(asc(milestones.sequenceOrder)).all();
}

/**
 * Saves the campaign and its milestones in one transaction. The campaign starts as DRAFT with no
 * vault address: it only becomes LIVE once CampaignFactory has deployed its vault
 * (`recordVaultDeploy`), so a campaign can never appear fundable without real escrow behind it.
 */
export function createCampaign(db: Db, organizerProfileId: string, input: CreateCampaignInput): CampaignWithMilestones {
  const id = randomUUID();
  db.transaction((tx) => {
    tx.insert(campaigns)
      .values({
        id,
        organizerProfileId,
        title: input.title,
        summary: input.summary,
        category: input.category,
        fundingGoal: input.fundingGoalMinorUnits,
        adminExpenseCapPct: input.adminExpenseCapPct,
        status: "DRAFT",
        chainStatus: "pending",
      })
      .run();
    input.milestones.forEach((m, index) => {
      tx.insert(milestones)
        .values({
          id: randomUUID(),
          campaignId: id,
          description: m.description,
          targetPct: m.targetPct,
          requiredAttestations: m.requiredAttestations,
          status: "PENDING",
          sequenceOrder: index,
        })
        .run();
    });
  });

  const saved = getCampaign(db, id);
  if (!saved) throw new Error("Campaign missing after insert");
  return saved;
}

export function getCampaign(db: Db, id: string): CampaignWithMilestones | null {
  const row = db.select().from(campaigns).where(eq(campaigns.id, id)).get();
  return row ? toCampaign(row, milestonesFor(db, id)) : null;
}

export function listByOrganizer(db: Db, organizerProfileId: string): CampaignWithMilestones[] {
  return db
    .select()
    .from(campaigns)
    .where(eq(campaigns.organizerProfileId, organizerProfileId))
    .orderBy(desc(campaigns.createdAt))
    .all()
    .map((row) => toCampaign(row, milestonesFor(db, row.id)));
}

/** Resolves which user owns a campaign, for authorization checks. */
export function ownerUserId(db: Db, campaignId: string): string | null {
  const row = db
    .select({ userId: organizerProfiles.userId })
    .from(campaigns)
    .innerJoin(organizerProfiles, eq(organizerProfiles.id, campaigns.organizerProfileId))
    .where(eq(campaigns.id, campaignId))
    .get();
  return row?.userId ?? null;
}

/**
 * Records the outcome of the on-chain vault deploy. Only a confirmed deploy sets the vault
 * address and flips the campaign to LIVE; anything else leaves it DRAFT and retryable, so the
 * database can never claim a vault that does not exist on-chain.
 */
export function recordVaultDeploy(db: Db, campaignId: string, result: VaultDeployResult): CampaignWithMilestones {
  const deployed = result.status === "deployed";
  db.update(campaigns)
    .set({
      chainStatus: result.status,
      chainTxHash: deployed ? (result.txHash ?? null) : null,
      chainError: result.status === "failed" ? (result.error ?? "unknown error") : null,
      ...(deployed
        ? {
            vaultContractAddress: result.vaultAddress ?? null,
            onchainCampaignId: result.onchainCampaignId ?? null,
            status: "LIVE" as const,
          }
        : {}),
    })
    .where(eq(campaigns.id, campaignId))
    .run();

  const updated = getCampaign(db, campaignId);
  if (!updated) throw new CampaignNotFoundError();
  return updated;
}

/** Every published campaign, newest first, for the public campaign list. */
export function listLive(db: Db): CampaignWithMilestones[] {
  return db
    .select()
    .from(campaigns)
    .where(eq(campaigns.status, "LIVE"))
    .orderBy(desc(campaigns.createdAt))
    .all()
    .map((row) => toCampaign(row, milestonesFor(db, row.id)));
}
