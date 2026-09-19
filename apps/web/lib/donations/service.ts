import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { Db } from "../db";
import { donations, users, type DonationRow } from "../db/schema";
import { getCampaign } from "../campaigns/service";

type Step = DonationRow["step"];
export type DonationStage = "adding_funds" | "approving" | "sending" | "confirming" | "done" | "failed";

export interface DonationView {
  id: string;
  campaignId: string;
  amountMinorUnits: string;
  feeMinorUnits: string;
  status: DonationRow["status"];
  step: Step;
  stage: DonationStage;
  /** 1-based position among the steps this donation needs, for a progress display. */
  stepNumber: number;
  totalSteps: number;
  /** The deposit transaction, once it has been sent. */
  txHash: string | null;
  error: string | null;
  createdAt: string;
  confirmedAt: string | null;
}

export class DonationNotFoundError extends Error {
  constructor() {
    super("Donation not found");
  }
}
export class WalletNotManagedError extends Error {
  constructor() {
    super("This account uses its own wallet, which VERA cannot sign for yet");
  }
}
export class CampaignNotOpenError extends Error {
  constructor() {
    super("This campaign is not open for donations");
  }
}
export class FeeChoiceRequiredError extends Error {
  constructor() {
    super("Choose whether to cover the platform fee");
  }
}

/** The order of on-chain steps. `fee` is skipped when there is no fee. */
const ORDER: Step[] = ["gas", "mint", "fee", "approve", "deposit"];
function stepsFor(feeMinorUnits: string): Step[] {
  return ORDER.filter((s) => s !== "fee" || feeMinorUnits !== "0");
}

export function toView(row: DonationRow): DonationView {
  const steps = stepsFor(row.feeMinorUnits);
  let stage: DonationStage = "adding_funds";
  if (row.status === "CONFIRMED") stage = "done";
  else if (row.status === "FAILED") stage = "failed";
  else if (row.step === "approve") stage = "approving";
  else if (row.step === "deposit") stage = row.onchainTxHash ? "confirming" : "sending";

  return {
    id: row.id,
    campaignId: row.campaignId,
    amountMinorUnits: row.amountMinorUnits,
    feeMinorUnits: row.feeMinorUnits,
    status: row.status,
    step: row.step,
    stage,
    stepNumber: row.status === "CONFIRMED" ? steps.length : Math.max(1, steps.indexOf(row.step) + 1),
    totalSteps: steps.length,
    txHash: row.onchainTxHash,
    error: row.error,
    createdAt: row.createdAt,
    confirmedAt: row.confirmedAt,
  };
}

function load(db: Db, id: string, userId: string): DonationRow {
  const row = db.select().from(donations).where(eq(donations.id, id)).get();
  if (!row || row.donorUserId !== userId) throw new DonationNotFoundError();
  return row;
}

export function getDonation(db: Db, id: string, userId: string): DonationView {
  return toView(load(db, id, userId));
}

export function listDonations(db: Db, userId: string): DonationView[] {
  return db.select().from(donations).where(eq(donations.donorUserId, userId)).orderBy(desc(donations.createdAt)).all().map(toView);
}

/**
 * Records a donation as PENDING at its first step. Nothing touches the chain here: the browser
 * then advances it one step at a time, so no single request has to outlive a serverless timeout
 * and a crash in the middle can be resumed. `platformFeeMinorUnits` is the configured flat fee.
 */
export function createDonation(
  db: Db,
  input: { userId: string; campaignId: string; amountMinorUnits: string; feeChoice?: "cover" | "decline" },
  platformFeeMinorUnits: bigint,
): DonationView {
  const campaign = getCampaign(db, input.campaignId);
  if (!campaign || campaign.status !== "LIVE" || !campaign.vaultContractAddress) throw new CampaignNotOpenError();

  const donor = db.select().from(users).where(eq(users.id, input.userId)).get();
  if (!donor || donor.walletType !== "generated" || !donor.walletKeyEnc) throw new WalletNotManagedError();

  let fee = 0n;
  if (platformFeeMinorUnits > 0n) {
    if (!input.feeChoice) throw new FeeChoiceRequiredError();
    fee = input.feeChoice === "cover" ? platformFeeMinorUnits : 0n;
  }

  const id = randomUUID();
  db.insert(donations)
    .values({
      id,
      campaignId: input.campaignId,
      donorUserId: input.userId,
      amountMinorUnits: input.amountMinorUnits,
      feeMinorUnits: fee.toString(),
      status: "PENDING",
      step: "gas",
    })
    .run();
  return getDonation(db, id, input.userId);
}

/** A failed donation can be retried from the step that failed; nothing earlier is repeated. */
export function retryDonation(db: Db, id: string, userId: string): DonationView {
  const row = load(db, id, userId);
  if (row.status === "FAILED") {
    db.update(donations).set({ status: "PENDING", error: null, lockedUntil: 0 }).where(eq(donations.id, id)).run();
  }
  return getDonation(db, id, userId);
}
