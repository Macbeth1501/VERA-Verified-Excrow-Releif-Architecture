import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimits } from "@/lib/api/rate-limit";
import { signSession } from "@/lib/auth/session";
import { getDb, resetDbForTests } from "@/lib/db";
import { beneficiaries, disbursements, users } from "@/lib/db/schema";
import { FakeDisbursementChain } from "@/lib/disbursement/fake-chain";
import { VAULT, makeDonor, makeLiveCampaign } from "@/lib/donations/test-setup";
import { resetEnvCache } from "@/lib/env";

const shared = vi.hoisted(() => ({ chain: null as unknown }));
vi.mock("@/lib/chain/disbursement", () => ({ disbursementChain: () => shared.chain }));

import { POST as disburse } from "./[id]/disburse/route";

const H1 = `0x${"a1".repeat(32)}`;
const AMOUNT = "100000000";
let chain: FakeDisbursementChain;

const req = (body?: unknown, cookie?: string) =>
  new Request("http://localhost/x", {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
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
  chain = new FakeDisbursementChain();
  shared.chain = chain;
});

/** A live campaign whose milestone 0 was released, with one confirmed beneficiary. */
async function released() {
  const db = getDb();
  const campaign = await makeLiveCampaign(db);
  const organizer = db.select().from(users).where(eq(users.role, "organizer")).get()!;
  const admin = db.select().from(users).where(eq(users.role, "admin")).get()!;
  const beneficiaryId = randomUUID();
  db.insert(beneficiaries)
    .values({ id: beneficiaryId, campaignId: campaign.id, identityHash: H1, payoutMethod: "bank transfer", registeredByUserId: organizer.id, chainStatus: "CONFIRMED" })
    .run();
  chain.organizer = organizer.walletAddress.toLowerCase();
  chain.register(VAULT, H1);
  chain.release(VAULT, 0, BigInt(AMOUNT));
  return {
    milestoneId: campaign.milestones[0].id,
    beneficiaryId,
    organizerCookie: await cookieFor(organizer.id),
    adminCookie: await cookieFor(admin.id),
  };
}

describe("POST /api/v1/milestones/:id/disburse", () => {
  it("records the payout for the organizer: 201 with both hashes and the reference", async () => {
    const { milestoneId, beneficiaryId, organizerCookie } = await released();
    const res = await disburse(req({ beneficiaryId, amountMinorUnits: AMOUNT }, organizerCookie), ctx(milestoneId));
    expect(res.status).toBe(201);
    const { disbursement } = await res.json();
    expect(disbursement).toMatchObject({ status: "CONFIRMED", milestoneId, beneficiaryId, identityHash: H1, amountMinorUnits: AMOUNT });
    expect(disbursement.txHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(disbursement.approveTxHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(disbursement.payoutReference).toMatch(/^VERA-SIM-/);
  });

  it("lets an admin record it, signed as the organizer", async () => {
    const { milestoneId, beneficiaryId, adminCookie } = await released();
    const res = await disburse(req({ beneficiaryId, amountMinorUnits: AMOUNT }, adminCookie), ctx(milestoneId));
    expect(res.status).toBe(201);
    expect(chain.sent.filter((s) => s.startsWith("disburse:"))).toHaveLength(1);
  });

  it("needs sign-in, and the organizer or admin role read from the database", async () => {
    const { milestoneId, beneficiaryId } = await released();
    expect((await disburse(req({ beneficiaryId, amountMinorUnits: AMOUNT }), ctx(milestoneId))).status).toBe(401);
    const donor = await makeDonor(getDb());
    const res = await disburse(req({ beneficiaryId, amountMinorUnits: AMOUNT }, await cookieFor(donor.id)), ctx(milestoneId));
    expect(res.status).toBe(403);
    expect(chain.sent).toHaveLength(0);
  });

  it("refuses an organizer of a different campaign", async () => {
    const { milestoneId, beneficiaryId } = await released();
    const other = await makeDonor(getDb());
    getDb().update(users).set({ role: "organizer" }).where(eq(users.id, other.id)).run();
    const res = await disburse(req({ beneficiaryId, amountMinorUnits: AMOUNT }, await cookieFor(other.id)), ctx(milestoneId));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("FORBIDDEN");
  });

  it("rejects a bad body without touching the chain", async () => {
    const { milestoneId, organizerCookie } = await released();
    const bad = await disburse(req({ beneficiaryId: "", amountMinorUnits: "-1" }, organizerCookie), ctx(milestoneId));
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.code).toBe("VALIDATION_FAILED");
    expect((await disburse(req("{not json", organizerCookie), ctx(milestoneId))).status).toBe(400);
    expect(chain.sent).toHaveLength(0);
  });

  it("answers 202 when sent but unconfirmed, keeps it PENDING, and 409 on a second payout", async () => {
    const { milestoneId, beneficiaryId, organizerCookie } = await released();
    chain.hangNext = true;
    const first = await disburse(req({ beneficiaryId, amountMinorUnits: AMOUNT }, organizerCookie), ctx(milestoneId));
    expect(first.status).toBe(202);
    expect((await first.json()).error.code).toBe("DISBURSEMENT_PENDING");
    const row = getDb().select().from(disbursements).get()!;
    expect(row.status).toBe("PENDING");

    chain.land(row.txHash!);
    const settled = await disburse(req({ beneficiaryId, amountMinorUnits: AMOUNT }, organizerCookie), ctx(milestoneId));
    expect(settled.status).toBe(201);
    const again = await disburse(req({ beneficiaryId, amountMinorUnits: AMOUNT }, organizerCookie), ctx(milestoneId));
    expect(again.status).toBe(409);
    expect((await again.json()).error.code).toBe("ALREADY_DISBURSED");
  });

  it("reports an unreleased milestone and a switched-off feature with their own codes", async () => {
    const { milestoneId, beneficiaryId, organizerCookie } = await released();
    chain.releasedMilestones.clear();
    const early = await disburse(req({ beneficiaryId, amountMinorUnits: AMOUNT }, organizerCookie), ctx(milestoneId));
    expect([early.status, (await early.json()).error.code]).toEqual([409, "MILESTONE_NOT_RELEASED"]);
    chain.isConfigured = false;
    const off = await disburse(req({ beneficiaryId, amountMinorUnits: AMOUNT }, organizerCookie), ctx(milestoneId));
    expect([off.status, (await off.json()).error.code]).toEqual([503, "DISBURSEMENT_NOT_CONFIGURED"]);
  });

  it("is 404 for an unknown milestone", async () => {
    const { beneficiaryId, organizerCookie } = await released();
    const res = await disburse(req({ beneficiaryId, amountMinorUnits: AMOUNT }, organizerCookie), ctx("missing"));
    expect(res.status).toBe(404);
  });
});
