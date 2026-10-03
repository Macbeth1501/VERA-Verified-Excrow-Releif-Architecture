"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { StageTrack } from "@/components/StageRail";
import { CATEGORY_LABEL } from "@/lib/campaigns/ceilings";
import type { DashboardData } from "@/lib/campaigns/dashboard";
import { formatBps, formatUtc, shortAddress } from "@/lib/campaigns/format";
import { formatMinorUnits } from "@/lib/campaigns/money";
import { explorerAddressUrl, explorerTxUrl } from "@/lib/explorer";

/** How often the page re-reads the ledger while it is open and visible. */
const REFRESH_MS = 10_000;

/* Ruled-row table that turns into labelled stacked rows on a phone instead of scrolling sideways. */
const TABLE = "w-full text-left text-sm";
const THEAD = "text-dim max-md:sr-only";
const TH = "border-b border-rule px-0 py-2.5 pr-5 font-medium last:pr-0";
const TR = "border-b border-rule max-md:grid max-md:grid-cols-2 max-md:gap-x-4 max-md:gap-y-1 max-md:py-3";
const TD = "py-3 pr-5 align-top last:pr-0 max-md:block max-md:py-0 max-md:before:mb-0.5 max-md:before:block max-md:before:text-[13px] max-md:before:text-dim max-md:before:content-[attr(data-label)]";
const LINK_TARGET = "inline-flex min-h-8 items-center underline";

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
      <p role="status" className="rounded-md bg-warn-wash px-4 py-3 text-sm text-warn">
        <strong>{asOf}.</strong> {reason}
      </p>
    );
  }
  return (
    <p role="status" className="text-sm text-dim">
      {asOf} · live, refreshes every {REFRESH_MS / 1000} seconds
    </p>
  );
}

const SEAL = {
  match: { text: "Verified against the blockchain", tone: "border-ok/50 bg-ok-wash text-ok" },
  mismatch: { text: "Does not match the blockchain", tone: "border-bad/50 bg-bad-wash text-bad" },
  unavailable: { text: "Could not be compared just now", tone: "border-rule-strong bg-panel text-sand" },
  not_checked: { text: "Not compared with the blockchain yet", tone: "border-rule-strong bg-panel text-sand" },
} as const;

/** One-glance trust state beside the title; the full explanation lives in the verification panel. */
function ReconciliationSeal({ status }: { status: DashboardData["reconciliation"]["status"] }) {
  const seal = SEAL[status];
  return (
    <a
      href="#verification"
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium hover:brightness-110 ${seal.tone}`}
      data-testid="reconciliation-seal"
      data-status={status}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {status === "match" ? (
          <>
            <path d="M12 3 5 6v5c0 4.5 2.9 8 7 10 4.1-2 7-5.5 7-10V6l-7-3Z" />
            <path d="m9 12 2.2 2.2L15.5 10" />
          </>
        ) : status === "mismatch" ? (
          <>
            <path d="M12 3 5 6v5c0 4.5 2.9 8 7 10 4.1-2 7-5.5 7-10V6l-7-3Z" />
            <path d="M12 8.5v4.2M12 15.8v.1" />
          </>
        ) : (
          <>
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 7.5V12l3 2" />
          </>
        )}
      </svg>
      {seal.text}
    </a>
  );
}

function ReconciliationBadge({ data, onRecheck }: { data: DashboardData; onRecheck: () => Promise<void> }) {
  const [checking, setChecking] = useState(false);
  const { status, checkedAtBlock, payouts, reason } = data.reconciliation;
  const asOf = data.indexer.dataAsOfBlock;
  const tone = {
    match: "border-ok/40 bg-ok-wash",
    mismatch: "border-bad/40 bg-bad-wash",
    unavailable: "border-rule bg-panel",
    not_checked: "border-rule bg-panel",
  }[status];
  const message = {
    match: `The total shown here matches what the escrow account holds, to the last unit, at block ${checkedAtBlock?.toLocaleString("en-US")}.`,
    mismatch:
      payouts === "mismatch"
        ? "Warning: the payouts shown here do NOT match the payout contract on the blockchain, or exceed what was released. Do not rely on these figures."
        : "Warning: the total shown here does NOT match what the escrow account holds on the blockchain. Do not rely on these figures.",
    unavailable:
      (reason === "state_pruned"
        ? "The blockchain node we ask no longer keeps data that old, so the comparison could not be made."
        : reason === "unreachable"
          ? "No blockchain node answered in time, so the comparison could not be made."
          : "The comparison with the blockchain could not be completed.") +
      ` The figures on this page are counted from recorded on-chain events${asOf ? ` up to block ${asOf.toLocaleString("en-US")}` : ""}, but they are not confirmed yet. Try again in a moment, or check them yourself below.`,
    not_checked: "These figures have not been compared with the blockchain. You can check them yourself below.",
  }[status];

  return (
    <div id="verification" className={`rounded-lg border p-5 ${tone}`} data-testid="reconciliation" data-status={status}>
      <h2 className="text-lg text-ink">{status === "match" ? "Checked against the blockchain" : "How to check this yourself"}</h2>
      <p className="mt-2 text-sm text-sand">{message}</p>
      {status === "match" && payouts === "match" ? (
        <p className="mt-2 text-sm text-sand" data-testid="payouts-reconciled">
          Payouts to beneficiaries also match the payout contract&apos;s own total, and never exceed what was released.
        </p>
      ) : null}
      {status === "unavailable" || status === "not_checked" ? (
        <button
          type="button"
          disabled={checking}
          onClick={async () => {
            setChecking(true);
            await onRecheck();
            setChecking(false);
          }}
          className="mt-4 inline-flex min-h-10 items-center rounded-md border border-copper px-4 text-sm font-medium text-copper hover:bg-panel disabled:opacity-60"
          data-testid="recheck"
        >
          {checking ? "Checking..." : "Check again"}
        </button>
      ) : null}
      <p className="mt-4 text-sm text-dim">Escrow account</p>
      <a className="break-all font-mono text-[13px] underline" href={explorerAddressUrl(data.vault)} target="_blank" rel="noreferrer">
        {data.vault}
      </a>
      <p className="mt-3 text-sm text-sand">
        Open that page on the public block explorer, look at the mINR token balance the account holds, and compare it with the
        amount held. You do not need to trust us.
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

  return { data, refreshFailed, refresh };
}

/**
 * Every payout to a beneficiary (FR-ESC-02), each a public line item on the Disbursement contract.
 * The beneficiary shows only as their registry fingerprint and the transfer only as the hash of its
 * reference, as they are on-chain: nobody can read a name or an account number from them.
 */
function Payouts({ data }: { data: DashboardData }) {
  const { entries, contract } = data.payouts;
  if (!contract && entries.length === 0) return null;
  const milestone = (index: number) => data.milestones.find((m) => m.sequenceOrder === index);
  return (
    <section aria-labelledby="payouts-heading" className="mt-14" data-testid="payouts">
      <h2 id="payouts-heading" className="text-2xl text-ink">
        Payouts to beneficiaries
      </h2>
      <p className="mt-2 max-w-[62ch] text-sm text-sand">
        After a milestone is released, the organizer records who it paid. The payout contract refuses a payout for an unreleased
        milestone, an unregistered beneficiary, a milestone already paid, or more than was released.
        {contract ? (
          <>
            {" "}
            <a className="underline" href={explorerAddressUrl(contract)} target="_blank" rel="noreferrer">
              Check the payout contract
            </a>
            .
          </>
        ) : null}
      </p>
      {entries.length === 0 ? (
        <p className="mt-5 border-y border-rule py-5 text-sand">No payouts recorded yet. The first one appears here as soon as an organizer records it.</p>
      ) : (
        <table className={`${TABLE} mt-5`}>
          <caption className="sr-only">Payouts to beneficiaries, newest first</caption>
          <thead className={THEAD}>
            <tr className="max-md:contents">
              <th scope="col" className={TH}>When</th>
              <th scope="col" className={TH}>Milestone</th>
              <th scope="col" className={TH}>Beneficiary (anonymous fingerprint)</th>
              <th scope="col" className={`${TH} text-right`}>Amount</th>
              <th scope="col" className={TH}>Proof</th>
            </tr>
          </thead>
          <tbody>
            {[...entries].reverse().map((p) => (
              <tr key={p.id} className={TR} data-testid="payout-row">
                <td className={`${TD} text-sand`} data-label="When">{formatUtc(p.timestamp)}</td>
                <td className={`${TD} text-sand`} data-label="Milestone">
                  {p.milestoneIndex + 1}. {milestone(p.milestoneIndex)?.description ?? ""}
                </td>
                <td className={`${TD} font-mono text-[13px] text-sand`} data-label="Beneficiary" title={p.identityHash}>
                  {shortAddress(p.identityHash)}
                </td>
                <td className={`${TD} num text-right font-semibold text-ink max-md:text-left`} data-label="Amount">{formatMinorUnits(p.amount)}</td>
                <td className={TD} data-label="Proof">
                  <a className={LINK_TARGET} href={explorerTxUrl(p.txHash)} target="_blank" rel="noreferrer">
                    View on explorer
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/**
 * A milestone's progress as the public ledger shows it, counted from indexed on-chain events only
 * (the database keeps no attestation counts), so it can never claim more than the chain does.
 */
export function milestoneProgress(ledger: DashboardData["ledger"], index: number) {
  const mine = ledger.filter((e) => e.milestoneIndex === index);
  const release = mine.find((e) => e.type === "MilestoneReleased");
  const payout = mine.find((e) => e.type === "PayoutRecorded");
  return {
    attestations: mine.filter((e) => e.type === "MilestoneAttested").length,
    council: mine.filter((e) => e.type === "CouncilApproved").length,
    verified: mine.some((e) => e.type === "MilestoneVerified"),
    released: Boolean(release),
    releasedAmount: release?.amount ?? null,
    /** Paid on to a registered beneficiary through the Disbursement contract. */
    paidToBeneficiary: payout?.amount ?? null,
  };
}

function AccountRow({ label, note, value, testId, strong }: { label: string; note?: ReactNode; value: string; testId?: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-6 border-b border-rule py-3.5 ${strong ? "border-t-2 border-t-rule-strong" : ""}`}>
      <dt>
        <span className={strong ? "font-display text-xl text-ink" : "text-ink"}>{label}</span>
        {note ? <span className="mt-0.5 block text-sm text-dim">{note}</span> : null}
      </dt>
      <dd className={`num shrink-0 text-right ${strong ? "font-display text-3xl font-semibold text-ink" : "text-xl font-semibold text-ink"}`} data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

export function LedgerDashboard({ initial, donateSlot }: { initial: DashboardData; donateSlot?: ReactNode }) {
  const { data, refreshFailed, refresh } = useLiveData(initial);
  const { campaign, escrow, organizer } = data;
  const progress = Math.min(100, escrow.goalReachedBps / 100);
  const donations = data.ledger.filter((e) => e.type === "DonationReceived");
  const goal = BigInt(campaign.fundingGoalMinorUnits);
  const exportBase = `/api/v1/campaigns/${campaign.id}/export`;
  const released = BigInt(escrow.totalReleasedMinorUnits);
  const paidOut = BigInt(data.payouts.totalMinorUnits);

  return (
    <main className="flex-1 py-10 lg:py-14">
      <header className="flex flex-wrap items-start justify-between gap-x-10 gap-y-5">
        <div className="min-w-0 max-w-[46rem]">
          <h1 className="text-4xl leading-[1.1] text-ink sm:text-5xl">{campaign.title}</h1>
          <p className="mt-3 text-sand">
            {CATEGORY_LABEL[campaign.category]} campaign
            {organizer ? (
              <>
                {" "}
                run by{" "}
                <Link href={`/organizers/${organizer.id}`} className="font-medium underline">
                  {organizer.legalName}
                </Link>{" "}
                ({organizer.jurisdiction}), a verified organizer
              </>
            ) : null}
          </p>
          <p className="mt-4 max-w-[62ch] text-lg text-sand">{campaign.summary}</p>
        </div>
        <div className="flex flex-col items-start gap-3 lg:items-end">
          <Link href={`/activity?campaign=${campaign.id}`} className="inline-flex min-h-8 items-center text-sm font-medium underline" data-testid="campaign-activity-link">
            See every on-chain transaction for this campaign
          </Link>
        </div>
      </header>

      <div className="mt-6">
        <FreshnessBanner data={data} refreshFailed={refreshFailed} />
      </div>

      <div className="mt-10 grid gap-x-16 gap-y-12 lg:grid-cols-12">
        <section aria-labelledby="escrow-heading" className="lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <h2 id="escrow-heading" className="text-2xl text-ink">
              Where the money is
            </h2>
            <ReconciliationSeal status={data.reconciliation.status} />
          </div>
          <dl className="mt-4">
            <AccountRow
              label="Donated"
              value={formatMinorUnits(escrow.totalDonatedMinorUnits)}
              note={`${escrow.donationCount} ${escrow.donationCount === 1 ? "donation" : "donations"}`}
            />
            <AccountRow
              label="Released to the organizer"
              value={formatMinorUnits(escrow.totalReleasedMinorUnits)}
              testId="released"
              note={released > 0n ? "Moved to the organizer after verified milestones" : "Nothing released yet"}
            />
            <AccountRow
              label="Paid out to beneficiaries"
              value={formatMinorUnits(data.payouts.totalMinorUnits)}
              testId="paid-to-beneficiaries"
              note={
                data.beneficiaries.registry ? (
                  <span data-testid="beneficiaries">
                    {data.beneficiaries.uniqueCount} verified unique {data.beneficiaries.uniqueCount === 1 ? "beneficiary" : "beneficiaries"} ·{" "}
                    <a className="underline" href={explorerAddressUrl(data.beneficiaries.registry)} target="_blank" rel="noreferrer">
                      public registry
                    </a>
                  </span>
                ) : paidOut > 0n ? (
                  "Recorded by the organizer, out of what was released"
                ) : (
                  "None recorded yet"
                )
              }
            />
            {released > paidOut ? (
              <AccountRow
                label="Released, not yet paid out"
                value={formatMinorUnits((released - paidOut).toString())}
                testId="released-unpaid"
                note="With the organizer, waiting to be recorded as payouts to beneficiaries"
              />
            ) : null}
            <AccountRow label="Still held in escrow" value={formatMinorUnits(escrow.heldMinorUnits)} testId="held" strong note="Donated minus released" />
          </dl>

          <div className="mt-8">
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span className="text-sand">Donated so far against the goal of {formatMinorUnits(campaign.fundingGoalMinorUnits)}</span>
              <span className="num font-medium text-ink">{formatBps(escrow.goalReachedBps)}</span>
            </div>
            <div
              className="mt-2 h-2 w-full overflow-hidden rounded-full bg-rule"
              role="progressbar"
              aria-label="Donated so far, as a share of the funding goal"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
            >
              <div className="h-full rounded-full bg-copper" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-3 text-sm text-dim">Admin costs are capped at {campaign.adminExpenseCapPct}% by the contract itself, not by policy.</p>
          </div>
        </section>

        <aside className="space-y-6 lg:sticky lg:top-6 lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1 lg:self-start">
          {donateSlot ? <div>{donateSlot}</div> : null}
          <ReconciliationBadge data={data} onRecheck={refresh} />
        </aside>

        <div className="lg:col-span-7">
          <section aria-labelledby="milestones-heading">
            <h2 id="milestones-heading" className="text-2xl text-ink">
              Milestones
            </h2>
            <p className="mt-2 max-w-[62ch] text-sm text-sand">
              Money is released in stages, only after independent people confirm each stage is done. A <span className="font-medium text-ink">confirmation</span>{" "}
              is one
              independent attestor&apos;s signed check of the work; releases over 100 mINR also need three <span className="font-medium text-ink">council approvals</span>.{" "}
              <Link href="/how-it-works#words-heading" className="underline">
                What these words mean
              </Link>
              .
            </p>
            <ol className="mt-3">
              {data.milestones.map((m) => {
                const p = milestoneProgress(data.ledger, m.sequenceOrder);
                const reached = p.paidToBeneficiary ? 4 : p.released ? 3 : p.verified ? 2 : 1;
                const state = p.released ? "Released" : p.verified ? "Verified, awaiting release" : "Pending";
                const target = formatMinorUnits(((goal * BigInt(m.targetPct)) / 100n).toString());
                return (
                  <li key={m.id} className="border-b border-rule py-6" data-testid={`milestone-${m.sequenceOrder}`}>
                    <div className="flex items-start justify-between gap-6">
                      <div className="min-w-0">
                        <p className="text-lg text-ink">{m.description}</p>
                        <p className="num mt-0.5 text-sm text-dim">
                          {m.targetPct}% of the goal · target {target}
                        </p>
                      </div>
                      <p className="num shrink-0 text-right">
                        <span className="block font-display text-2xl font-semibold text-ink">
                          {p.releasedAmount ? formatMinorUnits(p.releasedAmount) : "Not yet"}
                        </span>
                        <span className="text-sm text-dim">released</span>
                      </p>
                    </div>
                    <StageTrack reached={reached} />
                    <p className="mt-4 max-w-[62ch] text-sm text-sand">
                      <span data-testid="milestone-state" className="font-medium text-ink">
                        {state}
                      </span>
                      {". "}
                      {p.attestations} of {m.requiredAttestations} independent confirmations
                      {p.council > 0 ? `, ${p.council} council approvals` : ""}
                      {p.releasedAmount
                        ? `. The release is this milestone's share of what had been donated when it was released${
                            p.paidToBeneficiary ? `; ${formatMinorUnits(p.paidToBeneficiary)} of it has been paid out to a beneficiary.` : "; none of it has been paid out to a beneficiary yet."
                          }`
                        : "."}
                    </p>
                  </li>
                );
              })}
            </ol>
          </section>

          <Payouts data={data} />

          <section aria-labelledby="ledger-heading" className="mt-14">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="ledger-heading" className="text-2xl text-ink">
                Every donation
              </h2>
              <div className="flex gap-5 text-sm font-medium">
                <a className={LINK_TARGET} href={`${exportBase}?format=csv`} download>
                  Download CSV
                </a>
                <a className={LINK_TARGET} href={`${exportBase}?format=json`} download>
                  Download JSON
                </a>
              </div>
            </div>

            {donations.length === 0 ? (
              <p className="mt-5 border-y border-rule py-5 text-sand">No donations yet. New donations appear here within about 20 seconds.</p>
            ) : (
              <table className={`${TABLE} mt-4`}>
                <caption className="sr-only">Donations received by this campaign, newest first</caption>
                <thead className={THEAD}>
                  <tr className="max-md:contents">
                    <th scope="col" className={TH}>When</th>
                    <th scope="col" className={TH}>From</th>
                    <th scope="col" className={`${TH} text-right`}>Amount</th>
                    <th scope="col" className={TH}>Proof</th>
                  </tr>
                </thead>
                <tbody>
                  {[...donations].reverse().map((e) => (
                    <tr key={e.id} className={TR}>
                      <td className={`${TD} text-sand`} data-label="When">{formatUtc(e.timestamp)}</td>
                      <td className={`${TD} font-mono text-[13px] text-sand`} data-label="From">{shortAddress(e.actor)}</td>
                      <td className={`${TD} num text-right font-semibold text-ink max-md:text-left`} data-label="Amount">
                        {formatMinorUnits(e.amount ?? "0")}
                      </td>
                      <td className={TD} data-label="Proof">
                        <a className={LINK_TARGET} href={explorerTxUrl(e.txHash)} target="_blank" rel="noreferrer">
                          View on explorer
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
