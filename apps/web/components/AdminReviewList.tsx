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
  documentId: string | null;
  kybStatus: "pending" | "verified" | "rejected";
  rejectionReason: string | null;
  chainSync: "none" | "not_configured" | "synced" | "failed";
  chainTxHash: string | null;
  chainError: string | null;
}

const STATUS_TONE: Record<ReviewItem["kybStatus"], string> = {
  pending: "border-warn/50 bg-warn-wash text-warn",
  verified: "border-ok/50 bg-ok-wash text-ok",
  rejected: "border-bad/50 bg-bad-wash text-bad",
};

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

  if (items.length === 0) return <p className="mt-6 border-y border-rule py-5 text-sand">No applications yet.</p>;

  return (
    <div className="mt-4">
      {error ? (
        <p role="alert" className="rounded-md bg-bad-wash px-3 py-2 text-sm text-bad">
          {error}
        </p>
      ) : null}
      {items.map((o) => (
        <section key={o.id} className="border-b border-rule py-6 first:border-t" data-testid="application">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-display text-xl text-ink">{o.legalName}</h3>
              <p className="mt-0.5 text-sm text-sand">
                Registration {o.registrationNumber}, {o.jurisdiction}
              </p>
              <p className="mt-0.5 text-sm text-sand">Applicant: {o.email}</p>
              <p className="mt-0.5 text-sm text-sand">
                Document: {o.documentName} <span className="font-mono text-[13px]">({o.documentHash.slice(0, 12)}...)</span>
                {o.documentId ? (
                  <>
                    {" "}
                    <a
                      href={`/api/v1/documents/${o.documentId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-ink underline"
                    >
                      View document
                    </a>
                  </>
                ) : (
                  <span className="italic text-dim"> (no file uploaded, hash only)</span>
                )}
              </p>
            </div>
            <span className={`shrink-0 rounded-full border px-3 py-1 text-[13px] font-medium capitalize ${STATUS_TONE[o.kybStatus]}`}>
              {o.kybStatus}
            </span>
          </div>

          {o.kybStatus === "pending" ? (
            <div className="mt-4 space-y-3">
              <input
                placeholder="Reason (required to reject)"
                value={reasons[o.id] ?? ""}
                onChange={(e) => setReasons({ ...reasons, [o.id]: e.target.value })}
                className="w-full rounded-md border border-rule-strong bg-well px-3 py-2.5 text-ink"
              />
              <div className="flex gap-2">
                <button
                  disabled={busyId === o.id}
                  onClick={() => call(o.id, "decision", { decision: "approve" })}
                  className="rounded-md bg-copper px-5 py-2 text-sm font-semibold text-on-copper hover:bg-copper-hover disabled:opacity-60"
                >
                  {busyId === o.id ? "Working..." : "Approve"}
                </button>
                <button
                  disabled={busyId === o.id}
                  onClick={() => call(o.id, "decision", { decision: "reject", reason: reasons[o.id] ?? "" })}
                  className="rounded-md border border-bad/50 px-4 py-2 text-sm font-medium text-bad hover:bg-bad-wash disabled:opacity-60"
                >
                  Reject
                </button>
              </div>
            </div>
          ) : null}

          {o.kybStatus === "rejected" && o.rejectionReason ? (
            <p className="mt-3 text-sm text-sand">Reason: {o.rejectionReason}</p>
          ) : null}

          {o.kybStatus === "verified" ? (
            <div className="mt-3 text-sm text-sand">
              <p>{CHAIN_LABEL[o.chainSync]}</p>
              {o.chainSync === "synced" && o.chainTxHash?.startsWith("0x") ? (
                <a className="underline" href={`https://amoy.polygonscan.com/tx/${o.chainTxHash}`} target="_blank" rel="noreferrer">
                  View transaction
                </a>
              ) : null}
              {o.chainSync === "failed" && o.chainError ? <p className="text-bad">{o.chainError}</p> : null}
              {o.chainSync !== "synced" ? (
                <button
                  disabled={busyId === o.id}
                  onClick={() => call(o.id, "sync")}
                  className="mt-2 rounded-md border border-rule-strong px-4 py-2 text-sm font-medium text-ink hover:bg-panel disabled:opacity-60"
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
