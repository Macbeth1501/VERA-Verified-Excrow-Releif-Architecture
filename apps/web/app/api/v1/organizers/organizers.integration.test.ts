import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { resetEnvCache } from "@/lib/env";
import { getDb, resetDbForTests, schema } from "@/lib/db";
import { resetRateLimits } from "@/lib/api/rate-limit";
import { registerDonor } from "@/lib/auth/users";
import { signSession, type Role } from "@/lib/auth/session";

const chain = vi.hoisted(() => ({ syncOrganizerVerification: vi.fn() }));
vi.mock("@/lib/chain/factory", () => ({ syncOrganizerVerification: chain.syncOrganizerVerification }));

import { POST as apply } from "./verify/route";
import { GET as mine } from "./me/route";
import { GET as publicProfile } from "./[id]/route";
import { GET as adminList } from "../admin/organizers/route";
import { POST as decision } from "../admin/organizers/[id]/decision/route";
import { POST as retrySync } from "../admin/organizers/[id]/sync/route";
import { POST as createCampaign } from "../campaigns/route";

const ENC_KEY = "ab".repeat(32);
const DOC_HASH = "a".repeat(64);
const application = {
  legalName: "Ayodhya Relief Trust",
  registrationNumber: "MH/2019/0042",
  jurisdiction: "India",
  documentHash: DOC_HASH,
  documentName: "registration-certificate.pdf",
};

interface TestUser {
  id: string;
  cookie: string;
  wallet: string;
}

let counter = 0;
async function makeUser(role: Role = "donor"): Promise<TestUser> {
  const user = await registerDonor(
    getDb(),
    { email: `user${++counter}@example.com`, password: "correct-horse-battery" },
    ENC_KEY,
  );
  if (role !== "donor") getDb().update(schema.users).set({ role }).where(eq(schema.users.id, user.id)).run();
  return { id: user.id, cookie: `vera_session=${await signSession({ userId: user.id, role })}`, wallet: user.walletAddress };
}

function req(method: string, body?: unknown, cookie?: string) {
  return new Request("http://localhost/x", {
    method,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

async function applyAs(user: TestUser) {
  const res = await apply(req("POST", application, user.cookie));
  return (await res.json()).profile?.id as string;
}

beforeEach(() => {
  process.env.DATABASE_URL = ":memory:";
  process.env.AUTH_SECRET = "s".repeat(40);
  process.env.WALLET_ENCRYPTION_KEY = ENC_KEY;
  process.env.MOCK_INR_ADDRESS = "0x9b6f00a1ce627a3e0d2da601253704084d8fc52c";
  resetEnvCache();
  resetDbForTests();
  resetRateLimits();
  chain.syncOrganizerVerification.mockReset();
  chain.syncOrganizerVerification.mockResolvedValue({ status: "synced", txHash: "0xabc" });
});

describe("applying (FR-IDN-02)", () => {
  it("requires sign-in", async () => {
    expect((await apply(req("POST", application))).status).toBe(401);
  });

  it("creates an application whose status starts as pending", async () => {
    const org = await makeUser();
    const res = await apply(req("POST", { ...application, documentHash: "A".repeat(64) }, org.cookie));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.kyb_status).toBe("pending");
    expect(body.profile.documentHash).toBe(DOC_HASH);
  });

  it("returns field errors when the document is missing or fields are blank", async () => {
    const org = await makeUser();
    const res = await apply(req("POST", { ...application, documentHash: "", legalName: "" }, org.cookie));
    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.details.documentHash).toBeDefined();
    expect(error.details.legalName).toBeDefined();
  });

  it("refuses a second application while pending or verified", async () => {
    const org = await makeUser();
    await applyAs(org);
    const again = await apply(req("POST", application, org.cookie));
    expect(again.status).toBe(409);
    expect((await again.json()).error.details.kyb_status).toBe("pending");
  });

  it("does not let an admin apply", async () => {
    const admin = await makeUser("admin");
    expect((await apply(req("POST", application, admin.cookie))).status).toBe(403);
  });

  it("shows the applicant their own status", async () => {
    const org = await makeUser();
    expect((await (await mine(req("GET", undefined, org.cookie))).json()).kyb_status).toBeNull();
    await applyAs(org);
    expect((await (await mine(req("GET", undefined, org.cookie))).json()).kyb_status).toBe("pending");
  });
});

describe("admin review", () => {
  it("is admin only", async () => {
    const donor = await makeUser();
    const id = await applyAs(donor);
    expect((await adminList(req("GET"))).status).toBe(401);
    expect((await adminList(req("GET", undefined, donor.cookie))).status).toBe(403);
    expect((await decision(req("POST", { decision: "approve" }, donor.cookie), ctx(id))).status).toBe(403);
  });

  it("lists pending applications with the applicant email", async () => {
    const admin = await makeUser("admin");
    await applyAs(await makeUser());
    const res = await adminList(new Request("http://localhost/x?status=pending", { headers: { cookie: admin.cookie } }));
    const { organizers } = await res.json();
    expect(organizers).toHaveLength(1);
    expect(organizers[0].email).toMatch(/@example.com$/);
  });

  it("approving verifies the organizer, promotes the role and mirrors it on-chain", async () => {
    const admin = await makeUser("admin");
    const org = await makeUser();
    const id = await applyAs(org);
    const res = await decision(req("POST", { decision: "approve" }, admin.cookie), ctx(id));
    expect(res.status).toBe(200);
    const { profile } = await res.json();
    expect(profile.kybStatus).toBe("verified");
    expect(profile.chainSync).toBe("synced");
    expect(profile.chainTxHash).toBe("0xabc");
    expect(chain.syncOrganizerVerification).toHaveBeenCalledWith(org.wallet);
    const row = getDb().select().from(schema.users).where(eq(schema.users.id, org.id)).get();
    expect(row?.role).toBe("organizer");
  });

  it("keeps the approval when the chain call fails, records the error, and can retry", async () => {
    const admin = await makeUser("admin");
    const id = await applyAs(await makeUser());
    chain.syncOrganizerVerification.mockResolvedValueOnce({ status: "failed", error: "rpc down" });
    const { profile } = await (await decision(req("POST", { decision: "approve" }, admin.cookie), ctx(id))).json();
    expect(profile.kybStatus).toBe("verified");
    expect(profile.chainSync).toBe("failed");
    expect(profile.chainError).toBe("rpc down");

    const retry = await retrySync(req("POST", undefined, admin.cookie), ctx(id));
    expect((await retry.json()).profile.chainSync).toBe("synced");
  });

  it("records when on-chain sync is not configured", async () => {
    const admin = await makeUser("admin");
    const id = await applyAs(await makeUser());
    chain.syncOrganizerVerification.mockResolvedValueOnce({ status: "not_configured" });
    const { profile } = await (await decision(req("POST", { decision: "approve" }, admin.cookie), ctx(id))).json();
    expect(profile.chainSync).toBe("not_configured");
  });

  it("rejecting needs a reason, does not touch the chain, and allows a resubmission", async () => {
    const admin = await makeUser("admin");
    const org = await makeUser();
    const id = await applyAs(org);
    expect((await decision(req("POST", { decision: "reject" }, admin.cookie), ctx(id))).status).toBe(400);

    const res = await decision(req("POST", { decision: "reject", reason: "Document unreadable" }, admin.cookie), ctx(id));
    expect((await res.json()).profile.rejectionReason).toBe("Document unreadable");
    expect(chain.syncOrganizerVerification).not.toHaveBeenCalled();

    const again = await apply(req("POST", application, org.cookie));
    expect(again.status).toBe(201);
    expect((await again.json()).profile.kybStatus).toBe("pending");
  });

  it("cannot review the same application twice, and unknown ids are 404", async () => {
    const admin = await makeUser("admin");
    const id = await applyAs(await makeUser());
    await decision(req("POST", { decision: "approve" }, admin.cookie), ctx(id));
    const second = await decision(req("POST", { decision: "reject", reason: "second thoughts" }, admin.cookie), ctx(id));
    expect(second.status).toBe(409);
    expect((await decision(req("POST", { decision: "approve" }, admin.cookie), ctx("missing"))).status).toBe(404);
  });

  it("will not sync an organizer who is not verified", async () => {
    const admin = await makeUser("admin");
    const id = await applyAs(await makeUser());
    expect((await retrySync(req("POST", undefined, admin.cookie), ctx(id))).status).toBe(409);
  });
});

describe("public profile", () => {
  it("shows only verified organizers, and only registration details", async () => {
    const admin = await makeUser("admin");
    const id = await applyAs(await makeUser());
    expect((await publicProfile(req("GET"), ctx(id))).status).toBe(404);

    await decision(req("POST", { decision: "approve" }, admin.cookie), ctx(id));
    const res = await publicProfile(req("GET"), ctx(id));
    expect(res.status).toBe(200);
    const { profile } = await res.json();
    expect(profile.legalName).toBe("Ayodhya Relief Trust");
    expect(profile.registrationNumber).toBe("MH/2019/0042");
    expect(JSON.stringify(profile)).not.toMatch(/email|documentHash|userId|walletAddress/);
  });

  it("hides rejected applications", async () => {
    const admin = await makeUser("admin");
    const id = await applyAs(await makeUser());
    await decision(req("POST", { decision: "reject", reason: "Not a registered entity" }, admin.cookie), ctx(id));
    expect((await publicProfile(req("GET"), ctx(id))).status).toBe(404);
  });
});

describe("campaign creation gate (only Verified organizers)", () => {
  it("refuses signed-out users", async () => {
    expect((await createCampaign(req("POST", {}))).status).toBe(401);
  });

  it("refuses a user who never applied", async () => {
    const res = await createCampaign(req("POST", {}, (await makeUser()).cookie));
    expect(res.status).toBe(403);
    expect((await res.json()).error.details.kyb_status).toBe("none");
  });

  it("refuses a pending organizer", async () => {
    const org = await makeUser();
    await applyAs(org);
    const res = await createCampaign(req("POST", {}, org.cookie));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("ORGANIZER_NOT_VERIFIED");
  });

  it("refuses a rejected organizer server-side", async () => {
    const admin = await makeUser("admin");
    const org = await makeUser();
    const id = await applyAs(org);
    await decision(req("POST", { decision: "reject", reason: "Fraudulent document" }, admin.cookie), ctx(id));
    const res = await createCampaign(req("POST", {}, org.cookie));
    expect(res.status).toBe(403);
    expect((await res.json()).error.details.kyb_status).toBe("rejected");
  });

  it("lets a verified organizer through, even with an older donor-role session token", async () => {
    const admin = await makeUser("admin");
    const org = await makeUser(); // cookie was signed while still a donor
    const id = await applyAs(org);
    await decision(req("POST", { decision: "approve" }, admin.cookie), ctx(id));
    // An empty body now reaches field validation, which proves the verification gate let it past.
    const res = await createCampaign(req("POST", {}, org.cookie));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_FAILED");
  });
});
