import { randomBytes, randomUUID } from "node:crypto";
import { asc, eq, and } from "drizzle-orm";
import { findUserById, getWalletKeyEnc, type PublicUser } from "../auth/users";
import { getCampaign, ownerUserId } from "../campaigns/service";
import type { Db } from "../db";
import { beneficiaries, campaignSalts, type BeneficiaryRow } from "../db/schema";
import type { BeneficiaryChain } from "./chain-port";

/**
 * Beneficiary registration (Step 13, FR-IDN-03). The organizer (or an admin acting for them) sends a
 * fingerprint made in the browser; this layer refuses a repeat in the same campaign, records the
 * request, and has the campaign's OWN organizer register it on the BeneficiaryRegistry, which
 * re-checks uniqueness independently on-chain (SPDD 17.2: a compromised backend cannot rubber-stamp
 * a duplicate). Only hashes are handled here: there is no raw identity data anywhere to store or log.
 */

export type BeneficiaryFailure = {
  ok: false;
  status: number;
  code:
    | "CAMPAIGN_NOT_FOUND"
    | "CAMPAIGN_NOT_LIVE"
    | "FORBIDDEN"
    | "REGISTRY_NOT_CONFIGURED"
    | "DUPLICATE_BENEFICIARY"
    | "REGISTRATION_PENDING"
    | "CHAIN_FAILED";
  message: string;
};

export type Outcome<T> = ({ ok: true } & T) | BeneficiaryFailure;

const fail = (status: number, code: BeneficiaryFailure["code"], message: string): BeneficiaryFailure => ({ ok: false, status, code, message });

/** Sent to the registry when no photo fingerprint was given. */
export const NO_PHOTO = `0x${"0".repeat(64)}`;
/** A PENDING request that never got a transaction hash is retried after this long. */
const STALE_UNSENT_MS = 60_000;

/** What the organizer sees for one beneficiary: hashes and status only, never identity data. */
export interface BeneficiaryView {
  id: string;
  identityHash: string;
  photoHash: string | null;
  payoutMethod: string;
  status: BeneficiaryRow["chainStatus"];
  txHash: string | null;
  error: string | null;
  createdAt: string;
}

const viewOf = (b: BeneficiaryRow): BeneficiaryView => ({
  id: b.id,
  identityHash: b.identityHash,
  photoHash: b.photoHash,
  payoutMethod: b.payoutMethod,
  status: b.chainStatus,
  txHash: b.chainTxHash,
  error: b.chainError,
  createdAt: b.createdAt,
});

interface Context {
  vault: string;
  ownerId: string;
}

/** Only the campaign's organizer, or an admin, may see or change its beneficiaries. */
function authorize(db: Db, actor: Pick<PublicUser, "id" | "role">, campaignId: string): ({ ok: true } & Context) | BeneficiaryFailure {
  const campaign = getCampaign(db, campaignId);
  const ownerId = campaign ? ownerUserId(db, campaignId) : null;
  if (!campaign || !ownerId) return fail(404, "CAMPAIGN_NOT_FOUND", "Campaign not found.");
  if (actor.id !== ownerId && actor.role !== "admin") return fail(403, "FORBIDDEN", "Only the campaign's organizer can manage its beneficiaries.");
  if (campaign.status !== "LIVE" || !campaign.vaultContractAddress) {
    return fail(409, "CAMPAIGN_NOT_LIVE", "Publish the campaign before registering beneficiaries.");
  }
  return { ok: true, vault: campaign.vaultContractAddress, ownerId };
}

/**
 * The random salt beneficiary fingerprints are hashed with, created on first use (so campaigns that
 * existed before this feature get one too). Handed only to the campaign's organizer or an admin.
 */
export function getProgramSalt(db: Db, actor: Pick<PublicUser, "id" | "role">, campaignId: string): Outcome<{ salt: string }> {
  const ctx = authorize(db, actor, campaignId);
  if (!ctx.ok) return ctx;
  db.insert(campaignSalts).values({ campaignId, salt: randomBytes(16).toString("hex") }).onConflictDoNothing().run();
  const row = db.select().from(campaignSalts).where(eq(campaignSalts.campaignId, campaignId)).get();
  return row ? { ok: true, salt: row.salt } : fail(404, "CAMPAIGN_NOT_FOUND", "Campaign not found.");
}

export function listBeneficiaries(db: Db, actor: Pick<PublicUser, "id" | "role">, campaignId: string): Outcome<{ beneficiaries: BeneficiaryView[] }> {
  const ctx = authorize(db, actor, campaignId);
  if (!ctx.ok) return ctx;
  const rows = db.select().from(beneficiaries).where(eq(beneficiaries.campaignId, campaignId)).orderBy(asc(beneficiaries.createdAt)).all();
  return { ok: true, beneficiaries: rows.map(viewOf) };
}

const DUPLICATE = () => fail(409, "DUPLICATE_BENEFICIARY", "This beneficiary is already registered for this campaign.");

/** Whether a failed insert broke the (campaign, fingerprint) unique index, however the driver wraps it. */
function isUniqueViolation(err: unknown): boolean {
  for (let e: unknown = err; e instanceof Error; e = (e as { cause?: unknown }).cause) {
    if (/UNIQUE constraint failed/i.test(e.message)) return true;
  }
  return false;
}

/**
 * Registers one beneficiary for a campaign. Refuses a fingerprint the campaign already holds, in the
 * database and again on-chain. The transaction is signed by the campaign's organizer, never the
 * caller: the registry only accepts the vault's own organizer, so an admin acting for them must still
 * produce the organizer's registration. The request is saved first and the transaction hash before
 * waiting, so a chain failure never loses it, and a send whose outcome is unknown stays PENDING.
 * The refusal names no earlier record: it says only that a duplicate exists.
 */
export async function registerBeneficiary(
  db: Db,
  chain: BeneficiaryChain,
  input: { actor: Pick<PublicUser, "id" | "role">; campaignId: string; identityHash: string; photoHash?: string; payoutMethod: string },
): Promise<Outcome<{ beneficiary: BeneficiaryView }>> {
  const ctx = authorize(db, input.actor, input.campaignId);
  if (!ctx.ok) return ctx;
  if (!chain.configured()) {
    return fail(503, "REGISTRY_NOT_CONFIGURED", "Beneficiary registration is switched off: the registry or the sponsor wallet is not configured.");
  }
  const organizer = findUserById(db, ctx.ownerId);
  const keyEnc = getWalletKeyEnc(db, ctx.ownerId);
  if (!organizer || !keyEnc) return fail(409, "FORBIDDEN", "This account uses its own wallet, which the server cannot sign for.");

  const identityHash = input.identityHash.toLowerCase();
  const photoHash = input.photoHash?.toLowerCase() ?? null;
  const rowKey = and(eq(beneficiaries.campaignId, input.campaignId), eq(beneficiaries.identityHash, identityHash));
  const settle = (id: string, set: Partial<BeneficiaryRow>) => db.update(beneficiaries).set(set).where(eq(beneficiaries.id, id)).run();
  const reload = (id: string) => viewOf(db.select().from(beneficiaries).where(eq(beneficiaries.id, id)).get()!);

  const existing = db.select().from(beneficiaries).where(rowKey).get();
  if (existing?.chainStatus === "CONFIRMED") return DUPLICATE();

  if (existing?.chainStatus === "PENDING") {
    const state = existing.chainTxHash ? await chain.txState(existing.chainTxHash) : "pending";
    if (state === "success") {
      settle(existing.id, { chainStatus: "CONFIRMED", chainError: null });
      return { ok: true, beneficiary: reload(existing.id) };
    }
    const unsentAndOld = !existing.chainTxHash && Date.now() - Date.parse(existing.createdAt) > STALE_UNSENT_MS;
    if (state === "pending" && !unsentAndOld) {
      return fail(409, "REGISTRATION_PENDING", "Your earlier request for this beneficiary is still being confirmed. Give it a minute.");
    }
  }

  // The chain is the authority on uniqueness: a fingerprint it already holds is a duplicate, or the
  // outcome of an earlier attempt of ours that we never saw confirmed.
  if ((await chain.isRegistered(ctx.vault, identityHash)) === true) {
    if (!existing) return DUPLICATE();
    settle(existing.id, { chainStatus: "CONFIRMED", chainError: null });
    return { ok: true, beneficiary: reload(existing.id) };
  }

  let id: string;
  if (existing) {
    id = existing.id;
    settle(id, { chainStatus: "PENDING", chainTxHash: null, chainError: null, photoHash, payoutMethod: input.payoutMethod });
  } else {
    id = randomUUID();
    try {
      db.insert(beneficiaries)
        .values({ id, campaignId: input.campaignId, identityHash, photoHash, payoutMethod: input.payoutMethod, registeredByUserId: input.actor.id })
        .run();
    } catch (err) {
      if (isUniqueViolation(err)) return DUPLICATE(); // a concurrent request won the race
      throw err;
    }
  }

  const tx = await chain.register({ address: organizer.walletAddress, keyEnc }, ctx.vault, identityHash, photoHash ?? NO_PHOTO, (hash) =>
    settle(id, { chainTxHash: hash }),
  );
  if (tx.ok) settle(id, { chainStatus: "CONFIRMED", chainTxHash: tx.txHash, chainError: null });
  else if (!tx.pending) settle(id, { chainStatus: "FAILED", chainError: tx.error });
  else settle(id, { chainError: tx.error }); // stays PENDING

  if (!tx.ok && !tx.pending) return fail(422, "CHAIN_FAILED", tx.error);
  if (!tx.ok) return fail(202, "REGISTRATION_PENDING", "Sent, but the confirmation was not seen yet. It will settle shortly.");
  return { ok: true, beneficiary: reload(id) };
}
