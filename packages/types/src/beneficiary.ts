/**
 * Mirrors the BENEFICIARIES table (SPDD §11.2).
 * `identityHash` is a client-side salted SHA-256 hash (SPDD §17.2) —
 * the platform NEVER receives or stores raw beneficiary PII.
 * Uniqueness on (identityHash, programId) is enforced both here (DB)
 * and independently on-chain via BeneficiaryRegistry.
 * Ref: FR-IDN-03
 */
export interface Beneficiary {
  id: string;
  identityHash: string;
  programId: string;
  photoHash?: string; // optional proof-of-identity photo fingerprint
  payoutMethod: string; // provider-agnostic label for the simulated off-ramp
  registeredAt: string; // ISO 8601
}
