"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { formatMinorUnits, rupeesToMinorUnits } from "@/lib/campaigns/money";
import { createDonationSchema } from "@/lib/donations/validation";
import type { DonationView } from "@/lib/donations/service";
import { DonationProgress } from "./DonationProgress";

export type DonateState = "signed_out" | "own_wallet" | "off" | "ready";

const QUICK_AMOUNTS = ["100", "500", "1000"];
const BOX = "rounded-lg border border-zinc-200 p-6 dark:border-zinc-800";
const INPUT =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

function Heading() {
  return <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Donate to this campaign</h2>;
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <section className={BOX}>
      <Heading />
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{children}</p>
    </section>
  );
}

export function DonatePanel({
  campaignId,
  campaignHref,
  state,
  feeMinorUnits,
}: {
  campaignId: string;
  campaignHref: string;
  state: DonateState;
  /** The configured flat platform fee, "0" by default. */
  feeMinorUnits: string;
}) {
  const [amount, setAmount] = useState("");
  const [feeChoice, setFeeChoice] = useState<"cover" | "decline" | null>(null);
  const [donation, setDonation] = useState<DonationView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasFee = feeMinorUnits !== "0";
  const minor = rupeesToMinorUnits(amount);
  const fee = hasFee && feeChoice === "cover" ? BigInt(feeMinorUnits) : 0n;
  const validAmount = minor !== null && createDonationSchema.safeParse({ campaignId, amountMinorUnits: minor }).success;
  const canSubmit = validAmount && (!hasFee || feeChoice !== null) && !busy;

  if (state === "signed_out") {
    return (
      <Notice>
        <Link href="/login" className="font-medium underline">Sign in</Link> or{" "}
        <Link href="/register" className="font-medium underline">create an account</Link> to donate. It takes about a
        minute, and you do not need any crypto knowledge.
      </Notice>
    );
  }
  if (state === "own_wallet") {
    return (
      <Notice>
        Your account uses your own crypto wallet, and donating from it is not available yet. Create a regular account to donate.
      </Notice>
    );
  }
  if (state === "off") return <Notice>Donations are switched off on this server right now.</Notice>;

  if (donation) {
    return (
      <section className={BOX}>
        <Heading />
        <div className="mt-4">
          <DonationProgress initial={donation} campaignHref={campaignHref} />
        </div>
        {donation.status === "CONFIRMED" ? (
          <button
            type="button"
            onClick={() => { setDonation(null); setAmount(""); setFeeChoice(null); }}
            className="mt-4 text-sm font-medium underline"
          >
            Make another donation
          </button>
        ) : null}
      </section>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || minor === null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/donations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ campaignId, amountMinorUnits: minor, ...(hasFee && feeChoice ? { feeChoice } : {}) }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) return setError(body?.error?.details?.amountMinorUnits?.[0] ?? body?.error?.message ?? "Something went wrong.");
      setDonation(body.donation);
    } catch {
      setError("We could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={BOX} aria-labelledby="donate-heading">
      <h2 id="donate-heading" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Donate to this campaign</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        This is practice money on a test network. We add it to your account for you, then send it to the campaign&apos;s escrow.
      </p>

      <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
        <div>
          <label htmlFor="amount" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Amount (rupees)</label>
          <input id="amount" inputMode="decimal" placeholder="Enter an amount" value={amount} onChange={(e) => setAmount(e.target.value)} className={INPUT} />
          <div className="mt-2 flex gap-2">
            {QUICK_AMOUNTS.map((q) => (
              <button key={q} type="button" onClick={() => setAmount(q)} className="rounded-md border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900">
                ₹{Number(q).toLocaleString("en-IN")}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-md bg-zinc-50 p-4 text-sm dark:bg-zinc-900">
          <p className="font-medium text-zinc-800 dark:text-zinc-200">What you pay</p>
          <dl className="mt-2 space-y-1 text-zinc-700 dark:text-zinc-300">
            <div className="flex justify-between">
              <dt>Goes to the campaign</dt>
              <dd>{validAmount && minor ? formatMinorUnits(minor) : "-"}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Platform fee</dt>
              <dd>{hasFee ? (feeChoice === null ? "your choice below" : formatMinorUnits(fee.toString())) : "₹0.00"}</dd>
            </div>
            <div className="flex justify-between border-t border-zinc-200 pt-1 font-medium dark:border-zinc-700">
              <dt>Total</dt>
              <dd>{validAmount && minor ? formatMinorUnits((BigInt(minor) + fee).toString()) : "-"}</dd>
            </div>
          </dl>
          {!hasFee ? (
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">VERA takes no fee. 100% of your donation goes to the campaign, with no tip added.</p>
          ) : null}
        </div>

        {hasFee ? (
          <fieldset>
            <legend className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Platform fee (optional)</legend>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              A flat {formatMinorUnits(feeMinorUnits)}, paid on top, so your full donation still reaches the campaign.
            </p>
            <div className="mt-2 space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name="fee" checked={feeChoice === "cover"} onChange={() => setFeeChoice("cover")} />
                Cover the {formatMinorUnits(feeMinorUnits)} fee
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="fee" checked={feeChoice === "decline"} onChange={() => setFeeChoice("decline")} />
                No thanks, ₹0.00 fee
              </label>
            </div>
          </fieldset>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {busy ? "Starting..." : validAmount && minor ? `Donate ${formatMinorUnits(minor)}` : "Donate"}
        </button>
      </form>
    </section>
  );
}
