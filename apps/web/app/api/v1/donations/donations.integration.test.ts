import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvCache } from "@/lib/env";
import { getDb, resetDbForTests } from "@/lib/db";
import { resetRateLimits } from "@/lib/api/rate-limit";
import { signSession } from "@/lib/auth/session";
import { FakeDonationChain } from "@/lib/donations/fake-chain";
import { makeDonor, makeLiveCampaign } from "@/lib/donations/test-setup";

const shared = vi.hoisted(() => ({ chain: null as unknown, configured: true }));
vi.mock("@/lib/chain/donations", () => ({
  donationsConfigured: () => shared.configured,
  createDonationChain: () => shared.chain,
}));

import { GET as listMine, POST as create } from "./route";
import { GET as getOne } from "./[id]/route";
import { POST as advance } from "./[id]/advance/route";
import { POST as retry } from "./[id]/retry/route";

let chain: FakeDonationChain;

async function cookieFor(userId: string) {
  return `vera_session=${await signSession({ userId, role: "donor" })}`;
}
const req = (method: string, body?: unknown, cookie?: string) =>
  new Request("http://localhost/x", {
    method,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

async function start(amount = "100000000", extra: Record<string, unknown> = {}) {
  const campaign = await makeLiveCampaign(getDb());
  const donor = await makeDonor(getDb());
  const cookie = await cookieFor(donor.id);
  const res = await create(req("POST", { campaignId: campaign.id, amountMinorUnits: amount, ...extra }, cookie));
  return { campaign, donor, cookie, res, body: await res.json() };
}

/** Call /advance until the donation stops being PENDING, as the browser does. */
async function drive(id: string, cookie: string) {
  for (let i = 0; i < 20; i++) {
    const { donation } = await (await advance(req("POST", undefined, cookie), ctx(id))).json();
    if (donation.status !== "PENDING") return donation;
  }
  throw new Error("donation never settled");
}

beforeEach(() => {
  process.env.DATABASE_URL = ":memory:";
  process.env.AUTH_SECRET = "s".repeat(40);
  process.env.WALLET_ENCRYPTION_KEY = "ab".repeat(32);
  process.env.MOCK_INR_ADDRESS = "0x9b6f00a1ce627a3e0d2da601253704084d8fc52c";
  delete process.env.PLATFORM_FEE_MINOR_UNITS;
  delete process.env.PLATFORM_FEE_ADDRESS;
  resetEnvCache();
  resetDbForTests();
  resetRateLimits();
  chain = new FakeDonationChain();
  shared.chain = chain;
  shared.configured = true;
});

describe("POST /api/v1/donations", () => {
  it("requires sign-in", async () => {
    expect((await create(req("POST", { campaignId: "x", amountMinorUnits: "100000000" }))).status).toBe(401);
  });

  it("starts a donation as PENDING without touching the chain", async () => {
    const { res, body } = await start();
    expect(res.status).toBe(201);
    expect(body.donation.status).toBe("PENDING");
    expect(body.donation.feeMinorUnits).toBe("0");
    expect(chain.calls).toHaveLength(0);
  });

  it("says donations are off when the server has no sponsor wallet", async () => {
    shared.configured = false;
    const { res, body } = await start();
    expect(res.status).toBe(503);
    expect(body.error.code).toBe("DONATIONS_NOT_CONFIGURED");
  });

  it("rejects bad amounts with a plain message", async () => {
    for (const amount of ["0", "-5", "1.5", "abc", "999999", "1000000000001"]) {
      const { res, body } = await start(amount);
      expect(res.status).toBe(400);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    }
  });

  it("refuses a campaign that is not live, and a donor whose wallet we cannot sign for", async () => {
    const donor = await makeDonor(getDb());
    const cookie = await cookieFor(donor.id);
    const missing = await create(req("POST", { campaignId: "nope", amountMinorUnits: "100000000" }, cookie));
    expect(missing.status).toBe(409);
    expect((await missing.json()).error.code).toBe("CAMPAIGN_NOT_OPEN");

    const campaign = await makeLiveCampaign(getDb());
    const own = await makeDonor(getDb(), "0xb2Ab1471d98909237B3F3828E7422182584E11E3");
    const res = await create(req("POST", { campaignId: campaign.id, amountMinorUnits: "100000000" }, await cookieFor(own.id)));
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("WALLET_NOT_MANAGED");
  });

  it("with a fee configured, requires an explicit choice and never defaults one", async () => {
    process.env.PLATFORM_FEE_MINOR_UNITS = "2000000";
    process.env.PLATFORM_FEE_ADDRESS = "0x000000000000000000000000000000000000fee0";
    resetEnvCache();
    const none = await start();
    expect(none.res.status).toBe(400);
    expect(none.body.error.code).toBe("FEE_CHOICE_REQUIRED");
    expect((await start("100000000", { feeChoice: "decline" })).body.donation.feeMinorUnits).toBe("0");
    expect((await start("100000000", { feeChoice: "cover" })).body.donation.feeMinorUnits).toBe("2000000");
  });
});

describe("running a donation over HTTP", () => {
  it("advances step by step to CONFIRMED, and only then", async () => {
    const { cookie, body } = await start();
    const id = body.donation_id;
    const statuses: string[] = [];
    for (let i = 0; i < 20; i++) {
      const { donation } = await (await advance(req("POST", undefined, cookie), ctx(id))).json();
      statuses.push(donation.status);
      if (donation.status !== "PENDING") break;
    }
    expect(statuses.at(-1)).toBe("CONFIRMED");
    expect(statuses.slice(0, -1).every((s) => s === "PENDING")).toBe(true);
    expect(chain.kinds()).toEqual(["gas", "mint", "approve", "deposit"]);
    const final = await (await getOne(req("GET", undefined, cookie), ctx(id))).json();
    expect(final.donation.txHash).toBe(chain.lastHash("deposit"));
  });

  it("lists the donor's donations, newest first, and only their own", async () => {
    const a = await start();
    await start();
    const list = await (await listMine(req("GET", undefined, a.cookie))).json();
    expect(list.donations).toHaveLength(1);
    expect(list.donations[0].id).toBe(a.body.donation_id);
  });

  it("shows a stuck-in-flight deposit as pending, never as done", async () => {
    const { cookie, body } = await start();
    for (let i = 0; i < 3; i++) await advance(req("POST", undefined, cookie), ctx(body.donation_id)); // gas, mint, approve
    chain.pendingChecks.set("0xdeposit00000004", 5);
    const { donation } = await (await advance(req("POST", undefined, cookie), ctx(body.donation_id))).json();
    expect(donation.status).toBe("PENDING");
    expect(donation.stage).toBe("confirming");
  });

  it("reports a failure plainly and lets the donor retry from that step", async () => {
    chain.failNextSend = "approve";
    const { cookie, body } = await start();
    const failed = await drive(body.donation_id, cookie);
    expect(failed.status).toBe("FAILED");
    expect(failed.error).toBe("We could not authorise the donation.");

    const retried = await (await retry(req("POST", undefined, cookie), ctx(body.donation_id))).json();
    expect(retried.donation.status).toBe("PENDING");
    expect((await drive(body.donation_id, cookie)).status).toBe("CONFIRMED");
    expect(chain.count("mint")).toBe(1);
  });
});

describe("privacy and limits", () => {
  it("hides one donor's donation from another (404, not 403, so its existence is not revealed)", async () => {
    const owner = await start();
    const stranger = await cookieFor((await makeDonor(getDb())).id);
    const id = owner.body.donation_id;
    expect((await getOne(req("GET", undefined, stranger), ctx(id))).status).toBe(404);
    expect((await advance(req("POST", undefined, stranger), ctx(id))).status).toBe(404);
    expect((await retry(req("POST", undefined, stranger), ctx(id))).status).toBe(404);
    expect(chain.calls).toHaveLength(0);
  });

  it("requires sign-in for reading and advancing", async () => {
    expect((await getOne(req("GET"), ctx("x"))).status).toBe(401);
    expect((await advance(req("POST"), ctx("x"))).status).toBe(401);
  });

  it("rate limits starting donations", async () => {
    const campaign = await makeLiveCampaign(getDb());
    const cookie = await cookieFor((await makeDonor(getDb())).id);
    let last = 0;
    for (let i = 0; i < 12; i++) {
      last = (await create(req("POST", { campaignId: campaign.id, amountMinorUnits: "100000000" }, cookie))).status;
    }
    expect(last).toBe(429);
  });
});
