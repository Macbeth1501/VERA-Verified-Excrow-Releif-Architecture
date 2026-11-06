/** Integration tests for the C5 routes: POST .../beneficiaries/attestations, the attestor's access to the salt, evidence access, and a 2-attestor requirement. */

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { resetRateLimits } from "@/lib/api/rate-limit";
import { signSession, type Role } from "@/lib/auth/session";
import { hashIdentityFragment } from "@/lib/beneficiary/clientHasher";
import { getProgramSalt } from "@/lib/beneficiary/service";
import { campaignVerification } from "@/lib/beneficiary/verification";
import { getDb, resetDbForTests } from "@/lib/db";
import { beneficiaries, documents, users } from "@/lib/db/schema";
import { makeDonor, makeLiveCampaign } from "@/lib/donations/test-setup";
import { resetEnvCache } from "@/lib/env";
import { GET as getDocument } from "@/app/api/v1/documents/[id]/route";
import { GET as getSalt } from "../salt/route";
import { POST as attest } from "./route";

const ENC_KEY = "ab".repeat(32);
const FRAGMENT = "Ravi Kumar, 1988, Dibrugarh";
let campaignId: string;
let salt: string;
let hash: string;
let beneficiaryId: string;

async function cookieFor(userId: string, role: Role) {
  return `vera_session=${await signSession({ userId, role })}`;
}
async function person(role: Role) {
  const db = getDb();
  const u = await makeDonor(db);
  if (role !== "donor") db.update(users).set({ role }).where(eq(users.id, u.id)).run();
  return { id: u.id, cookie: await cookieFor(u.id, role) };
}
const req = (body: unknown, cookie?: string) =>
  new Request("http://localhost/x", {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
const ctx = (id = campaignId) => ({ params: Promise.resolve({ id }) });
const get = (cookie?: string) => new Request("http://localhost/x", { headers: cookie ? { cookie } : {} });

function setup(required?: string) {
  process.env.DATABASE_URL = ":memory:";
  process.env.AUTH_SECRET = "s".repeat(40);
  process.env.WALLET_ENCRYPTION_KEY = ENC_KEY;
  process.env.MOCK_INR_ADDRESS = "0x9b6f00a1ce627a3e0d2da601253704084d8fc52c";
  if (required) process.env.BENEFICIARY_REQUIRED_ATTESTATIONS = required;
  else delete process.env.BENEFICIARY_REQUIRED_ATTESTATIONS;
  resetEnvCache();
  resetDbForTests();
  resetRateLimits();
}

async function seed() {
  const db = getDb();
  const campaign = await makeLiveCampaign(db);
  campaignId = campaign.id;
  const organizer = db.select().from(users).where(eq(users.role, "organizer")).get()!;
  const s = getProgramSalt(db, { id: organizer.id, role: "organizer" }, campaignId);
  if (!s.ok) throw new Error("no salt");
  salt = s.salt;
  hash = await hashIdentityFragment(FRAGMENT, salt);
  beneficiaryId = randomUUID();
  db.insert(beneficiaries)
    .values({ id: beneficiaryId, campaignId, identityHash: hash, payoutMethod: "bank transfer", registeredByUserId: organizer.id, chainStatus: "CONFIRMED" })
    .run();
}

beforeEach(async () => {
  setup();
  await seed();
});

describe("POST /api/v1/campaigns/:id/beneficiaries/attestations", () => {
  it("signed-out gets 401 and every non-attestor role gets 403", async () => {
    expect((await attest(req({ identityHash: hash }), ctx())).status).toBe(401);
    for (const role of ["donor", "organizer", "admin", "council"] as const) {
      const p = role === "organizer" || role === "admin" ? { cookie: await cookieFor(getDb().select().from(users).where(eq(users.role, role)).get()!.id, role) } : await person(role);
      expect((await attest(req({ identityHash: hash }, p.cookie), ctx())).status, role).toBe(403);
    }
    expect(campaignVerification(getDb(), campaignId).verified).toBe(0);
  });

  it("201 with the new count on a match, and a second call by the same attestor is 409", async () => {
    const a = await person("attestor");
    const res = await attest(req({ identityHash: hash }, a.cookie), ctx());
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ matched: true, attestations: 1, required: 1, verified: true });
    const again = await attest(req({ identityHash: hash }, a.cookie), ctx());
    expect(again.status).toBe(409);
    expect((await again.json()).error.code).toBe("ALREADY_ATTESTED");
  });

  it("200 matched:false for a fingerprint nobody has, revealing nothing else", async () => {
    const a = await person("attestor");
    const res = await attest(req({ identityHash: await hashIdentityFragment("Not Registered", salt) }, a.cookie), ctx());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ matched: false });
  });

  it("400 for something that is not a fingerprint (identity text is not accepted)", async () => {
    const a = await person("attestor");
    const res = await attest(req({ identityHash: FRAGMENT }, a.cookie), ctx());
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_FAILED");
  });

  it("404 for an unknown campaign", async () => {
    const a = await person("attestor");
    expect((await attest(req({ identityHash: hash }, a.cookie), ctx("missing"))).status).toBe(404);
  });

  it("rate-limits an attestor trying many fingerprints", async () => {
    const a = await person("attestor");
    let last = 200;
    for (let i = 0; i < 14; i++) last = (await attest(req({ identityHash: `0x${i.toString(16).padStart(64, "1")}` }, a.cookie), ctx())).status;
    expect(last).toBe(429);
  });

  it("stores evidence that only an admin or attestor can open (not council, donors or signed-out)", async () => {
    const a = await person("attestor");
    const bytes = Buffer.from("meeting photo");
    const { createHash } = await import("node:crypto");
    const res = await attest(
      req({ identityHash: hash, evidenceHash: `0x${createHash("sha256").update(bytes).digest("hex")}`, evidenceMimeType: "image/png", evidenceData: bytes.toString("base64"), evidenceName: "m.png" }, a.cookie),
      ctx(),
    );
    expect(res.status).toBe(201);
    const doc = getDb().select().from(documents).get()!;
    const open = (cookie?: string) => getDocument(get(cookie), { params: Promise.resolve({ id: doc.id }) });
    expect((await open(a.cookie)).status).toBe(200);
    const admin = getDb().select().from(users).where(eq(users.role, "admin")).get()!;
    expect((await open(await cookieFor(admin.id, "admin"))).status).toBe(200);
    expect((await open((await person("council")).cookie)).status).toBe(403);
    expect((await open((await person("donor")).cookie)).status).toBe(403);
    expect((await open()).status).toBe(401);
  });
});

describe("GET .../beneficiaries/salt for attestors", () => {
  it("gives an attestor the salt, and still refuses a donor", async () => {
    const a = await person("attestor");
    const ok = await getSalt(get(a.cookie), ctx());
    expect(ok.status).toBe(200);
    expect((await ok.json()).salt).toBe(salt);
    expect((await getSalt(get((await person("donor")).cookie), ctx())).status).toBe(403);
    expect((await getSalt(get(), ctx())).status).toBe(401);
  });
});

describe("a requirement of 2 attestors (BENEFICIARY_REQUIRED_ATTESTATIONS=2)", () => {
  beforeEach(async () => {
    setup("2");
    await seed();
  });

  it("is verified only after two distinct attestors confirm", async () => {
    const a = await person("attestor");
    const b = await person("attestor");
    const first = await (await attest(req({ identityHash: hash }, a.cookie), ctx())).json();
    expect(first).toEqual({ matched: true, attestations: 1, required: 2, verified: false });
    expect(campaignVerification(getDb(), campaignId)).toEqual({ registered: 1, verified: 0, required: 2 });
    const second = await (await attest(req({ identityHash: hash }, b.cookie), ctx())).json();
    expect(second).toEqual({ matched: true, attestations: 2, required: 2, verified: true });
    expect(campaignVerification(getDb(), campaignId)).toEqual({ registered: 1, verified: 1, required: 2 });
  });
});
