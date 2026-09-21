import { randomBytes } from "node:crypto";
import { keccak256, toBytes } from "viem";

/**
 * The simulated off-ramp (SPDD 18.4, FR-ESC-02). No bank or wallet provider is called: the MVP only
 * produces the reference a real provider would return for a transfer, so it can be anchored on-chain.
 * The reference itself stays in the app's database; only its keccak256 goes into the
 * `PayoutRecorded` event, so a donor holding a reference can check it against the public line item.
 */
export interface PayoutReference {
  /** Human-readable, e.g. "VERA-SIM-9F2C41D07A3B55E1". */
  reference: string;
  /** keccak256 of the reference as UTF-8: the `bytes32 payoutRef` sent to the contract. Never zero. */
  refHash: `0x${string}`;
}

export const hashPayoutReference = (reference: string): `0x${string}` => keccak256(toBytes(reference));

/** A fresh, unguessable reference for one simulated transfer. */
export function createPayoutReference(): PayoutReference {
  const reference = `VERA-SIM-${randomBytes(8).toString("hex").toUpperCase()}`;
  return { reference, refHash: hashPayoutReference(reference) };
}
