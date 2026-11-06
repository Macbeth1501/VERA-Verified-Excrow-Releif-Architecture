/** C5: attestors verify that registered beneficiaries exist (app-enforced). Match and no-match, who may attest, once each, evidence, privacy, and the derived verified state. */

import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { PublicUser } from "../auth/users";
import { findUserById } from "../auth/users";
import { createDb, type Db } from "../db";
import { beneficiaries, beneficiaryAttestations, documents, users } from "../db/schema";
import { makeDonor, makeLiveCampaign } from "../donations/test-setup";
import type { CampaignWithMilestones } from "../campaigns/service";
import { attestBeneficiary } from "./attestation";
import { hashIdentityFragment } from "./clientHasher";
import { FakeBeneficiaryChain } from "./fake-chain";
import { getProgramSalt, listBeneficiaries } from "./service";
import { attestBeneficiarySchema } from "./validation";
import { attestationCount, campaignVerification } from "./verification";

let db: Db;
let campaign: CampaignWithMilestones;
let organizer: PublicUser;
let admin: PublicUser;
let beneficiaryId: string;
let salt: string;
let hash: string;
const FRAGMENT = "Asha Devi, born 1990-04-12, Barpeta village";

async function asRole(role: "attestor" | "council" | "donor"): Promise<PublicUser> {
  const u = await makeDonor(db);
  if (role !== "donor") db.update(users).set({ role }).where(eq(users.id, u.id)).run();
  return findUserById(db, u.id)!;
}
const attestor = () => asRole("attestor");
const attest = (actor: Pick<PublicUser, "id" | "role" | "walletAddress">, identityHash = hash, extra: object = {}) =>
  attestBeneficiary(db, new FakeBeneficiaryChain(), actor, campaign.id, { identityHash, ...extra });

function addBeneficiary(identityHash: string, chainStatus: "PENDING" | "CONFIRMED" | "FAILED" = "CONFIRMED") {
  const id = randomUUID();
  db.insert(beneficiaries).values({ id, campaignId: campaign.id, identityHash, payoutMethod: "bank transfer", registeredByUserId: organizer.id, chainStatus }).run();
  return id;
}

beforeEach(async () => {
  db = createDb(":memory:");
  campaign = await makeLiveCampaign(db);
  organizer = findUserById(db, db.select().from(users).where(eq(users.role, "organizer")).get()!.id)!;
  admin = findUserById(db, db.select().from(users).where(eq(users.role, "admin")).get()!.id)!;
  const s = getProgramSalt(db, organizer, campaign.id);
  if (!s.ok) throw new Error("no salt");
  salt = s.salt;
  hash = await hashIdentityFragment(FRAGMENT, salt);
  beneficiaryId = addBeneficiary(hash);
});

describe("confirming a beneficiary", () => {
  it("matches the fingerprint, records one attestation and reports it verified at the default of 1", async () => {
    const a = await attestor();
    const r = await attest(a);
    expect(r).toEqual({ ok: true, matched: true, attestations: 1, required: 1, verified: true });
    expect(attestationCount(db, beneficiaryId)).toBe(1);
  });

  it("matches however the attestor typed it (case, spacing), and says so plainly when nothing matches", async () => {
    const a = await attestor();
    const sloppy = await hashIdentityFragment("  asha DEVI,  born 1990-04-12,   Barpeta village ", salt);
    expect(await attest(a, sloppy)).toMatchObject({ ok: true, matched: true });

    const b = await attestor();
    const wrong = await hashIdentityFragment("Somebody Else, born 1971", salt);
    expect(await attest(b, wrong)).toEqual({ ok: true, matched: false });
    expect(db.select().from(beneficiaryAttestations).all()).toHaveLength(1);
  });

  it("does not match a fingerprint made with another campaign's salt, nor a beneficiary not yet confirmed on-chain", async () => {
    const a = await attestor();
    expect(await attest(a, await hashIdentityFragment(FRAGMENT, "another-campaigns-salt"))).toEqual({ ok: true, matched: false });
    const pending = await hashIdentityFragment("Pending Person", salt);
    addBeneficiary(pending, "PENDING");
    expect(await attest(a, pending)).toEqual({ ok: true, matched: false });
  });

  it("counts each attestor once", async () => {
    const a = await attestor();
    expect((await attest(a)).ok).toBe(true);
    const again = await attest(a);
    expect(!again.ok && again.code).toBe("ALREADY_ATTESTED");
    expect(attestationCount(db, beneficiaryId)).toBe(1);
    const b = await attestor();
    expect(await attest(b)).toMatchObject({ matched: true, attestations: 2 });
  });

  it("refuses anyone who is not an attestor: the organizer, an admin, council, a donor", async () => {
    for (const actor of [organizer, admin, await asRole("council"), await asRole("donor")]) {
      const r = await attest(actor);
      expect(!r.ok && r.code, actor.role).toBe("FORBIDDEN");
    }
    expect(db.select().from(beneficiaryAttestations).all()).toEqual([]);
  });

  it("refuses an attestor who owns the campaign", async () => {
    const owner = { id: organizer.id, role: "attestor" as const, walletAddress: organizer.walletAddress }; // cannot happen via the role manager; the check is defence in depth
    const r = await attest(owner);
    expect(!r.ok && r.code).toBe("FORBIDDEN");
  });

  it("reports an unknown campaign", async () => {
    const r = await attestBeneficiary(db, new FakeBeneficiaryChain(), await attestor(), "missing", { identityHash: hash });
    expect(!r.ok && r.code).toBe("CAMPAIGN_NOT_FOUND");
  });
});

describe("evidence", () => {
  const bytes = Buffer.from("a photo of the meeting");
  const evidenceHash = `0x${createHash("sha256").update(bytes).digest("hex")}`;
  const evidence = { data: bytes.toString("base64"), mimeType: "image/png", name: "meeting.png" };

  it("stores the evidence file with the new purpose and links it to the attestation", async () => {
    const a = await attestor();
    expect((await attest(a, hash, { evidenceHash, evidence })).ok).toBe(true);
    const doc = db.select().from(documents).get()!;
    expect(doc.purpose).toBe("beneficiary_evidence");
    expect(doc.uploadedByUserId).toBe(a.id);
    const row = db.select().from(beneficiaryAttestations).get()!;
    expect(row.evidenceDocumentId).toBe(doc.id);
    expect(row.evidenceHash).toBe(evidenceHash);
  });

  it("accepts a hash without a file, refuses a file whose bytes do not match its hash, and a file with no hash", async () => {
    const a = await attestor();
    const bad = await attest(a, hash, { evidenceHash: `0x${"11".repeat(32)}`, evidence });
    expect(!bad.ok && bad.code).toBe("VALIDATION_FAILED");
    const noHash = await attest(a, hash, { evidence });
    expect(!noHash.ok && noHash.code).toBe("VALIDATION_FAILED");
    expect(db.select().from(documents).all()).toEqual([]);
    expect(db.select().from(beneficiaryAttestations).all()).toEqual([]);
    expect((await attest(a, hash, { evidenceHash })).ok).toBe(true);
    expect(db.select().from(documents).all()).toEqual([]);
  });

  it("keeps no file when the fingerprint matched nobody", async () => {
    const a = await attestor();
    const wrong = await hashIdentityFragment("Nobody Registered", salt);
    expect(await attest(a, wrong, { evidenceHash, evidence })).toEqual({ ok: true, matched: false });
    expect(db.select().from(documents).all()).toEqual([]);
  });
});

describe("privacy", () => {
  it("never stores or returns the identity text, only fingerprints", async () => {
    const a = await attestor();
    const result = await attest(a);
    expect(JSON.stringify(result)).not.toContain("Asha");
    const dump = JSON.stringify({
      attestations: db.select().from(beneficiaryAttestations).all(),
      beneficiaries: db.select().from(beneficiaries).all(),
      list: listBeneficiaries(db, organizer, campaign.id),
    });
    for (const piece of ["Asha", "Devi", "1990", "Barpeta"]) expect(dump).not.toContain(piece);
  });

  it("the request schema has no field for identity text and drops one if sent", () => {
    const parsed = attestBeneficiarySchema.parse({ identityHash: hash, name: "Asha Devi", idNumber: "1234" });
    expect(Object.keys(parsed)).toEqual(["identityHash"]);
    expect(attestBeneficiarySchema.safeParse({ identityHash: "Asha Devi" }).success).toBe(false);
    expect(attestBeneficiarySchema.safeParse({ identityHash: `0x${"0".repeat(64)}` }).success).toBe(false);
  });
});

describe("the derived verified state", () => {
  it("is not verified before any attestation and the list shows the counts", async () => {
    const before = listBeneficiaries(db, organizer, campaign.id);
    expect(before.ok && before.beneficiaries[0]).toMatchObject({ attestations: 0, requiredAttestations: 1, verified: false });
    expect(campaignVerification(db, campaign.id)).toEqual({ registered: 1, verified: 0, required: 1 });

    await attest(await attestor());
    const after = listBeneficiaries(db, admin, campaign.id);
    expect(after.ok && after.beneficiaries[0]).toMatchObject({ attestations: 1, verified: true });
    expect(campaignVerification(db, campaign.id)).toEqual({ registered: 1, verified: 1, required: 1 });
  });

  it("counts only confirmed beneficiaries as registered", () => {
    addBeneficiary(`0x${"cc".repeat(32)}`, "PENDING");
    addBeneficiary(`0x${"dd".repeat(32)}`, "FAILED");
    expect(campaignVerification(db, campaign.id).registered).toBe(1);
  });
});

describe("the salt for attestors", () => {
  it("is given to an attestor on a live campaign, so they can fingerprint a person they met", async () => {
    const r = getProgramSalt(db, await attestor(), campaign.id);
    expect(r.ok && r.salt).toBe(salt);
  });

  it("is still refused to donors and council, and an unknown campaign is not found", async () => {
    for (const actor of [await asRole("donor"), await asRole("council")]) {
      const r = getProgramSalt(db, actor, campaign.id);
      expect(!r.ok && r.code).toBe("FORBIDDEN");
    }
    const missing = getProgramSalt(db, await attestor(), "missing");
    expect(!missing.ok && missing.code).toBe("CAMPAIGN_NOT_FOUND");
  });
});
