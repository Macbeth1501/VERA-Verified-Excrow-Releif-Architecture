/**
 * What the donation flow needs from the blockchain. The real implementation is
 * `lib/chain/donations.ts`; tests use an in-memory fake. Every `send*` method submits ONE
 * transaction and returns its hash without waiting, so the caller can save the hash before
 * waiting (a crash then cannot lose track of a transaction that was already sent).
 */
export type ReceiptState = "pending" | "success" | "reverted";

export interface SendParams {
  donorAddress: string;
  /** AES-GCM encrypted key of the donor's generated wallet. */
  donorKeyEnc: string;
}

export interface DonationChain {
  /** Tops the donor's wallet up with POL for gas. `null` means no top-up was needed. */
  fundGas(donorAddress: string): Promise<{ txHash: string | null }>;
  /** The simulated fiat on-ramp: faucet-mints mINR to the donor's wallet. */
  sendMint(p: SendParams & { amount: bigint }): Promise<string>;
  /** Pays the flat platform fee on top of the donation. */
  sendFee(p: SendParams & { amount: bigint }): Promise<string>;
  /** Lets the vault pull exactly `amount` from the donor's wallet. */
  sendApprove(p: SendParams & { vault: string; amount: bigint }): Promise<string>;
  /** Deposits into the campaign's vault. */
  sendDeposit(p: SendParams & { vault: string; amount: bigint }): Promise<string>;
  /** Waits up to `waitMs` for the transaction to be mined. */
  receipt(txHash: string, waitMs: number): Promise<ReceiptState>;
  /** True only if the mined transaction emitted DonationReceived from `vault` for this donor and amount. */
  verifyDeposit(txHash: string, p: { vault: string; donorAddress: string; amount: bigint }): Promise<boolean>;
}
