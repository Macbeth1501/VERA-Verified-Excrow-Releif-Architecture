import { randomUUID } from "node:crypto";
import { and, eq, lte } from "drizzle-orm";
import { findUserById, getWalletKeyEnc, type PublicUser } from "../auth/users";
import { formatMinorUnits } from "../campaigns/money";
import { ownerUserId } from "../campaigns/service";
import { createPayoutReference } from "../chain/mockOffRamp";
import type { Db } from "../db";
import { beneficiaries, disbursements, type DisbursementRow } from "../db/schema";
import { loadMilestone } from "../escrow/service";
import type { DisbursementChain } from "./chain-port";

/**
 * Milestone disbursement (Step 14, FR-ESC-02). After the MilestoneManager has released a milestone to
 * the campaign's organizer, the organizer (or an admin acting for them) records the simulated payout
 * of it to one registered beneficiary. The Disbursement contract decides everything that matters
 * (milestone Released, beneficiary registered for this campaign, paid once, within what was released);
 * this layer pre-checks the obvious cases to give a clear message before spending gas, records the
 * request, and has the campaign's OWN organizer send both transactions: the token approval, then the
 * payout. Each hash is saved before waiting, and a send whose outcome is unknown stays PENDING.
 */

export type DisbursementFailure = {
  ok: false;
  status: number;
  code:
    | "MILESTONE_NOT_FOUND"
    | "FORBIDDEN"
    | "DISBURSEMENT_NOT_CONFIGURED"
    | "BENEFICIARY_NOT_FOUND"
    | "MILESTONE_NOT_RELEASED"
    | "ALREADY_DISBURSED"
    | "EXCEEDS_RELEASED"
    | "INSUFFICIENT_FUNDS"
    | "DISBURSEMENT_PENDING"
    | "CHAIN_UNAVAILABLE"
    | "CHAIN_FAILED";
  message: string;
};

export type Outcome<T> = ({ ok: true } & T) | DisbursementFailure;

const fail = (status: number, code: DisbursementFailure["code"], message: string): DisbursementFailure => ({ ok: false, status, code, message });

/** How long one request owns a payout: two transactions, each with a top-up and up to 90 s of waiting. */
const LOCK_MS = 5 * 60_000;

export interface DisbursementView {
  id: string;
  milestoneId: string;
  campaignId: string;
  beneficiaryId: string;
  identityHash: string;
  amountMinorUnits: string;
  payoutReference: string;
  payoutRefHash: string;
  status: DisbursementRow["status"];
  approveTxHash: string | null;
  txHash: string | null;
  error: string | null;
  createdAt: string;
  confirmedAt: string | null;
}

const viewOf = (d: DisbursementRow): DisbursementView => ({
  id: d.id,
  milestoneId: d.milestoneId,
  campaignId: d.campaignId,
  beneficiaryId: d.beneficiaryId,
  identityHash: d.identityHash,
  amountMinorUnits: d.amountMinorUnits,
  payoutReference: d.payoutReference,
  payoutRefHash: d.payoutRefHash,
  status: d.status,
  approveTxHash: d.approveTxHash,
  txHash: d.txHash,
  error: d.error,
  createdAt: d.createdAt,
  confirmedAt: d.confirmedAt,
});

const PENDING = () => fail(409, "DISBURSEMENT_PENDING", "This milestone's payout is already being processed. Give it a minute.");

/** Whether a failed insert broke the one-payout-per-milestone unique index, however the driver wraps it. */
function isUniqueViolation(err: unknown): boolean {
  for (let e: unknown = err; e instanceof Error; e = (e as { cause?: unknown }).cause) {
    if (/UNIQUE constraint failed/i.test(e.message)) return true;
  }
  return false;
}

/**
 * Records the payout of a released milestone to a registered beneficiary. Only the campaign's
 * organizer or an admin may ask, and both transactions are always signed by the campaign's organizer,
 * never the caller: the manager paid the release to the organizer's wallet and the contract only
 * accepts the vault's organizer. One request at a time owns a milestone's payout (an atomic lock), so
 * its transactions are never sent twice; a leftover PENDING row is re-checked against the chain first.
 */
export async function disburseMilestone(
  db: Db,
  chain: DisbursementChain,
  input: { actor: Pick<PublicUser, "id" | "role">; milestoneId: string; beneficiaryId: string; amountMinorUnits: string },
): Promise<Outcome<{ disbursement: DisbursementView }>> {
  const ctx = loadMilestone(db, input.milestoneId);
  if (!ctx) return fail(404, "MILESTONE_NOT_FOUND", "Milestone not found, or its campaign is not live.");
  const ownerId = ownerUserId(db, ctx.campaign.id);
  if (!ownerId || (input.actor.id !== ownerId && input.actor.role !== "admin")) {
    return fail(403, "FORBIDDEN", "Only the campaign's organizer or an admin can record a payout.");
  }
  if (!chain.configured()) {
    return fail(503, "DISBURSEMENT_NOT_CONFIGURED", "Payouts are switched off: the payout contract or the sponsor wallet is not configured.");
  }
  const organizer = findUserById(db, ownerId);
  const keyEnc = getWalletKeyEnc(db, ownerId);
  if (!organizer || !keyEnc) return fail(409, "FORBIDDEN", "This campaign's organizer uses their own wallet, which the server cannot sign for.");

  const byMilestone = eq(disbursements.milestoneId, input.milestoneId);
  const reload = (id: string) => viewOf(db.select().from(disbursements).where(eq(disbursements.id, id)).get()!);
  const settle = (id: string, set: Partial<DisbursementRow>) => db.update(disbursements).set(set).where(eq(disbursements.id, id)).run();
  const confirm = (id: string, txHash?: string) => {
    settle(id, { status: "CONFIRMED", error: null, confirmedAt: new Date().toISOString(), ...(txHash ? { txHash } : {}) });
    return { ok: true as const, disbursement: reload(id) };
  };

  const existing = db.select().from(disbursements).where(byMilestone).get();
  if (existing?.status === "CONFIRMED") return fail(409, "ALREADY_DISBURSED", "This milestone's payout has already been recorded.");

  // Claim the row atomically; a request already working on it owns it until it finishes (or the lock expires).
  let rowId: string | null = null;
  if (existing) {
    const now = Date.now();
    const claimed = db
      .update(disbursements)
      .set({ lockedUntil: now + LOCK_MS })
      .where(and(eq(disbursements.id, existing.id), eq(disbursements.status, existing.status), lte(disbursements.lockedUntil, now)))
      .run();
    if (claimed.changes !== 1) return PENDING();
    rowId = existing.id;
  }

  try {
    // An earlier attempt's transactions decide what happens next; a read error counts as "pending".
    if (existing?.status === "PENDING") {
      if (existing.txHash) {
        const state = await chain.txState(existing.txHash);
        if (state === "success") return confirm(existing.id);
        if (state === "pending") return PENDING();
      } else if (existing.approveTxHash && (await chain.txState(existing.approveTxHash)) === "pending") {
        return PENDING();
      }
    }

    const beneficiary = db
      .select()
      .from(beneficiaries)
      .where(and(eq(beneficiaries.id, input.beneficiaryId), eq(beneficiaries.campaignId, ctx.campaign.id)))
      .get();
    if (!beneficiary) return fail(404, "BENEFICIARY_NOT_FOUND", "That beneficiary is not registered for this campaign.");
    if (beneficiary.chainStatus !== "CONFIRMED") {
      return fail(409, "BENEFICIARY_NOT_FOUND", "That beneficiary's registration is not confirmed on the blockchain yet.");
    }

    const index = ctx.milestone.sequenceOrder;
    const state = await chain.readPayout(ctx.vault, index, organizer.walletAddress);
    if (!state) return fail(503, "CHAIN_UNAVAILABLE", "The blockchain could not be read. Try again in a moment.");
    if (state.disbursed) return fail(409, "ALREADY_DISBURSED", "This milestone's payout has already been recorded on the blockchain.");
    if (!state.released) return fail(409, "MILESTONE_NOT_RELEASED", "This milestone has not been released yet, so there is nothing to pay out.");
    const amount = BigInt(input.amountMinorUnits);
    if (amount > BigInt(state.payableRemaining)) {
      return fail(409, "EXCEEDS_RELEASED", `The payout is more than this campaign has released and not yet paid out (${formatMinorUnits(state.payableRemaining)} mINR).`);
    }
    if (amount > BigInt(state.organizerBalance)) {
      return fail(409, "INSUFFICIENT_FUNDS", `The organizer's wallet holds ${formatMinorUnits(state.organizerBalance)} mINR, less than this payout.`);
    }

    const request = { beneficiaryId: beneficiary.id, identityHash: beneficiary.identityHash, amountMinorUnits: input.amountMinorUnits };
    if (existing) {
      // Retrying: keep the payout reference (it was never used on-chain, or its use reverted).
      settle(existing.id, { ...request, requestedByUserId: input.actor.id, status: "PENDING", approveTxHash: null, txHash: null, error: null });
    } else {
      const id = randomUUID();
      const ref = createPayoutReference();
      try {
        db.insert(disbursements)
          .values({
            id, milestoneId: input.milestoneId, campaignId: ctx.campaign.id, ...request,
            payoutReference: ref.reference, payoutRefHash: ref.refHash, requestedByUserId: input.actor.id,
            lockedUntil: Date.now() + LOCK_MS,
          })
          .run();
      } catch (err) {
        if (isUniqueViolation(err)) return PENDING(); // a concurrent request won the race
        throw err;
      }
      rowId = id;
    }
    const id = rowId!;
    const signer = { address: organizer.walletAddress, keyEnc };
    const sendFailed = (tx: { error: string; pending?: boolean }) => {
      if (tx.pending) {
        settle(id, { error: tx.error }); // stays PENDING
        return fail(202, "DISBURSEMENT_PENDING", "Sent, but the confirmation was not seen yet. It will settle shortly.");
      }
      settle(id, { status: "FAILED", error: tx.error });
      return fail(422, "CHAIN_FAILED", tx.error);
    };

    // 1. The organizer lets the contract take the amount (skipped when an approval already covers it).
    if (BigInt(state.allowance) < amount) {
      const approved = await chain.approve(signer, input.amountMinorUnits, (hash) => settle(id, { approveTxHash: hash }));
      if (!approved.ok) return sendFailed(approved);
    }

    // 2. The payout itself: the contract re-checks every rule and emits the public PayoutRecorded line item.
    const row = db.select().from(disbursements).where(eq(disbursements.id, id)).get()!;
    const tx = await chain.disburse(signer, ctx.vault, index, row.identityHash, row.amountMinorUnits, row.payoutRefHash, (hash) =>
      settle(id, { txHash: hash }),
    );
    if (!tx.ok) return sendFailed(tx);
    return confirm(id, tx.txHash);
  } finally {
    if (rowId) settle(rowId, { lockedUntil: 0 });
  }
}
