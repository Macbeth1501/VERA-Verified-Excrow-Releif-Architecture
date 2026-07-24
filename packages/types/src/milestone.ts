/**
 * Milestone lifecycle status: Pending -> Verified -> Released.
 * A milestone cannot reach RELEASED without meeting its M-of-N
 * attestation threshold — enforced on-chain, not just here.
 * Ref: FR-ESC-01, SPDD §17.1, §18.3
 */
export enum MilestoneStatus {
  PENDING = "PENDING",
  VERIFIED = "VERIFIED",
  RELEASED = "RELEASED",
}

/**
 * Mirrors the MILESTONES table (SPDD §11.2).
 * `requiredAttestations` / `attestationCount` implement the M-of-N
 * logic from §17.1.
 * Ref: FR-ESC-01
 */
export interface Milestone {
  id: string;
  campaignId: string;
  description: string;
  targetPct: number; // % of campaign fundingGoal; all milestones per campaign sum to 100
  requiredAttestations: number; // M in M-of-N
  attestationCount: number; // current count toward threshold
  status: MilestoneStatus;
  sequenceOrder: number;
}
