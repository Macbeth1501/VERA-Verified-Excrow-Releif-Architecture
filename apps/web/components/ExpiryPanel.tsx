"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ExpiryInfo } from "@/lib/campaigns/dashboard";
import { formatUtc } from "@/lib/campaigns/format";
import { formatMinorUnits } from "@/lib/campaigns/money";

const REASON_TEXT = {
  deadline: "the end date passed",
  inactivity: "no milestone was released for the whole inactivity period",
  completed: "every milestone was released and money was left over",
} as const;

const CLOSE_BUTTON_TEXT = {
  deadline: "The end date has passed, so anyone can close this campaign and open refunds.",
  inactivity: "No milestone has been released for the whole inactivity period, so anyone can close this campaign and open refunds.",
  completed: "Every milestone has been released and some money is left over, so anyone can close this campaign and return it to the donors.",
} as const;

const BUTTON = "rounded-md bg-copper px-4 py-2 text-sm font-semibold text-on-copper hover:bg-copper-hover disabled:opacity-60";

type RefundView = { closed: boolean; claimed: boolean; amountMinorUnits: string };

/**
 * The campaign's end date, the inactivity rule and, once it is closed, the donors' refunds. Closing
 * is open to anyone signed in (the contract only agrees when it is really closable); a refund is taken
 * by the donor, from their own wallet, and shows only what is theirs.
 */
export function ExpiryPanel({
  campaignId,
  expiry,
  signedIn,
  onChanged,
}: {
  campaignId: string;
  expiry: ExpiryInfo;
  signedIn: boolean;
  onChanged: () => void;
}) {
  const [refund, setRefund] = useState<RefundView | null>(null);
  const [busy, setBusy] = useState<"close" | "claim" | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Bumped after an action so the donor's own figure is read again. */
  const [reload, setReload] = useState(0);
  const closed = expiry.state === "closed";

  useEffect(() => {
    if (!signedIn || !closed) return;
    let cancelled = false;
    fetch(`/api/v1/campaigns/${campaignId}/refund`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!cancelled && body) setRefund(body.refund);
      })
      .catch(() => {
        /* the panel simply shows no personal figure until the next refresh */
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId, signedIn, closed, reload]);

  async function act(kind: "close" | "claim") {
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch(`/api/v1/campaigns/${campaignId}/${kind === "close" ? "close" : "refund"}`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error?.message ?? "Something went wrong.");
      }
      onChanged();
      setReload((n) => n + 1);
    } catch {
      setError("We could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  if (!expiry.enabled) {
    return (
      <section aria-labelledby="expiry-heading" data-testid="expiry-panel">
        <h2 id="expiry-heading" className="text-2xl text-ink">
          End date and refunds
        </h2>
        <p className="mt-3 max-w-[62ch] text-sm text-sand">
          This campaign was published before end dates existed, so it has no deadline and cannot refund its donors.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="expiry-heading" data-testid="expiry-panel">
      <h2 id="expiry-heading" className="text-2xl text-ink">
        End date and refunds
      </h2>

      {expiry.state === "open" ? (
        <p className="mt-3 max-w-[62ch] text-sm text-sand">
          Donations are open until <strong className="text-ink">{formatUtc(expiry.deadlineAt!)}</strong>. If no milestone is released by{" "}
          <strong className="text-ink">{formatUtc(expiry.inactivityDeadlineAt!)}</strong> ({expiry.inactivityDays} days without progress), or the end date
          passes first, anyone can close the campaign and every donor can take back their share of what is still held. Money already released to the
          organizer is not taken back.
        </p>
      ) : null}

      {expiry.state === "ended" ? (
        <p className="mt-3 max-w-[62ch] text-sm text-sand" data-testid="expiry-ended">
          The end date passed on <strong className="text-ink">{formatUtc(expiry.deadlineAt!)}</strong>. Donations are closed. Until someone closes the
          campaign, nothing moves.
        </p>
      ) : null}

      {closed && expiry.closed ? (
        <p className="mt-3 max-w-[62ch] text-sm text-sand" data-testid="expiry-closed">
          Closed on {formatUtc(expiry.closed.timestamp)} because {REASON_TEXT[expiry.closed.reason]}.{" "}
          <strong className="text-ink">{formatMinorUnits(expiry.closed.refundPool)}</strong> was held and is shared back to donors in proportion to what
          each gave. {expiry.refundCount} {expiry.refundCount === 1 ? "donor has" : "donors have"} claimed so far.
        </p>
      ) : null}

      {expiry.closableReason ? (
        <div className="mt-4 max-w-[62ch]" data-testid="expiry-close">
          <p className="text-sm text-sand">{CLOSE_BUTTON_TEXT[expiry.closableReason]}</p>
          {signedIn ? (
            <button type="button" className={`mt-3 ${BUTTON}`} disabled={busy !== null} onClick={() => act("close")}>
              {busy === "close" ? "Closing..." : "Close this campaign"}
            </button>
          ) : (
            <p className="mt-3 text-sm">
              <Link href="/login" className="font-medium underline">
                Sign in
              </Link>{" "}
              to close it.
            </p>
          )}
        </div>
      ) : null}

      {closed ? (
        <div className="mt-4 max-w-[62ch]" data-testid="expiry-refund">
          {!signedIn ? (
            <p className="text-sm text-sand">
              <Link href="/login" className="font-medium underline">
                Sign in
              </Link>{" "}
              to see whether you have a refund to claim.
            </p>
          ) : refund === null ? (
            <p className="text-sm text-dim">Checking your refund...</p>
          ) : refund.claimed ? (
            <p className="text-sm text-sand">You have already claimed your refund.</p>
          ) : refund.amountMinorUnits !== "0" ? (
            <>
              <p className="text-sm text-sand">
                Your share is <strong className="text-ink">{formatMinorUnits(refund.amountMinorUnits)}</strong>, paid back to your own wallet.
              </p>
              <button type="button" className={`mt-3 ${BUTTON}`} disabled={busy !== null} onClick={() => act("claim")}>
                {busy === "claim" ? "Claiming..." : `Claim ${formatMinorUnits(refund.amountMinorUnits)}`}
              </button>
            </>
          ) : (
            <p className="text-sm text-sand">You have no refund due on this campaign.</p>
          )}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-sm text-bad">
          {error}
        </p>
      ) : null}
    </section>
  );
}
