import type { Milestone } from "./milestone";

/**
 * Campaign category. Each carries its own admin-expense ceiling,
 * enforced on-chain by MilestoneManager.
 * Ref: FR-CMP-01, SPDD §18.3
 */
export enum CampaignCategory {
  DISASTER_RELIEF = "DISASTER_RELIEF",
  MEDICAL = "MEDICAL",
  COMMUNITY = "COMMUNITY",
}

/**
 * Campaign lifecycle status.
 * Ref: SPDD §8.6 (Control Flow state diagram)
 */
export enum CampaignStatus {
  DRAFT = "DRAFT",
  VERIFIED = "VERIFIED",
  LIVE = "LIVE",
  PAUSED = "PAUSED", // optional demo pause() concept — SPDD §18.2 / §20.2
  COMPLETED = "COMPLETED",
}

/**
 * Mirrors the CAMPAIGNS table (SPDD §11.2).
 * Off-chain descriptive metadata only. Fund-related figures (balance,
 * total raised) are never stored here directly — they are read-only
 * projections maintained by the indexer (SPDD §11.1).
 * Ref: FR-CMP-01
 */
export interface Campaign {
  id: string;
  organizerId: string;
  title: string;
  category: CampaignCategory;
  fundingGoal: number;
  adminExpenseCapPct: number;
  vaultContractAddress: string | null; // null until on-chain deploy succeeds
  status: CampaignStatus;
  createdAt: string; // ISO 8601

  // Optional: populated on joined API responses, e.g. GET /campaigns/:id
  milestones?: Milestone[];
}
