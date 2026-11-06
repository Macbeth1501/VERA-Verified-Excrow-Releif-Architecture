import { beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "../db";
import { makeLiveCampaign } from "../donations/test-setup";
import { FakeEscrowChain } from "./fake-chain";
import { getReleaseLimit, setReleaseLimit } from "./limits";
import { MAX_RELEASE_LIMIT_RUPEES, releaseLimitToMinorUnits } from "./release-limit";
import { defineMilestonesOnChain } from "./service";
import { releaseLimitSchema } from "./validation";

describe("releaseLimitToMinorUnits", () => {
  it("converts rupees to minor units", () => {
    expect(releaseLimitToMinorUnits("250.5")).toBe("250500000");
    expect(releaseLimitToMinorUnits("100")).toBe("100000000");
    expect(releaseLimitToMinorUnits("1,000.25")).toBe("1000250000");
  });

  it("accepts 0 (every release then needs the council) and the cap", () => {
    expect(releaseLimitToMinorUnits("0")).toBe("0");
    expect(releaseLimitToMinorUnits(String(MAX_RELEASE_LIMIT_RUPEES))).toBe("10000000000000");
  });

  it("rejects negative, non-numeric, more than 2 decimals, empty and over the cap", () => {
    for (const bad of ["-1", "abc", "1.234", "", "  ", "1e3", String(MAX_RELEASE_LIMIT_RUPEES + 1)]) {
      expect(releaseLimitToMinorUnits(bad), bad).toBeNull();
    }
  });

  it("the schema returns minor units or a field error", () => {
    expect(releaseLimitSchema.parse({ limitRupees: "250.5" }).limitRupees).toBe("250500000");
    expect(releaseLimitSchema.safeParse({ limitRupees: "-5" }).success).toBe(false);
  });
});

describe("get/set release limit (fake chain)", () => {
  let chain: FakeEscrowChain;
  beforeEach(() => {
    chain = new FakeEscrowChain();
  });

  it("reads the current value, and reports not configured / unreadable", async () => {
    expect(await getReleaseLimit(chain)).toEqual({ configured: true, limitMinorUnits: "100000000" });
    chain.unreadable = true;
    expect(await getReleaseLimit(chain)).toEqual({ configured: true, limitMinorUnits: null });
    chain.isConfigured = false;
    expect(await getReleaseLimit(chain)).toEqual({ configured: false, limitMinorUnits: null });
  });

  it("sets the value and returns the hash", async () => {
    const r = await setReleaseLimit(chain, "250500000");
    expect(r.ok && r.txHash).toMatch(/^0x/);
    expect(await chain.readAutoReleaseLimit()).toBe("250500000");
  });

  it("refuses when not configured, reports a chain failure, and a hung send is pending not failed", async () => {
    chain.isConfigured = false;
    const off = await setReleaseLimit(chain, "1");
    expect(!off.ok && off.code).toBe("ESCROW_NOT_CONFIGURED");
    chain.isConfigured = true;
    chain.failNext = "rpc down";
    const failed = await setReleaseLimit(chain, "1");
    expect(!failed.ok && failed.code).toBe("CHAIN_FAILED");
    chain.hangNext = true;
    const hung = await setReleaseLimit(chain, "1");
    expect(hung.ok && hung.pending).toBe(true);
  });
});

describe("the limit is snapshotted per milestone (safety property)", () => {
  let db: Db;
  let chain: FakeEscrowChain;
  beforeEach(() => {
    db = createDb(":memory:");
    chain = new FakeEscrowChain();
  });

  it("a new value applies to milestones defined afterwards; defined ones keep the old value", async () => {
    const first = await makeLiveCampaign(db);
    expect((await defineMilestonesOnChain(db, chain, first.id)).status).toBe("defined");
    const firstVault = first.vaultContractAddress!;

    await setReleaseLimit(chain, "5000000"); // ₹5

    const laterVault = "0x1111111111111111111111111111111111111111";
    await chain.defineMilestone({ address: "0xorganizer", keyEnc: "" }, laterVault, 100, 2, () => undefined);

    expect((await chain.readMilestone(firstVault, 0))?.autoReleaseLimit).toBe("100000000");
    expect((await chain.readMilestone(laterVault, 0))?.autoReleaseLimit).toBe("5000000");
  });
});
