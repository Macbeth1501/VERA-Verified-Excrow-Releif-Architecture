import { and, eq, lt } from "drizzle-orm";
import type { Db } from "../db";
import { donations, users, type DonationRow } from "../db/schema";
import { getCampaign } from "../campaigns/service";
import type { DonationChain, SendParams } from "./chain-port";
import { getDonation, type DonationView } from "./service";

type Step = DonationRow["step"];

const ORDER: Step[] = ["gas", "mint", "fee", "approve", "deposit"];
const LOCK_MS = 45_000;

const STEP_ERROR: Record<string, string> = {
  gas: "We could not prepare your account for the donation.",
  mint: "We could not add practice funds to your account.",
  fee: "We could not process the platform fee.",
  approve: "We could not authorise the donation.",
  deposit: "We could not send the donation to the campaign.",
};

export interface AdvanceOptions {
  /** How long to wait for a just-sent transaction to be mined before returning "still pending". */
  waitMs: number;
  /** The fee wallet, required only when the donation carries a fee. */
  feeAddress?: string;
  now?: number;
}

function nextStep(step: Step, fee: string): Step {
  const steps = ORDER.filter((s) => s !== "fee" || fee !== "0");
  return steps[steps.indexOf(step) + 1] ?? "done";
}

/** The column that holds a step's transaction hash. */
function hashOf(row: DonationRow, step: Step): string | null {
  return {
    gas: row.gasTxHash,
    mint: row.mintTxHash,
    fee: row.feeTxHash,
    approve: row.approveTxHash,
    deposit: row.onchainTxHash,
    done: null,
  }[step];
}

function hashPatch(step: Step, hash: string | null): Partial<DonationRow> {
  switch (step) {
    case "gas": return { gasTxHash: hash };
    case "mint": return { mintTxHash: hash };
    case "fee": return { feeTxHash: hash };
    case "approve": return { approveTxHash: hash };
    case "deposit": return { onchainTxHash: hash };
    default: return {};
  }
}

function acquire(db: Db, id: string, now: number): boolean {
  const result = db
    .update(donations)
    .set({ lockedUntil: now + LOCK_MS })
    .where(and(eq(donations.id, id), eq(donations.status, "PENDING"), lt(donations.lockedUntil, now)))
    .run();
  return result.changes === 1;
}

function fail(db: Db, id: string, step: Step, detail: string, clearHash: boolean): void {
  console.error(JSON.stringify({ event: "donation_step_failed", donation: id, step, detail: detail.slice(0, 200) }));
  db.update(donations)
    .set({ status: "FAILED", error: STEP_ERROR[step] ?? "Something went wrong.", ...(clearHash ? hashPatch(step, null) : {}) })
    .where(eq(donations.id, id))
    .run();
}

async function sendStep(chain: DonationChain, step: Step, row: DonationRow, p: SendParams, vault: string, opts: AdvanceOptions) {
  const amount = BigInt(row.amountMinorUnits);
  const fee = BigInt(row.feeMinorUnits);
  switch (step) {
    case "gas": return (await chain.fundGas(p.donorAddress)).txHash;
    case "mint": return chain.sendMint({ ...p, amount: amount + fee });
    case "fee":
      if (!opts.feeAddress) throw new Error("no fee address configured");
      return chain.sendFee({ ...p, amount: fee });
    case "approve": return chain.sendApprove({ ...p, vault, amount });
    case "deposit": return chain.sendDeposit({ ...p, vault, amount });
    default: return null;
  }
}

/**
 * Moves a donation forward by ONE step: send that step's transaction (saving its hash before
 * waiting), then wait briefly for it to be mined. If it is not mined yet the donation simply stays
 * PENDING and the next call checks again. A donation only becomes CONFIRMED when the deposit's
 * receipt is read from the chain and its DonationReceived event is verified (SPDD 8.9).
 */
export async function advanceDonation(
  db: Db,
  chain: DonationChain,
  id: string,
  userId: string,
  opts: AdvanceOptions,
): Promise<DonationView> {
  const now = opts.now ?? Date.now();
  const initial = getDonation(db, id, userId);
  if (initial.status !== "PENDING" || !acquire(db, id, now)) return initial;

  try {
    await runStep(db, chain, id, opts);
  } catch (err) {
    const row = db.select().from(donations).where(eq(donations.id, id)).get();
    const detail = err instanceof Error ? err.message : "unknown error";
    if (row && hashOf(row, row.step)) {
      // A transaction for this step was already sent, so it may well have gone through. An error
      // while checking on it must never turn into a "failed" donation; stay PENDING and re-check.
      console.error(JSON.stringify({ event: "donation_check_error", donation: id, step: row.step, detail: detail.slice(0, 200) }));
    } else if (row) {
      fail(db, id, row.step, detail, false);
    }
  } finally {
    db.update(donations).set({ lockedUntil: 0 }).where(eq(donations.id, id)).run();
  }
  return getDonation(db, id, userId);
}

async function runStep(db: Db, chain: DonationChain, id: string, opts: AdvanceOptions): Promise<void> {
  const row = db.select().from(donations).where(eq(donations.id, id)).get();
  if (!row || row.status !== "PENDING" || row.step === "done") return;
  const step = row.step;

  const donor = db.select().from(users).where(eq(users.id, row.donorUserId)).get();
  const campaign = getCampaign(db, row.campaignId);
  if (!donor?.walletKeyEnc || !campaign?.vaultContractAddress) {
    return fail(db, id, step, "donor wallet or campaign vault missing", false);
  }
  const vault = campaign.vaultContractAddress;
  const params: SendParams = { donorAddress: donor.walletAddress, donorKeyEnc: donor.walletKeyEnc };

  let hash = hashOf(row, step);
  if (!hash) {
    try {
      hash = await sendStep(chain, step, row, params, vault, opts);
    } catch (err) {
      return fail(db, id, step, err instanceof Error ? err.message : "send failed", false);
    }
    if (hash === null) {
      // Nothing to send (for example the wallet already has enough gas): straight to the next step.
      db.update(donations).set({ step: nextStep(step, row.feeMinorUnits) }).where(eq(donations.id, id)).run();
      return;
    }
    // Saved before waiting, so a crash cannot lose track of a transaction that was already sent.
    db.update(donations).set(hashPatch(step, hash)).where(eq(donations.id, id)).run();
  }

  let state;
  try {
    state = await chain.receipt(hash, opts.waitMs);
  } catch {
    return; // could not reach the chain: unknown, not failed. The next call checks again.
  }
  if (state === "pending") return;
  if (state === "reverted") return fail(db, id, step, `transaction ${hash} reverted`, true);

  if (step !== "deposit") {
    db.update(donations).set({ step: nextStep(step, row.feeMinorUnits) }).where(eq(donations.id, id)).run();
    return;
  }

  let verified: boolean;
  try {
    verified = await chain.verifyDeposit(hash, {
      vault,
      donorAddress: donor.walletAddress,
      amount: BigInt(row.amountMinorUnits),
    });
  } catch {
    return; // could not read the receipt logs right now: stay PENDING and check again
  }
  if (!verified) return fail(db, id, step, `deposit ${hash} did not emit the expected DonationReceived`, false);
  db.update(donations)
    .set({ status: "CONFIRMED", step: "done", error: null, confirmedAt: new Date().toISOString() })
    .where(eq(donations.id, id))
    .run();
}
