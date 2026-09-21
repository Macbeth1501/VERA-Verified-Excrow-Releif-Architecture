import type { OnSent, Signer, Tx, TxState } from "../escrow/chain-port";
import type { DisbursementChain, PayoutState } from "./chain-port";

/**
 * An in-memory Disbursement contract (plus the slices of the token, manager and registry it reads)
 * for tests. It applies the same rules as the contract (only the vault's organizer; the milestone
 * Released; each milestone paid once; a registered beneficiary; non-zero amount and reference; the
 * campaign's payouts within what was released; an approval and a balance to cover the transfer), so
 * service tests exercise real behaviour while the contract's own tests prove the rules. `failNext`,
 * `hangNext` and `hangApprove` script failures.
 */
export class FakeDisbursementChain implements DisbursementChain {
  isConfigured = true;
  unreadable = false;
  /** The vault's organizer, lower case. */
  organizer = "0xorganizer";
  /** Milestone indexes the manager reports as Released, per vault. */
  releasedMilestones = new Map<string, Set<number>>();
  /** `manager.releasedTotal(vault)`. */
  releasedTotal = new Map<string, bigint>();
  /** Registered fingerprints per vault (the registry). */
  registered = new Map<string, Set<string>>();
  balances = new Map<string, bigint>();
  allowances = new Map<string, bigint>();
  disbursedTotal = new Map<string, bigint>();
  disbursed = new Set<string>();
  txStates = new Map<string, TxState>();
  failNext: string | null = null;
  /** Next disburse returns "sent but outcome unknown". */
  hangNext = false;
  /** Next approve returns "sent but outcome unknown". */
  hangApprove = false;
  sent: string[] = [];
  private n = 0;

  /** Test helper: the manager released `amount` for this milestone to the organizer. */
  release(vault: string, index: number, amount: bigint) {
    const set = this.releasedMilestones.get(vault) ?? new Set<number>();
    set.add(index);
    this.releasedMilestones.set(vault, set);
    this.releasedTotal.set(vault, (this.releasedTotal.get(vault) ?? 0n) + amount);
    this.balances.set(this.organizer, (this.balances.get(this.organizer) ?? 0n) + amount);
  }
  register(vault: string, identityHash: string) {
    const set = this.registered.get(vault) ?? new Set<string>();
    set.add(identityHash.toLowerCase());
    this.registered.set(vault, set);
  }

  configured() {
    return this.isConfigured;
  }
  private remaining(vault: string) {
    const released = this.releasedTotal.get(vault) ?? 0n;
    const paid = this.disbursedTotal.get(vault) ?? 0n;
    return released > paid ? released - paid : 0n;
  }
  async readPayout(vault: string, index: number, organizer: string): Promise<PayoutState | null> {
    if (this.unreadable) return null;
    const who = organizer.toLowerCase();
    return {
      released: this.releasedMilestones.get(vault)?.has(index) ?? false,
      disbursed: this.disbursed.has(`${vault}:${index}`),
      payableRemaining: this.remaining(vault).toString(),
      organizerBalance: (this.balances.get(who) ?? 0n).toString(),
      allowance: (this.allowances.get(who) ?? 0n).toString(),
    };
  }
  async txState(hash: string): Promise<TxState> {
    return this.txStates.get(hash) ?? "pending";
  }

  private nextHash() {
    return `0x${(++this.n).toString(16).padStart(64, "0")}`;
  }
  private takeFailure(): Tx | null {
    if (!this.failNext) return null;
    const error = this.failNext;
    this.failNext = null;
    return { ok: false, error };
  }

  async approve(signer: Signer, amount: string, onSent: OnSent): Promise<Tx> {
    const failure = this.takeFailure();
    if (failure) return failure;
    const txHash = this.nextHash();
    onSent(txHash);
    this.sent.push(`approve:${amount}`);
    if (this.hangApprove) {
      this.hangApprove = false;
      this.txStates.set(txHash, "pending");
      return { ok: false, error: "timed out waiting for the receipt", pending: true };
    }
    this.allowances.set(signer.address.toLowerCase(), BigInt(amount));
    this.txStates.set(txHash, "success");
    return { ok: true, txHash };
  }

  async disburse(signer: Signer, vault: string, index: number, identityHash: string, amount: string, payoutRefHash: string, onSent: OnSent): Promise<Tx> {
    const who = signer.address.toLowerCase();
    const value = BigInt(amount);
    if (who !== this.organizer) return { ok: false, error: "Only the campaign's organizer can record a payout." };
    if (value === 0n) return { ok: false, error: "A payout needs an amount." };
    if (/^0x0{64}$/.test(payoutRefHash)) return { ok: false, error: "A payout needs an off-ramp reference." };
    if (this.disbursed.has(`${vault}:${index}`)) return { ok: false, error: "This milestone's payout has already been recorded." };
    if (!this.releasedMilestones.get(vault)?.has(index)) return { ok: false, error: "This milestone has not been released yet." };
    if (!this.registered.get(vault)?.has(identityHash.toLowerCase())) return { ok: false, error: "That beneficiary is not registered for this campaign." };
    if (value > this.remaining(vault)) return { ok: false, error: "The payout is more than this campaign has released and not yet paid out." };
    if ((this.allowances.get(who) ?? 0n) < value) return { ok: false, error: "The organizer has not approved the payout amount yet." };
    if ((this.balances.get(who) ?? 0n) < value) return { ok: false, error: "The organizer's wallet does not hold enough mINR for this payout." };
    const failure = this.takeFailure();
    if (failure) return failure;

    const txHash = this.nextHash();
    onSent(txHash);
    this.sent.push(`disburse:${vault}:${index}:${identityHash.toLowerCase()}:${amount}`);
    const settle = () => {
      this.disbursed.add(`${vault}:${index}`);
      this.disbursedTotal.set(vault, (this.disbursedTotal.get(vault) ?? 0n) + value);
      this.allowances.set(who, (this.allowances.get(who) ?? 0n) - value);
      this.balances.set(who, (this.balances.get(who) ?? 0n) - value);
      this.txStates.set(txHash, "success");
    };
    if (this.hangNext) {
      this.hangNext = false;
      this.txStates.set(txHash, "pending");
      this.pendingLandings.set(txHash, settle);
      return { ok: false, error: "timed out waiting for the receipt", pending: true };
    }
    settle();
    return { ok: true, txHash };
  }

  private pendingLandings = new Map<string, () => void>();
  /** Test helper: a disburse that hung lands after all. */
  land(txHash: string) {
    this.pendingLandings.get(txHash)?.();
    this.pendingLandings.delete(txHash);
  }
}
