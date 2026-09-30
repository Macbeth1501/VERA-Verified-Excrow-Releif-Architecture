import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvCache } from "@/lib/env";
import { getDb, resetDbForTests } from "@/lib/db";
import { resetSyncState } from "@/lib/indexer/runtime";
import { FakeChain, VAULT_A, VAULT_B, created, donation } from "@/lib/indexer/fake-chain";
import { makeLiveCampaign } from "@/lib/donations/test-setup";

const shared = vi.hoisted(() => ({ chain: null as unknown }));
vi.mock("@/lib/chain/reader", () => ({ createChainReader: () => shared.chain }));

import { GET as activity } from "./route";

const FACTORY = "0x6931E776da5db1D9e5890407FE268705D70740bD";
let chain: FakeChain;

const get = (query = "") => activity(new Request(`http://localhost/api/v1/activity${query}`));

beforeEach(() => {
  process.env.DATABASE_URL = ":memory:";
  process.env.AUTH_SECRET = "s".repeat(40);
  process.env.WALLET_ENCRYPTION_KEY = "ab".repeat(32);
  process.env.MOCK_INR_ADDRESS = "0x9b6f00a1ce627a3e0d2da601253704084d8fc52c";
  process.env.FACTORY_ADDRESS = FACTORY;
  process.env.INDEXER_START_BLOCK = "100";
  process.env.INDEXER_CONFIRMATIONS = "2";
  resetEnvCache();
  resetDbForTests();
  resetSyncState();
  chain = new FakeChain();
  shared.chain = chain;
});

describe("GET /api/v1/activity", () => {
  it("is public and lists indexed events newest first, with freshness", async () => {
    await makeLiveCampaign(getDb());
    chain.events = [created(VAULT_A, 150), donation(VAULT_A, 200, "250000000")];
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body.total).toBe(2);
    expect(body.rows.map((r: { type: string }) => r.type)).toEqual(["DonationReceived", "CampaignCreated"]);
    expect(body.rows[0].detail).toContain("₹250.00 was donated");
    expect(body.rows[0].campaignTitle).toBe("Flood relief for Assam");
    expect(body.indexer).toMatchObject({ configured: true, dataAsOfBlock: 998, freshness: "current" });
  });

  it("filters by type and by campaign, and pages", async () => {
    const campaign = await makeLiveCampaign(getDb());
    chain.events = [created(VAULT_A, 150), created(VAULT_B, 160), donation(VAULT_A, 200, "5"), donation(VAULT_B, 210, "9"), donation(VAULT_A, 220, "7")];
    expect((await (await get("?type=DonationReceived")).json()).total).toBe(3);
    expect((await (await get(`?campaign=${campaign.id}`)).json()).total).toBe(3);
    expect((await (await get(`?campaign=${campaign.id}&type=DonationReceived`)).json()).total).toBe(2);
    const paged = await (await get("?limit=2&offset=2")).json();
    expect(paged.rows).toHaveLength(2);
    expect(paged.total).toBe(5);
  });

  it("refuses an unknown event type or a non-numeric page size with a clear error", async () => {
    const badType = await get("?type=Nonsense");
    expect(badType.status).toBe(400);
    expect((await badType.json()).error.code).toBe("VALIDATION_FAILED");
    expect((await get("?limit=abc")).status).toBe(400);
  });

  it("says the indexer is off instead of pretending the history is complete", async () => {
    delete process.env.INDEXER_START_BLOCK;
    resetEnvCache();
    const body = await (await get()).json();
    expect(body.indexer).toMatchObject({ configured: false, freshness: "off" });
    expect(body.rows).toEqual([]);
  });
});
