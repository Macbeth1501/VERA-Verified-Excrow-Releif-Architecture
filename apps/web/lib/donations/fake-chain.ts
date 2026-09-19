import type { DonationChain, ReceiptState, SendParams } from "./chain-port";

/** A scriptable in-memory chain for donation tests. Records every send so tests can assert on it. */
export class FakeDonationChain implements DonationChain {
  calls: Array<{ kind: string; amount?: bigint; vault?: string; hash?: string }> = [];
  /** Hashes whose receipt is still "pending" for this many more checks. */
  pendingChecks = new Map<string, number>();
  reverted = new Set<string>();
  needsGas = true;
  depositVerifies = true;
  /** Make the next send of this kind throw. */
  failNextSend: string | null = null;
  /** Make receipt checks throw (an unreachable RPC). */
  receiptThrows = false;
  /** Delay before a send resolves, to exercise concurrent requests. */
  sendDelayMs = 0;
  private counter = 0;

  private async send(kind: string, extra: { amount?: bigint; vault?: string } = {}): Promise<string> {
    if (this.sendDelayMs) await new Promise((r) => setTimeout(r, this.sendDelayMs));
    if (this.failNextSend === kind) {
      this.failNextSend = null;
      throw new Error(`${kind} send failed`);
    }
    const hash = `0x${kind}${String(++this.counter).padStart(8, "0")}`;
    this.calls.push({ kind, hash, ...extra });
    return hash;
  }

  async fundGas(): Promise<{ txHash: string | null }> {
    if (!this.needsGas) return { txHash: null };
    return { txHash: await this.send("gas") };
  }
  sendMint(p: SendParams & { amount: bigint }) { return this.send("mint", { amount: p.amount }); }
  sendFee(p: SendParams & { amount: bigint }) { return this.send("fee", { amount: p.amount }); }
  sendApprove(p: SendParams & { vault: string; amount: bigint }) { return this.send("approve", { amount: p.amount, vault: p.vault }); }
  sendDeposit(p: SendParams & { vault: string; amount: bigint }) { return this.send("deposit", { amount: p.amount, vault: p.vault }); }

  async receipt(hash: string): Promise<ReceiptState> {
    if (this.receiptThrows) throw new Error("rpc unreachable");
    const left = this.pendingChecks.get(hash) ?? 0;
    if (left > 0) {
      this.pendingChecks.set(hash, left - 1);
      return "pending";
    }
    return this.reverted.has(hash) ? "reverted" : "success";
  }

  async verifyDeposit(): Promise<boolean> {
    return this.depositVerifies;
  }

  count(kind: string): number {
    return this.calls.filter((c) => c.kind === kind).length;
  }
  kinds(): string[] {
    return this.calls.map((c) => c.kind);
  }
  lastHash(kind: string): string {
    return [...this.calls].reverse().find((c) => c.kind === kind)?.hash ?? "";
  }
}
