import type { OnSent, Signer, Tx, TxState } from "../escrow/chain-port";
import type { BeneficiaryChain } from "./chain-port";

const ZERO = `0x${"0".repeat(64)}`;

/**
 * An in-memory BeneficiaryRegistry for tests. It applies the same rules as the contract (only the
 * vault's organizer; no zero hash; one registration per fingerprint per vault) so service tests
 * exercise real behaviour, while the contract's own tests prove the rules. Every "transaction" gets a
 * unique hash; `failNext` and `hangNext` script failures.
 */
export class FakeBeneficiaryChain implements BeneficiaryChain {
  isConfigured = true;
  unreadable = false;
  /** The wallet allowed to register (the vault's organizer), lower case. */
  organizer = "0xorganizer";
  registered = new Map<string, Set<string>>();
  txStates = new Map<string, TxState>();
  failNext: string | null = null;
  /** Next send returns "sent but outcome unknown". */
  hangNext = false;
  sent: string[] = [];
  private n = 0;

  configured() {
    return this.isConfigured;
  }
  async isRegistered(vault: string, identityHash: string) {
    return this.unreadable ? null : (this.registered.get(vault)?.has(identityHash.toLowerCase()) ?? false);
  }
  async txState(hash: string): Promise<TxState> {
    return this.txStates.get(hash) ?? "pending";
  }

  async register(signer: Signer, vault: string, identityHash: string, _photoHash: string, onSent: OnSent): Promise<Tx> {
    const hash = identityHash.toLowerCase();
    if (signer.address.toLowerCase() !== this.organizer) return { ok: false, error: "Only the campaign's organizer can register beneficiaries." };
    if (hash === ZERO) return { ok: false, error: "A beneficiary needs an identity fingerprint." };
    if (this.registered.get(vault)?.has(hash)) return { ok: false, error: "This beneficiary is already registered for this campaign." };
    if (this.failNext) {
      const error = this.failNext;
      this.failNext = null;
      return { ok: false, error };
    }
    const txHash = `0x${(++this.n).toString(16).padStart(64, "0")}`;
    onSent(txHash);
    this.sent.push(`register:${vault}:${hash}`);
    this.txStates.set(txHash, "success");
    const set = this.registered.get(vault) ?? new Set<string>();
    if (this.hangNext) {
      this.hangNext = false;
      this.txStates.set(txHash, "pending");
      return { ok: false, error: "timed out waiting for the receipt", pending: true };
    }
    set.add(hash);
    this.registered.set(vault, set);
    return { ok: true, txHash };
  }

  /** Test helper: the pending transaction lands after all. */
  land(txHash: string, vault: string, identityHash: string) {
    this.txStates.set(txHash, "success");
    const set = this.registered.get(vault) ?? new Set<string>();
    set.add(identityHash.toLowerCase());
    this.registered.set(vault, set);
  }
}
