/** Integration tests for /api/v1/admin/council-threshold: admin-only access, validation, floor, ceiling, unreadable chain and success. */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { resetEnvCache } from "@/lib/env";
import { getDb, resetDbForTests, schema } from "@/lib/db";
import { resetRateLimits } from "@/lib/api/rate-limit";
import { registerDonor } from "@/lib/auth/users";
import { signSession, type Role } from "@/lib/auth/session";
import { FakeEscrowChain } from "@/lib/escrow/fake-chain";
import { setRole } from "@/lib/escrow/service";

const fake = vi.hoisted(() => ({ chain: null as unknown }));
vi.mock("@/lib/chain/manager", () => ({ escrowChain: () => fake.chain }));

import { GET, POST } from "./route";

const ENC_KEY = "ab".repeat(32);
let chain: FakeEscrowChain;
let counter = 0;

async function account(role: Role) {
  const user = await registerDonor(getDb(), { email: `u${++counter}@example.com`, password: "correct-horse-battery" }, ENC_KEY);
  if (role !== "donor") getDb().update(schema.users).set({ role }).where(eq(schema.users.id, user.id)).run();
  return { user, cookie: `vera_session=${await signSession({ userId: user.id, role })}` };
}
async function council(n: number) {
  for (let i = 0; i < n; i++) {
    const { user } = await account("donor");
    expect((await setRole(getDb(), chain, { email: user.email, role: "council", active: true })).ok).toBe(true);
  }
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
    expect((await POST(req("POST", { threshold: 2 }))).status).toBe(401);
    for (const role of ["donor", "organizer", "attestor", "council"] as const) {
      const { cookie } = await account(role);
      expect((await GET(req("GET", undefined, cookie))).status).toBe(403);
      expect((await POST(req("POST", { threshold: 2 }, cookie))).status).toBe(403);
    }
    expect(chain.sent).toEqual([]);
  });
});

describe("GET", () => {
  it("returns K, the council size and the in-flight list", async () => {
    await council(3);
    const { cookie } = await account("admin");
    const res = await GET(req("GET", undefined, cookie));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ configured: true, threshold: 3, councilMembers: 3, inFlight: [] });
  });

  it("returns 503, never a guessed value, when the chain cannot be read", async () => {
    chain.unreadable = true;
    const { cookie } = await account("admin");
    const res = await GET(req("GET", undefined, cookie));
    expect(res.status).toBe(503);
    expect((await res.json()).threshold).toBeUndefined();
  });

  it("reports configured: false when escrow is off", async () => {
    chain.isConfigured = false;
    const { cookie } = await account("admin");
    expect((await (await GET(req("GET", undefined, cookie))).json()).configured).toBe(false);
  });
});

describe("POST", () => {
  it("sets K and returns the hash", async () => {
    await council(4);
    const { cookie } = await account("admin");
    const res = await POST(req("POST", { threshold: 4 }, cookie));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.threshold).toBe(4);
    expect(body.txHash).toMatch(/^0x/);
    expect(chain.councilThreshold).toBe(4);
  });

  it("rejects K below the floor of 2 with 400 (schema), and sends nothing", async () => {
    await council(3);
    const { cookie } = await account("admin");
    for (const bad of [1, 0, -3, 2.5, "3", null]) {
      expect((await POST(req("POST", { threshold: bad }, cookie))).status, String(bad)).toBe(400);
    }
    expect(chain.councilThreshold).toBe(3);
    expect(chain.sent.filter((s) => s.startsWith("threshold"))).toEqual([]);
  });

  it("rejects K above the registered council with 422 and a clear message", async () => {
    await council(3);
    const { cookie } = await account("admin");
    const res = await POST(req("POST", { threshold: 5 }, cookie));
    expect(res.status).toBe(422);
    expect((await res.json()).error.message).toMatch(/Only 3 council members are registered/);
    expect(chain.councilThreshold).toBe(3);
  });

  it("answers with the not-configured code when escrow is off", async () => {
    chain.isConfigured = false;
    const { cookie } = await account("admin");
    const res = await POST(req("POST", { threshold: 2 }, cookie));
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("ESCROW_NOT_CONFIGURED");
  });

  it("reports a chain failure as 502", async () => {
    await council(3);
    chain.failNext = "rpc down";
    const { cookie } = await account("admin");
    const res = await POST(req("POST", { threshold: 2 }, cookie));
    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe("CHAIN_FAILED");
  });
});
