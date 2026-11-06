"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { describeEffect, thresholdRefusal } from "@/lib/escrow/threshold-effect";

interface InFlight {
  milestoneId: string;
  campaignTitle: string;
  index: number;
  councilApprovals: number;
}

/** Admin tool: read and change the global council threshold K (a real, sponsored transaction that takes effect at once). */
export function CouncilThresholdManager({
  configured,
  threshold,
  councilMembers,
  inFlight,
}: {
  configured: boolean;
  /** Current K from the chain; null when it could not be read. */
  threshold: number | null;
  councilMembers: number;
  inFlight: InFlight[];
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ txHash: string | null; pending: boolean } | null>(null);

  const parsed = /^\d+$/.test(value.trim()) ? Number(value.trim()) : null;
  const refusal = parsed === null ? null : thresholdRefusal(parsed, councilMembers);
  const valid = parsed !== null && refusal === null;

  async function save() {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const res = await fetch("/api/v1/admin/council-threshold", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ threshold: parsed }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message ?? "Something went wrong.");
      } else {
        setDone({ txHash: data.txHash ?? null, pending: Boolean(data.pending) });
        setValue("");
        setConfirming(false);
      }
      router.refresh();
    } catch {
      setError("We could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-12" aria-labelledby="threshold-heading">
      <h2 id="threshold-heading" className="border-b border-rule pb-3 text-2xl text-ink">
        Council approvals needed
      </h2>
      <p className="mt-3 max-w-[62ch] text-sand">
        How many council members must approve a release above the council approval limit. The contract never allows fewer than
        2. Unlike the limit, a change here takes effect at once, including for releases already waiting for the council.
      </p>

      {!configured ? (
        <p className="mt-5 border-y border-rule py-4 text-sand">The milestone manager is not configured on this server.</p>
      ) : (
        <>
          <p className="mt-5 text-ink" data-testid="current-threshold">
            Current number: <span className="num font-medium">{threshold === null ? "unavailable (could not read the blockchain)" : threshold}</span>
            <span className="text-dim"> · {councilMembers} council member{councilMembers === 1 ? "" : "s"} registered</span>
          </p>
          <form
            className="mt-4 flex flex-wrap items-end gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (valid) setConfirming(true);
            }}
          >
            <label className="text-sm text-sand">
              New number of approvals
              <input
                inputMode="numeric"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setConfirming(false);
                }}
                className="mt-1.5 block w-40 rounded-md border border-rule-strong bg-well px-3 py-2.5 text-ink"
              />
            </label>
            <button
              type="submit"
              disabled={busy || !valid}
              className="rounded-md bg-copper px-5 py-2.5 text-sm font-semibold text-on-copper hover:bg-copper-hover disabled:opacity-60"
            >
              Save
            </button>
          </form>
          {value !== "" && parsed === null ? <p className="mt-2 text-sm text-bad">Enter a whole number.</p> : null}
          {refusal ? <p className="mt-2 max-w-[62ch] text-sm text-bad">{refusal}</p> : null}

          {confirming && valid ? (
            <div role="alertdialog" aria-label="Confirm the new number" className="mt-4 max-w-[62ch] border border-rule-strong p-4">
              <p className="text-ink">
                Change the approvals needed to <span className="num font-medium">{parsed}</span>? This sends a real transaction from the platform
                wallet and applies immediately.
              </p>
              {inFlight.length > 0 ? (
                <>
                  <p className="mt-3 text-sm text-sand">Releases waiting for the council right now:</p>
                  <ul className="mt-1 divide-y divide-rule border-y border-rule text-sm" data-testid="in-flight">
                    {inFlight.map((m) => (
                      <li key={m.milestoneId} className="py-2 text-ink">
                        {m.campaignTitle}, milestone {m.index + 1} ({m.councilApprovals} approval{m.councilApprovals === 1 ? "" : "s"}):{" "}
                        <span className="font-medium">{describeEffect(m.councilApprovals, parsed)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="mt-3 text-sm text-sand">No release is waiting for the council right now.</p>
              )}
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={save}
                  className="rounded-md bg-copper px-5 py-2.5 text-sm font-semibold text-on-copper hover:bg-copper-hover disabled:opacity-60"
                >
                  {busy ? "Working..." : "Confirm change"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirming(false)}
                  className="rounded-md border border-rule-strong px-4 py-2 text-sm font-medium text-ink hover:bg-panel disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}

      {error ? (
        <p role="alert" className="mt-3 rounded-md bg-bad-wash px-3 py-2 text-sm text-bad">
          {error}
        </p>
      ) : null}
      {done ? (
        <p role="status" className="mt-3 text-sm text-ok">
          {done.pending ? (
            "The change was sent but its result is not known yet. Reload in a minute to see the current number."
          ) : (
            <>
              Number changed.{" "}
              <a className="underline" href={`https://amoy.polygonscan.com/tx/${done.txHash}`} target="_blank" rel="noreferrer">
                View the transaction
              </a>
            </>
          )}
        </p>
      ) : null}
    </section>
  );
}
