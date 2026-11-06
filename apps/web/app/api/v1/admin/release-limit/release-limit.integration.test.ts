/** Integration tests for /api/v1/admin/release-limit: admin-only access, validation, unreadable chain and success. */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { resetEnvCache } from "@/lib/env";
import { getDb, resetDbForTests, schema } from "@/lib/db";
import { resetRateLimits } from "@/lib/api/rate-limit";
import { registerDonor } from "@/lib/auth/users";
import { signSession, type Role } from "@/lib/auth/session";
import { FakeEscrowChain } from "@/lib/escrow/fake-chain";

const fake = vi.hoisted(() => ({ chain: null as unknown }));
vi.mock("@/lib/chain/manager", () => ({ escrowChain: () => fake.chain }));

import { GET, POST } from "./route";

const ENC_KEY = "ab".repeat(32);
let chain: FakeEscrowChain;
let counter = 0;

async function cookieFor(role: Role) {
  const user = await registerDonor(getDb(), { email: `u${++counter}@example.com`, password: "correct-horse-battery" }, ENC_KEY);
  if (role !== "donor") getDb().update(schema.users).set({ role }).where(eq(schema.users.id, user.id)).run();
  return `vera_session=${await signSession({ userId: user.id, role })}`;
}

const req = (method: string, body?: unknown, cookie?: string) =>
  new Request("http://localhost/x", {
    method,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

beforeEach(() => {
  process.env.DATABASE_URL = ":memory:";
  process.env.AUTH_SECRET = "s".repeat(40);
  process.env.WALLET_ENCRYPTION_KEY = ENC_KEY;
  process.env.MOCK_INR_ADDRESS = "0x9b6f00a1ce627a3e0d2da601253704084d8fc52c";
  resetEnvCache();
  resetDbForTests();
  resetRateLimits();
  chain = new FakeEscrowChain();
  fake.chain = chain;
});

describe("access", () => {
  it("signed-out gets 401, non-admins get 403, on both methods", async () => {
    expect((await GET(req("GET"))).status).toBe(401);
    expect((await POST(req("POST", { limitRupees: "5" }))).status).toBe(401);
    for (const role of ["donor", "organizer", "attestor", "council"] as const) {
      const cookie = await cookieFor(role);
      expect((await GET(req("GET", undefined, cookie))).status).toBe(403);
      expect((await POST(req("POST", { limitRupees: "5" }, cookie))).status).toBe(403);
    }
    expect(chain.sent).toEqual([]);
  });
});

describe("GET", () => {
  it("returns the limit read from the chain", async () => {
    const res = await GET(req("GET", undefined, await cookieFor("admin")));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ limitMinorUnits: "100000000", configured: true });
  });

  it("returns 503, never a guessed value, when the chain cannot be read", async () => {
    chain.unreadable = true;
    const res = await GET(req("GET", undefined, await cookieFor("admin")));
    expect(res.status).toBe(503);
    expect((await res.json()).limitMinorUnits).toBeUndefined();
  });

  it("reports configured: false when escrow is off", async () => {
    chain.isConfigured = false;
    const res = await GET(req("GET", undefined, await cookieFor("admin")));
    expect(await res.json()).toEqual({ limitMinorUnits: null, configured: false });
  });
});

describe("POST", () => {
  it("sets the limit and returns the hash", async () => {
    const res = await POST(req("POST", { limitRupees: "250.5" }, await cookieFor("admin")));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.limitMinorUnits).toBe("250500000");
    expect(body.txHash).toMatch(/^0x/);
    expect(chain.autoReleaseLimit).toBe(250_500_000n);
  });

  it("accepts 0", async () => {
    expect((await POST(req("POST", { limitRupees: "0" }, await cookieFor("admin")))).status).toBe(200);
    expect(chain.autoReleaseLimit).toBe(0n);
  });

  it("rejects bad input with 400 and sends nothing", async () => {
    const cookie = await cookieFor("admin");
    for (const bad of ["-1", "abc", "1.234", "99999999"]) {
      expect((await POST(req("POST", { limitRupees: bad }, cookie))).status, bad).toBe(400);
    }
    expect(chain.sent).toEqual([]);
  });

  it("answers with the not-configured code when escrow is off", async () => {
    chain.isConfigured = false;
    const res = await POST(req("POST", { limitRupees: "5" }, await cookieFor("admin")));
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("ESCROW_NOT_CONFIGURED");
  });

  it("reports a chain failure as 502", async () => {
    chain.failNext = "rpc down";
    const res = await POST(req("POST", { limitRupees: "5" }, await cookieFor("admin")));
    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe("CHAIN_FAILED");
  });
});
