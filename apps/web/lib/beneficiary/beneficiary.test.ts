import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { PublicUser } from "../auth/users";
import { findUserById } from "../auth/users";
import { createCampaign, getCampaign, recordVaultDeploy, type CampaignWithMilestones } from "../campaigns/service";
import { createDb, type Db } from "../db";
import { beneficiaries, users } from "../db/schema";
import { VAULT, makeDonor, makeLiveCampaign } from "../donations/test-setup";
import { FakeBeneficiaryChain } from "./fake-chain";
import { getProgramSalt, listBeneficiaries, registerBeneficiary } from "./service";
import { registerBeneficiarySchema } from "./validation";

const H1 = `0x${"a1".repeat(32)}`;
const H2 = `0x${"b2".repeat(32)}`;
const PAYOUT = "bank transfer";

let db: Db;
let chain: FakeBeneficiaryChain;
let campaign: CampaignWithMilestones;
let organizer: PublicUser;
let admin: PublicUser;
let stranger: PublicUser;

beforeEach(async () => {
  db = createDb(":memory:");
  chain = new FakeBeneficiaryChain();
  campaign = await makeLiveCampaign(db);
  organizer = findUserById(db, db.select().from(users).where(eq(users.role, "organizer")).get()!.id)!;
  admin = findUserById(db, db.select().from(users).where(eq(users.role, "admin")).get()!.id)!;
  stranger = await makeDonor(db);
  chain.organizer = organizer.walletAddress.toLowerCase();
});

const register = (identityHash = H1, actor: Pick<PublicUser, "id" | "role"> = organizer, campaignId = campaign.id) =>
  registerBeneficiary(db, chain, { actor, campaignId, identityHash, payoutMethod: PAYOUT });
const rows = () => db.select().from(beneficiaries).all();

/** A second live campaign by the same organizer, on a different vault. */
function secondCampaign(vault = "0x1111111111111111111111111111111111111111") {
  const c = createCampaign(db, campaign.organizerProfileId, {
    title: "Second campaign for the same trust",
    summary: "A second campaign, used to prove registrations are per campaign.",
    category: "DISASTER_RELIEF",
    fundingGoalMinorUnits: "1000000000",
    adminExpenseCapPct: 10,
    milestones: [{ description: "Deliver everything", targetPct: 100, requiredAttestations: 2 }],
  });
  return recordVaultDeploy(db, c.id, { status: "deployed", vaultAddress: vault, onchainCampaignId: 1, txHash: "0x2" });
}

describe("registering a beneficiary", () => {
  it("records it, sends one registration signed by the organizer, and saves the hash", async () => {
    const r = await register();
    expect(r.ok && r.beneficiary.status).toBe("CONFIRMED");
    expect(chain.sent).toEqual([`register:${VAULT}:${H1}`]);
    const row = rows()[0];
    expect(row.chainTxHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(row.registeredByUserId).toBe(organizer.id);
  });

  it("refuses the same fingerprint twice with a reason code, and sends nothing the second time", async () => {
    await register();
    const again = await register();
    expect(!again.ok && [again.status, again.code]).toEqual([409, "DUPLICATE_BENEFICIARY"]);
    expect(chain.sent).toHaveLength(1);
    expect(rows()).toHaveLength(1);
  });

  it("treats the same fingerprint in different letter case as the same one", async () => {
    await register(H1);
    const again = await register(`0x${H1.slice(2).toUpperCase()}`);
    expect(!again.ok && again.code).toBe("DUPLICATE_BENEFICIARY");
  });

  it("reveals nothing about the earlier record when refusing", async () => {
    const first = await register();
    const again = await register();
    expect(again.ok).toBe(false);
    if (again.ok || !first.ok) return;
    expect(Object.keys(again).sort()).toEqual(["code", "message", "ok", "status"]);
    const text = JSON.stringify(again);
    for (const leak of [first.beneficiary.id, first.beneficiary.createdAt, first.beneficiary.txHash ?? "?", H1]) expect(text).not.toContain(leak);
  });

  it("lets different people register in the same campaign", async () => {
    expect((await register(H1)).ok).toBe(true);
    expect((await register(H2)).ok).toBe(true);
    expect(rows()).toHaveLength(2);
  });

  it("lets the same fingerprint register in a different campaign", async () => {
    const other = secondCampaign();
    await register(H1);
    const there = await register(H1, organizer, other.id);
    expect(there.ok).toBe(true);
    expect(rows()).toHaveLength(2);
  });

  it("lets an admin register, still signed as the campaign's organizer", async () => {
    const r = await register(H1, admin);
    expect(r.ok).toBe(true);
    expect(rows()[0].registeredByUserId).toBe(admin.id);
  });

  it("refuses everyone else", async () => {
    const r = await register(H1, stranger);
    expect(!r.ok && [r.status, r.code]).toEqual([403, "FORBIDDEN"]);
    expect(rows()).toHaveLength(0);
    expect(chain.sent).toHaveLength(0);
  });

  it("refuses an unknown campaign and one that is not published yet", async () => {
    const missing = await register(H1, organizer, "does-not-exist");
    expect(!missing.ok && missing.code).toBe("CAMPAIGN_NOT_FOUND");
    const draft = createCampaign(db, campaign.organizerProfileId, {
      title: "Not yet published", summary: "A draft that has no vault yet, so nobody can register into it.",
      category: "MEDICAL", fundingGoalMinorUnits: "1000000", adminExpenseCapPct: 10,
      milestones: [{ description: "Everything", targetPct: 100, requiredAttestations: 2 }],
    });
    const early = await register(H1, organizer, draft.id);
    expect(!early.ok && early.code).toBe("CAMPAIGN_NOT_LIVE");
  });

  it("says it is switched off, and writes nothing, when the registry is not configured", async () => {
    chain.isConfigured = false;
    const r = await register();
    expect(!r.ok && [r.status, r.code]).toEqual([503, "REGISTRY_NOT_CONFIGURED"]);
    expect(rows()).toHaveLength(0);
  });

  it("cannot sign for an organizer who uses their own wallet", async () => {
    db.update(users).set({ walletKeyEnc: null }).where(eq(users.id, organizer.id)).run();
    const r = await register();
    expect(!r.ok && r.code).toBe("FORBIDDEN");
    expect(chain.sent).toHaveLength(0);
  });
});

describe("when the chain misbehaves", () => {
  it("keeps the request as FAILED after a chain failure, and a retry reuses the same row", async () => {
    chain.failNext = "rpc down";
    const first = await register();
    expect(!first.ok && [first.status, first.code]).toEqual([422, "CHAIN_FAILED"]);
    expect(rows().map((r) => r.chainStatus)).toEqual(["FAILED"]);

    const retry = await register();
    expect(retry.ok && retry.beneficiary.status).toBe("CONFIRMED");
    expect(rows()).toHaveLength(1);
  });

  it("keeps an unknown outcome PENDING with its hash saved, and never sends it twice", async () => {
    chain.hangNext = true;
    const first = await register();
    expect(!first.ok && [first.status, first.code]).toEqual([202, "REGISTRATION_PENDING"]);
    const row = rows()[0];
    expect(row.chainStatus).toBe("PENDING");
    expect(row.chainTxHash).toBeTruthy();

    const early = await register();
    expect(!early.ok && early.code).toBe("REGISTRATION_PENDING");
    expect(chain.sent).toHaveLength(1);

    chain.land(row.chainTxHash!, VAULT, H1);
    const done = await register();
    expect(done.ok && done.beneficiary.status).toBe("CONFIRMED");
    expect(chain.sent).toHaveLength(1);
  });

  it("refuses a fingerprint the chain already holds even when the database has no record", async () => {
    chain.land("0xabc", VAULT, H1);
    const r = await register();
    expect(!r.ok && r.code).toBe("DUPLICATE_BENEFICIARY");
    expect(chain.sent).toHaveLength(0);
    expect(rows()).toHaveLength(0);
  });

  it("adopts an earlier attempt that turns out to be on-chain after all", async () => {
    chain.failNext = "rpc down";
    await register();
    chain.land("0xabc", VAULT, H1); // the "failed" send had actually landed
    const r = await register();
    expect(r.ok && r.beneficiary.status).toBe("CONFIRMED");
    expect(chain.sent).toHaveLength(0);
    expect(rows()).toHaveLength(1);
  });

  it("still tries when the chain cannot be read, and the contract remains the judge", async () => {
    chain.unreadable = true;
    const r = await register();
    expect(r.ok).toBe(true);
  });

  it("lets only one of two simultaneous identical requests through", async () => {
    const results = await Promise.all([register(), register()]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.code === "DUPLICATE_BENEFICIARY")).toHaveLength(1);
    expect(rows()).toHaveLength(1);
    expect(chain.sent).toHaveLength(1);
  });
});

describe("the program salt", () => {
  const salt = (id = campaign.id, actor: Pick<PublicUser, "id" | "role"> = organizer) => getProgramSalt(db, actor, id);

  it("is random, stable per campaign, and different between campaigns", () => {
    const a = salt();
    expect(a.ok && a.salt).toMatch(/^[0-9a-f]{32}$/);
    const again = salt();
    expect(again.ok && a.ok && again.salt).toBe(a.ok && a.salt);
    const other = salt(secondCampaign().id);
    expect(other.ok && a.ok && other.salt).not.toBe(a.ok && a.salt);
  });

  it("goes only to the organizer or an admin", () => {
    expect(salt(campaign.id, admin).ok).toBe(true);
    const r = salt(campaign.id, stranger);
    expect(!r.ok && r.code).toBe("FORBIDDEN");
  });

  it("never appears in the campaign data that routes return", () => {
    const s = salt();
    expect(JSON.stringify(getCampaign(db, campaign.id))).not.toContain(s.ok ? s.salt : "?");
  });
});

describe("listing beneficiaries", () => {
  it("shows hashes and status only, oldest first, to the organizer and admins", async () => {
    await register(H1);
    await register(H2);
    const r = listBeneficiaries(db, organizer, campaign.id);
    expect(r.ok && r.beneficiaries.map((b) => b.identityHash)).toEqual([H1, H2]);
    if (r.ok) {
      expect(Object.keys(r.beneficiaries[0]).sort()).toEqual(
        ["createdAt", "error", "id", "identityHash", "payoutMethod", "photoHash", "status", "txHash"],
      );
    }
    expect(listBeneficiaries(db, admin, campaign.id).ok).toBe(true);
  });

  it("is private to the campaign's organizer and admins", () => {
    const r = listBeneficiaries(db, stranger, campaign.id);
    expect(!r.ok && r.code).toBe("FORBIDDEN");
  });
});

describe("what the API accepts", () => {
  const ok = { identityHash: H1, payoutMethod: " bank transfer " };

  it("accepts a fingerprint, lower-cases it and trims the payout label", () => {
    const p = registerBeneficiarySchema.safeParse({ ...ok, identityHash: H1.toUpperCase().replace("0X", "0x") });
    expect(p.success && p.data).toEqual({ identityHash: H1, payoutMethod: "bank transfer" });
  });

  it("rejects anything that is not a 0x plus 64-hex fingerprint, including raw text", () => {
    for (const bad of ["asha devi 1990-01-01", "0x123", `0x${"g".repeat(64)}`, "", `0x${"0".repeat(64)}`]) {
      expect(registerBeneficiarySchema.safeParse({ ...ok, identityHash: bad }).success).toBe(false);
    }
  });

  it("takes an optional photo fingerprint under the same rule", () => {
    expect(registerBeneficiarySchema.safeParse({ ...ok, photoHash: H2 }).success).toBe(true);
    expect(registerBeneficiarySchema.safeParse({ ...ok, photoHash: "photo.jpg" }).success).toBe(false);
  });

  it("requires a payout method and silently drops any raw identity field", () => {
    expect(registerBeneficiarySchema.safeParse({ identityHash: H1, payoutMethod: "  " }).success).toBe(false);
    const p = registerBeneficiarySchema.safeParse({ ...ok, name: "Asha Devi", nationalId: "1234" });
    expect(p.success && Object.keys(p.data).sort()).toEqual(["identityHash", "payoutMethod"]);
  });
});
