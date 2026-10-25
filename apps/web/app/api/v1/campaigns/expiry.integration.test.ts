import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimits } from "@/lib/api/rate-limit";
import { signSession } from "@/lib/auth/session";
import { getDb, resetDbForTests } from "@/lib/db";
import { campaigns } from "@/lib/db/schema";
import { VAULT, makeDonor, makeLiveCampaign } from "@/lib/donations/test-setup";
import { resetEnvCache } from "@/lib/env";
import { FakeExpiryChain } from "@/lib/expiry/fake-chain";

const shared = vi.hoisted(() => ({ chain: null as unknown }));
vi.mock("@/lib/chain/expiry", () => ({ expiryChain: () => shared.chain }));

import { POST as close } from "./[id]/close/route";
import { GET as refundStatus, POST as claim } from "./[id]/refund/route";

let chain: FakeExpiryChain;

const req = (method: string, cookie?: string) =>
  new Request("http://localhost/x", { method, headers: cookie ? { cookie } : {} });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const cookieFor = async (userId: string) => `vera_session=${await signSession({ userId, role: "donor" })}`;

beforeEach(() => {
  process.env.DATABASE_URL = ":memory:";
  process.env.AUTH_SECRET = "s".repeat(40);
  process.env.WALLET_ENCRYPTION_KEY = "ab".repeat(32);
  process.env.MOCK_INR_ADDRESS = "0x9b6f00a1ce627a3e0d2da601253704084d8fc52c";
  resetEnvCache();
  resetDbForTests();
  resetRateLimits();
  chain = new FakeExpiryChain();
  shared.chain = chain;
});

/** A live campaign published with a deadline, so it can expire. */
async function expiring() {
  const db = getDb();
  const campaign = await makeLiveCampaign(db);
  db.update(campaigns).set({ deadlineAt: "2026-12-30T00:00:00.000Z" }).where(eq(campaigns.id, campaign.id)).run();
  return campaign;
}

describe("POST /api/v1/campaigns/:id/close", () => {
  it("needs sign-in", async () => {
    const c = await expiring();
    expect((await close(req("POST"), ctx(c.id))).status).toBe(401);
    expect(chain.closes).toHaveLength(0);
  });

  it("lets any signed-in user close a closable campaign", async () => {
    const c = await expiring();
    chain.donate(VAULT, "0xaaa", 100n);
    const stranger = await makeDonor(getDb());
    const res = await close(req("POST", await cookieFor(stranger.id)), ctx(c.id));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ closed: true, txHash: expect.stringMatching(/^0xclose/) });
    expect(chain.closes).toEqual([VAULT]);
  });

  it("passes the contract's own refusal on as a plain 422 when it is not closable yet", async () => {
    const c = await expiring();
    chain.donate(VAULT, "0xaaa", 100n);
    chain.closableError = "This campaign cannot be closed yet: its end date has not passed.";
    const user = await makeDonor(getDb());
    const res = await close(req("POST", await cookieFor(user.id)), ctx(c.id));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatchObject({ code: "CHAIN_FAILED", message: expect.stringContaining("end date has not passed") });
    expect(chain.closes).toHaveLength(0);
  });

  it("says plainly that a campaign published before expiry existed cannot be closed", async () => {
    const old = await makeLiveCampaign(getDb()); // no deadline recorded
    const user = await makeDonor(getDb());
    const res = await close(req("POST", await cookieFor(user.id)), ctx(old.id));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("EXPIRY_NOT_AVAILABLE");
  });

  it("404s for a campaign that does not exist and 503s when the sponsor is not configured", async () => {
    const user = await makeDonor(getDb());
    const cookie = await cookieFor(user.id);
    expect((await close(req("POST", cookie), ctx("nope"))).status).toBe(404);
    const c = await expiring();
    chain.isConfigured = false;
    const res = await close(req("POST", cookie), ctx(c.id));
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("EXPIRY_NOT_CONFIGURED");
  });
});

describe("GET and POST /api/v1/campaigns/:id/refund", () => {
  it("shows a donor their share once the campaign is closed, pro rata", async () => {
    const c = await expiring();
    const alice = await makeDonor(getDb());
    const bob = await makeDonor(getDb());
    chain.donate(VAULT, alice.walletAddress, 300n);
    chain.donate(VAULT, bob.walletAddress, 100n);

    const before = await (await refundStatus(req("GET", await cookieFor(alice.id)), ctx(c.id))).json();
    expect(before.refund).toEqual({ closed: false, claimed: false, amountMinorUnits: "0" });

    await chain.close(VAULT);
    const a = await (await refundStatus(req("GET", await cookieFor(alice.id)), ctx(c.id))).json();
    const b = await (await refundStatus(req("GET", await cookieFor(bob.id)), ctx(c.id))).json();
    expect(a.refund).toEqual({ closed: true, claimed: false, amountMinorUnits: "300" });
    expect(b.refund).toEqual({ closed: true, claimed: false, amountMinorUnits: "100" });
  });

  it("pays the refund from the donor's own wallet, once", async () => {
    const c = await expiring();
    const alice = await makeDonor(getDb());
    chain.donate(VAULT, alice.walletAddress, 300n);
    await chain.close(VAULT);

    const cookie = await cookieFor(alice.id);
    const res = await claim(req("POST", cookie), ctx(c.id));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ claimed: true });
    expect(chain.claims).toEqual([{ vault: VAULT, donor: alice.walletAddress.toLowerCase() }]);

    const again = await claim(req("POST", cookie), ctx(c.id));
    expect(again.status).toBe(409);
    expect((await again.json()).error.code).toBe("NO_REFUND_DUE");
    expect(chain.claims).toHaveLength(1);
  });

  it("refuses before the campaign is closed, and for someone who never donated", async () => {
    const c = await expiring();
    const alice = await makeDonor(getDb());
    const stranger = await makeDonor(getDb());
    chain.donate(VAULT, alice.walletAddress, 300n);

    const early = await claim(req("POST", await cookieFor(alice.id)), ctx(c.id));
    expect(early.status).toBe(409);
    expect((await early.json()).error.code).toBe("NOT_CLOSED");

    await chain.close(VAULT);
    const none = await claim(req("POST", await cookieFor(stranger.id)), ctx(c.id));
    expect(none.status).toBe(409);
    expect((await none.json()).error.code).toBe("NO_REFUND_DUE");
    expect(chain.claims).toHaveLength(0);
  });

  it("needs sign-in, and reports an unreadable chain as 503 instead of guessing", async () => {
    const c = await expiring();
    expect((await refundStatus(req("GET"), ctx(c.id))).status).toBe(401);
    expect((await claim(req("POST"), ctx(c.id))).status).toBe(401);

    const user = await makeDonor(getDb());
    chain.unreadable = true;
    const res = await refundStatus(req("GET", await cookieFor(user.id)), ctx(c.id));
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("CHAIN_UNAVAILABLE");
  });

  it("surfaces a failed claim and does not mark it claimed", async () => {
    const c = await expiring();
    const alice = await makeDonor(getDb());
    chain.donate(VAULT, alice.walletAddress, 300n);
    await chain.close(VAULT);
    chain.failNext = "Network fees are unusually high right now.";

    const cookie = await cookieFor(alice.id);
    const failed = await claim(req("POST", cookie), ctx(c.id));
    expect(failed.status).toBe(422);
    const retry = await claim(req("POST", cookie), ctx(c.id));
    expect(retry.status).toBe(200);
  });
});
