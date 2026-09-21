import type { OnSent, Signer, Tx, TxState } from "../escrow/chain-port";

/**
 * What milestone disbursement needs from the chain. The real implementation is
 * `lib/chain/disbursement.ts` (viem, the Disbursement contract plus the mINR token and the
 * MilestoneManager it reads); tests supply `fake-chain.ts`. Methods never throw: failures come back
 * as values so the caller can record them and retry. Ref: SPDD 5.3 FR-ESC-02, 18.4.
 */

/** Everything the service checks before spending gas, read in one go. Amounts are mINR minor units. */
export interface PayoutState {
  /** The milestone's status on the MilestoneManager is Released. */
  released: boolean;
  /** Disbursement already recorded a payout for this milestone. */
  disbursed: boolean;
  /** `Disbursement.payableRemaining(vault)`: released for the campaign minus already paid out. */
  payableRemaining: string;
  /** The organizer's mINR balance (the release was paid to them). */
  organizerBalance: string;
  /** What the organizer has already approved the Disbursement contract to take. */
  allowance: string;
}

export interface DisbursementChain {
  /** False when the Disbursement or manager address, or the sponsor key, is missing. */
  configured(): boolean;
  /** null = could not read the chain. */
  readPayout(vault: string, index: number, organizer: string): Promise<PayoutState | null>;
  /** Outcome of an already-sent transaction; a read error is reported as "pending", never "reverted". */
  txState(txHash: string): Promise<TxState>;
  /** The organizer lets the Disbursement contract take `amount` of mINR. Signed by the organizer. */
  approve(signer: Signer, amount: string, onSent: OnSent): Promise<Tx>;
  /** Records the payout on-chain and moves the mINR into the contract. Signed by the organizer. */
  disburse(signer: Signer, vault: string, index: number, identityHash: string, amount: string, payoutRefHash: string, onSent: OnSent): Promise<Tx>;
}
