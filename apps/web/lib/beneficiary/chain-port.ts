import type { OnSent, Signer, Tx, TxState } from "../escrow/chain-port";

/**
 * What beneficiary registration needs from the chain. The real implementation is
 * `lib/chain/registry.ts` (viem, the BeneficiaryRegistry contract); tests supply `fake-chain.ts`.
 * Methods never throw: failures come back as values so the caller can record them and retry.
 * Ref: SPDD 17.2, 18.5, FR-IDN-03.
 */
export interface BeneficiaryChain {
  /** False when the registry address or the sponsor key is missing; registration reports "switched off". */
  configured(): boolean;
  /** Is this fingerprint already registered for this vault? null = could not read the chain. */
  isRegistered(vault: string, identityHash: string): Promise<boolean | null>;
  /** Outcome of an already-sent transaction; a read error is reported as "pending", never "reverted". */
  txState(txHash: string): Promise<TxState>;
  /** Signed by the vault's organizer; the platform only sponsors gas. */
  register(signer: Signer, vault: string, identityHash: string, photoHash: string, onSent: OnSent): Promise<Tx>;
  /**
   * V2 registry only (C6): an attestor confirms a registered beneficiary exists. Signed by the
   * attestor's own wallet; the contract requires the manager's attestor role, refuses the vault's
   * organizer and counts each attestor once.
   */
  attest(signer: Signer, vault: string, identityHash: string, onSent: OnSent): Promise<Tx>;
}
