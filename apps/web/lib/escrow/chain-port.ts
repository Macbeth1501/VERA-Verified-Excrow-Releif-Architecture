/**
 * Everything the escrow services (milestone definition, attestation, council approval, release)
 * need from the chain. The real implementation is `lib/chain/manager.ts` (viem, the MilestoneManager
 * contract); tests supply `fake-chain.ts`. Methods never throw: failures come back as values so the
 * caller can record them and retry. Ref: SPDD §18.3, FR-ESC-01, FR-GOV-01.
 */

export type Tx =
  | { ok: true; txHash: string }
  /** `pending` means the transaction WAS sent but its outcome is unknown: keep it PENDING, never FAILED. */
  | { ok: false; error: string; pending?: boolean };

/** A generated wallet the server signs with (the actor's own; the platform only sponsors gas). */
export interface Signer {
  address: string;
  /** AES-GCM encrypted private key. */
  keyEnc: string;
}

export type ChainStatus = "Pending" | "Verified" | "Released";

/** One milestone as the MilestoneManager contract itself reports it. Amounts are mINR minor units. */
export interface MilestoneState {
  status: ChainStatus;
  attestationCount: number;
  requiredAttestations: number;
  councilApprovals: number;
  councilThreshold: number;
  /** Releases at or below this need attestors only; above it the council must also approve. */
  autoReleaseLimit: string;
  /** What releasing it would pay right now. */
  releasableAmount: string;
}

export type TxState = "success" | "reverted" | "pending";

/** Called with the transaction hash as soon as it is sent, so it can be saved before waiting. */
export type OnSent = (txHash: string) => void;

export interface EscrowChain {
  /** False when the manager address or the sponsor key is missing; every action reports "not configured". */
  configured(): boolean;
  /** Is this vault bound to the configured MilestoneManager? null = could not read the chain. */
  vaultBound(vault: string): Promise<boolean | null>;
  /** How many milestones the manager already holds for this vault; null = could not read. */
  definedCount(vault: string): Promise<number | null>;
  /** Milestone state from the contract; null = not defined yet or the chain could not be read. */
  readMilestone(vault: string, index: number): Promise<MilestoneState | null>;
  /** Outcome of an already-sent transaction; a read error is reported as "pending", never "reverted". */
  txState(txHash: string): Promise<TxState>;

  defineMilestone(signer: Signer, vault: string, targetPct: number, requiredAttestations: number, onSent: OnSent): Promise<Tx>;
  submitAttestation(signer: Signer, vault: string, index: number, proofHash: string, onSent: OnSent): Promise<Tx>;
  councilApprove(signer: Signer, vault: string, index: number, onSent: OnSent): Promise<Tx>;
  /** Permissionless on-chain; sent from the sponsor wallet. */
  release(vault: string, index: number, onSent: OnSent): Promise<Tx>;
  /** Owner-only: register or remove an attestor or council member. Idempotent. */
  setRole(kind: "attestor" | "council", address: string, active: boolean): Promise<Tx>;
}
