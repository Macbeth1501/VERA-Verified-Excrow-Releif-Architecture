import type { Signer, Tx } from "../escrow/chain-port";

/**
 * What campaign expiry needs from the chain. The real implementation is `lib/chain/expiry.ts` (viem,
 * the campaign vault itself); tests supply `fake-chain.ts`. Methods never throw: failures come back
 * as values. The chain is the only record of a close or a refund (the vault emits `CampaignClosed`
 * and `RefundClaimed`, which the indexer reads), so nothing here is stored in the database.
 */

/** One donor's refund position on a vault, read from the vault itself. Amounts are mINR minor units. */
export interface RefundState {
  /** `close()` has been called: the balance is frozen as the refund pool. */
  closed: boolean;
  /** This donor has already taken their share. */
  claimed: boolean;
  /** What this donor can claim now: 0 before the close, after claiming, or if they never donated. */
  amount: string;
}

export interface ExpiryChain {
  /** False when the sponsor key is missing, so no transaction can be paid for. */
  configured(): boolean;
  /** null = could not read the chain (or the vault has no expiry functions). */
  readRefund(vault: string, donor: string): Promise<RefundState | null>;
  /** Anyone may close an expired, stalled or finished campaign; the sponsor wallet sends it. */
  close(vault: string): Promise<Tx>;
  /** The donor takes their share. Signed by the donor's own wallet; the platform only sponsors gas. */
  claimRefund(signer: Signer, vault: string): Promise<Tx>;
}
