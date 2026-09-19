import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimits } from "@/lib/api/rate-limit";
import { signSession } from "@/lib/auth/session";
import { getDb, resetDbForTests } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { makeDonor, makeLiveCampaign } from "@/lib/donations/test-setup";
import { FakeEscrowChain } from "@/lib/escrow/fake-chain";
import { resetEnvCache } from "@/lib/env";

const shared = vi.hoisted(() => ({ chain: null as unknown }));
vi.mock("@/lib/chain/manager", () => ({ escrowChain: () => shared.chain }));

import { GET as getMilestone } from "./[id]/route";
import { POST as attest } from "./[id]/attestations/route";
import { POST as approve } from "./[id]/council-approval/route";
import { POST as release } from "./[id]/release/route";
import { POST as define } from "../campaigns/[id]/milestones/define/route";
import { GET as listRoles, POST as setRole } from "../admin/roles/route";

const PROOF = `0x${"cd".repeat(32)}`;
let chain: FakeEscrowChain;

const req = (method: string, body?: unknown, cookie?: string) =>
  new Request("http://localhost/x", {
    method,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
/** The session's role claim is deliberately wrong: the server must read the role from the database. */
const cookieFor = async (userId: string) => `vera_session=${await signSession({ userId, role: "donor" })}`;

async function actor(role?: "admin" | "attestor" | "council") {
  const user = await makeDonor(getDb());
  if (role === "admin") getDb().update(users).set({ role: "admin" }).where(eq(users.id, user.id)).run();
  return { user, cookie: await cookieFor(user.id) };
}

beforeEach(() => {
  process.env.DATABASE_URL = ":memory:";
  process.env.AUTH_SECRET = "s".repeat(40);
  process.env.WALLET_ENCRYPTION_KEY = "ab".repeat(32);
  process.env.MOCK_INR_ADDRESS = "0x9b6f00a1ce627a3e0d2da601253704084d8fc52c";
  resetEnvCache();
  resetDbForTests();
  resetRateLimits();
  chain = new FakeEscrowChain();
  shared.chain = chain;
});

/** A live campaign with its milestone defined, plus its organizer's cookie. */
async function liveAndDefined() {
  const campaign = await makeLiveCampaign(getDb());
  const organizer = getDb().select().from(users).where(eq(users.role, "organizer")).get()!;
  const cookie = await cookieFor(organizer.id);
  const res = await define(req("POST", undefined, cookie), ctx(campaign.id));
  expect(res.status).toBe(200);
  expect((await res.json()).result.status).toBe("defined");
  return { campaign, milestoneId: campaign.milestones[0].id, organizerCookie: cookie };
}

async function grant(adminCookie: string, email: string, role: "attestor" | "council") {
  const res = await setRole(req("POST", { email, role, active: true }, adminCookie));
  expect(res.status).toBe(200);
}

describe("admin roles", () => {
  it("is admin only, and lists who holds a role", async () => {
    const donor = await actor();
    expect((await listRoles(req("GET"))).status).toBe(401);
    expect((await listRoles(req("GET", undefined, donor.cookie))).status).toBe(403);
    expect((await setRole(req("POST", { email: "a@b.co", role: "attestor", active: true }, donor.cookie))).status).toBe(403);

    const admin = await actor("admin");
    const target = await makeDonor(getDb());
    await grant(admin.cookie, target.email, "attestor");
    const { grants } = await (await listRoles(req("GET", undefined, admin.cookie))).json();
    expect(grants).toEqual([expect.objectContaining({ email: target.email, role: "attestor", chainSync: "synced" })]);
  });

  it("rejects a bad body", async () => {
    const admin = await actor("admin");
    const res = await setRole(req("POST", { email: "x@y.co", role: "boss", active: true }, admin.cookie));
    expect(res.status).toBe(400);
  });
});

describe("attestations (Step 11)", () => {
  it("needs sign-in and the attestor role, read from the database", async () => {
    const { milestoneId } = await liveAndDefined();
    expect((await attest(req("POST", { proofHash: PROOF }), ctx(milestoneId))).status).toBe(401);
    const donor = await actor();
    expect((await attest(req("POST", { proofHash: PROOF }, donor.cookie), ctx(milestoneId))).status).toBe(403);
  });

  it("rejects a missing or malformed evidence hash", async () => {
    const { milestoneId } = await liveAndDefined();
    const admin = await actor("admin");
    const a = await actor();
    await grant(admin.cookie, a.user.email, "attestor");
    expect((await attest(req("POST", {}, a.cookie), ctx(milestoneId))).status).toBe(400);
    expect((await attest(req("POST", { proofHash: "0x123" }, a.cookie), ctx(milestoneId))).status).toBe(400);
  });

  it("2-of-2: the first confirmation leaves it pending, the second meets the threshold", async () => {
    const { milestoneId } = await liveAndDefined();
    const admin = await actor("admin");
    const [a1, a2] = [await actor(), await actor()];
    await grant(admin.cookie, a1.user.email, "attestor");
    await grant(admin.cookie, a2.user.email, "attestor");

    const first = await (await attest(req("POST", { proofHash: PROOF }, a1.cookie), ctx(milestoneId))).json();
    expect(first.threshold_met).toBe(false);
    expect(first.attestation_status).toBe("CONFIRMED");

    const second = await (await attest(req("POST", { proofHash: PROOF }, a2.cookie), ctx(milestoneId))).json();
    expect(second.threshold_met).toBe(true);
    expect(second.milestone.state.status).toBe("Verified");

    const dup = await attest(req("POST", { proofHash: PROOF }, a1.cookie), ctx(milestoneId));
    expect(dup.status).toBe(409);
    expect((await dup.json()).error.code).toBe("MILESTONE_NOT_READY");
  });

  it("exposes the contract's state publicly", async () => {
    const { milestoneId } = await liveAndDefined();
    const body = await (await getMilestone(req("GET"), ctx(milestoneId))).json();
    expect(body.milestone.state).toMatchObject({ status: "Pending", attestationCount: 0, requiredAttestations: 2 });
    expect((await getMilestone(req("GET"), ctx("nope"))).status).toBe(404);
  });

  it("reports that escrow is switched off instead of erroring", async () => {
    const { milestoneId } = await liveAndDefined();
    const admin = await actor("admin");
    const a1 = await actor();
    await grant(admin.cookie, a1.user.email, "attestor");
    chain.isConfigured = false;
    const res = await attest(req("POST", { proofHash: PROOF }, a1.cookie), ctx(milestoneId));
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("ESCROW_NOT_CONFIGURED");
  });
});

describe("council approval and release (Step 12)", () => {
  it("a payout above the limit needs 3 approvals: 2 do not execute, the 3rd does", async () => {
    chain.payout = 400_000_000n;
    const { milestoneId, organizerCookie } = await liveAndDefined();
    const admin = await actor("admin");
    for (let i = 0; i < 2; i++) {
      const a = await actor();
      await grant(admin.cookie, a.user.email, "attestor");
      await attest(req("POST", { proofHash: PROOF }, a.cookie), ctx(milestoneId));
    }
    const members = [await actor(), await actor(), await actor()];
    for (const m of members) await grant(admin.cookie, m.user.email, "council");

    for (const m of members.slice(0, 2)) {
      const res = await (await approve(req("POST", undefined, m.cookie), ctx(milestoneId))).json();
      expect(res.threshold).toBe(3);
    }
    const early = await release(req("POST", undefined, organizerCookie), ctx(milestoneId));
    expect(early.status).toBe(409);
    expect((await early.json()).error.message).toContain("needs 3 council approvals; it has 2");

    const third = await (await approve(req("POST", undefined, members[2].cookie), ctx(milestoneId))).json();
    expect(third.signatures_collected).toBe(3);
    const done = await release(req("POST", undefined, organizerCookie), ctx(milestoneId));
    expect(done.status).toBe(200);
    expect((await done.json()).milestone.state.status).toBe("Released");
  });

  it("only council members may approve, and a stranger cannot release", async () => {
    const { milestoneId } = await liveAndDefined();
    const stranger = await actor();
    expect((await approve(req("POST", undefined, stranger.cookie), ctx(milestoneId))).status).toBe(403);
    expect((await release(req("POST", undefined, stranger.cookie), ctx(milestoneId))).status).toBe(403);
    expect((await release(req("POST"), ctx(milestoneId))).status).toBe(401);
  });

  it("registering milestones is limited to the campaign's organizer", async () => {
    const campaign = await makeLiveCampaign(getDb());
    const stranger = await actor();
    expect((await define(req("POST", undefined, stranger.cookie), ctx(campaign.id))).status).toBe(403);
    expect((await define(req("POST"), ctx(campaign.id))).status).toBe(401);
    expect((await define(req("POST", undefined, stranger.cookie), ctx("missing"))).status).toBe(404);
  });
});
