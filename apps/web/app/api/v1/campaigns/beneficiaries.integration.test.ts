import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimits } from "@/lib/api/rate-limit";
import { signSession } from "@/lib/auth/session";
import { FakeBeneficiaryChain } from "@/lib/beneficiary/fake-chain";
import { getDb, resetDbForTests } from "@/lib/db";
import { beneficiaries, users } from "@/lib/db/schema";
import { makeDonor, makeLiveCampaign } from "@/lib/donations/test-setup";
import { resetEnvCache } from "@/lib/env";

const shared = vi.hoisted(() => ({ chain: null as unknown }));
vi.mock("@/lib/chain/registry", () => ({ beneficiaryChain: () => shared.chain }));

import { GET as list, POST as register } from "./[id]/beneficiaries/route";
import { GET as getSalt } from "./[id]/beneficiaries/salt/route";

const H = (n: number) => `0x${n.toString(16).padStart(2, "0").repeat(32)}`;
let chain: FakeBeneficiaryChain;

const req = (method: string, body?: unknown, cookie?: string) =>
  new Request("http://localhost/x", {
    method,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
/** The session's role claim is deliberately wrong: the server must read the role from the database. */
const cookieFor = async (userId: string) => `vera_session=${await signSession({ userId, role: "donor" })}`;

beforeEach(() => {
  process.env.DATABASE_URL = ":memory:";
  process.env.AUTH_SECRET = "s".repeat(40);
  process.env.WALLET_ENCRYPTION_KEY = "ab".repeat(32);
  process.env.MOCK_INR_ADDRESS = "0x9b6f00a1ce627a3e0d2da601253704084d8fc52c";
  resetEnvCache();
  resetDbForTests();
  resetRateLimits();
  chain = new FakeBeneficiaryChain();
  shared.chain = chain;
});

async function setup() {
  const campaign = await makeLiveCampaign(getDb());
  const organizer = getDb().select().from(users).where(eq(users.role, "organizer")).get()!;
  const admin = getDb().select().from(users).where(eq(users.role, "admin")).get()!;
  chain.organizer = organizer.walletAddress.toLowerCase();
  const donor = await makeDonor(getDb());
  return {
    campaign,
    org: await cookieFor(organizer.id),
    admin: await cookieFor(admin.id),
    donor: await cookieFor(donor.id),
  };
}
const body = (n = 1, extra: object = {}) => ({ identityHash: H(n), payoutMethod: "bank transfer", ...extra });

describe("POST /campaigns/:id/beneficiaries", () => {
  it("needs sign-in and an organizer or admin role, read from the database", async () => {
    const s = await setup();
    expect((await register(req("POST", body()), ctx(s.campaign.id))).status).toBe(401);
    expect((await register(req("POST", body(), s.donor), ctx(s.campaign.id))).status).toBe(403);
    expect(chain.sent).toHaveLength(0);
  });

  it("registers a beneficiary and returns hashes only", async () => {
    const s = await setup();
    const res = await register(req("POST", body(1), s.org), ctx(s.campaign.id));
    expect(res.status).toBe(201);
    const { beneficiary } = await res.json();
    expect(beneficiary).toMatchObject({ identityHash: H(1), status: "CONFIRMED", payoutMethod: "bank transfer" });
    expect(chain.sent).toHaveLength(1);
  });

  it("refuses a duplicate with 409 and a reason code that names nothing", async () => {
    const s = await setup();
    await register(req("POST", body(1), s.org), ctx(s.campaign.id));
    const res = await register(req("POST", body(1), s.org), ctx(s.campaign.id));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error.code).toBe("DUPLICATE_BENEFICIARY");
    expect(Object.keys(json.error).sort()).toEqual(["code", "message"]);
    expect(chain.sent).toHaveLength(1);
  });

  it("lets an admin register on the organizer's behalf", async () => {
    const s = await setup();
    expect((await register(req("POST", body(2), s.admin), ctx(s.campaign.id))).status).toBe(201);
  });

  it("rejects raw identity text and never echoes it back", async () => {
    const s = await setup();
    const raw = "Asha Devi 1990-01-01";
    const res = await register(req("POST", body(1, { identityHash: raw, name: raw }), s.org), ctx(s.campaign.id));
    expect(res.status).toBe(400);
    expect(await res.text()).not.toContain("Asha");
    expect((await register(req("POST", { identityHash: H(1) }, s.org), ctx(s.campaign.id))).status).toBe(400);
  });

  it("drops any extra identity field instead of storing it", async () => {
    const s = await setup();
    await register(req("POST", body(1, { name: "Asha Devi", nationalId: "1234-5678" }), s.org), ctx(s.campaign.id));
    const stored = JSON.stringify(getDb().select().from(beneficiaries).all());
    expect(stored).not.toContain("Asha");
    expect(stored).not.toContain("1234-5678");
  });

  it("rejects malformed JSON and unknown campaigns", async () => {
    const s = await setup();
    const bad = new Request("http://localhost/x", { method: "POST", headers: { "content-type": "application/json", cookie: s.org }, body: "{not json" });
    expect((await register(bad, ctx(s.campaign.id))).status).toBe(400);
    expect((await register(req("POST", body(), s.org), ctx("nope"))).status).toBe(404);
  });

  it("reports switched-off and pending confirmation as their own codes", async () => {
    const s = await setup();
    chain.isConfigured = false;
    const off = await register(req("POST", body(1), s.org), ctx(s.campaign.id));
    expect([off.status, (await off.json()).error.code]).toEqual([503, "REGISTRY_NOT_CONFIGURED"]);
    chain.isConfigured = true;
    chain.hangNext = true;
    const hung = await register(req("POST", body(2), s.org), ctx(s.campaign.id));
    expect([hung.status, (await hung.json()).error.code]).toEqual([202, "REGISTRATION_PENDING"]);
  });

  it("is rate limited per signed-in person: 5 quickly, then 429, while others are unaffected", async () => {
    const s = await setup();
    for (let n = 1; n <= 5; n++) expect((await register(req("POST", body(n), s.org), ctx(s.campaign.id))).status).toBe(201);
    const sixth = await register(req("POST", body(6), s.org), ctx(s.campaign.id));
    expect(sixth.status).toBe(429);
    expect((await sixth.json()).error.code).toBe("RATE_LIMITED");
    expect((await register(req("POST", body(7), s.admin), ctx(s.campaign.id))).status).toBe(201);
    expect(chain.sent).toHaveLength(6);
  });
});

describe("GET /campaigns/:id/beneficiaries and /salt", () => {
  it("lists hashes for the organizer and admin, and nobody else", async () => {
    const s = await setup();
    await register(req("POST", body(1), s.org), ctx(s.campaign.id));
    const res = await list(req("GET", undefined, s.org), ctx(s.campaign.id));
    expect((await res.json()).beneficiaries.map((b: { identityHash: string }) => b.identityHash)).toEqual([H(1)]);
    expect((await list(req("GET", undefined, s.admin), ctx(s.campaign.id))).status).toBe(200);
    expect((await list(req("GET"), ctx(s.campaign.id))).status).toBe(401);
    expect((await list(req("GET", undefined, s.donor), ctx(s.campaign.id))).status).toBe(403);
  });

  it("hands the salt only to the organizer or an admin, and it stays the same", async () => {
    const s = await setup();
    const one = await (await getSalt(req("GET", undefined, s.org), ctx(s.campaign.id))).json();
    const two = await (await getSalt(req("GET", undefined, s.admin), ctx(s.campaign.id))).json();
    expect(one.salt).toMatch(/^[0-9a-f]{32}$/);
    expect(two.salt).toBe(one.salt);
    expect((await getSalt(req("GET"), ctx(s.campaign.id))).status).toBe(401);
    expect((await getSalt(req("GET", undefined, s.donor), ctx(s.campaign.id))).status).toBe(403);
  });
});
