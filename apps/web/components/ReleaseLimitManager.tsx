"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatMinorUnits } from "@/lib/campaigns/money";
import { releaseLimitToMinorUnits } from "@/lib/escrow/release-limit";

/** Admin tool: read and change the global council-approval limit (a real, sponsored transaction). */
export function ReleaseLimitManager({
  configured,
  limitMinorUnits,
  largestGoalMinorUnits,
}: {
  configured: boolean;
  /** Current limit from the chain; null when it could not be read. */
  limitMinorUnits: string | null;
  /** The biggest funding goal of any campaign, to warn about a limit that lets everything skip the council. */
  largestGoalMinorUnits: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ txHash: string | null; pending: boolean } | null>(null);

  const minor = releaseLimitToMinorUnits(value);
  const tooHigh = minor !== null && largestGoalMinorUnits !== null && BigInt(minor) >= BigInt(largestGoalMinorUnits);

  async function save() {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const res = await fetch("/api/v1/admin/release-limit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ limitRupees: value }),
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
    <section className="mt-12" aria-labelledby="limit-heading">
      <h2 id="limit-heading" className="border-b border-rule pb-3 text-2xl text-ink">
        Council approval limit
      </h2>
      <p className="mt-3 max-w-[62ch] text-sand">
        A release above this amount needs the council&apos;s approvals as well as the attestors&apos;. Applies to campaigns
        published after this change. Campaigns already published keep the limit they were published with.
      </p>

      {!configured ? (
        <p className="mt-5 border-y border-rule py-4 text-sand">The milestone manager is not configured on this server.</p>
      ) : (
        <>
          <p className="mt-5 text-ink" data-testid="current-limit">
            Current limit:{" "}
            <span className="num font-medium">{limitMinorUnits === null ? "unavailable (could not read the blockchain)" : formatMinorUnits(limitMinorUnits)}</span>
          </p>
          <form
            className="mt-4 flex flex-wrap items-end gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (minor !== null) setConfirming(true);
            }}
          >
            <label className="text-sm text-sand">
              New limit (rupees)
              <input
                inputMode="decimal"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setConfirming(false);
                }}
                className="mt-1.5 block w-48 rounded-md border border-rule-strong bg-well px-3 py-2.5 text-ink"
              />
            </label>
            <button
              type="submit"
              disabled={busy || minor === null}
              className="rounded-md bg-copper px-5 py-2.5 text-sm font-semibold text-on-copper hover:bg-copper-hover disabled:opacity-60"
            >
              Save
            </button>
          </form>
          {value !== "" && minor === null ? (
            <p className="mt-2 text-sm text-bad">Enter rupees from 0 to 1,00,00,000, with at most 2 decimals. 0 means every release needs the council.</p>
          ) : null}
          {tooHigh ? (
            <p role="note" className="mt-3 max-w-[62ch] rounded-md bg-warn-wash px-3 py-2 text-sm text-warn">
              Releases up to this amount will not need council approval, and it is at least as large as the biggest campaign goal.
            </p>
          ) : null}

          {confirming && minor !== null ? (
            <div role="alertdialog" aria-label="Confirm the new limit" className="mt-4 max-w-[62ch] border border-rule-strong p-4">
              <p className="text-ink">
                Change the limit to <span className="num font-medium">{formatMinorUnits(minor)}</span>? This sends a real transaction from the
                platform wallet.
              </p>
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
            "The change was sent but its result is not known yet. Reload in a minute to see the current limit."
          ) : (
            <>
              Limit changed.{" "}
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
