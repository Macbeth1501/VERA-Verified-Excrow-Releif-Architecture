import { beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "../db";
import { VAULT, makeLiveCampaign } from "../donations/test-setup";
import { DISBURSEMENT, FACTORY, FakeChain, MANAGER, REGISTRY, VAULT_A, VAULT_B, attested, beneficiary, created, donation, payout, released } from "../indexer/fake-chain";
import { syncOnce } from "../indexer/sync";
import { ACTIVITY_TYPES, describeEvent, isEventName, listActivity, type KnownContracts } from "./activity";

const config = { startBlock: 100, managerStartBlock: 100, registryStartBlock: 100, disbursementStartBlock: 100, confirmations: 2, maxRange: 2000 };
const known: KnownContracts = { factory: FACTORY, manager: MANAGER, registry: REGISTRY, disbursement: DISBURSEMENT };
let db: Db;
let chain: FakeChain;
let campaignId: string;

beforeEach(async () => {
  db = createDb(":memory:");
  chain = new FakeChain();
  campaignId = (await makeLiveCampaign(db)).id; // its vault is VAULT (= VAULT_A)
  expect(VAULT.toLowerCase()).toBe(VAULT_A);
});

async function seed() {
  chain.events = [
    created(VAULT_A, 150),
    donation(VAULT_A, 200, "250000000"),
    attested(VAULT_A, 300, 0),
    released(VAULT_A, 400, "100000000", 0),
    beneficiary(VAULT_A, 450, `0x${"a1".repeat(32)}`),
    payout(VAULT_A, 500, "30000000", 0),
    created(VAULT_B, 160), // a vault the app never published
    donation(VAULT_B, 210, "5000000"),
  ];
  await syncOnce(db, chain, config);
}

describe("listActivity", () => {
  it("lists every event across campaigns and contracts, newest first", async () => {
    await seed();
    const page = listActivity(db, known);
    expect(page.total).toBe(8);
    expect(page.rows.map((r) => r.blockNumber)).toEqual([500, 450, 400, 300, 210, 200, 160, 150]);
  });

  it("names the emitting contract and the campaign, and marks vaults the app did not publish", async () => {
    await seed();
    const rows = listActivity(db, known).rows;
    const byType = (t: string, block: number) => rows.find((r) => r.type === t && r.blockNumber === block)!;
    expect(byType("CampaignCreated", 150).contract).toBe("CampaignFactory");
    expect(byType("MilestoneReleased", 400).contract).toBe("MilestoneManager");
    expect(byType("BeneficiaryRegistered", 450).contract).toBe("BeneficiaryRegistry");
    expect(byType("PayoutRecorded", 500).contract).toBe("Disbursement");
    expect(byType("DonationReceived", 200).contract).toBe("Campaign vault");
    expect(byType("DonationReceived", 200).campaignId).toBe(campaignId);
    expect(byType("DonationReceived", 200).campaignTitle).toBe("Flood relief for Assam");
    expect(byType("DonationReceived", 210).campaignId).toBeNull();
  });

  it("describes events in plain language with 1-based milestone numbers and rupee amounts", async () => {
    await seed();
    const rows = listActivity(db, known).rows;
    expect(rows.find((r) => r.type === "MilestoneReleased")!.detail).toContain("₹100.00 was released");
    expect(rows.find((r) => r.type === "MilestoneReleased")!.detail).toContain("milestone 1");
    expect(rows.find((r) => r.type === "MilestoneReleased")!.milestoneNumber).toBe(1);
    expect(rows.find((r) => r.type === "PayoutRecorded")!.detail).toContain("₹30.00 was paid to a registered beneficiary");
  });

  it("never repeats a beneficiary fingerprint or payout reference", async () => {
    await seed();
    const text = JSON.stringify(listActivity(db, known).rows);
    expect(text).not.toContain("a1".repeat(32));
  });

  it("filters by campaign and by event type, and an unknown campaign matches nothing", async () => {
    await seed();
    expect(listActivity(db, known, { campaignId }).total).toBe(6);
    expect(listActivity(db, known, { type: "DonationReceived" }).total).toBe(2);
    expect(listActivity(db, known, { campaignId, type: "DonationReceived" }).total).toBe(1);
    const none = listActivity(db, known, { campaignId: "no-such-campaign" });
    expect(none.total).toBe(0);
    expect(none.rows).toEqual([]);
  });

  it("pages, and clamps silly limits and offsets", async () => {
    await seed();
    const first = listActivity(db, known, { limit: 3 });
    expect(first.rows).toHaveLength(3);
    expect(first.total).toBe(8);
    const second = listActivity(db, known, { limit: 3, offset: 3 });
    expect(second.rows.map((r) => r.blockNumber)).toEqual([300, 210, 200]);
    expect(listActivity(db, known, { limit: 0 }).limit).toBe(1);
    expect(listActivity(db, known, { limit: 9999 }).limit).toBe(200);
    expect(listActivity(db, known, { offset: -5 }).offset).toBe(0);
  });

  it("counts every type for the filter menu regardless of the current filter", async () => {
    await seed();
    const counts = listActivity(db, known, { type: "PayoutRecorded" }).countsByType;
    expect(counts.DonationReceived).toBe(2);
    expect(counts.PayoutRecorded).toBe(1);
    expect(counts.MilestoneVerified).toBe(0);
    expect(Object.keys(counts).sort()).toEqual([...ACTIVITY_TYPES].sort());
  });

  it("counts by type for the chosen campaign only, so the summary follows the campaign filter", async () => {
    await seed();
    const all = listActivity(db, known).countsByType;
    const mine = listActivity(db, known, { campaignId }).countsByType;
    expect(all.DonationReceived).toBe(2);
    expect(mine.DonationReceived).toBe(1);
    expect(listActivity(db, known, { campaignId: "no-such-campaign" }).countsByType.DonationReceived).toBe(0);
  });

  it("is empty, not an error, before anything is indexed", () => {
    const page = listActivity(db, known);
    expect(page.total).toBe(0);
    expect(page.rows).toEqual([]);
  });
});

describe("helpers", () => {
  it("recognises only real event names", () => {
    expect(isEventName("DonationReceived")).toBe(true);
    expect(isEventName("Nope")).toBe(false);
    expect(isEventName(null)).toBe(false);
  });

  it("describes a milestone event without a milestone number gracefully", () => {
    expect(describeEvent("MilestoneAttested", { actor: null, amount: null, milestoneNumber: null, campaignTitle: null })).toBe("Attestor someone confirmed a milestone.");
  });
});
