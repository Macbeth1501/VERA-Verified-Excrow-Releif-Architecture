"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { formatUnits } from "viem";
import { formatMinorUnits, MINR_DECIMALS, rupeesToMinorUnits } from "@/lib/campaigns/money";
import type { DisbursementView } from "@/lib/disbursement/service";
import { explorerTxUrl } from "@/lib/explorer";

const INPUT =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
const short = (hash: string) => `${hash.slice(0, 10)}...${hash.slice(-6)}`;

export interface PayoutBeneficiary {
  id: string;
  identityHash: string;
  payoutMethod: string;
}

/**
 * Records the payout of a released milestone to one registered beneficiary (FR-ESC-02). The server
 * sends two transactions from the organizer's own wallet (approve, then disburse) and generates the
 * simulated off-ramp reference itself. A payout that was sent but not yet confirmed stays "pending"
 * and is settled by checking again; it is never sent twice.
 */
export function PayoutForm({
  milestoneId,
  beneficiaries,
  existing,
  suggestedMinorUnits,
}: {
  milestoneId: string;
  beneficiaries: PayoutBeneficiary[];
  existing: DisbursementView | null;
  /** What the manager released for this milestone, from the indexer, if known. */
  suggestedMinorUnits: string | null;
}) {
  const router = useRouter();
  const [beneficiaryId, setBeneficiaryId] = useState(existing?.beneficiaryId ?? beneficiaries[0]?.id ?? "");
  const [amount, setAmount] = useState(() => {
    const minor = existing?.amountMinorUnits ?? suggestedMinorUnits;
    return minor ? formatUnits(BigInt(minor), MINR_DECIMALS) : "";
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "pending" | "error"; text: string } | null>(null);

  if (existing?.status === "CONFIRMED") {
    return (
      <div className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" data-testid="payout-done">
        <p>
          Paid {formatMinorUnits(existing.amountMinorUnits)} to beneficiary <span className="font-mono">{short(existing.identityHash)}</span>.
        </p>
        <p className="mt-1">
          Reference <span className="font-mono">{existing.payoutReference}</span>
          {existing.txHash ? (
            <>
              {" · "}
              <a className="underline" href={explorerTxUrl(existing.txHash)} target="_blank" rel="noreferrer">
                View on explorer
              </a>
            </>
          ) : null}
        </p>
      </div>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const amountMinorUnits = rupeesToMinorUnits(amount);
    if (!amountMinorUnits) return setMessage({ kind: "error", text: "Enter the amount paid, in rupees." });
    if (!beneficiaryId) return setMessage({ kind: "error", text: "Choose a registered beneficiary." });
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/milestones/${milestoneId}/disburse`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ beneficiaryId, amountMinorUnits }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 201) setMessage({ kind: "ok", text: "Payout recorded on the blockchain." });
      else if (data?.error?.code === "DISBURSEMENT_PENDING") setMessage({ kind: "pending", text: data.error.message });
      else setMessage({ kind: "error", text: data?.error?.message ?? "Something went wrong." });
      router.refresh();
    } catch {
      setMessage({ kind: "error", text: "We could not reach the server." });
    } finally {
      setBusy(false);
    }
  }

  const pending = existing?.status === "PENDING";
  return (
    <form onSubmit={submit} className="mt-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800" data-testid="payout-form">
      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Record the payout to a beneficiary</p>
      {pending ? (
        <p className="mt-1 text-sm text-amber-700 dark:text-amber-400" data-testid="payout-pending">
          A payout was sent and is waiting for confirmation. Check again in a moment; it will not be sent twice.
        </p>
      ) : null}
      {existing?.status === "FAILED" ? (
        <p className="mt-1 text-sm text-red-700 dark:text-red-400">The last attempt failed: {existing.error}</p>
      ) : null}
      {beneficiaries.length === 0 ? (
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Register a beneficiary for this campaign first.</p>
      ) : (
        <>
          <label className="mt-2 block text-sm text-zinc-700 dark:text-zinc-300">
            Beneficiary
            <select className={INPUT} value={beneficiaryId} onChange={(e) => setBeneficiaryId(e.target.value)} disabled={busy || pending}>
              {beneficiaries.map((b) => (
                <option key={b.id} value={b.id}>
                  {short(b.identityHash)} · {b.payoutMethod}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-2 block text-sm text-zinc-700 dark:text-zinc-300">
            Amount paid (₹)
            <input className={INPUT} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={busy || pending} />
          </label>
          <p className="mt-1 text-xs text-zinc-500">
            This moves the mINR from your wallet into the payout contract and records a simulated transfer reference.
            The contract refuses more than this campaign has released and not yet paid out.
          </p>
          <button
            type="submit"
            disabled={busy}
            className="mt-2 rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {busy ? "Recording on the blockchain, this can take a minute..." : pending ? "Check again" : "Record payout"}
          </button>
        </>
      )}
      {message ? (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={`mt-2 text-sm ${message.kind === "ok" ? "text-emerald-700 dark:text-emerald-400" : message.kind === "pending" ? "text-amber-700 dark:text-amber-400" : "text-red-700 dark:text-red-400"}`}
        >
          {message.text}
        </p>
      ) : null}
    </form>
  );
}
