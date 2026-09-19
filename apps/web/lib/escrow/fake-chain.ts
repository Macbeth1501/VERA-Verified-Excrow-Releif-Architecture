import type { ChainStatus, EscrowChain, MilestoneState, OnSent, Signer, Tx, TxState } from "./chain-port";

interface FakeMilestone {
  targetPct: number;
  required: number;
  attestors: Set<string>;
  approvers: Set<string>;
  status: ChainStatus;
}

/**
 * An in-memory MilestoneManager for tests. It applies the same rules as the contract (only
 * registered attestors, once each, never the organizer; M-of-N to verify; council approvals above
 * the limit) so service tests exercise real behaviour, while the contract's own tests prove the rules.
 * Every "transaction" gets a unique hash; `failNext` and `hangNext` script failures.
 */
export class FakeEscrowChain implements EscrowChain {
  isConfigured = true;
  bound = true;
  unreadable = false;
  attestors = new Set<string>();
  council = new Set<string>();
  councilThreshold = 3;
  autoReleaseLimit = 100_000_000n;
  /** What a release would pay, per milestone index (mINR minor units). */
  payout = 40_000_000n;
  organizer = "0xorganizer";
  milestones = new Map<string, FakeMilestone[]>();
  txStates = new Map<string, TxState>();
  failNext: string | null = null;
  /** Next send returns "sent but outcome unknown". */
  hangNext = false;
  sent: string[] = [];
  private n = 0;

  configured() {
    return this.isConfigured;
  }
  async vaultBound() {
    return this.unreadable ? null : this.bound;
  }
  async definedCount(vault: string) {
    return this.unreadable ? null : (this.milestones.get(vault)?.length ?? 0);
  }
  async readMilestone(vault: string, index: number): Promise<MilestoneState | null> {
    const m = this.milestones.get(vault)?.[index];
    if (!m || this.unreadable) return null;
    return {
      status: m.status,
      attestationCount: m.attestors.size,
      requiredAttestations: m.required,
      councilApprovals: m.approvers.size,
      councilThreshold: this.councilThreshold,
      autoReleaseLimit: this.autoReleaseLimit.toString(),
      releasableAmount: this.payout.toString(),
    };
  }
  async txState(hash: string): Promise<TxState> {
    return this.txStates.get(hash) ?? "pending";
  }

  private send(label: string, onSent: OnSent): Tx | null {
    if (this.failNext) {
      const error = this.failNext;
      this.failNext = null;
      return { ok: false, error };
    }
    const hash = `0x${(++this.n).toString(16).padStart(64, "0")}`;
    onSent(hash);
    this.sent.push(label);
    this.txStates.set(hash, "success");
    if (this.hangNext) {
      this.hangNext = false;
      this.txStates.set(hash, "pending");
      return { ok: false, error: "timed out waiting for the receipt", pending: true };
    }
    return { ok: true, txHash: hash };
  }

  async defineMilestone(signer: Signer, vault: string, targetPct: number, required: number, onSent: OnSent): Promise<Tx> {
    const failed = this.send(`define:${vault}:${targetPct}`, onSent);
    if (failed && !failed.ok && !failed.pending) return failed;
    const list = this.milestones.get(vault) ?? [];
    list.push({ targetPct, required, attestors: new Set(), approvers: new Set(), status: "Pending" });
    this.milestones.set(vault, list);
    return failed ?? { ok: true, txHash: `0xdefine${list.length}` };
  }

  async submitAttestation(signer: Signer, vault: string, index: number, _proof: string, onSent: OnSent): Promise<Tx> {
    const who = signer.address.toLowerCase();
    if (!this.attestors.has(who)) return { ok: false, error: "This wallet is not registered as an attestor on the contract." };
    if (who === this.organizer) return { ok: false, error: "A campaign's organizer cannot confirm their own milestone." };
    const m = this.milestones.get(vault)?.[index];
    if (!m) return { ok: false, error: "That milestone is not defined on the contract yet." };
    if (m.attestors.has(who)) return { ok: false, error: "This attestor has already confirmed this milestone." };
    const result = this.send(`attest:${index}:${who}`, onSent);
    if (result && !result.ok && !result.pending) return result;
    m.attestors.add(who);
    if (m.status === "Pending" && m.attestors.size >= m.required) m.status = "Verified";
    return result ?? { ok: true, txHash: "0xattest" };
  }

  async councilApprove(signer: Signer, vault: string, index: number, onSent: OnSent): Promise<Tx> {
    const who = signer.address.toLowerCase();
    if (!this.council.has(who)) return { ok: false, error: "This wallet is not registered as a council member on the contract." };
    const m = this.milestones.get(vault)?.[index];
    if (!m || m.status !== "Verified") return { ok: false, error: "This milestone has not reached its required number of confirmations yet." };
    if (m.approvers.has(who)) return { ok: false, error: "This council member has already approved this release." };
    const result = this.send(`approve:${index}:${who}`, onSent);
    if (result && !result.ok && !result.pending) return result;
    m.approvers.add(who);
    return result ?? { ok: true, txHash: "0xapprove" };
  }

  async release(vault: string, index: number, onSent: OnSent): Promise<Tx> {
    const list = this.milestones.get(vault) ?? [];
    const m = list[index];
    if (!m || m.status !== "Verified") return { ok: false, error: "This milestone has not reached its required number of confirmations yet." };
    if (list.slice(0, index).some((x) => x.status !== "Released")) return { ok: false, error: "Earlier milestones must be released first." };
    if (this.payout > this.autoReleaseLimit && m.approvers.size < this.councilThreshold) {
      return { ok: false, error: "This payout is above the automatic limit and needs more council approvals." };
    }
    const result = this.send(`release:${index}`, onSent);
    if (result && !result.ok && !result.pending) return result;
    m.status = "Released";
    return result ?? { ok: true, txHash: "0xrelease" };
  }

  async setRole(kind: "attestor" | "council", address: string, active: boolean): Promise<Tx> {
    if (this.failNext) {
      const error = this.failNext;
      this.failNext = null;
      return { ok: false, error };
    }
    const set = kind === "attestor" ? this.attestors : this.council;
    if (active) set.add(address.toLowerCase());
    else set.delete(address.toLowerCase());
    this.sent.push(`role:${kind}:${active}`);
    return { ok: true, txHash: `0xrole${++this.n}` };
  }
}
