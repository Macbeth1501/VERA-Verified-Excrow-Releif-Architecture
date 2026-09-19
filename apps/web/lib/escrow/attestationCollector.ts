import type { PublicUser } from "../auth/users";
import type { Db } from "../db";
import type { MilestoneActionRow } from "../db/schema";
import type { EscrowChain } from "./chain-port";
import {
  fail,
  loadMilestone,
  noSigner,
  performAction,
  roleIsSynced,
  signerFor,
  viewMilestone,
  type MilestoneContext,
  type MilestoneView,
  type Outcome,
} from "./service";

export type Prepared = { ok: true; ctx: MilestoneContext; view: MilestoneView } | Extract<Outcome<object>, { ok: false }>;

/**
 * Common groundwork for anything that acts on a milestone: it exists on a live campaign, the
 * escrow is configured, the contract already knows the milestone, and its state was readable.
 */
export async function prepareMilestone(db: Db, chain: EscrowChain, milestoneId: string): Promise<Prepared> {
  const ctx = loadMilestone(db, milestoneId);
  if (!ctx) return fail(404, "MILESTONE_NOT_FOUND", "Milestone not found, or its campaign is not live.");
  if (!chain.configured()) return fail(503, "ESCROW_NOT_CONFIGURED", "Milestone actions are switched off: the milestone manager or the sponsor wallet is not configured.");
  const view = await viewMilestone(db, chain, ctx);
  if (!view.definedOnChain) {
    return fail(409, "MILESTONE_NOT_READY", view.chainError ?? "This milestone has not been registered on the blockchain yet. The organizer needs to finish publishing.");
  }
  if (!view.state) return fail(503, "CHAIN_UNAVAILABLE", "The blockchain could not be read. Try again in a moment.");
  return { ok: true, ctx, view };
}

/**
 * FR-ESC-01: a trusted attestor confirms a milestone is complete, with a hash of the evidence they
 * reviewed (the evidence itself never leaves their browser). The transaction is sent from the
 * attestor's own wallet. The contract counts each attestor once, rejects the campaign's own
 * organizer, and flips the milestone to Verified when the required number is reached; this
 * function only reads that result back.
 */
export async function submitAttestation(
  db: Db,
  chain: EscrowChain,
  user: PublicUser,
  milestoneId: string,
  proofHash: string,
): Promise<Outcome<{ action: MilestoneActionRow; milestone: MilestoneView }>> {
  if (user.role !== "attestor" || !roleIsSynced(db, user.id, "attestor")) {
    return fail(403, "ROLE_NOT_SYNCED", "You are not a registered attestor on the blockchain yet. Ask an admin to sync your role.");
  }
  const prepared = await prepareMilestone(db, chain, milestoneId);
  if (!prepared.ok) return prepared;
  if (prepared.view.state?.status !== "Pending") {
    return fail(409, "MILESTONE_NOT_READY", "This milestone already has enough confirmations.");
  }
  const signer = signerFor(db, user);
  if (!signer) return noSigner();

  const result = await performAction(db, chain, {
    milestoneId,
    kind: "attestation",
    user,
    proofHash,
    send: (onSent) => chain.submitAttestation(signer, prepared.ctx.vault, prepared.ctx.milestone.sequenceOrder, proofHash, onSent),
  });
  if (!result.ok) return result;
  return { ok: true, action: result.action, milestone: await viewMilestone(db, chain, prepared.ctx) };
}
