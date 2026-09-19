import type { PublicUser } from "../auth/users";
import { ownerUserId } from "../campaigns/service";
import type { Db } from "../db";
import { milestones, type MilestoneActionRow } from "../db/schema";
import { eq } from "drizzle-orm";
import { prepareMilestone } from "./attestationCollector";
import type { EscrowChain } from "./chain-port";
import { fail, noSigner, performAction, roleIsSynced, signerFor, viewMilestone, type MilestoneView, type Outcome } from "./service";

/**
 * FR-GOV-01: a council member approves the release of a verified milestone. It matters only above
 * the automatic-release limit, but any member may approve any verified milestone. Sent from the
 * member's own wallet; the contract counts each member once, and the count is read back from it.
 */
export async function councilApprove(
  db: Db,
  chain: EscrowChain,
  user: PublicUser,
  milestoneId: string,
): Promise<Outcome<{ action: MilestoneActionRow; milestone: MilestoneView }>> {
  if (user.role !== "council" || !roleIsSynced(db, user.id, "council")) {
    return fail(403, "ROLE_NOT_SYNCED", "You are not a registered council member on the blockchain yet. Ask an admin to sync your role.");
  }
  const prepared = await prepareMilestone(db, chain, milestoneId);
  if (!prepared.ok) return prepared;
  if (prepared.view.state?.status !== "Verified") {
    return fail(409, "MILESTONE_NOT_READY", prepared.view.state?.status === "Released" ? "This milestone has already been released." : "This milestone is not verified yet, so there is nothing to approve.");
  }
  const signer = signerFor(db, user);
  if (!signer) return noSigner();

  const result = await performAction(db, chain, {
    milestoneId,
    kind: "council_approval",
    user,
    send: (onSent) => chain.councilApprove(signer, prepared.ctx.vault, prepared.ctx.milestone.sequenceOrder, onSent),
  });
  if (!result.ok) return result;
  return { ok: true, action: result.action, milestone: await viewMilestone(db, chain, prepared.ctx) };
}

/**
 * Releases a verified milestone's share to the campaign's organizer. The contract does the real
 * checking (all milestones defined, earlier ones released first, council approvals above the limit);
 * this pre-checks the obvious cases only to give a clear message before spending gas. Sent from the
 * sponsor wallet, because release is permissionless on-chain, but the app limits who may ask:
 * the campaign's organizer, a council member, or an admin.
 */
export async function releaseMilestone(
  db: Db,
  chain: EscrowChain,
  user: PublicUser,
  milestoneId: string,
): Promise<Outcome<{ action: MilestoneActionRow; milestone: MilestoneView }>> {
  const prepared = await prepareMilestone(db, chain, milestoneId);
  if (!prepared.ok) return prepared;
  const { ctx, view } = prepared;

  const isOwner = ownerUserId(db, ctx.campaign.id) === user.id;
  const allowed = user.role === "admin" || isOwner || (user.role === "council" && roleIsSynced(db, user.id, "council"));
  if (!allowed) return fail(403, "FORBIDDEN", "Only the campaign's organizer, a council member or an admin can trigger a release.");

  const state = view.state;
  if (!state || state.status === "Pending") return fail(409, "MILESTONE_NOT_READY", "This milestone is not verified yet.");
  if (state.status === "Released") return fail(409, "ALREADY_DONE", "This milestone has already been released.");
  if (BigInt(state.releasableAmount) > BigInt(state.autoReleaseLimit) && state.councilApprovals < state.councilThreshold) {
    return fail(409, "MILESTONE_NOT_READY", `This payout is above the automatic limit and needs ${state.councilThreshold} council approvals; it has ${state.councilApprovals}.`);
  }

  const result = await performAction(db, chain, {
    milestoneId,
    kind: "release",
    user,
    send: (onSent) => chain.release(ctx.vault, ctx.milestone.sequenceOrder, onSent),
  });
  if (!result.ok) return result;
  db.update(milestones).set({ status: "RELEASED" }).where(eq(milestones.id, milestoneId)).run();
  return { ok: true, action: result.action, milestone: await viewMilestone(db, chain, ctx) };
}
