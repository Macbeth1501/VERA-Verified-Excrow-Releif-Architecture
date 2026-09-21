import { beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "../db";
import { indexerStatus, reconcileVault, vaultLedger, vaultTotals } from "./queries";
import { allCursors } from "./store";
import { syncOnce } from "./sync";
import { FakeChain, VAULT_A, VAULT_B, attested, beneficiary, created, donation, released } from "./fake-chain";

const config = { startBlock: 100, confirmations: 2, maxRange: 2000 };
let db: Db;
let chain: FakeChain;

beforeEach(() => {
  db = createDb(":memory:");
  chain = new FakeChain();
});

describe("indexing events", () => {
  it("finds a campaign's vault and its donations, and derives the total", async () => {
    chain.events = [created(VAULT_A, 150), donation(VAULT_A, 200, "250000000"), donation(VAULT_A, 300, "10000000")];
    const result = await syncOnce(db, chain, config);

    expect(result.errors).toEqual([]);
    expect(result.newEvents).toBe(3);
    const totals = vaultTotals(db, VAULT_A);
    expect(totals.totalDonated).toBe("260000000");
    expect(totals.donationCount).toBe(2);
    expect(totals.indexedThroughBlock).toBe(998);
  });

  it("returns the ledger in chain order with donor, amount and timestamp", async () => {
    chain.events = [donation(VAULT_A, 300, "5"), created(VAULT_A, 150), donation(VAULT_A, 200, "7")];
    await syncOnce(db, chain, config);
    const ledger = vaultLedger(db, VAULT_A);
    expect(ledger.map((e) => [e.type, e.blockNumber, e.amount])).toEqual([
      ["CampaignCreated", 150, null],
      ["DonationReceived", 200, "7"],
      ["DonationReceived", 300, "5"],
    ]);
    expect(ledger[1].timestamp).toMatch(/^20\d\d-/);
    expect(ledger[1].actor).toMatch(/^0x1111/);
  });

  it("is idempotent: running again adds nothing and changes no totals", async () => {
    chain.events = [created(VAULT_A, 150), donation(VAULT_A, 200, "100")];
    await syncOnce(db, chain, config);
    const again = await syncOnce(db, chain, config);
    expect(again.newEvents).toBe(0);
    expect(vaultTotals(db, VAULT_A).totalDonated).toBe("100");
  });

  it("keeps two donations from the same transaction apart by log index", async () => {
    const tx = "0x" + "e".repeat(64);
    chain.events = [created(VAULT_A, 150), donation(VAULT_A, 200, "1", 0, tx), donation(VAULT_A, 200, "2", 1, tx)];
    await syncOnce(db, chain, config);
    expect(vaultTotals(db, VAULT_A).totalDonated).toBe("3");
  });

  it("keeps campaigns separate", async () => {
    chain.events = [created(VAULT_A, 150), created(VAULT_B, 160), donation(VAULT_A, 200, "10"), donation(VAULT_B, 210, "99")];
    await syncOnce(db, chain, config);
    expect(vaultTotals(db, VAULT_A).totalDonated).toBe("10");
    expect(vaultTotals(db, VAULT_B).totalDonated).toBe("99");
  });

  it("sums amounts exactly, beyond floating-point range", async () => {
    chain.events = [created(VAULT_A, 150), donation(VAULT_A, 200, "9007199254740993"), donation(VAULT_A, 210, "1")];
    await syncOnce(db, chain, config);
    expect(vaultTotals(db, VAULT_A).totalDonated).toBe("9007199254740994");
  });
});

describe("confirmations and lag", () => {
  it("does not index blocks that are not yet deep enough", async () => {
    chain.head = 500;
    chain.events = [created(VAULT_A, 150), donation(VAULT_A, 499, "50")];
    await syncOnce(db, chain, config);
    expect(vaultTotals(db, VAULT_A).donationCount).toBe(0);

    chain.head = 502;
    await syncOnce(db, chain, config);
    expect(vaultTotals(db, VAULT_A).totalDonated).toBe("50");
  });

  it("reports data as of the lowest block every stream has reached, and the lag", async () => {
    chain.events = [created(VAULT_A, 150)];
    await syncOnce(db, chain, config);
    chain.head = 1010;
    const status = await indexerStatus(db, chain);
    expect(status.indexedThroughBlock).toBe(998);
    expect(status.headBlock).toBe(1010);
    expect(status.lagBlocks).toBe(12);
    expect(status.vaultsTracked).toBe(1);
  });

  it("reports unknown lag when the chain cannot be reached, instead of guessing", async () => {
    chain.events = [created(VAULT_A, 150)];
    await syncOnce(db, chain, config);
    chain.headFails = true;
    const status = await indexerStatus(db, chain);
    expect(status.headBlock).toBeNull();
    expect(status.lagBlocks).toBeNull();
    expect(status.indexedThroughBlock).toBe(998);
  });
});

describe("resilience", () => {
  it("shrinks its read window when an RPC refuses wide ranges, and still gets every event", async () => {
    chain.maxRange = 100;
    chain.events = [created(VAULT_A, 150), donation(VAULT_A, 400, "1"), donation(VAULT_A, 900, "2")];
    const result = await syncOnce(db, chain, config);
    expect(result.errors).toEqual([]);
    expect(vaultTotals(db, VAULT_A).totalDonated).toBe("3");
    // The first, oversized request was refused; every request that succeeded fit the limit.
    expect(chain.calls[0].to - chain.calls[0].from + 1).toBeGreaterThan(100);
    expect(chain.calls.at(-1)!.to - chain.calls.at(-1)!.from + 1).toBeLessThanOrEqual(100);
  });

  it("does not advance a cursor past a failure, then resumes with no gap and no duplicate", async () => {
    chain.events = [created(VAULT_A, 150), donation(VAULT_A, 200, "10"), donation(VAULT_A, 700, "20")];
    chain.failFromBlock = 600;
    const failed = await syncOnce(db, chain, config);
    expect(failed.errors.length).toBeGreaterThan(0);
    expect(vaultTotals(db, VAULT_A).totalDonated).toBe("10");
    const cursor = allCursors(db).find((c) => c.stream === `vault:${VAULT_A}`);
    expect(cursor?.lastBlock).toBeLessThan(600);

    chain.failFromBlock = null;
    const resumed = await syncOnce(db, chain, config);
    expect(resumed.errors).toEqual([]);
    expect(vaultTotals(db, VAULT_A).totalDonated).toBe("30");
    expect(vaultTotals(db, VAULT_A).donationCount).toBe(2);
  });

  it("returns an error instead of throwing when the chain head is unreachable", async () => {
    chain.headFails = true;
    const result = await syncOnce(db, chain, config);
    expect(result.headBlock).toBeNull();
    expect(result.errors[0]).toContain("chain head");
  });

  it("picks up a vault created after an earlier pass and reads all of its donations from creation onward", async () => {
    chain.head = 600;
    chain.events = [created(VAULT_A, 150)];
    await syncOnce(db, chain, config);
    expect(vaultTotals(db, VAULT_B).indexedThroughBlock).toBeNull();

    chain.head = 900;
    chain.events.push(created(VAULT_B, 700), donation(VAULT_B, 700, "4"), donation(VAULT_B, 705, "6"));
    await syncOnce(db, chain, config);
    expect(vaultTotals(db, VAULT_B).totalDonated).toBe("10");
    expect(vaultTotals(db, VAULT_B).donationCount).toBe(2);
    expect(vaultTotals(db, VAULT_A).donationCount).toBe(0);
  });

  it("starts at the configured start block, never earlier", async () => {
    chain.events = [created(VAULT_A, 150)];
    await syncOnce(db, chain, config);
    expect(Math.min(...chain.calls.filter((c) => c.kind === "factory").map((c) => c.from))).toBe(100);
  });
});

describe("reconciliation (zero tolerance)", () => {
  it("matches when the indexed total equals the vault's accounting and the token balance", async () => {
    chain.events = [created(VAULT_A, 150), donation(VAULT_A, 200, "250000000")];
    chain.balances.set(VAULT_A, { tracked: 250000000n, token: 250000000n });
    await syncOnce(db, chain, config);
    const row = await reconcileVault(db, chain, VAULT_A);
    expect(row?.match).toBe(true);
    expect(row?.checkedAtBlock).toBe(998);
  });

  it("flags any difference, even a single unit", async () => {
    chain.events = [created(VAULT_A, 150), donation(VAULT_A, 200, "250000000")];
    await syncOnce(db, chain, config);
    for (const [tracked, token] of [[250000001n, 250000000n], [250000000n, 249999999n]] as const) {
      chain.balances.set(VAULT_A, { tracked, token });
      expect((await reconcileVault(db, chain, VAULT_A))?.match).toBe(false);
    }
  });

  it("has nothing to reconcile for a vault that was never indexed", async () => {
    expect(await reconcileVault(db, chain, VAULT_B)).toBeNull();
  });
});

describe("milestone events (Step 4 manager)", () => {
  const withManager = { ...config, managerStartBlock: 100 };

  it("subtracts releases from the vault balance and reconciles against the chain", async () => {
    chain.events = [created(VAULT_A, 150), donation(VAULT_A, 200, "100000000"), attested(VAULT_A, 250), released(VAULT_A, 300, "40000000")];
    chain.balances.set(VAULT_A, { tracked: 60000000n, token: 60000000n });
    await syncOnce(db, chain, withManager);

    const totals = vaultTotals(db, VAULT_A);
    expect(totals.totalDonated).toBe("100000000");
    expect(totals.totalReleased).toBe("40000000");
    expect(totals.balance).toBe("60000000");
    expect((await reconcileVault(db, chain, VAULT_A))?.match).toBe(true);
  });

  it("shows attestations and the release in the ledger, tied to their milestone", async () => {
    chain.events = [created(VAULT_A, 150), attested(VAULT_A, 250, 1), released(VAULT_A, 300, "5", 1)];
    await syncOnce(db, chain, withManager);
    const ledger = vaultLedger(db, VAULT_A);
    expect(ledger.map((e) => [e.type, e.milestoneIndex])).toEqual([
      ["CampaignCreated", null],
      ["MilestoneAttested", 1],
      ["MilestoneReleased", 1],
    ]);
    expect(ledger[2].amount).toBe("5");
  });

  it("ignores the manager entirely when no start block is configured", async () => {
    chain.events = [created(VAULT_A, 150), released(VAULT_A, 300, "5")];
    await syncOnce(db, chain, config);
    expect(vaultTotals(db, VAULT_A).totalReleased).toBe("0");
  });

  it("does not count a release twice when read again", async () => {
    chain.events = [created(VAULT_A, 150), donation(VAULT_A, 200, "100"), released(VAULT_A, 300, "40")];
    await syncOnce(db, chain, withManager);
    await syncOnce(db, chain, withManager);
    expect(vaultTotals(db, VAULT_A).balance).toBe("60");
  });
});

describe("beneficiary events (Step 13 registry)", () => {
  const withRegistry = { ...config, registryStartBlock: 100 };
  const H = (n: number) => `0x${n.toString(16).padStart(2, "0").repeat(32)}`;

  it("counts each registered beneficiary for its own campaign", async () => {
    chain.events = [
      created(VAULT_A, 150),
      created(VAULT_B, 151),
      beneficiary(VAULT_A, 200, H(1)),
      beneficiary(VAULT_A, 201, H(2), 1),
      beneficiary(VAULT_B, 202, H(3)),
    ];
    await syncOnce(db, chain, withRegistry);

    expect(vaultTotals(db, VAULT_A).beneficiaryCount).toBe(2);
    expect(vaultTotals(db, VAULT_B).beneficiaryCount).toBe(1);
  });

  it("does not count one twice when the same range is read again", async () => {
    chain.events = [created(VAULT_A, 150), beneficiary(VAULT_A, 200, H(1))];
    await syncOnce(db, chain, withRegistry);
    const second = await syncOnce(db, chain, withRegistry);

    expect(second.newEvents).toBe(0);
    expect(vaultTotals(db, VAULT_A).beneficiaryCount).toBe(1);
  });

  it("ignores the registry entirely when no start block is configured", async () => {
    chain.events = [created(VAULT_A, 150), beneficiary(VAULT_A, 200, H(1))];
    await syncOnce(db, chain, config);

    expect(vaultTotals(db, VAULT_A).beneficiaryCount).toBe(0);
    expect(allCursors(db).map((c) => c.stream)).not.toContain("registry");
  });

  it("keeps fingerprints out of the ledger and never treats one as a milestone", async () => {
    chain.events = [created(VAULT_A, 150), beneficiary(VAULT_A, 200, H(1), 7), donation(VAULT_A, 210, "250000000")];
    await syncOnce(db, chain, withRegistry);

    const ledger = vaultLedger(db, VAULT_A);
    expect(ledger.map((e) => e.type)).toEqual(["CampaignCreated", "DonationReceived"]);
    expect(JSON.stringify(ledger)).not.toContain(H(1));
    expect(ledger.every((e) => e.milestoneIndex === null)).toBe(true);
  });

  it("leaves the money figures and reconciliation untouched", async () => {
    chain.events = [created(VAULT_A, 150), donation(VAULT_A, 200, "250000000"), beneficiary(VAULT_A, 205, H(1))];
    chain.balances.set(VAULT_A, { tracked: 250000000n, token: 250000000n });
    await syncOnce(db, chain, withRegistry);

    const totals = vaultTotals(db, VAULT_A);
    expect([totals.totalDonated, totals.balance, totals.donationCount]).toEqual(["250000000", "250000000", 1]);
    expect((await reconcileVault(db, chain, VAULT_A))?.match).toBe(true);
  });

  it("counts a milestone release and a beneficiary registration separately", async () => {
    chain.events = [
      created(VAULT_A, 150),
      donation(VAULT_A, 200, "250000000"),
      beneficiary(VAULT_A, 205, H(1)),
      released(VAULT_A, 210, "150000000"),
      attested(VAULT_A, 208),
    ];
    await syncOnce(db, chain, { ...withRegistry, managerStartBlock: 100 });

    const totals = vaultTotals(db, VAULT_A);
    expect(totals.totalReleased).toBe("150000000");
    expect(totals.beneficiaryCount).toBe(1);
    expect(vaultLedger(db, VAULT_A).filter((e) => e.type === "MilestoneAttested")).toHaveLength(1);
  });
});
