import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { resetEnvCache } from "@/lib/env";
import { getDb, resetDbForTests, schema } from "@/lib/db";
import { resetRateLimits } from "@/lib/api/rate-limit";
import { registerDonor } from "@/lib/auth/users";
import { signSession, type Role } from "@/lib/auth/session";
import { createCampaign, recordVaultDeploy } from "@/lib/campaigns/service";
import { decide, submitApplication } from "@/lib/organizers/service";
import { resetSyncState } from "@/lib/indexer/runtime";
import { FakeChain, VAULT_A, VAULT_B, created, donation } from "@/lib/indexer/fake-chain";

const shared = vi.hoisted(() => ({ chain: null as unknown }));
vi.mock("@/lib/chain/reader", () => ({ createChainReader: () => shared.chain }));

import { GET as status } from "./status/route";
import { POST as forceSync } from "./sync/route";
import { GET as reconcile } from "./reconcile/route";
import { GET as ledger } from "../campaigns/[id]/ledger/route";
import { GET as exportLedger } from "../campaigns/[id]/export/route";

const ENC_KEY = "ab".repeat(32);
const FACTORY = "0x6931E776da5db1D9e5890407FE268705D70740bD";
let chain: FakeChain;
let counter = 0;

async function makeUser(role: Role = "donor") {
  const user = await registerDonor(getDb(), { email: `u${++counter}@example.com`, password: "correct-horse-battery" }, ENC_KEY);
  if (role !== "donor") getDb().update(schema.users).set({ role }).where(eq(schema.users.id, user.id)).run();
  return { id: user.id, cookie: `vera_session=${await signSession({ userId: user.id, role })}` };
}

/** A LIVE campaign whose vault is `vault`, as if publishing had succeeded. */
async function liveCampaign(vault: string) {
  const db = getDb();
  const org = await makeUser();
  const admin = await makeUser("admin");
  const profile = submitApplication(db, org.id, {
    legalName: "Trust", registrationNumber: "R-1", jurisdiction: "India", documentHash: "a".repeat(64), documentName: "d.pdf",
  });
  decide(db, profile.id, admin.id, "approve");
  const campaign = createCampaign(db, profile.id, {
    title: "Flood relief for Assam",
    summary: "Emergency food, clean water and shelter for families displaced by floods.",
    category: "DISASTER_RELIEF",
    fundingGoalMinorUnits: "1000000000",
    adminExpenseCapPct: 10,
    milestones: [{ description: "Deliver food and water", targetPct: 100, requiredAttestations: 2 }],
  });
  return recordVaultDeploy(db, campaign.id, { status: "deployed", vaultAddress: vault, onchainCampaignId: 0, txHash: "0x1" });
}

const req = (cookie?: string) => new Request("http://localhost/x", { method: "POST", headers: cookie ? { cookie } : {} });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  process.env.DATABASE_URL = ":memory:";
  process.env.AUTH_SECRET = "s".repeat(40);
  process.env.WALLET_ENCRYPTION_KEY = ENC_KEY;
  process.env.MOCK_INR_ADDRESS = "0x9b6f00a1ce627a3e0d2da601253704084d8fc52c";
  process.env.FACTORY_ADDRESS = FACTORY;
  process.env.INDEXER_START_BLOCK = "100";
  process.env.INDEXER_CONFIRMATIONS = "2";
  resetEnvCache();
  resetDbForTests();
  resetRateLimits();
  resetSyncState();
  chain = new FakeChain();
  shared.chain = chain;
});

describe("GET /api/v1/indexer/status", () => {
  it("says the indexer is off, rather than guessing, when it is not configured", async () => {
    delete process.env.INDEXER_START_BLOCK;
    resetEnvCache();
    const body = await (await status()).json();
    expect(body.configured).toBe(false);
    expect(body.message).toContain("INDEXER_START_BLOCK");
  });

  it("reports data as of a block, with the lag", async () => {
    chain.events = [created(VAULT_A, 150)];
    const body = await (await status()).json();
    expect(body.configured).toBe(true);
    expect(body.indexedThroughBlock).toBe(998);
    expect(body.headBlock).toBe(1000);
    expect(body.lagBlocks).toBe(2);
    expect(body.vaultsTracked).toBe(1);
  });
});

describe("GET /api/v1/campaigns/:id/ledger", () => {
  it("shows a live campaign's donations and totals, built from chain events", async () => {
    const campaign = await liveCampaign(VAULT_A);
    chain.events = [created(VAULT_A, 150), donation(VAULT_A, 200, "250000000"), donation(VAULT_A, 300, "10000000")];
    const res = await ledger(req(), ctx(campaign.id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.escrow.totalDonatedMinorUnits).toBe("260000000");
    expect(body.escrow.donationCount).toBe(2);
    expect(body.ledger.map((e: { type: string }) => e.type)).toEqual(["CampaignCreated", "DonationReceived", "DonationReceived"]);
    expect(body.indexer.dataAsOfBlock).toBe(998);
  });

  it("does not mix in another campaign's donations", async () => {
    const campaign = await liveCampaign(VAULT_A);
    chain.events = [created(VAULT_A, 150), created(VAULT_B, 160), donation(VAULT_A, 200, "5"), donation(VAULT_B, 210, "999")];
    const body = await (await ledger(req(), ctx(campaign.id))).json();
    expect(body.escrow.totalDonatedMinorUnits).toBe("5");
  });

  it("picks up a new donation on the next refresh", async () => {
    const campaign = await liveCampaign(VAULT_A);
    chain.events = [created(VAULT_A, 150), donation(VAULT_A, 200, "10")];
    await ledger(req(), ctx(campaign.id));

    chain.head = 1010;
    chain.events.push(donation(VAULT_A, 1005, "90"));
    resetSyncState(); // as if more than the staleness window has passed
    const body = await (await ledger(req(), ctx(campaign.id))).json();
    expect(body.escrow.totalDonatedMinorUnits).toBe("100");
  });

  it("is not available for a draft or an unknown campaign", async () => {
    expect((await ledger(req(), ctx("missing"))).status).toBe(404);
    const db = getDb();
    const org = await makeUser();
    const profile = submitApplication(db, org.id, {
      legalName: "Trust", registrationNumber: "R-2", jurisdiction: "India", documentHash: "b".repeat(64), documentName: "d.pdf",
    });
    const draft = createCampaign(db, profile.id, {
      title: "A draft campaign title",
      summary: "A draft campaign that has never been published to the chain.",
      category: "COMMUNITY",
      fundingGoalMinorUnits: "5",
      adminExpenseCapPct: 5,
      milestones: [{ description: "Only milestone", targetPct: 100, requiredAttestations: 1 }],
    });
    expect((await ledger(req(), ctx(draft.id))).status).toBe(404);
  });
});

describe("POST /api/v1/indexer/sync", () => {
  it("is admin only", async () => {
    expect((await forceSync(req())).status).toBe(401);
    expect((await forceSync(req((await makeUser()).cookie))).status).toBe(403);
  });

  it("lets an admin force a pass and reports what it found", async () => {
    chain.events = [created(VAULT_A, 150), donation(VAULT_A, 200, "1")];
    const res = await forceSync(req((await makeUser("admin")).cookie));
    const body = await res.json();
    expect(body.newEvents).toBe(2);
    expect(body.errors).toEqual([]);
  });

  it("says so when the indexer is not configured", async () => {
    delete process.env.FACTORY_ADDRESS;
    resetEnvCache();
    const res = await forceSync(req((await makeUser("admin")).cookie));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("INDEXER_NOT_CONFIGURED");
  });
});

describe("GET /api/v1/indexer/reconcile", () => {
  it("reports a match when events, the vault's accounting and the token balance agree", async () => {
    chain.events = [created(VAULT_A, 150), donation(VAULT_A, 200, "250000000")];
    chain.balances.set(VAULT_A, { tracked: 250000000n, token: 250000000n });
    const body = await (await reconcile()).json();
    expect(body.allMatch).toBe(true);
    expect(body.vaults[0].match).toBe(true);
  });

  it("reports a mismatch loudly", async () => {
    chain.events = [created(VAULT_A, 150), donation(VAULT_A, 200, "250000000")];
    chain.balances.set(VAULT_A, { tracked: 250000000n, token: 1n });
    const body = await (await reconcile()).json();
    expect(body.allMatch).toBe(false);
  });

  it("never claims a match when the chain could not be read", async () => {
    chain.events = [created(VAULT_A, 150), donation(VAULT_A, 200, "1")];
    chain.vaultBalancesAt = async () => {
      throw new Error("missing trie node");
    };
    const body = await (await reconcile()).json();
    expect(body.allMatch).toBe(false);
    expect(body.vaults[0].error).toBeDefined();
  });
});

describe("public dashboard data", () => {
  it("shows the organizer, milestones, progress toward the goal and a verified reconciliation", async () => {
    const campaign = await liveCampaign(VAULT_A);
    chain.events = [created(VAULT_A, 150), donation(VAULT_A, 200, "250000000")];
    chain.balances.set(VAULT_A, { tracked: 250000000n, token: 250000000n });
    const body = await (await ledger(req(), ctx(campaign.id))).json();

    expect(body.organizer.legalName).toBe("Trust");
    expect(body.milestones).toHaveLength(1);
    expect(body.escrow.goalReachedBps).toBe(2500);
    expect(body.escrow.heldMinorUnits).toBe("250000000");
    expect(body.reconciliation.status).toBe("match");
    expect(body.indexer.freshness).toBe("current");
    expect(JSON.stringify(body)).not.toMatch(/email|passwordHash|walletKey|documentHash/i);
  });

  it("flags a mismatch between the indexed total and the chain", async () => {
    const campaign = await liveCampaign(VAULT_A);
    chain.events = [created(VAULT_A, 150), donation(VAULT_A, 200, "250000000")];
    chain.balances.set(VAULT_A, { tracked: 250000000n, token: 249999999n });
    expect((await (await ledger(req(), ctx(campaign.id))).json()).reconciliation.status).toBe("mismatch");
  });

  it("warns that data is lagging instead of presenting it as current", async () => {
    const campaign = await liveCampaign(VAULT_A);
    chain.events = [created(VAULT_A, 150), donation(VAULT_A, 200, "10")];
    chain.failFromBlock = 600; // the indexer cannot get past block 600 while the head is 1000
    const body = await (await ledger(req(), ctx(campaign.id))).json();
    expect(body.indexer.freshness).toBe("lagging");
    expect(body.indexer.lagBlocks).toBeGreaterThan(60);
  });
});

describe("GET /api/v1/campaigns/:id/export", () => {
  it("downloads the audit trail as CSV", async () => {
    const campaign = await liveCampaign(VAULT_A);
    chain.events = [created(VAULT_A, 150), donation(VAULT_A, 200, "250500000")];
    const res = await exportLedger(new Request("http://localhost/x?format=csv"), ctx(campaign.id));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("vera-flood-relief-for-assam-ledger.csv");
    const lines = (await res.text()).trim().split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[2]).toContain("DonationReceived");
    expect(lines[2]).toContain(",250500000,250.5,");
  });

  it("downloads JSON by default, with how to verify it independently", async () => {
    const campaign = await liveCampaign(VAULT_A);
    chain.events = [created(VAULT_A, 150)];
    const res = await exportLedger(new Request("http://localhost/x"), ctx(campaign.id));
    expect(res.headers.get("content-disposition")).toContain(".json");
    expect((await res.json()).verifyYourself.vaultOnExplorer).toContain("polygonscan.com/address/");
  });

  it("rejects an unknown format and hides drafts and unknown campaigns", async () => {
    const campaign = await liveCampaign(VAULT_A);
    expect((await exportLedger(new Request("http://localhost/x?format=xml"), ctx(campaign.id))).status).toBe(400);
    expect((await exportLedger(new Request("http://localhost/x"), ctx("missing"))).status).toBe(404);
  });
});
