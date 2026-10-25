import { getWalletKeyEnc, type PublicUser } from "../auth/users";
import { getCampaign, type CampaignWithMilestones } from "../campaigns/service";
import type { Db } from "../db";
import type { ExpiryChain } from "./chain-port";

/**
 * Campaign expiry (deadline, inactivity, leftover money). The vault decides everything that matters
 * (whether the campaign may be closed, and each donor's share); this layer finds the campaign, refuses
 * the obvious cases with a clear message before any gas is spent, and has the right wallet send the
 * transaction: the sponsor for the permissionless close, the donor's own wallet for their refund.
 * There is no database record of either: the chain events are the record and the indexer reads them.
 */

export type ExpiryFailure = {
  ok: false;
  status: number;
  code:
    | "CAMPAIGN_NOT_FOUND"
    | "EXPIRY_NOT_AVAILABLE"
    | "EXPIRY_NOT_CONFIGURED"
    | "CHAIN_UNAVAILABLE"
    | "NOT_CLOSED"
    | "NO_REFUND_DUE"
    | "NO_WALLET_KEY"
    | "CHAIN_FAILED";
  message: string;
};

export type Outcome<T> = ({ ok: true } & T) | ExpiryFailure;

const fail = (status: number, code: ExpiryFailure["code"], message: string): ExpiryFailure => ({ ok: false, status, code, message });

/** A published campaign whose vault has a deadline, or the reason it has no expiry. */
function expiringCampaign(db: Db, campaignId: string): Outcome<{ campaign: CampaignWithMilestones; vault: string }> {
  const campaign = getCampaign(db, campaignId);
  if (!campaign || campaign.status !== "LIVE" || !campaign.vaultContractAddress) {
    return fail(404, "CAMPAIGN_NOT_FOUND", "Campaign not found.");
  }
  if (!campaign.deadlineAt) {
    return fail(409, "EXPIRY_NOT_AVAILABLE", "This campaign was published before expiry existed, so it has no end date and cannot refund donors.");
  }
  return { ok: true, campaign, vault: campaign.vaultContractAddress };
}

/**
 * Closes an expired, stalled or finished campaign, freezing what is left as the donors' refund pool.
 * Anyone signed in may ask (the contract lets anyone); the contract refuses unless it is really closable.
 */
export async function closeCampaign(db: Db, chain: ExpiryChain, campaignId: string): Promise<Outcome<{ txHash: string }>> {
  const found = expiringCampaign(db, campaignId);
  if (!found.ok) return found;
  if (!chain.configured()) return fail(503, "EXPIRY_NOT_CONFIGURED", "Closing campaigns is switched off on this server.");

  const sent = await chain.close(found.vault);
  if (!sent.ok) return fail(sent.pending ? 502 : 422, "CHAIN_FAILED", sent.error);
  return { ok: true, txHash: sent.txHash };
}

export interface RefundView {
  closed: boolean;
  claimed: boolean;
  /** mINR minor units this donor can claim right now. */
  amountMinorUnits: string;
}

/** What the signed-in donor can claim from this campaign, read from the vault. */
export async function refundFor(db: Db, chain: ExpiryChain, user: PublicUser, campaignId: string): Promise<Outcome<{ refund: RefundView }>> {
  const found = expiringCampaign(db, campaignId);
  if (!found.ok) return found;
  const state = await chain.readRefund(found.vault, user.walletAddress);
  if (!state) return fail(503, "CHAIN_UNAVAILABLE", "The blockchain could not be read just now. Please try again.");
  return { ok: true, refund: { closed: state.closed, claimed: state.claimed, amountMinorUnits: state.amount } };
}

/** The donor takes their share. Always sent from their own generated wallet, never the platform's. */
export async function claimRefund(db: Db, chain: ExpiryChain, user: PublicUser, campaignId: string): Promise<Outcome<{ txHash: string }>> {
  const status = await refundFor(db, chain, user, campaignId);
  if (!status.ok) return status;
  if (!status.refund.closed) return fail(409, "NOT_CLOSED", "This campaign has not been closed yet, so there is nothing to claim.");
  if (status.refund.claimed || status.refund.amountMinorUnits === "0") {
    return fail(409, "NO_REFUND_DUE", status.refund.claimed ? "You have already claimed your refund." : "You have no refund due on this campaign.");
  }
  if (!chain.configured()) return fail(503, "EXPIRY_NOT_CONFIGURED", "Refunds are switched off on this server.");

  const keyEnc = getWalletKeyEnc(db, user.id);
  if (!keyEnc) {
    return fail(409, "NO_WALLET_KEY", "Your account uses its own wallet, which the server cannot sign for. Wallet connect is not built yet.");
  }

  const found = expiringCampaign(db, campaignId);
  if (!found.ok) return found;
  const sent = await chain.claimRefund({ address: user.walletAddress, keyEnc }, found.vault);
  if (!sent.ok) return fail(sent.pending ? 502 : 422, "CHAIN_FAILED", sent.error);
  return { ok: true, txHash: sent.txHash };
}
