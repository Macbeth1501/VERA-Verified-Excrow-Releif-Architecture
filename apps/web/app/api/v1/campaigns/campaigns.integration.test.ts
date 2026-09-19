import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { resetEnvCache } from "@/lib/env";
import { getDb, resetDbForTests, schema } from "@/lib/db";
import { resetRateLimits } from "@/lib/api/rate-limit";
import { registerDonor } from "@/lib/auth/users";
import { signSession, type Role } from "@/lib/auth/session";
import { decide, submitApplication } from "@/lib/organizers/service";

const chain = vi.hoisted(() => ({ deployCampaignVault: vi.fn() }));
vi.mock("@/lib/chain/campaigns", () => ({ deployCampaignVault: chain.deployCampaignVault }));

import { POST as create, GET as listMine } from "./route";
import { GET as getOne } from "./[id]/route";
import { POST as deploy } from "./[id]/deploy/route";

const ENC_KEY = "ab".repeat(32);
const VAULT = "0x6590E3D9E42EDB7e8970b9348CE457b9a2f990F7";

export const campaignInput = {
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

interface TestUser {
  id: string;
  cookie: string;
  wallet: string;
}

let counter = 0;
async function makeUser(role: Role = "donor"): Promise<TestUser> {
  const user = await registerDonor(
    getDb(),
    { email: `u${++counter}@example.com`, password: "correct-horse-battery" },
    ENC_KEY,
  );
  if (role !== "donor") getDb().update(schema.users).set({ role }).where(eq(schema.users.id, user.id)).run();
  return { id: user.id, cookie: `vera_session=${await signSession({ userId: user.id, role })}`, wallet: user.walletAddress };
}

/** A user with an organizer profile in the given state. */
async function makeOrganizer(status: "pending" | "verified" | "rejected" = "verified"): Promise<TestUser> {
  const db = getDb();
  const user = await makeUser();
  const admin = await makeUser("admin");
  const profile = submitApplication(db, user.id, {
    legalName: "Ayodhya Relief Trust",
    registrationNumber: "MH/2019/0042",
    jurisdiction: "India",
    documentHash: "a".repeat(64),
    documentName: "cert.pdf",
  });
  if (status === "verified") decide(db, profile.id, admin.id, "approve");
  if (status === "rejected") decide(db, profile.id, admin.id, "reject", "Not a registered entity");
  return user;
}

function req(method: string, body?: unknown, cookie?: string) {
  return new Request("http://localhost/x", {
    method,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

async function createFor(user: TestUser, overrides: Record<string, unknown> = {}) {
  const res = await create(req("POST", { ...campaignInput, ...overrides }, user.cookie));
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  process.env.DATABASE_URL = ":memory:";
  process.env.AUTH_SECRET = "s".repeat(40);
  process.env.WALLET_ENCRYPTION_KEY = ENC_KEY;
  process.env.MOCK_INR_ADDRESS = "0x9b6f00a1ce627a3e0d2da601253704084d8fc52c";
  delete process.env.FACTORY_ADDRESS;
  delete process.env.FACTORY_OWNER_KEY;
  resetEnvCache();
  resetDbForTests();
  resetRateLimits();
  chain.deployCampaignVault.mockReset();
  chain.deployCampaignVault.mockResolvedValue({
    status: "deployed",
    vaultAddress: VAULT,
    onchainCampaignId: 7,
    txHash: "0xdeadbeef",
  });
});

describe("the verified-organizer gate", () => {
  it("refuses signed-out users", async () => {
    expect((await create(req("POST", campaignInput))).status).toBe(401);
  });

  it("refuses a user who never applied, a pending one and a rejected one", async () => {
    for (const [status, expected] of [
      [undefined, "none"],
      ["pending", "pending"],
      ["rejected", "rejected"],
    ] as const) {
      const user = status ? await makeOrganizer(status) : await makeUser();
      const { status: code, body } = await createFor(user);
      expect(code).toBe(403);
      expect(body.error.code).toBe("ORGANIZER_NOT_VERIFIED");
      expect(body.error.details.kyb_status).toBe(expected);
    }
  });

  it("lets a verified organizer create a campaign", async () => {
    const { status } = await createFor(await makeOrganizer());
    expect(status).toBe(201);
  });
});

describe("server-side validation (authoritative, regardless of the UI)", () => {
  // FR-CMP-01: the acceptance criterion names 90% and 110% explicitly.
  it("rejects milestones totalling 90% or 110%", async () => {
    const org = await makeOrganizer();
    for (const [first, total] of [[50, "90%"], [70, "110%"]] as const) {
      const { status, body } = await createFor(org, {
        milestones: [{ ...campaignInput.milestones[0], targetPct: first }, campaignInput.milestones[1]],
      });
      expect(status).toBe(400);
      expect(body.error.code).toBe("VALIDATION_FAILED");
      expect(body.error.details.milestones[0]).toContain(total);
    }
    expect(getDb().select().from(schema.campaigns).all()).toHaveLength(0);
  });

  it("rejects an admin cap above the category ceiling but allows exactly the ceiling", async () => {
    const org = await makeOrganizer();
    const over = await createFor(org, { adminExpenseCapPct: 11 });
    expect(over.status).toBe(400);
    expect(over.body.error.details.adminExpenseCapPct[0]).toContain("cannot exceed 10%");
    expect((await createFor(org, { adminExpenseCapPct: 10 })).status).toBe(201);
  });

  it("allows a higher cap for a category with a higher ceiling", async () => {
    const org = await makeOrganizer();
    expect((await createFor(org, { category: "COMMUNITY", adminExpenseCapPct: 20 })).status).toBe(201);
    expect((await createFor(org, { category: "MEDICAL", adminExpenseCapPct: 16 })).status).toBe(400);
  });

  it("rejects an empty milestone list and invalid JSON", async () => {
    const org = await makeOrganizer();
    expect((await createFor(org, { milestones: [] })).status).toBe(400);
    const bad = await create(
      new Request("http://localhost/x", { method: "POST", headers: { "content-type": "application/json", cookie: org.cookie }, body: "{oops" }),
    );
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.code).toBe("INVALID_JSON");
  });
});

describe("creating and reading campaigns", () => {
  it("saves the campaign and its milestones in order, as a DRAFT with no vault", async () => {
    const org = await makeOrganizer();
    const { body } = await createFor(org);
    const c = body.campaign;
    expect(c.status).toBe("DRAFT");
    expect(c.vaultContractAddress).toBeNull();
    expect(c.chainStatus).toBe("pending");
    expect(c.fundingGoalMinorUnits).toBe("1000000000");
    expect(c.milestones.map((m: { targetPct: number }) => m.targetPct)).toEqual([60, 40]);
    expect(c.milestones.map((m: { sequenceOrder: number }) => m.sequenceOrder)).toEqual([0, 1]);
    expect(c.milestones[0].status).toBe("PENDING");
  });

  it("lists only the signed-in organizer's own campaigns", async () => {
    const a = await makeOrganizer();
    const b = await makeOrganizer();
    await createFor(a);
    await createFor(a, { title: "Second campaign for Assam" });
    await createFor(b, { title: "Unrelated medical campaign" });

    const mine = await (await listMine(req("GET", undefined, a.cookie))).json();
    expect(mine.campaigns).toHaveLength(2);
    const other = await (await listMine(req("GET", undefined, b.cookie))).json();
    expect(other.campaigns).toHaveLength(1);
    const donor = await (await listMine(req("GET", undefined, (await makeUser()).cookie))).json();
    expect(donor.campaigns).toEqual([]);
  });

  it("hides a DRAFT from everyone but its organizer and admins", async () => {
    const org = await makeOrganizer();
    const { body } = await createFor(org);
    const id = body.campaign_id;
    expect((await getOne(req("GET"), ctx(id))).status).toBe(404);
    expect((await getOne(req("GET", undefined, (await makeUser()).cookie), ctx(id))).status).toBe(404);
    expect((await getOne(req("GET", undefined, org.cookie), ctx(id))).status).toBe(200);
    expect((await getOne(req("GET", undefined, (await makeUser("admin")).cookie), ctx(id))).status).toBe(200);
  });

  it("makes a LIVE campaign publicly readable", async () => {
    const org = await makeOrganizer();
    const { body } = await createFor(org);
    await deploy(req("POST", undefined, org.cookie), ctx(body.campaign_id));
    const res = await getOne(req("GET"), ctx(body.campaign_id));
    expect(res.status).toBe(200);
    expect((await res.json()).campaign.vaultContractAddress).toBe(VAULT);
  });

  it("returns 404 for an unknown campaign", async () => {
    expect((await getOne(req("GET"), ctx("missing"))).status).toBe(404);
  });
});

describe("deploying the vault on-chain", () => {
  it("records the vault address and turns the campaign LIVE", async () => {
    const org = await makeOrganizer();
    const { body } = await createFor(org);
    const res = await deploy(req("POST", undefined, org.cookie), ctx(body.campaign_id));
    expect(res.status).toBe(200);
    const c = (await res.json()).campaign;
    expect(c.status).toBe("LIVE");
    expect(c.chainStatus).toBe("deployed");
    expect(c.vaultContractAddress).toBe(VAULT);
    expect(c.onchainCampaignId).toBe(7);
    expect(c.chainTxHash).toBe("0xdeadbeef");
  });

  it("signs as the organizer, passing their wallet and the milestone split", async () => {
    const org = await makeOrganizer();
    const { body } = await createFor(org);
    await deploy(req("POST", undefined, org.cookie), ctx(body.campaign_id));
    expect(chain.deployCampaignVault).toHaveBeenCalledWith(
      expect.objectContaining({
        organizerAddress: org.wallet,
        category: "DISASTER_RELIEF",
        fundingGoalMinorUnits: "1000000000",
        adminExpenseCapPct: 10,
        milestonePcts: [60, 40],
      }),
    );
    expect(chain.deployCampaignVault.mock.calls[0][0].organizerWalletKeyEnc).toBeTruthy();
  });

  it("uses the organizer's wallet even when an admin retries, never the admin's", async () => {
    const org = await makeOrganizer();
    const admin = await makeUser("admin");
    const { body } = await createFor(org);
    chain.deployCampaignVault.mockResolvedValueOnce({ status: "failed", error: "rpc down" });
    await deploy(req("POST", undefined, org.cookie), ctx(body.campaign_id));

    await deploy(req("POST", undefined, admin.cookie), ctx(body.campaign_id));
    expect(chain.deployCampaignVault).toHaveBeenLastCalledWith(
      expect.objectContaining({ organizerAddress: org.wallet }),
    );
    expect(chain.deployCampaignVault).not.toHaveBeenLastCalledWith(
      expect.objectContaining({ organizerAddress: admin.wallet }),
    );
  });

  it("keeps the campaign a retryable DRAFT when the chain call fails", async () => {
    const org = await makeOrganizer();
    const { body } = await createFor(org);
    chain.deployCampaignVault.mockResolvedValueOnce({ status: "failed", error: "insufficient funds" });

    const failedRes = await (await deploy(req("POST", undefined, org.cookie), ctx(body.campaign_id))).json();
    expect(failedRes.campaign.status).toBe("DRAFT");
    expect(failedRes.campaign.chainStatus).toBe("failed");
    expect(failedRes.campaign.chainError).toBe("insufficient funds");
    expect(failedRes.campaign.vaultContractAddress).toBeNull();

    const retried = await (await deploy(req("POST", undefined, org.cookie), ctx(body.campaign_id))).json();
    expect(retried.campaign.status).toBe("LIVE");
    expect(retried.campaign.chainError).toBeNull();
  });

  it("records when on-chain deploy is not configured, without failing the campaign", async () => {
    const org = await makeOrganizer();
    const { body } = await createFor(org);
    chain.deployCampaignVault.mockResolvedValueOnce({ status: "not_configured" });
    const c = (await (await deploy(req("POST", undefined, org.cookie), ctx(body.campaign_id))).json()).campaign;
    expect(c.chainStatus).toBe("not_configured");
    expect(c.status).toBe("DRAFT");
    expect(c.vaultContractAddress).toBeNull();
  });

  it("does not deploy a second vault for an already deployed campaign", async () => {
    const org = await makeOrganizer();
    const { body } = await createFor(org);
    await deploy(req("POST", undefined, org.cookie), ctx(body.campaign_id));
    await deploy(req("POST", undefined, org.cookie), ctx(body.campaign_id));
    expect(chain.deployCampaignVault).toHaveBeenCalledTimes(1);
  });

  it("refuses a different organizer and signed-out callers", async () => {
    const org = await makeOrganizer();
    const stranger = await makeOrganizer();
    const { body } = await createFor(org);
    expect((await deploy(req("POST", undefined, stranger.cookie), ctx(body.campaign_id))).status).toBe(403);
    expect((await deploy(req("POST"), ctx(body.campaign_id))).status).toBe(401);
    expect(chain.deployCampaignVault).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown campaign", async () => {
    const org = await makeOrganizer();
    expect((await deploy(req("POST", undefined, org.cookie), ctx("missing"))).status).toBe(404);
  });
});
