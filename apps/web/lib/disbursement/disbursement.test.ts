import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { keccak256, toBytes } from "viem";
import { beforeEach, describe, expect, it } from "vitest";
import type { PublicUser } from "../auth/users";
import { findUserById } from "../auth/users";
import { createCampaign, recordVaultDeploy, type CampaignWithMilestones } from "../campaigns/service";
import { createPayoutReference, hashPayoutReference } from "../chain/mockOffRamp";
import { createDb, type Db } from "../db";
import { beneficiaries, disbursements, users } from "../db/schema";
import { VAULT, makeDonor, makeLiveCampaign } from "../donations/test-setup";
import { FakeDisbursementChain } from "./fake-chain";
import { disburseMilestone } from "./service";
import { disburseSchema } from "./validation";

const H1 = `0x${"a1".repeat(32)}`;
const RELEASED = 100_000_000n; // 100 mINR

let db: Db;
let chain: FakeDisbursementChain;
let campaign: CampaignWithMilestones;
let milestoneId: string;
let organizer: PublicUser;
let admin: PublicUser;
let stranger: PublicUser;
let beneficiaryId: string;

function addBeneficiary(campaignId: string, identityHash = H1, chainStatus: "PENDING" | "CONFIRMED" | "FAILED" = "CONFIRMED") {
  const id = randomUUID();
  db.insert(beneficiaries).values({ id, campaignId, identityHash, payoutMethod: "bank transfer", registeredByUserId: organizer.id, chainStatus }).run();
  return id;
}

beforeEach(async () => {
  db = createDb(":memory:");
  chain = new FakeDisbursementChain();
  campaign = await makeLiveCampaign(db);
  milestoneId = campaign.milestones[0].id;
  organizer = findUserById(db, db.select().from(users).where(eq(users.role, "organizer")).get()!.id)!;
  admin = findUserById(db, db.select().from(users).where(eq(users.role, "admin")).get()!.id)!;
  stranger = await makeDonor(db);
  chain.organizer = organizer.walletAddress.toLowerCase();
  beneficiaryId = addBeneficiary(campaign.id);
  chain.register(VAULT, H1);
  chain.release(VAULT, 0, RELEASED);
});

const disburse = (amountMinorUnits = RELEASED.toString(), actor: Pick<PublicUser, "id" | "role"> = organizer, id = milestoneId, bId = beneficiaryId) =>
  disburseMilestone(db, chain, { actor, milestoneId: id, beneficiaryId: bId, amountMinorUnits });
const rows = () => db.select().from(disbursements).all();
const disburseSends = () => chain.sent.filter((s) => s.startsWith("disburse:"));
const approveSends = () => chain.sent.filter((s) => s.startsWith("approve:"));

describe("recording a payout", () => {
  it("approves then disburses, signed by the organizer, and saves both hashes and a reference", async () => {
    const r = await disburse();
    expect(r.ok && r.disbursement.status).toBe("CONFIRMED");
    expect(chain.sent).toEqual([`approve:${RELEASED}`, `disburse:${VAULT}:0:${H1}:${RELEASED}`]);
    const row = rows()[0];
    expect(row.approveTxHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(row.txHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(row.txHash).not.toBe(row.approveTxHash);
    expect(row.payoutRefHash).toBe(keccak256(toBytes(row.payoutReference)));
    expect(row.confirmedAt).not.toBeNull();
    expect(row.lockedUntil).toBe(0);
    expect(row.requestedByUserId).toBe(organizer.id);
    expect(chain.disbursedTotal.get(VAULT)).toBe(RELEASED);
  });

  it("lets an admin ask, still signed as the campaign's organizer", async () => {
    const r = await disburse(undefined, admin);
    expect(r.ok).toBe(true);
    expect(rows()[0].requestedByUserId).toBe(admin.id);
    expect(disburseSends()).toHaveLength(1); // the fake refuses any signer but the organizer
  });

  it("refuses everyone else and sends nothing", async () => {
    const r = await disburse(undefined, stranger);
    expect(!r.ok && [r.status, r.code]).toEqual([403, "FORBIDDEN"]);
    expect(rows()).toHaveLength(0);
    expect(chain.sent).toHaveLength(0);
  });

  it("allows a partial payout", async () => {
    expect((await disburse("40000000")).ok).toBe(true);
    expect(chain.disbursedTotal.get(VAULT)).toBe(40_000_000n);
  });

  it("skips the approval when an earlier one already covers the amount", async () => {
    chain.allowances.set(chain.organizer, RELEASED);
    expect((await disburse()).ok).toBe(true);
    expect(approveSends()).toHaveLength(0);
    expect(rows()[0].approveTxHash).toBeNull();
  });

  it("pays a milestone once: a second request is refused and nothing more is sent", async () => {
    await disburse("10000000");
    const again = await disburse("10000000");
    expect(!again.ok && [again.status, again.code]).toEqual([409, "ALREADY_DISBURSED"]);
    expect(disburseSends()).toHaveLength(1);
    expect(rows()).toHaveLength(1);
  });

  it("refuses a milestone the chain already shows as paid, even without a database record", async () => {
    chain.disbursed.add(`${VAULT}:0`);
    const r = await disburse();
    expect(!r.ok && r.code).toBe("ALREADY_DISBURSED");
    expect(rows()).toHaveLength(0);
    expect(chain.sent).toHaveLength(0);
  });
});

describe("pre-checks before any gas is spent", () => {
  it("refuses a milestone that has not been released", async () => {
    chain.releasedMilestones.clear();
    const r = await disburse();
    expect(!r.ok && [r.status, r.code]).toEqual([409, "MILESTONE_NOT_RELEASED"]);
    expect(chain.sent).toHaveLength(0);
    expect(rows()).toHaveLength(0);
  });

  it("refuses more than the campaign released and has not yet paid out, naming what is left", async () => {
    const r = await disburse((RELEASED + 1n).toString());
    expect(!r.ok && r.code).toBe("EXCEEDS_RELEASED");
    expect(!r.ok && r.message).toContain("100");
    expect(chain.sent).toHaveLength(0);
  });

  it("refuses when the organizer's wallet no longer holds the money", async () => {
    chain.balances.set(chain.organizer, 5_000_000n);
    const r = await disburse();
    expect(!r.ok && r.code).toBe("INSUFFICIENT_FUNDS");
    expect(chain.sent).toHaveLength(0);
  });

  it("refuses an unknown beneficiary, one from another campaign, and one not yet confirmed on-chain", async () => {
    expect(await disburse(undefined, organizer, milestoneId, "nope")).toMatchObject({ code: "BENEFICIARY_NOT_FOUND", status: 404 });

    const other = createCampaign(db, campaign.organizerProfileId, {
      title: "Second campaign for the same trust", summary: "Used to prove a payout names this campaign's own beneficiary.",
      category: "DISASTER_RELIEF", fundingGoalMinorUnits: "1000000000", adminExpenseCapPct: 10,
      milestones: [{ description: "Deliver everything", targetPct: 100, requiredAttestations: 2 }],
    });
    recordVaultDeploy(db, other.id, { status: "deployed", vaultAddress: "0x1111111111111111111111111111111111111111", onchainCampaignId: 1, txHash: "0x2" });
    const elsewhere = addBeneficiary(other.id, `0x${"b2".repeat(32)}`);
    expect(await disburse(undefined, organizer, milestoneId, elsewhere)).toMatchObject({ code: "BENEFICIARY_NOT_FOUND" });

    const unconfirmed = addBeneficiary(campaign.id, `0x${"c3".repeat(32)}`, "PENDING");
    expect(await disburse(undefined, organizer, milestoneId, unconfirmed)).toMatchObject({ code: "BENEFICIARY_NOT_FOUND", status: 409 });
    expect(chain.sent).toHaveLength(0);
    expect(rows()).toHaveLength(0);
  });

  it("refuses an unknown milestone", async () => {
    expect(await disburse(undefined, organizer, "missing")).toMatchObject({ code: "MILESTONE_NOT_FOUND", status: 404 });
  });

  it("says it is switched off when not configured, and unavailable when the chain cannot be read", async () => {
    chain.isConfigured = false;
    expect(await disburse()).toMatchObject({ code: "DISBURSEMENT_NOT_CONFIGURED", status: 503 });
    chain.isConfigured = true;
    chain.unreadable = true;
    expect(await disburse()).toMatchObject({ code: "CHAIN_UNAVAILABLE", status: 503 });
    expect(rows()).toHaveLength(0);
    expect(chain.sent).toHaveLength(0);
  });

  it("cannot sign for an organizer who uses their own wallet", async () => {
    db.update(users).set({ walletKeyEnc: null, walletType: "external" }).where(eq(users.id, organizer.id)).run();
    expect(await disburse()).toMatchObject({ code: "FORBIDDEN", status: 409 });
    expect(chain.sent).toHaveLength(0);
  });
});

describe("when the chain misbehaves", () => {
  it("records a failed approval as FAILED; a retry reuses the row and its payout reference", async () => {
    chain.failNext = "out of gas";
    const first = await disburse();
    expect(first).toMatchObject({ code: "CHAIN_FAILED", status: 422 });
    const failed = rows()[0];
    expect([failed.status, failed.error]).toEqual(["FAILED", "out of gas"]);

    const retry = await disburse();
    expect(retry.ok).toBe(true);
    expect(rows()).toHaveLength(1);
    expect(rows()[0].payoutReference).toBe(failed.payoutReference);
    expect(disburseSends()).toHaveLength(1);
  });

  it("does not approve again on a retry after the payout itself failed", async () => {
    // Approve succeeds, then the disburse is refused once; the approval stays on-chain.
    const origDisburse = chain.disburse.bind(chain);
    let refuse = true;
    chain.disburse = async (...args) => {
      if (refuse) {
        refuse = false;
        return { ok: false, error: "nonce too low" };
      }
      return origDisburse(...args);
    };
    expect(await disburse()).toMatchObject({ code: "CHAIN_FAILED" });
    expect(rows()[0].status).toBe("FAILED");
    expect((await disburse()).ok).toBe(true);
    expect(approveSends()).toHaveLength(1);
  });

  it("keeps an unknown payout outcome PENDING with its hash saved, never sends it twice, and settles once it lands", async () => {
    chain.hangNext = true;
    const first = await disburse();
    expect(first).toMatchObject({ code: "DISBURSEMENT_PENDING", status: 202 });
    const row = rows()[0];
    expect(row.status).toBe("PENDING");
    expect(row.txHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(row.lockedUntil).toBe(0);

    const again = await disburse();
    expect(again).toMatchObject({ code: "DISBURSEMENT_PENDING", status: 409 });
    expect(rows()[0].status).toBe("PENDING"); // never FAILED
    expect(disburseSends()).toHaveLength(1);

    chain.land(row.txHash!);
    const settled = await disburse();
    expect(settled.ok && settled.disbursement.status).toBe("CONFIRMED");
    expect(disburseSends()).toHaveLength(1);
  });

  it("keeps an unknown approval PENDING and waits for it; once it lands, only the payout is sent", async () => {
    chain.hangApprove = true;
    expect(await disburse()).toMatchObject({ code: "DISBURSEMENT_PENDING", status: 202 });
    const row = rows()[0];
    expect([row.status, row.txHash]).toEqual(["PENDING", null]);
    expect(row.approveTxHash).toMatch(/^0x[0-9a-f]{64}$/);

    expect(await disburse()).toMatchObject({ code: "DISBURSEMENT_PENDING", status: 409 });
    expect(chain.sent).toHaveLength(1);

    // The approval lands after all.
    chain.txStates.set(row.approveTxHash!, "success");
    chain.allowances.set(chain.organizer, RELEASED);
    const done = await disburse();
    expect(done.ok).toBe(true);
    expect(approveSends()).toHaveLength(1);
    expect(disburseSends()).toHaveLength(1);
  });

  it("refuses while another request holds the payout, and sends nothing", async () => {
    chain.failNext = "rpc down";
    await disburse();
    db.update(disbursements).set({ lockedUntil: Date.now() + 60_000 }).run();
    const sentBefore = chain.sent.length;
    expect(await disburse()).toMatchObject({ code: "DISBURSEMENT_PENDING", status: 409 });
    expect(chain.sent).toHaveLength(sentBefore);
  });

  it("lets only one of two simultaneous requests through", async () => {
    const [a, b] = await Promise.all([disburse(), disburse()]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(disburseSends()).toHaveLength(1);
    expect(rows()).toHaveLength(1);
  });
});

describe("the simulated off-ramp reference", () => {
  it("is random, non-empty, and its on-chain hash is keccak256 of the reference", () => {
    const a = createPayoutReference();
    const b = createPayoutReference();
    expect(a.reference).toMatch(/^VERA-SIM-[0-9A-F]{16}$/);
    expect(a.reference).not.toBe(b.reference);
    expect(a.refHash).toBe(keccak256(toBytes(a.reference)));
    expect(a.refHash).toBe(hashPayoutReference(a.reference));
    expect(a.refHash).not.toMatch(/^0x0{64}$/);
  });
});

describe("what the API accepts", () => {
  it("takes a beneficiary id and a whole, positive amount in minor units", () => {
    expect(disburseSchema.safeParse({ beneficiaryId: "b1", amountMinorUnits: "1500000" }).success).toBe(true);
    for (const amountMinorUnits of ["0", "-5", "1.5", "", "01", "1".repeat(19)]) {
      expect(disburseSchema.safeParse({ beneficiaryId: "b1", amountMinorUnits }).success).toBe(false);
    }
    expect(disburseSchema.safeParse({ amountMinorUnits: "1" }).success).toBe(false);
  });

  it("ignores a payout reference sent by the caller: the server makes its own", async () => {
    const parsed = disburseSchema.parse({ beneficiaryId: beneficiaryId, amountMinorUnits: "1000000", payoutReference: "FAKE-REF" });
    expect(parsed).not.toHaveProperty("payoutReference");
  });
});
