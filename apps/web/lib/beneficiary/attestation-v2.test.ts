/** C6 part 2: with BENEFICIARY_REGISTRY_V2=1 an attestation is also sent on-chain from the attestor's own wallet, and only a chain-confirmed one counts. */

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PublicUser } from "../auth/users";
import { findUserById } from "../auth/users";
import type { CampaignWithMilestones } from "../campaigns/service";
import { createDb, type Db } from "../db";
import { beneficiaries, beneficiaryAttestations, roleGrants, users } from "../db/schema";
import { VAULT, makeDonor, makeLiveCampaign } from "../donations/test-setup";
import { resetEnvCache } from "../env";
import { attestBeneficiary } from "./attestation";
import { hashIdentityFragment } from "./clientHasher";
import { FakeBeneficiaryChain } from "./fake-chain";
import { getProgramSalt, listBeneficiaries } from "./service";
import { attestationCount, campaignVerification } from "./verification";

let db: Db;
let chain: FakeBeneficiaryChain;
let campaign: CampaignWithMilestones;
let organizer: PublicUser;
let beneficiaryId: string;
let hash: string;

const rows = () => db.select().from(beneficiaryAttestations).all();
const attest = (actor: PublicUser, identityHash = hash) => attestBeneficiary(db, chain, actor, campaign.id, { identityHash });

/** An attestor the contract knows (synced role, listed on the fake manager) or, with `synced: false`, only saved here. */
async function attestor(synced = true): Promise<PublicUser> {
  const u = await makeDonor(db);
  db.update(users).set({ role: "attestor" }).where(eq(users.id, u.id)).run();
  db.insert(roleGrants).values({ id: randomUUID(), userId: u.id, role: "attestor", chainSync: synced ? "synced" : "failed" }).run();
  if (synced) chain.attestors.add(u.walletAddress.toLowerCase());
  return findUserById(db, u.id)!;
}

beforeEach(async () => {
  Object.assign(process.env, {
    DATABASE_URL: ":memory:",
    AUTH_SECRET: "s".repeat(40),
    WALLET_ENCRYPTION_KEY: "ab".repeat(32),
    MOCK_INR_ADDRESS: "0x9b6f00a1ce627a3e0d2da601253704084d8fc52c",
    BENEFICIARY_REGISTRY_V2: "1",
  });
  delete process.env.BENEFICIARY_REQUIRED_ATTESTATIONS;
  resetEnvCache();

  db = createDb(":memory:");
  chain = new FakeBeneficiaryChain();
  campaign = await makeLiveCampaign(db);
  organizer = findUserById(db, db.select().from(users).where(eq(users.role, "organizer")).get()!.id)!;
  chain.organizer = organizer.walletAddress.toLowerCase();
  const salt = getProgramSalt(db, organizer, campaign.id);
  if (!salt.ok) throw new Error("no salt");
  hash = await hashIdentityFragment("Meena Kumari, 1985, Tezpur", salt.salt);
  beneficiaryId = randomUUID();
  db.insert(beneficiaries)
    .values({ id: beneficiaryId, campaignId: campaign.id, identityHash: hash, payoutMethod: "bank transfer", registeredByUserId: organizer.id, chainStatus: "CONFIRMED" })
    .run();
  chain.registered.set(VAULT, new Set([hash]));
});

afterEach(() => {
  delete process.env.BENEFICIARY_REGISTRY_V2;
  resetEnvCache();
});

describe("confirming on the registry contract", () => {
  it("sends the attestation from the attestor's own wallet and counts it once confirmed", async () => {
    const a = await attestor();
    const r = await attest(a);
    expect(r).toEqual({ ok: true, matched: true, attestations: 1, required: 1, verified: true });
    expect(chain.sent).toEqual([`attest:${VAULT}:${hash}:${a.walletAddress.toLowerCase()}`]);
    const row = rows()[0];
    expect(row).toMatchObject({ chainStatus: "CONFIRMED", attestorUserId: a.id });
    expect(row.chainTxHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("refuses an attestor whose role is not registered on the contract, sending and saving nothing", async () => {
    const a = await attestor(false);
    const r = await attest(a);
    expect(!r.ok && r.code).toBe("FORBIDDEN");
    expect(chain.sent).toEqual([]);
    expect(rows()).toEqual([]);
  });

  it("answers 503 when the registry or sponsor is not configured", async () => {
    chain.isConfigured = false;
    const r = await attest(await attestor());
    expect(!r.ok && r.status).toBe(503);
    expect(rows()).toEqual([]);
  });

  it("still answers plainly for a fingerprint nobody registered, and sends nothing", async () => {
    const r = await attest(await attestor(), `0x${"ee".repeat(32)}`);
    expect(r).toEqual({ ok: true, matched: false });
    expect(chain.sent).toEqual([]);
  });

  it("a second confirmation by the same attestor is refused once the first is confirmed", async () => {
    const a = await attestor();
    await attest(a);
    const again = await attest(a);
    expect(!again.ok && again.code).toBe("ALREADY_ATTESTED");
    expect(chain.sent).toHaveLength(1);
  });
});

describe("a failed or unconfirmed send never counts, and can be retried", () => {
  it("a chain failure keeps a FAILED row that does not count, and a retry reuses it", async () => {
    const a = await attestor();
    chain.failNext = "rpc down";
    const failed = await attest(a);
    expect(!failed.ok && failed.code).toBe("CHAIN_FAILED");
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toMatchObject({ chainStatus: "FAILED", chainError: "rpc down" });
    expect(attestationCount(db, beneficiaryId)).toBe(0);
    expect(campaignVerification(db, campaign.id).verified).toBe(0);

    const retried = await attest(a);
    expect(retried).toMatchObject({ ok: true, matched: true, verified: true });
    expect(rows()).toHaveLength(1);
    expect(rows()[0].chainStatus).toBe("CONFIRMED");
    expect(rows()[0].chainError).toBeNull();
  });

  it("an unknown outcome stays PENDING (202), is not counted, is not sent twice, and settles once it lands", async () => {
    const a = await attestor();
    chain.hangNext = true;
    const pending = await attest(a);
    expect(!pending.ok && pending.status).toBe(202);
    expect(!pending.ok && pending.code).toBe("ATTESTATION_PENDING");
    const row = rows()[0];
    expect(row.chainStatus).toBe("PENDING");
    expect(row.chainTxHash).toMatch(/^0x/); // the hash was saved before waiting
    expect(attestationCount(db, beneficiaryId)).toBe(0);

    const stillWaiting = await attest(a);
    expect(!stillWaiting.ok && stillWaiting.code).toBe("ATTESTATION_PENDING");
    expect(chain.sent).toHaveLength(1); // not sent twice

    chain.landAttestation(row.chainTxHash!, VAULT, hash, a.walletAddress);
    const settled = await attest(a);
    expect(settled).toMatchObject({ ok: true, matched: true, verified: true });
    expect(rows()[0].chainStatus).toBe("CONFIRMED");
    expect(chain.sent).toHaveLength(1);
  });

  it("a contract refusal (for example the organizer's own wallet) is reported and not counted", async () => {
    const a = await attestor();
    chain.organizer = a.walletAddress.toLowerCase(); // the vault's organizer wallet
    const r = await attest(a);
    expect(!r.ok && r.code).toBe("CHAIN_FAILED");
    expect(!r.ok && r.message).toMatch(/organizer cannot confirm/);
    expect(campaignVerification(db, campaign.id).verified).toBe(0);
  });
});

describe("what counts as verified in this mode", () => {
  it("an app-level-only row from before the switch does not count, and re-confirming upgrades the same row", async () => {
    const a = await attestor();
    db.insert(beneficiaryAttestations).values({ id: randomUUID(), beneficiaryId, attestorUserId: a.id }).run(); // chainStatus "none"
    expect(attestationCount(db, beneficiaryId)).toBe(0);
    expect(campaignVerification(db, campaign.id)).toEqual({ registered: 1, verified: 0, required: 1 });

    const upgraded = await attest(a);
    expect(upgraded).toMatchObject({ ok: true, matched: true, verified: true });
    expect(rows()).toHaveLength(1);
    expect(rows()[0].chainStatus).toBe("CONFIRMED");
  });

  it("the organizer's list shows only chain-confirmed attestations", async () => {
    const a = await attestor();
    const b = await attestor();
    chain.hangNext = true;
    await attest(a); // pending
    await attest(b); // confirmed
    const list = listBeneficiaries(db, organizer, campaign.id);
    expect(list.ok && list.beneficiaries[0]).toMatchObject({ attestations: 1, verified: true });
  });

  it("a requirement of 2 needs two chain-confirmed attestors", async () => {
    process.env.BENEFICIARY_REQUIRED_ATTESTATIONS = "2";
    resetEnvCache();
    const a = await attestor();
    const b = await attestor();
    expect(await attest(a)).toMatchObject({ attestations: 1, required: 2, verified: false });
    expect(await attest(b)).toMatchObject({ attestations: 2, required: 2, verified: true });
    delete process.env.BENEFICIARY_REQUIRED_ATTESTATIONS;
  });
});
