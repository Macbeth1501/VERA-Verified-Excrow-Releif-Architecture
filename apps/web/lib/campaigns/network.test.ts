import { beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "../db";
import { VAULT, makeLiveCampaign } from "../donations/test-setup";
import { FakeChain, VAULT_A, VAULT_B, created, donation, payout, released } from "../indexer/fake-chain";
import { syncOnce } from "../indexer/sync";
import type { RawEvent } from "../indexer/types";
import { networkTotals } from "./network";

const config = { startBlock: 100, managerStartBlock: 100, registryStartBlock: 100, disbursementStartBlock: 100, confirmations: 2, maxRange: 2000 };
let db: Db;
let chain: FakeChain;

const verified = (vault: string, blockNumber: number, index = 0): RawEvent => ({
  name: "MilestoneVerified",
  contract: "0xe6d7222dde3ee4b9688269427631adf49229e747",
  vault,
  blockNumber,
  txHash: `0xe${String(blockNumber).padStart(63, "0")}`,
  logIndex: 1,
  args: { vault, index: String(index) },
});

beforeEach(() => {
  db = createDb(":memory:");
  chain = new FakeChain();
});

describe("networkTotals", () => {
  it("is null when no campaign is published, so the page shows no invented figure", () => {
    expect(networkTotals(db)).toBeNull();
  });

  it("sums donated, released, paid out and held over the published campaigns only", async () => {
    await makeLiveCampaign(db);
    expect(VAULT.toLowerCase()).toBe(VAULT_A);
    chain.events = [
      created(VAULT_A, 150),
      donation(VAULT_A, 200, "250000000"),
      verified(VAULT_A, 300),
      released(VAULT_A, 400, "100000000", 0),
      payout(VAULT_A, 500, "30000000", 0),
      created(VAULT_B, 160), // never published in the app: must not count
      donation(VAULT_B, 210, "999000000"),
    ];
    await syncOnce(db, chain, config);
    const t = networkTotals(db)!;
    expect(t).toMatchObject({
      campaigns: 1,
      donated: "250000000",
      released: "100000000",
      held: "150000000",
      paidOut: "30000000",
      confirmedMilestones: 1,
    });
    expect(t.indexedThroughBlock).toBe(998);
  });

  it("reports zeros, not nulls, for a published campaign with no activity yet", async () => {
    await makeLiveCampaign(db);
    expect(networkTotals(db)).toMatchObject({ campaigns: 1, donated: "0", held: "0", released: "0", paidOut: "0", confirmedMilestones: 0 });
  });
});
