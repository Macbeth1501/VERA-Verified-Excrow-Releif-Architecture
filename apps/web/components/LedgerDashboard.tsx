"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { CATEGORY_LABEL } from "@/lib/campaigns/ceilings";
import type { DashboardData } from "@/lib/campaigns/dashboard";
import { formatBps, formatUtc, shortAddress } from "@/lib/campaigns/format";
import { formatMinorUnits } from "@/lib/campaigns/money";
import { explorerAddressUrl, explorerTxUrl } from "@/lib/explorer";

/** How often the page re-reads the ledger while it is open and visible. */
const REFRESH_MS = 10_000;

function FreshnessBanner({ data, refreshFailed }: { data: DashboardData; refreshFailed: boolean }) {
  const { indexer } = data;
  const asOf = indexer.dataAsOfBlock !== null ? `Data as of block ${indexer.dataAsOfBlock.toLocaleString("en-US")}` : "No chain data yet";

  if (indexer.freshness === "lagging" || indexer.freshness === "unknown" || indexer.freshness === "off" || refreshFailed) {
    const reason =
      indexer.freshness === "lagging"
        ? `This page is ${indexer.lagBlocks} blocks behind the blockchain, so very recent donations may be missing.`
        : indexer.freshness === "off"
          ? "Live blockchain reading is switched off on this server, so these figures may be out of date."
          : refreshFailed
            ? "We could not refresh just now, so you are seeing the last data we loaded."
            : "We could not tell how current this data is.";
    return (
      <p role="status" className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
        <strong>{asOf}.</strong> {reason}
      </p>
    );
  }
  return (
    <p role="status" className="text-sm text-zinc-500">
      {asOf} · live, refreshes every {REFRESH_MS / 1000} seconds
    </p>
  );
}

function ReconciliationBadge({ data }: { data: DashboardData }) {
  const { status, checkedAtBlock } = data.reconciliation;
  const styles = {
    match: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    mismatch: "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
    unavailable: "border-zinc-300 bg-zinc-50 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
    not_checked: "border-zinc-300 bg-zinc-50 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
  }[status];
  const message = {
    match: `Verified against the blockchain. The total shown here matches what the escrow account holds, to the last unit, at block ${checkedAtBlock?.toLocaleString("en-US")}.`,
    mismatch: "Warning: the total shown here does NOT match what the escrow account holds on the blockchain. Do not rely on these figures.",
    unavailable: "We could not compare these figures with the blockchain right now. You can check them yourself below.",
    not_checked: "These figures have not been compared with the blockchain. You can check them yourself below.",
  }[status];

  return (
    <div className={`rounded-lg border p-4 ${styles}`} data-testid="reconciliation" data-status={status}>
      <p className="font-medium">{message}</p>
      <p className="mt-3 text-sm">
        Escrow account:{" "}
        <a className="break-all font-mono underline" href={explorerAddressUrl(data.vault)} target="_blank" rel="noreferrer">
          {data.vault}
        </a>
      </p>
      <p className="mt-1 text-sm">
        Open that page on the public block explorer, look at the mINR token balance the account holds, and compare it
        with the amount held above. You do not need to trust us.
      </p>
    </div>
  );
}

function useLiveData(initial: DashboardData) {
  const [data, setData] = useState(initial);
  const [refreshFailed, setRefreshFailed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/campaigns/${initial.campaign.id}/ledger`, { cache: "no-store" });
      if (!res.ok) throw new Error("bad status");
      setData(await res.json());
      setRefreshFailed(false);
    } catch {
      setRefreshFailed(true);
    }
  }, [initial.campaign.id]);

  useEffect(() => {
    // Only poll while the tab is visible, so a forgotten background tab does not hammer the RPC.
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = setInterval(tick, REFRESH_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);

  return { data, refreshFailed };
}

/**
 * A milestone's progress as the public ledger shows it, counted from indexed on-chain events only
 * (the database keeps no attestation counts), so it can never claim more than the chain does.
 */
export function milestoneProgress(ledger: DashboardData["ledger"], index: number) {
  const mine = ledger.filter((e) => e.milestoneIndex === index);
  const release = mine.find((e) => e.type === "MilestoneReleased");
  return {
    attestations: mine.filter((e) => e.type === "MilestoneAttested").length,
    council: mine.filter((e) => e.type === "CouncilApproved").length,
    verified: mine.some((e) => e.type === "MilestoneVerified"),
    released: Boolean(release),
    releasedAmount: release?.amount ?? null,
  };
}

export function LedgerDashboard({ initial, donateSlot }: { initial: DashboardData; donateSlot?: ReactNode }) {
  const { data, refreshFailed } = useLiveData(initial);
  const { campaign, escrow, organizer } = data;
  const progress = Math.min(100, escrow.goalReachedBps / 100);
  const donations = data.ledger.filter((e) => e.type === "DonationReceived");
  const goal = BigInt(campaign.fundingGoalMinorUnits);
  const exportBase = `/api/v1/campaigns/${campaign.id}/export`;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <p className="text-sm font-medium text-zinc-500">{CATEGORY_LABEL[campaign.category]} campaign</p>
      <h1 className="mt-1 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">{campaign.title}</h1>
      {organizer ? (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Run by{" "}
          <Link href={`/organizers/${organizer.id}`} className="font-medium underline">
            {organizer.legalName}
          </Link>{" "}
          ({organizer.jurisdiction}), a verified organizer
        </p>
      ) : null}
      <p className="mt-4 text-zinc-700 dark:text-zinc-300">{campaign.summary}</p>

      <div className="mt-6">
        <FreshnessBanner data={data} refreshFailed={refreshFailed} />
      </div>

      <section aria-labelledby="escrow-heading" className="mt-6 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 id="escrow-heading" className="text-sm font-medium text-zinc-500">
          Held in escrow
        </h2>
        <p className="mt-1 text-4xl font-semibold text-zinc-900 dark:text-zinc-50" data-testid="held">
          {formatMinorUnits(escrow.heldMinorUnits)}
        </p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {escrow.donationCount} {escrow.donationCount === 1 ? "donation" : "donations"} · goal{" "}
          {formatMinorUnits(campaign.fundingGoalMinorUnits)}
        </p>
        <div
          className="mt-4 h-3 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
          role="progressbar"
          aria-label="Progress toward the funding goal"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
        >
          <div className="h-full bg-emerald-600" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{formatBps(escrow.goalReachedBps)} of the goal</p>
        {BigInt(escrow.totalReleasedMinorUnits) > 0n ? (
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400" data-testid="released">
            {formatMinorUnits(escrow.totalReleasedMinorUnits)} already paid out through verified milestones
          </p>
        ) : null}
        {data.beneficiaries.registry ? (
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400" data-testid="beneficiaries">
            {data.beneficiaries.uniqueCount} verified unique {data.beneficiaries.uniqueCount === 1 ? "beneficiary" : "beneficiaries"} ·{" "}
            <a className="underline" href={explorerAddressUrl(data.beneficiaries.registry)} target="_blank" rel="noreferrer">
              check the public registry
            </a>
          </p>
        ) : null}
        <p className="mt-3 text-sm text-zinc-500">
          Admin costs are capped at {campaign.adminExpenseCapPct}% by the contract itself, not by policy.
        </p>
      </section>

      {donateSlot ? <div className="mt-6">{donateSlot}</div> : null}

      <div className="mt-6">
        <ReconciliationBadge data={data} />
      </div>

      <section aria-labelledby="milestones-heading" className="mt-10">
        <h2 id="milestones-heading" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Milestones
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Money is released in stages, only after independent people confirm each stage is done.
        </p>
        <ol className="mt-4 space-y-3">
          {data.milestones.map((m) => {
            const progress = milestoneProgress(data.ledger, m.sequenceOrder);
            const state = progress.released ? "Released" : progress.verified ? "Verified, awaiting release" : "Pending";
            return (
              <li key={m.id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800" data-testid={`milestone-${m.sequenceOrder}`}>
                <div className="flex items-start justify-between gap-4">
                  <p className="text-zinc-800 dark:text-zinc-200">{m.description}</p>
                  <span className="shrink-0 text-sm font-medium text-zinc-600 dark:text-zinc-400">{m.targetPct}%</span>
                </div>
                <p className="mt-1 text-sm text-zinc-500">
                  {formatMinorUnits(((goal * BigInt(m.targetPct)) / 100n).toString())} of the goal · {progress.attestations} of{" "}
                  {m.requiredAttestations} independent confirmations · <span data-testid="milestone-state">{state}</span>
                  {progress.council > 0 ? ` · ${progress.council} council approvals` : ""}
                  {progress.releasedAmount ? ` · paid out ${formatMinorUnits(progress.releasedAmount)}` : ""}
                </p>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="ledger-heading" className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="ledger-heading" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Every donation
          </h2>
          <div className="flex gap-3 text-sm font-medium">
            <a className="underline" href={`${exportBase}?format=csv`} download>
              Download CSV
            </a>
            <a className="underline" href={`${exportBase}?format=json`} download>
              Download JSON
            </a>
          </div>
        </div>

        {donations.length === 0 ? (
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">No donations yet. New donations appear here within about 20 seconds.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Donations received by this campaign, newest first</caption>
              <thead className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">When</th>
                  <th scope="col" className="py-2 pr-4 font-medium">From</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">Amount</th>
                  <th scope="col" className="py-2 font-medium">Proof</th>
                </tr>
              </thead>
              <tbody>
                {[...donations].reverse().map((e) => (
                  <tr key={e.id} className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="py-2 pr-4 text-zinc-700 dark:text-zinc-300">{formatUtc(e.timestamp)}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-zinc-600 dark:text-zinc-400">{shortAddress(e.actor)}</td>
                    <td className="py-2 pr-4 text-right font-medium text-zinc-900 dark:text-zinc-50">
                      {formatMinorUnits(e.amount ?? "0")}
                    </td>
                    <td className="py-2">
                      <a className="underline" href={explorerTxUrl(e.txHash)} target="_blank" rel="noreferrer">
                        View on explorer
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
