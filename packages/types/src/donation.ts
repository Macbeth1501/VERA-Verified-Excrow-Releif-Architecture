/**
 * Donation status. A donation is never CONFIRMED until the chain
 * confirms the deposit tx — never report silent success.
 * Ref: FR-CMP-02, SPDD §8.9
 */
export enum DonationStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  FAILED = "FAILED",
}

/**
 * Mirrors the DONATIONS table (SPDD §11.2).
 * `amountToken` is the confirmed on-chain amount, net of only the
 * disclosed protocol fee — no hidden/tip deductions.
 * Ref: FR-CMP-02
 */
export interface Donation {
  id: string;
  campaignId: string;
  donorId: string;
  amountToken: number;
  onchainTxHash: string | null; // null while status === PENDING
  status: DonationStatus;
  createdAt: string; // ISO 8601
}
