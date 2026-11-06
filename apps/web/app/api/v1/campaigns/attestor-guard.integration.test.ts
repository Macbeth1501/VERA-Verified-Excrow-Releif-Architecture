/** C3 at the route: POST /api/v1/campaigns refuses more confirmations than there are synced attestors (when escrow is configured). */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { resetEnvCache } from "@/lib/env";
import { getDb, resetDbForTests, schema } from "@/lib/db";
import { resetRateLimits } from "@/lib/api/rate-limit";
import { registerDonor } from "@/lib/auth/users";
import { signSession } from "@/lib/auth/session";
import { decide, submitApplication } from "@/lib/organizers/service";

const escrow = vi.hoisted(() => ({ configured: false }));
vi.mock("@/lib/chain/manager", () => ({ escrowChain: () => ({ configured: () => escrow.configured }) }));

import { POST as create } from "./route";

const ENC_KEY = "ab".repeat(32);
const input = {
  title: "Flood relief for Assam",
  summary: "Emergency food, clean water and shelter for families displaced by the 2026 floods.",
  category: "DISASTER_RELIEF",
  fundingGoalMinorUnits: "1000000000",
  adminExpenseCapPct: 10,
  milestones: [
    { description: "Deliver food and water to 500 families", targetPct: 60, requiredAttestations: 2 },
    { description: "Rebuild 20 damaged homes", targetPct: 40, requiredAttestations: 3 },
  ],
};

let cookie: string;

async function grantAttestors(n: number) {
  const db = getDb();
  for (let i = 0; i < n; i++) {
    const u = await registerDonor(db, { email: `att${i}@example.com`, password: "correct-horse-battery" }, ENC_KEY);
    db.insert(schema.roleGrants).values({ id: `g${i}`, userId: u.id, role: "attestor", chainSync: "synced" }).run();
  }
}

beforeEach(async () => {
  process.env.DATABASE_URL = ":memory:";
  process.env.AUTH_SECRET = "s".repeat(40);
  process.env.WALLET_ENCRYPTION_KEY = ENC_KEY;
  process.env.MOCK_INR_ADDRESS = "0x9b6f00a1ce627a3e0d2da601253704084d8fc52c";
  resetEnvCache();
  resetDbForTests();
  resetRateLimits();
  escrow.configured = true;

  const db = getDb();
  const user = await registerDonor(db, { email: "org@example.com", password: "correct-horse-battery" }, ENC_KEY);
  const admin = await registerDonor(db, { email: "admin@example.com", password: "correct-horse-battery" }, ENC_KEY);
  db.update(schema.users).set({ role: "admin" }).where(eq(schema.users.id, admin.id)).run();
  const profile = submitApplication(db, user.id, {
    legalName: "Ayodhya Relief Trust",
    registrationNumber: "MH/2019/0042",
    jurisdiction: "India",
    documentHash: "a".repeat(64),
    documentName: "cert.pdf",
  });
  decide(db, profile.id, admin.id, "approve");
  cookie = `vera_session=${await signSession({ userId: user.id, role: "organizer" })}`;
});

const post = (body: unknown) =>
  create(new Request("http://localhost/x", { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) }));

describe("POST /api/v1/campaigns attestor guard", () => {
  it("accepts when every milestone needs no more than the registered attestors", async () => {
    await grantAttestors(3);
    expect((await post(input)).status).toBe(201);
  });

  it("rejects with a 422 field error when a milestone needs more than exist", async () => {
    await grantAttestors(2);
    const res = await post(input);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(body.error.message).toBe("Only 2 attestors are registered; ask an admin to add more or lower this number.");
    expect(body.error.details.milestones).toHaveLength(1);
  });

  it("rejects with a clear message when no attestor is registered", async () => {
    const res = await post(input);
    expect(res.status).toBe(422);
    expect((await res.json()).error.message).toMatch(/No attestors are registered/);
  });

  it("ignores attestors the contract does not know yet", async () => {
    await grantAttestors(3);
    getDb().update(schema.roleGrants).set({ chainSync: "failed" }).where(eq(schema.roleGrants.id, "g0")).run();
    expect((await post(input)).status).toBe(422);
  });

  it("does not apply when escrow is not configured", async () => {
    escrow.configured = false;
    expect((await post(input)).status).toBe(201);
  });
});
