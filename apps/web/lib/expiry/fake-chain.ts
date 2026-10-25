import type { Signer, Tx } from "../escrow/chain-port";
import type { ExpiryChain, RefundState } from "./chain-port";

/**
 * An in-memory campaign vault for tests. It applies the vault's own rules for closing and refunding
 * (a refund is the donor's share of the frozen pool, taken once; nothing before the close), while the
 * contract's Foundry tests prove them for real. Whether the campaign is closable is scripted with
 * `closableError` (null = closable now), because that depends on the chain clock.
 */
export class FakeExpiryChain implements ExpiryChain {
  isConfigured = true;
  unreadable = false;
  /** When set, `close` refuses with this message (the contract would say the same in its own words). */
  closableError: string | null = null;
  /** The next send fails with this message. */
  failNext: string | null = null;
  /** The next send is "sent but outcome unknown". */
  hangNext = false;

  /** Per vault: who gave what, whether it is closed, and the pool frozen at the close. */
  vaults = new Map<string, { donated: Map<string, bigint>; balance: bigint; closed: boolean; pool: bigint; claimed: Set<string> }>();
  closes: string[] = [];
  claims: Array<{ vault: string; donor: string }> = [];
  private n = 0;

  /** Test helper: `donor` gave `amount` to the vault. */
  donate(vault: string, donor: string, amount: bigint) {
    const v = this.vault(vault);
    v.donated.set(donor.toLowerCase(), (v.donated.get(donor.toLowerCase()) ?? 0n) + amount);
    v.balance += amount;
  }

  private vault(vault: string) {
    let v = this.vaults.get(vault.toLowerCase());
    if (!v) {
      v = { donated: new Map(), balance: 0n, closed: false, pool: 0n, claimed: new Set() };
      this.vaults.set(vault.toLowerCase(), v);
    }
    return v;
  }

  private share(vault: string, donor: string): bigint {
    const v = this.vault(vault);
    const total = [...v.donated.values()].reduce((a, b) => a + b, 0n);
    if (!v.closed || total === 0n || v.claimed.has(donor.toLowerCase())) return 0n;
    return (v.pool * (v.donated.get(donor.toLowerCase()) ?? 0n)) / total;
  }

  configured() {
    return this.isConfigured;
  }

  async readRefund(vault: string, donor: string): Promise<RefundState | null> {
    if (this.unreadable) return null;
    const v = this.vault(vault);
    return { closed: v.closed, claimed: v.claimed.has(donor.toLowerCase()), amount: this.share(vault, donor).toString() };
  }

  private scripted(): Tx | null {
    if (this.failNext) {
      const error = this.failNext;
      this.failNext = null;
      return { ok: false, error };
    }
    if (this.hangNext) {
      this.hangNext = false;
      return { ok: false, error: "Waiting for the network timed out.", pending: true };
    }
    return null;
  }

  async close(vault: string): Promise<Tx> {
    const scripted = this.scripted();
    if (scripted) return scripted;
    const v = this.vault(vault);
    if (v.closed) return { ok: false, error: "This campaign has already been closed." };
    if (v.balance === 0n) return { ok: false, error: "There is nothing left in the vault to refund." };
    if (this.closableError) return { ok: false, error: this.closableError };
    v.closed = true;
    v.pool = v.balance;
    this.closes.push(vault);
    return { ok: true, txHash: `0xclose${++this.n}` };
  }

  async claimRefund(signer: Signer, vault: string): Promise<Tx> {
    const scripted = this.scripted();
    if (scripted) return scripted;
    const v = this.vault(vault);
    if (!v.closed) return { ok: false, error: "This campaign has not been closed yet." };
    const amount = this.share(vault, signer.address);
    if (amount === 0n) return { ok: false, error: "You have no refund to claim on this campaign." };
    v.claimed.add(signer.address.toLowerCase());
    v.balance -= amount;
    this.claims.push({ vault, donor: signer.address.toLowerCase() });
    return { ok: true, txHash: `0xclaim${++this.n}` };
  }
}
