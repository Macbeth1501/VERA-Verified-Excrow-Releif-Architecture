"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatMinorUnits } from "@/lib/campaigns/money";
import type { DonationView } from "@/lib/donations/service";
import { explorerTxUrl } from "@/lib/explorer";

/** How often the browser asks the server to move the donation forward. */
const STEP_INTERVAL_MS = 1500;

const STAGE_TEXT: Record<DonationView["stage"], string> = {
  adding_funds: "Adding practice funds to your account",
  approving: "Authorising the donation",
  sending: "Sending your donation to the campaign",
  confirming: "Waiting for the blockchain to confirm your donation",
  done: "Donation confirmed",
  failed: "Your donation did not go through",
};

/**
 * Drives a donation to completion by calling /advance until the server reports CONFIRMED or
 * FAILED. It only ever shows "confirmed" when the server says the chain confirmed it.
 */
export function DonationProgress({
  initial,
  campaignHref,
  onDone,
}: {
  initial: DonationView;
  campaignHref?: string;
  onDone?: () => void;
}) {
  const [donation, setDonation] = useState(initial);
  const [offline, setOffline] = useState(false);
  const [running, setRunning] = useState(initial.status === "PENDING");
  const stopped = useRef(false);

  const advance = useCallback(async (): Promise<DonationView | null> => {
    try {
      const res = await fetch(`/api/v1/donations/${initial.id}/advance`, { method: "POST" });
      if (!res.ok) throw new Error("bad status");
      const body = await res.json();
      setOffline(false);
      setDonation(body.donation);
      return body.donation as DonationView;
    } catch {
      setOffline(true);
      return null;
    }
  }, [initial.id]);

  useEffect(() => {
    if (!running) return;
    stopped.current = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const next = await advance();
      if (stopped.current) return;
      if (next && next.status !== "PENDING") {
        setRunning(false);
        if (next.status === "CONFIRMED") onDone?.();
        return;
      }
      timer = setTimeout(tick, STEP_INTERVAL_MS);
    };
    void tick();
    return () => {
      stopped.current = true;
      clearTimeout(timer);
    };
  }, [running, advance, onDone]);

  async function retry() {
    const res = await fetch(`/api/v1/donations/${initial.id}/retry`, { method: "POST" });
    if (res.ok) {
      setDonation((await res.json()).donation);
      setRunning(true);
    }
  }

  const amount = formatMinorUnits(donation.amountMinorUnits);
  const fee = donation.feeMinorUnits !== "0" ? formatMinorUnits(donation.feeMinorUnits) : null;

  if (donation.status === "CONFIRMED") {
    return (
      <div role="status" className="rounded-lg border border-ok/40 bg-ok-wash p-6 text-ok">
        <p className="inline-flex items-center gap-2 text-sm font-medium">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="8.5" />
            <path d="m8.5 12.3 2.4 2.4 4.7-5" />
          </svg>
          Confirmed by the blockchain
        </p>
        <p className="mt-2 font-display text-2xl font-semibold text-ink">Thank you. Your donation of {amount} is confirmed.</p>
        <p className="mt-3 text-sm">
          All {amount} went to the campaign{fee ? `, plus the ${fee} fee you chose to cover` : ", with no fee taken"}. It
          appears on the public ledger within about 20 seconds.
        </p>
        <p className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
          {donation.txHash ? (
            <a className="underline" href={explorerTxUrl(donation.txHash)} target="_blank" rel="noreferrer">
              View your receipt on the explorer
            </a>
          ) : null}
          {campaignHref ? (
            <Link className="underline" href={campaignHref}>
              Back to the campaign
            </Link>
          ) : null}
        </p>
      </div>
    );
  }

  if (donation.status === "FAILED") {
    return (
      <div role="alert" className="rounded-lg border border-bad/40 bg-bad-wash p-6 text-bad">
        <p className="font-display text-xl font-semibold">{STAGE_TEXT.failed}</p>
        <p className="mt-2 text-sm">{donation.error ?? "Something went wrong."} Nothing was lost, and no donation was recorded as complete.</p>
        <button
          type="button"
          onClick={retry}
          className="mt-4 rounded-md border border-bad/50 px-4 py-2 text-sm font-medium hover:bg-bad/10"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div role="status" aria-live="polite" className="rounded-lg border border-warn/40 bg-warn-wash p-6 text-warn">
      <p className="font-display text-xl font-semibold">Pending: your {amount} donation is not complete yet.</p>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-warn/25" aria-hidden>
        <div className="h-full rounded-full bg-warn" style={{ width: `${Math.round((donation.stepNumber / donation.totalSteps) * 100)}%` }} />
      </div>
      <p className="mt-3 text-sm">
        Step {donation.stepNumber} of {donation.totalSteps}: {STAGE_TEXT[donation.stage]}. This can take up to a minute. Please keep this page open.
      </p>
      {donation.txHash ? (
        <a className="mt-2 inline-block text-sm underline" href={explorerTxUrl(donation.txHash)} target="_blank" rel="noreferrer">
          Follow the transaction on the explorer
        </a>
      ) : null}
      {offline ? <p className="mt-2 text-sm">We lost the connection for a moment. Retrying...</p> : null}
    </div>
  );
}
