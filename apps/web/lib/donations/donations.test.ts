import { beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "../db";
import { advanceDonation } from "./advance";
import {
  CampaignNotOpenError, DonationNotFoundError, FeeChoiceRequiredError, WalletNotManagedError,
  createDonation, getDonation, retryDonation, type DonationView,
} from "./service";
import { FakeDonationChain } from "./fake-chain";
import { VAULT, makeDonor, makeLiveCampaign } from "./test-setup";

const OPTS = { waitMs: 0, feeAddress: "0x000000000000000000000000000000000000fee0" };
const RUPEES_100 = "100000000";
const FEE = 2_000_000n; // 2 rupees, an example flat fee

let db: Db;
let chain: FakeDonationChain;

beforeEach(() => {
  db = createDb(":memory:");
  chain = new FakeDonationChain();
});

async function setup(feeChoice?: "cover" | "decline", fee = 0n) {
  const campaign = await makeLiveCampaign(db);
  const donor = await makeDonor(db);
  const view = createDonation(db, { userId: donor.id, campaignId: campaign.id, amountMinorUnits: RUPEES_100, feeChoice }, fee);
  return { campaign, donor, view };
}

/** Advance until the donation stops being PENDING, with a safety limit. */
async function run(id: string, userId: string, limit = 20): Promise<DonationView> {
  let view = getDonation(db, id, userId);
  for (let i = 0; i < limit && view.status === "PENDING"; i++) view = await advanceDonation(db, chain, id, userId, OPTS);
  return view;
}

describe("creating a donation", () => {
  it("starts PENDING at the first step and touches no chain", async () => {
    const { view } = await setup();
    expect(view.status).toBe("PENDING");
    expect(view.step).toBe("gas");
    expect(view.stepNumber).toBe(1);
    expect(view.totalSteps).toBe(4);
    expect(chain.calls).toHaveLength(0);
  });

  it("refuses a campaign that is not live, and a donor whose wallet VERA cannot sign for", async () => {
    const donor = await makeDonor(db);
    expect(() => createDonation(db, { userId: donor.id, campaignId: "missing", amountMinorUnits: RUPEES_100 }, 0n)).toThrow(CampaignNotOpenError);
    const campaign = await makeLiveCampaign(db);
    const own = await makeDonor(db, "0xb2Ab1471d98909237B3F3828E7422182584E11E3");
    expect(() => createDonation(db, { userId: own.id, campaignId: campaign.id, amountMinorUnits: RUPEES_100 }, 0n)).toThrow(WalletNotManagedError);
  });

  it("never pre-selects a fee: with a fee configured the donor must choose", async () => {
    const campaign = await makeLiveCampaign(db);
    const donor = await makeDonor(db);
    const input = { userId: donor.id, campaignId: campaign.id, amountMinorUnits: RUPEES_100 };
    expect(() => createDonation(db, input, FEE)).toThrow(FeeChoiceRequiredError);
    expect(createDonation(db, { ...input, feeChoice: "decline" }, FEE).feeMinorUnits).toBe("0");
    expect(createDonation(db, { ...input, feeChoice: "cover" }, FEE).feeMinorUnits).toBe(FEE.toString());
  });

  it("charges nothing and ignores a fee choice when there is no fee (the default)", async () => {
    const { view } = await setup("cover", 0n);
    expect(view.feeMinorUnits).toBe("0");
  });
});

describe("the happy path", () => {
  it("runs gas, mint, approve, deposit, and confirms only at the end", async () => {
    const { donor, view } = await setup();
    const seen: string[] = [];
    let current = view;
    while (current.status === "PENDING") {
      current = await advanceDonation(db, chain, view.id, donor.id, OPTS);
      seen.push(`${current.status}:${current.step}`);
    }
    expect(chain.kinds()).toEqual(["gas", "mint", "approve", "deposit"]);
    expect(current.status).toBe("CONFIRMED");
    expect(current.stage).toBe("done");
    expect(current.txHash).toBe(chain.lastHash("deposit"));
    expect(current.confirmedAt).not.toBeNull();
    // Every state before the last is still PENDING: nothing is "complete" early.
    expect(seen.slice(0, -1).every((s) => s.startsWith("PENDING"))).toBe(true);
  });

  it("mints exactly the donation and approves the vault for exactly that amount", async () => {
    const { donor, view } = await setup();
    await run(view.id, donor.id);
    expect(chain.calls.find((c) => c.kind === "mint")?.amount).toBe(100000000n);
    const approve = chain.calls.find((c) => c.kind === "approve");
    expect(approve?.amount).toBe(100000000n);
    expect(approve?.vault).toBe(VAULT);
    expect(chain.calls.find((c) => c.kind === "deposit")?.amount).toBe(100000000n);
  });

  it("skips the gas step when the wallet already has gas", async () => {
    chain.needsGas = false;
    const { donor, view } = await setup();
    await run(view.id, donor.id);
    expect(chain.kinds()).toEqual(["mint", "approve", "deposit"]);
  });

  it("is idempotent once confirmed: advancing again does nothing", async () => {
    const { donor, view } = await setup();
    await run(view.id, donor.id);
    const before = chain.calls.length;
    await advanceDonation(db, chain, view.id, donor.id, OPTS);
    expect(chain.calls).toHaveLength(before);
  });
});

describe("the fee (FR-CMP-02)", () => {
  it("when covered, the fee is paid ON TOP so 100% of the donation reaches the vault", async () => {
    const { donor, view } = await setup("cover", FEE);
    const done = await run(view.id, donor.id);
    expect(done.status).toBe("CONFIRMED");
    expect(chain.kinds()).toEqual(["gas", "mint", "fee", "approve", "deposit"]);
    expect(chain.calls.find((c) => c.kind === "mint")?.amount).toBe(100000000n + FEE);
    expect(chain.calls.find((c) => c.kind === "fee")?.amount).toBe(FEE);
    expect(chain.calls.find((c) => c.kind === "deposit")?.amount).toBe(100000000n);
  });

  it("when declined, no fee is charged and there is no fee step", async () => {
    const { donor, view } = await setup("decline", FEE);
    await run(view.id, donor.id);
    expect(chain.count("fee")).toBe(0);
    expect(chain.calls.find((c) => c.kind === "mint")?.amount).toBe(100000000n);
  });
});

describe("pending is never presented as done (SPDD 8.9)", () => {
  it("stays PENDING while the deposit is not yet mined, then confirms without sending it twice", async () => {
    const { donor, view } = await setup();
    // Walk to the deposit step, then make its receipt pending for a while.
    let current = view;
    while (current.step !== "deposit") current = await advanceDonation(db, chain, view.id, donor.id, OPTS);
    chain.pendingChecks.set("0xdeposit00000004", 3);

    current = await advanceDonation(db, chain, view.id, donor.id, OPTS);
    expect(current.status).toBe("PENDING");
    expect(current.stage).toBe("confirming");
    expect(current.txHash).toBe(chain.lastHash("deposit"));

    for (let i = 0; i < 2; i++) expect((await advanceDonation(db, chain, view.id, donor.id, OPTS)).status).toBe("PENDING");
    const done = await advanceDonation(db, chain, view.id, donor.id, OPTS);
    expect(done.status).toBe("CONFIRMED");
    expect(chain.count("deposit")).toBe(1);
  });

  it("does not confirm when the deposit mined but the DonationReceived event cannot be verified", async () => {
    chain.depositVerifies = false;
    const { donor, view } = await setup();
    const done = await run(view.id, donor.id);
    expect(done.status).toBe("FAILED");
    expect(done.status).not.toBe("CONFIRMED");
    expect(done.confirmedAt).toBeNull();
  });

  it("does NOT mark a sent deposit failed just because the chain could not be reached to check on it", async () => {
    const { donor, view } = await setup();
    let current = view;
    while (current.step !== "deposit") current = await advanceDonation(db, chain, view.id, donor.id, OPTS);
    chain.pendingChecks.set("0xdeposit00000004", 1); // in flight: not mined on the first look
    const sent = await advanceDonation(db, chain, view.id, donor.id, OPTS); // sends the deposit
    expect(sent.status).toBe("PENDING");
    expect(sent.txHash).not.toBeNull();
    chain.receiptThrows = true;
    for (let i = 0; i < 3; i++) {
      const during = await advanceDonation(db, chain, view.id, donor.id, OPTS);
      expect(during.status).toBe("PENDING");
    }
    chain.receiptThrows = false;
    expect((await advanceDonation(db, chain, view.id, donor.id, OPTS)).status).toBe("CONFIRMED");
    expect(chain.count("deposit")).toBe(1);
  });
});

describe("failure and retry", () => {
  it("a reverted deposit fails with a plain message, and a retry resends ONLY the deposit", async () => {
    const { donor, view } = await setup();
    let current = view;
    while (current.step !== "deposit") current = await advanceDonation(db, chain, view.id, donor.id, OPTS);
    chain.reverted.add("0xdeposit00000004");
    const failed = await run(view.id, donor.id);
    expect(failed.status).toBe("FAILED");
    expect(failed.stage).toBe("failed");
    expect(failed.error).toBe("We could not send the donation to the campaign.");
    expect(failed.txHash).toBeNull(); // the reverted hash is cleared so the retry sends afresh

    retryDonation(db, view.id, donor.id);
    const done = await run(view.id, donor.id);
    expect(done.status).toBe("CONFIRMED");
    expect(chain.count("mint")).toBe(1);
    expect(chain.count("deposit")).toBe(2);
  });

  it("a failed send stops at that step, and a retry resumes there without repeating earlier steps", async () => {
    chain.failNextSend = "mint";
    const { donor, view } = await setup();
    const failed = await run(view.id, donor.id);
    expect(failed.status).toBe("FAILED");
    expect(failed.step).toBe("mint");
    expect(failed.error).toBe("We could not add practice funds to your account.");
    expect(chain.count("gas")).toBe(1);

    retryDonation(db, view.id, donor.id);
    expect((await run(view.id, donor.id)).status).toBe("CONFIRMED");
    expect(chain.count("gas")).toBe(1);
    expect(chain.count("mint")).toBe(1);
  });

  it("does not leak technical detail to the donor", async () => {
    chain.failNextSend = "gas";
    const { donor, view } = await setup();
    const failed = await run(view.id, donor.id);
    expect(failed.error).not.toMatch(/send failed|0x|rpc|http/i);
  });
});

describe("safety", () => {
  it("two simultaneous requests never run the same step twice", async () => {
    chain.sendDelayMs = 30;
    const { donor, view } = await setup();
    await Promise.all([
      advanceDonation(db, chain, view.id, donor.id, OPTS),
      advanceDonation(db, chain, view.id, donor.id, OPTS),
      advanceDonation(db, chain, view.id, donor.id, OPTS),
    ]);
    expect(chain.count("gas")).toBe(1);
  });

  it("an abandoned lock expires, so a crashed worker cannot strand a donation", async () => {
    const { donor, view } = await setup();
    const soon = Date.now();
    await advanceDonation(db, chain, view.id, donor.id, { ...OPTS, now: soon });
    // Simulate a worker that died holding the lock.
    const { donations } = await import("../db/schema");
    const { eq } = await import("drizzle-orm");
    db.update(donations).set({ lockedUntil: soon + 1_000_000 }).where(eq(donations.id, view.id)).run();
    const stuck = await advanceDonation(db, chain, view.id, donor.id, { ...OPTS, now: soon + 1000 });
    expect(stuck.step).toBe(getDonation(db, view.id, donor.id).step);
    const callsBefore = chain.calls.length;
    await advanceDonation(db, chain, view.id, donor.id, { ...OPTS, now: soon + 2_000_000 });
    expect(chain.calls.length).toBeGreaterThan(callsBefore);
  });

  it("only the donor can see or advance their own donation", async () => {
    const { view } = await setup();
    const stranger = await makeDonor(db);
    expect(() => getDonation(db, view.id, stranger.id)).toThrow(DonationNotFoundError);
    await expect(advanceDonation(db, chain, view.id, stranger.id, OPTS)).rejects.toThrow(DonationNotFoundError);
  });
});

describe("amount validation", () => {
  it("returns friendly errors, and never throws, for malformed amounts", async () => {
    const { createDonationSchema } = await import("./validation");
    for (const bad of ["", "abc", "-5", "1.5", "0", "007", "1e9", " 100000000", "999999", "1000000000001", "99999999999999999999"]) {
      const result = createDonationSchema.safeParse({ campaignId: "c", amountMinorUnits: bad });
      expect(result.success, `"${bad}" should be rejected`).toBe(false);
    }
  });

  it("accepts the smallest and largest allowed donations", async () => {
    const { createDonationSchema } = await import("./validation");
    for (const ok of ["1000000", "1000000000000"]) {
      expect(createDonationSchema.safeParse({ campaignId: "c", amountMinorUnits: ok }).success).toBe(true);
    }
  });
});
