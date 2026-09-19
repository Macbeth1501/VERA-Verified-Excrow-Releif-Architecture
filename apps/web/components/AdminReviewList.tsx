"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface ReviewItem {
  id: string;
  email: string;
  legalName: string;
  registrationNumber: string;
  jurisdiction: string;
  documentName: string;
  documentHash: string;
  kybStatus: "pending" | "verified" | "rejected";
  rejectionReason: string | null;
  chainSync: "none" | "not_configured" | "synced" | "failed";
  chainTxHash: string | null;
  chainError: string | null;
}

const CHAIN_LABEL: Record<ReviewItem["chainSync"], string> = {
  none: "Not yet recorded on-chain",
  not_configured: "Approved here only. On-chain sync is not configured on this server.",
  synced: "Recorded on-chain",
  failed: "On-chain sync failed",
};

export function AdminReviewList({ items }: { items: ReviewItem[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function call(id: string, path: string, body?: unknown) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/organizers/${id}/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error?.details?.reason?.[0] ?? data?.error?.message ?? "Something went wrong.");
      }
      router.refresh();
    } catch {
      setError("We could not reach the server.");
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) return <p className="mt-6 text-zinc-600 dark:text-zinc-400">No applications yet.</p>;

  return (
    <div className="mt-6 space-y-4">
      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}
      {items.map((o) => (
        <section key={o.id} className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800" data-testid="application">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">{o.legalName}</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Registration {o.registrationNumber}, {o.jurisdiction}
              </p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Applicant: {o.email}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Document: {o.documentName} <span className="font-mono text-xs">({o.documentHash.slice(0, 12)}...)</span>
              </p>
            </div>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium capitalize dark:bg-zinc-800">
              {o.kybStatus}
            </span>
          </div>

          {o.kybStatus === "pending" ? (
            <div className="mt-4 space-y-3">
              <input
                placeholder="Reason (required to reject)"
                value={reasons[o.id] ?? ""}
                onChange={(e) => setReasons({ ...reasons, [o.id]: e.target.value })}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
              <div className="flex gap-2">
                <button
                  disabled={busyId === o.id}
                  onClick={() => call(o.id, "decision", { decision: "approve" })}
                  className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
                >
                  {busyId === o.id ? "Working..." : "Approve"}
                </button>
                <button
                  disabled={busyId === o.id}
                  onClick={() => call(o.id, "decision", { decision: "reject", reason: reasons[o.id] ?? "" })}
                  className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:hover:bg-red-950"
                >
                  Reject
                </button>
              </div>
            </div>
          ) : null}

          {o.kybStatus === "rejected" && o.rejectionReason ? (
            <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">Reason: {o.rejectionReason}</p>
          ) : null}

          {o.kybStatus === "verified" ? (
            <div className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
              <p>{CHAIN_LABEL[o.chainSync]}</p>
              {o.chainSync === "synced" && o.chainTxHash?.startsWith("0x") ? (
                <a className="underline" href={`https://amoy.polygonscan.com/tx/${o.chainTxHash}`} target="_blank" rel="noreferrer">
                  View transaction
                </a>
              ) : null}
              {o.chainSync === "failed" && o.chainError ? <p className="text-red-700">{o.chainError}</p> : null}
              {o.chainSync !== "synced" ? (
                <button
                  disabled={busyId === o.id}
                  onClick={() => call(o.id, "sync")}
                  className="mt-2 rounded-md border border-zinc-300 px-3 py-1 text-sm font-medium hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  Retry on-chain sync
                </button>
              ) : null}
            </div>
          ) : null}
        </section>
      ))}
    </div>
  );
}
