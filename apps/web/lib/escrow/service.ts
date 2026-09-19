import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { getWalletKeyEnc } from "../auth/users";
import type { PublicUser } from "../auth/users";
import { ownerUserId } from "../campaigns/service";
import type { Db } from "../db";
import {
  campaigns,
  milestoneActions,
  milestones,
  roleGrants,
  users,
  type CampaignRow,
  type MilestoneActionRow,
  type MilestoneRow,
  type RoleGrantRow,
} from "../db/schema";
import type { EscrowChain, MilestoneState, Signer, Tx } from "./chain-port";

/**
 * Shared escrow machinery for Steps 11 and 12 (FR-ESC-01, FR-GOV-01). The MilestoneManager contract
 * decides everything that matters (who may attest, how many confirmations, when money moves); this
 * layer records who asked for what, saves each transaction hash before waiting on it, and reads
 * the resulting state back from the chain. Nothing here stores a count or a status the chain owns.
 */

export type EscrowFailure = {
  ok: false;
  status: number;
  code:
    | "MILESTONE_NOT_FOUND"
    | "ESCROW_NOT_CONFIGURED"
    | "MILESTONE_NOT_READY"
    | "ROLE_NOT_SYNCED"
    | "ALREADY_DONE"
    | "ACTION_PENDING"
    | "CHAIN_UNAVAILABLE"
    | "CHAIN_FAILED"
    | "FORBIDDEN"
    | "USER_NOT_FOUND"
    | "VALIDATION_FAILED";
  message: string;
};

export type Outcome<T> = ({ ok: true } & T) | EscrowFailure;

export const fail = (status: number, code: EscrowFailure["code"], message: string): EscrowFailure => ({ ok: false, status, code, message });

export interface MilestoneContext {
  milestone: MilestoneRow;
  campaign: CampaignRow;
  vault: string;
}

/** A milestone and the campaign it belongs to; only published (LIVE, vault deployed) campaigns qualify. */
export function loadMilestone(db: Db, milestoneId: string): MilestoneContext | null {
  const milestone = db.select().from(milestones).where(eq(milestones.id, milestoneId)).get();
  if (!milestone) return null;
  const campaign = db.select().from(campaigns).where(eq(campaigns.id, milestone.campaignId)).get();
  if (!campaign || campaign.status !== "LIVE" || !campaign.vaultContractAddress) return null;
  return { milestone, campaign, vault: campaign.vaultContractAddress };
}

export function signerFor(db: Db, user: Pick<PublicUser, "id" | "walletAddress">): Signer | null {
  const keyEnc = getWalletKeyEnc(db, user.id);
  return keyEnc ? { address: user.walletAddress, keyEnc } : null;
}

const notMine = "This account uses its own wallet, which the server cannot sign for.";
export const noSigner = () => fail(409, "FORBIDDEN", notMine);

// ------------------------------------------------------------------ roles (admin)

export type RoleKind = RoleGrantRow["role"];

export interface RoleGrantView {
  id: string;
  email: string;
  walletAddress: string;
  role: RoleKind;
  chainSync: RoleGrantRow["chainSync"];
  chainError: string | null;
  chainTxHash: string | null;
}

export function listRoleGrants(db: Db): RoleGrantView[] {
  return db
    .select({
      id: roleGrants.id,
      email: users.email,
      walletAddress: users.walletAddress,
      role: roleGrants.role,
      chainSync: roleGrants.chainSync,
      chainError: roleGrants.chainError,
      chainTxHash: roleGrants.chainTxHash,
    })
    .from(roleGrants)
    .innerJoin(users, eq(users.id, roleGrants.userId))
    .orderBy(asc(roleGrants.createdAt))
    .all();
}

function recordSync(db: Db, grantId: string, tx: Tx | "not_configured") {
  db.update(roleGrants)
    .set(
      tx === "not_configured"
        ? { chainSync: "not_configured", chainError: null }
        : tx.ok
          ? { chainSync: "synced", chainTxHash: tx.txHash, chainError: null }
          : { chainSync: "failed", chainError: tx.error },
    )
    .where(eq(roleGrants.id, grantId))
    .run();
}

/**
 * Admin: make a user an attestor or council member, or take the role away. The database decision
 * is saved first and mirrored on the contract afterwards (retry by repeating the call). A
 * revocation goes the other way round, contract first, so power is never left on-chain after the
 * app believes it is gone. Organizers and admins cannot hold either role (conflict of interest),
 * and nobody holds both (SPDD §8.7: no single class may dominate).
 */
export async function setRole(
  db: Db,
  chain: EscrowChain,
  input: { email: string; role: RoleKind; active: boolean },
): Promise<Outcome<{ grant: RoleGrantView }>> {
  const email = input.email.trim().toLowerCase();
  const user = db.select().from(users).where(eq(users.email, email)).get();
  if (!user) return fail(404, "USER_NOT_FOUND", "No account with that email.");

  const existing = db.select().from(roleGrants).where(and(eq(roleGrants.userId, user.id), eq(roleGrants.role, input.role))).get();

  if (!input.active) {
    if (!existing) return fail(404, "USER_NOT_FOUND", `That account is not ${input.role === "attestor" ? "an attestor" : "a council member"}.`);
    if (chain.configured()) {
      const tx = await chain.setRole(input.role, user.walletAddress, false);
      if (!tx.ok) return fail(502, "CHAIN_FAILED", `Could not remove the role on the contract: ${tx.error}`);
    }
    db.transaction((t) => {
      t.delete(roleGrants).where(eq(roleGrants.id, existing.id)).run();
      if (user.role === input.role) t.update(users).set({ role: "donor" }).where(eq(users.id, user.id)).run();
    });
    return { ok: true, grant: { ...viewOf(existing, user.email, user.walletAddress), chainSync: "none", chainError: null } };
  }

  if (user.role === "organizer" || user.role === "admin") {
    return fail(409, "FORBIDDEN", "Organizers and admins cannot be attestors or council members: that would be a conflict of interest.");
  }
  if (user.role !== "donor" && user.role !== input.role) {
    return fail(409, "FORBIDDEN", `This account is already a ${user.role}. Remove that role first.`);
  }

  const grantId = existing?.id ?? randomUUID();
  db.transaction((t) => {
    t.update(users).set({ role: input.role }).where(eq(users.id, user.id)).run();
    if (!existing) t.insert(roleGrants).values({ id: grantId, userId: user.id, role: input.role }).run();
  });

  recordSync(db, grantId, chain.configured() ? await chain.setRole(input.role, user.walletAddress, true) : "not_configured");
  const saved = db.select().from(roleGrants).where(eq(roleGrants.id, grantId)).get();
  if (!saved) return fail(404, "USER_NOT_FOUND", "Role grant missing after save.");
  return { ok: true, grant: viewOf(saved, user.email, user.walletAddress) };
}

function viewOf(g: RoleGrantRow, email: string, walletAddress: string): RoleGrantView {
  return { id: g.id, email, walletAddress, role: g.role, chainSync: g.chainSync, chainError: g.chainError, chainTxHash: g.chainTxHash };
}

/** Whether this user's role is registered on the contract (the app checks; the contract enforces). */
export function roleIsSynced(db: Db, userId: string, role: RoleKind): boolean {
  const grant = db.select().from(roleGrants).where(and(eq(roleGrants.userId, userId), eq(roleGrants.role, role))).get();
  return grant?.chainSync === "synced";
}

// ------------------------------------------------------------------ defining milestones (organizer)

export type DefineStatus = "not_configured" | "not_live" | "defined" | "failed";

/**
 * Defines a live campaign's milestones on the MilestoneManager, in order, signed by the campaign's
 * organizer (the contract only accepts the vault's own organizer). Safe to repeat: it first reads how
 * many the contract already holds, so a definition that landed but was not recorded is adopted
 * rather than sent twice. Stops at the first failure and records why.
 */
export async function defineMilestonesOnChain(
  db: Db,
  chain: EscrowChain,
  campaignId: string,
): Promise<{ status: DefineStatus; error?: string }> {
  const campaign = db.select().from(campaigns).where(eq(campaigns.id, campaignId)).get();
  if (!campaign || campaign.status !== "LIVE" || !campaign.vaultContractAddress) return { status: "not_live" };
  if (!chain.configured()) return { status: "not_configured" };

  const vault = campaign.vaultContractAddress;
  const rows = db.select().from(milestones).where(eq(milestones.campaignId, campaignId)).orderBy(asc(milestones.sequenceOrder)).all();
  const markFailed = (id: string, error: string) =>
    db.update(milestones).set({ chainStatus: "failed", chainError: error }).where(eq(milestones.id, id)).run();

  const bound = await chain.vaultBound(vault);
  if (bound === false) {
    const error = "This campaign's vault was created before the milestone manager existed, so its funds can never be released. It is a demo-only campaign.";
    rows.forEach((m) => markFailed(m.id, error));
    return { status: "failed", error };
  }
  const already = await chain.definedCount(vault);
  if (bound === null || already === null) return { status: "failed", error: "The blockchain could not be read. Try again in a moment." };

  const ownerId = ownerUserId(db, campaignId);
  const owner = ownerId ? db.select().from(users).where(eq(users.id, ownerId)).get() : null;
  const keyEnc = ownerId ? getWalletKeyEnc(db, ownerId) : null;

  for (const m of rows) {
    if (m.sequenceOrder < already) {
      if (m.chainStatus !== "defined") {
        db.update(milestones).set({ chainStatus: "defined", chainError: null }).where(eq(milestones.id, m.id)).run();
      }
      continue;
    }
    if (!owner || !keyEnc) {
      const error = "The organizer uses their own wallet, which the server cannot sign for.";
      markFailed(m.id, error);
      return { status: "failed", error };
    }
    const tx = await chain.defineMilestone({ address: owner.walletAddress, keyEnc }, vault, m.targetPct, m.requiredAttestations, () => undefined);
    if (!tx.ok) {
      markFailed(m.id, tx.error);
      return { status: "failed", error: tx.error };
    }
    db.update(milestones).set({ chainStatus: "defined", chainTxHash: tx.txHash, chainError: null }).where(eq(milestones.id, m.id)).run();
  }
  return { status: "defined" };
}

// ------------------------------------------------------------------ actions (attest / approve / release)

export type ActionKind = MilestoneActionRow["kind"];

const STALE_UNSENT_MS = 60_000;

/**
 * Sends one action for one actor, at most once. The request is saved PENDING first, its transaction
 * hash is saved the moment it is sent (before waiting), and only a confirmed or reverted transaction
 * settles it. A leftover PENDING row is re-checked against the chain, so a crash never leaves an
 * action stuck or lets it be sent twice.
 */
export async function performAction(
  db: Db,
  chain: EscrowChain,
  input: {
    milestoneId: string;
    kind: ActionKind;
    user: Pick<PublicUser, "id" | "walletAddress">;
    proofHash?: string;
    send: (onSent: (hash: string) => void) => Promise<Tx>;
  },
): Promise<Outcome<{ action: MilestoneActionRow }>> {
  const address = input.user.walletAddress.toLowerCase();
  const key = and(
    eq(milestoneActions.milestoneId, input.milestoneId),
    eq(milestoneActions.kind, input.kind),
    eq(milestoneActions.actorAddress, address),
  );
  const existing = db.select().from(milestoneActions).where(key).get();

  if (existing?.status === "CONFIRMED") return fail(409, "ALREADY_DONE", "You have already done this.");
  if (existing?.status === "PENDING") {
    const state = existing.txHash ? await chain.txState(existing.txHash) : "pending";
    if (state === "success") {
      db.update(milestoneActions).set({ status: "CONFIRMED", error: null }).where(key).run();
      return fail(409, "ALREADY_DONE", "That transaction has now been confirmed.");
    }
    const unsentAndOld = !existing.txHash && Date.now() - Date.parse(existing.createdAt) > STALE_UNSENT_MS;
    if (state === "pending" && !unsentAndOld) {
      return fail(409, "ACTION_PENDING", "Your earlier request is still being confirmed. Give it a minute.");
    }
  }

  const id = existing?.id ?? randomUUID();
  if (existing) {
    db.update(milestoneActions)
      .set({ status: "PENDING", txHash: null, error: null, proofHash: input.proofHash ?? null })
      .where(key)
      .run();
  } else {
    db.insert(milestoneActions)
      .values({
        id, milestoneId: input.milestoneId, kind: input.kind, actorUserId: input.user.id,
        actorAddress: address, proofHash: input.proofHash ?? null,
      })
      .run();
  }
  const saveHash = (hash: string) => db.update(milestoneActions).set({ txHash: hash }).where(eq(milestoneActions.id, id)).run();

  const tx = await input.send(saveHash);
  if (tx.ok) {
    db.update(milestoneActions).set({ status: "CONFIRMED", txHash: tx.txHash, error: null }).where(eq(milestoneActions.id, id)).run();
  } else if (!tx.pending) {
    db.update(milestoneActions).set({ status: "FAILED", error: tx.error }).where(eq(milestoneActions.id, id)).run();
  } else {
    db.update(milestoneActions).set({ error: tx.error }).where(eq(milestoneActions.id, id)).run(); // stays PENDING
  }

  const action = db.select().from(milestoneActions).where(eq(milestoneActions.id, id)).get();
  if (!action) return fail(500 as number, "CHAIN_FAILED", "Action missing after save.");
  if (!tx.ok && !tx.pending) return fail(422, "CHAIN_FAILED", tx.error);
  if (!tx.ok) return fail(202, "ACTION_PENDING", "Sent, but the confirmation was not seen yet. It will settle shortly.");
  return { ok: true, action };
}

// ------------------------------------------------------------------ reading (public)

export interface ActionView {
  kind: ActionKind;
  status: MilestoneActionRow["status"];
  actorAddress: string;
  txHash: string | null;
  createdAt: string;
}

export interface MilestoneView {
  id: string;
  campaignId: string;
  campaignTitle: string;
  vault: string;
  index: number;
  description: string;
  targetPct: number;
  requiredAttestations: number;
  /** Whether the contract knows this milestone yet. */
  definedOnChain: boolean;
  chainError: string | null;
  /** From the contract; null = not defined yet or the chain could not be read. */
  state: MilestoneState | null;
  actions: ActionView[];
}

export async function viewMilestone(db: Db, chain: EscrowChain, ctx: MilestoneContext): Promise<MilestoneView> {
  const { milestone: m, campaign, vault } = ctx;
  const defined = m.chainStatus === "defined";
  const actions = db
    .select()
    .from(milestoneActions)
    .where(eq(milestoneActions.milestoneId, m.id))
    .orderBy(asc(milestoneActions.createdAt))
    .all()
    .map((a) => ({ kind: a.kind, status: a.status, actorAddress: a.actorAddress, txHash: a.txHash, createdAt: a.createdAt }));
  return {
    id: m.id,
    campaignId: campaign.id,
    campaignTitle: campaign.title,
    vault,
    index: m.sequenceOrder,
    description: m.description,
    targetPct: m.targetPct,
    requiredAttestations: m.requiredAttestations,
    definedOnChain: defined,
    chainError: m.chainError,
    state: defined && chain.configured() ? await chain.readMilestone(vault, m.sequenceOrder) : null,
    actions,
  };
}

/** Every milestone of every live campaign, each with its on-chain state; feeds the role dashboards. */
export async function listMilestoneViews(db: Db, chain: EscrowChain): Promise<MilestoneView[]> {
  const live = db.select().from(campaigns).where(eq(campaigns.status, "LIVE")).all();
  const views: MilestoneView[] = [];
  for (const c of live) {
    if (!c.vaultContractAddress) continue;
    const rows = db.select().from(milestones).where(eq(milestones.campaignId, c.id)).orderBy(asc(milestones.sequenceOrder)).all();
    for (const m of rows) views.push(await viewMilestone(db, chain, { milestone: m, campaign: c, vault: c.vaultContractAddress }));
  }
  return views;
}

/** One campaign's milestones with their on-chain state, for its organizer's page. */
export async function viewsForCampaign(db: Db, chain: EscrowChain, campaignId: string): Promise<MilestoneView[]> {
  const c = db.select().from(campaigns).where(eq(campaigns.id, campaignId)).get();
  if (!c || c.status !== "LIVE" || !c.vaultContractAddress) return [];
  const rows = db.select().from(milestones).where(eq(milestones.campaignId, c.id)).orderBy(asc(milestones.sequenceOrder)).all();
  const views: MilestoneView[] = [];
  for (const m of rows) views.push(await viewMilestone(db, chain, { milestone: m, campaign: c, vault: c.vaultContractAddress }));
  return views;
}
