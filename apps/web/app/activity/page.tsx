import Link from "next/link";
import type { EventName } from "@/lib/indexer/types";
import { ACTIVITY_TITLE, ACTIVITY_TYPES, isEventName } from "@/lib/activity/activity";
import { buildActivity, knownContractsFromEnv } from "@/lib/activity/load";
import { formatUtc } from "@/lib/campaigns/format";
import { listLive } from "@/lib/campaigns/service";
import { getDb } from "@/lib/db";
import { explorerAddressUrl, explorerTxUrl } from "@/lib/explorer";
import { indexerRuntime } from "@/lib/indexer/runtime";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chain activity | VERA" };

const PAGE_SIZE = 50;

/** Badges follow the money: what came in is neutral, confirmations are green, what went out is copper. */
const NEUTRAL = "border-rule-strong text-sand";
const CONFIRM = "border-ok/50 text-ok";
const MONEY_OUT = "border-ink/60 text-ink";
const BADGE: Record<string, string> = {
  CampaignCreated: NEUTRAL,
  DonationReceived: NEUTRAL,
  MilestoneDefined: NEUTRAL,
  MilestoneAttested: CONFIRM,
  MilestoneVerified: CONFIRM,
  CouncilApproved: CONFIRM,
  MilestoneReleased: MONEY_OUT,
  BeneficiaryRegistered: NEUTRAL,
  PayoutRecorded: MONEY_OUT,
};

/** The life of a rupee in four counts, using the same words as the stage rail. */
const SUMMARY: { label: string; note: string; types: EventName[] }[] = [
  { label: "Locked", note: "donations received", types: ["DonationReceived"] },
  { label: "Confirmed", note: "confirmations and approvals", types: ["MilestoneAttested", "MilestoneVerified", "CouncilApproved"] },
  { label: "Released", note: "releases to organizers", types: ["MilestoneReleased"] },
  { label: "Paid out", note: "payouts to beneficiaries", types: ["PayoutRecorded"] },
];

const shortHash = (h: string) => `${h.slice(0, 10)}...${h.slice(-6)}`;

function href(params: { campaign?: string; type?: string; page?: number }) {
  const q = new URLSearchParams();
  if (params.campaign) q.set("campaign", params.campaign);
  if (params.type) q.set("type", params.type);
  if (params.page && params.page > 1) q.set("page", String(params.page));
  const s = q.toString();
  return s ? `/activity?${s}` : "/activity";
}

const FIELD = "min-h-10 rounded-md border border-rule-strong bg-well px-3 text-ink";
const LINK = "inline-flex min-h-8 items-center underline";

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ campaign?: string; type?: string; page?: string }> }) {
  const sp = await searchParams;
  const db = getDb();
  const type = isEventName(sp.type) ? sp.type : undefined;
  const campaign = sp.campaign || undefined;
  const page = Math.max(1, Math.trunc(Number(sp.page)) || 1);

  const data = await buildActivity(db, indexerRuntime(), knownContractsFromEnv(), {
    campaignId: campaign,
    type,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const liveCampaigns = listLive(db);
  const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const filtered = Boolean(campaign || type);

  return (
    <main className="w-full flex-1 py-12 lg:py-16">
      <h1 className="text-4xl text-ink sm:text-5xl">Chain activity</h1>
      <p className="mt-3 max-w-[60ch] text-lg text-sand">
        Every donation, confirmation, approval, release and payout recorded on the blockchain for VERA campaigns, newest first. Each
        line links to its transaction on the public block explorer, so you can check it yourself.
      </p>

      {!data.indexer.configured ? (
        <p className="mt-5 rounded-md bg-warn-wash px-4 py-3 text-sm text-warn" data-testid="activity-off">
          The chain reader is switched off on this server, so this list may be empty or out of date.
        </p>
      ) : (
        <p
          className={`mt-5 text-sm ${data.indexer.freshness === "lagging" ? "rounded-md bg-warn-wash px-4 py-3 text-warn" : "text-dim"}`}
          data-testid="activity-freshness"
        >
          Data as of block {data.indexer.dataAsOfBlock ?? "unknown"}
          {data.indexer.lagBlocks !== null ? ` (${data.indexer.lagBlocks} blocks behind the chain)` : ""}
          {data.indexer.freshness === "lagging" ? ". The newest activity may not be shown yet." : "."}
        </p>
      )}

      <section className="mt-10" aria-label="Events by stage">
        <p className="text-sm text-dim" data-testid="activity-scope">
          {campaign ? `For ${liveCampaigns.find((c) => c.id === campaign)?.title ?? "this campaign"}` : "Across every campaign and contract that has been indexed"}
        </p>
        <ol className="relative mt-4 grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-4" data-testid="activity-summary">
          <span aria-hidden className="absolute left-2 right-2 top-[7px] hidden h-px bg-copper/60 sm:block" />
          {SUMMARY.map((g) => {
            const n = g.types.reduce((sum, t) => sum + data.countsByType[t], 0);
            return (
              <li key={g.label} className="relative">
                <span aria-hidden className={`relative z-10 block h-4 w-4 rounded-full border border-copper ${n > 0 ? "bg-copper" : "bg-well"}`} />
                <p className="mt-3 text-sm text-dim">{g.label}</p>
                <p className="num font-display text-2xl font-semibold text-ink">{n}</p>
                <p className="text-sm text-sand">{g.note}</p>
              </li>
            );
          })}
        </ol>
      </section>

      <form method="get" action="/activity" className="mt-8 flex flex-wrap items-end gap-x-5 gap-y-4 border-y border-rule py-5 text-sm">
        <label className="flex min-w-56 flex-col gap-1.5">
          <span className="font-medium text-sand">Campaign</span>
          <select name="campaign" defaultValue={campaign ?? ""} className={FIELD}>
            <option value="">All campaigns</option>
            {liveCampaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-64 flex-col gap-1.5">
          <span className="font-medium text-sand">Type</span>
          <select name="type" defaultValue={type ?? ""} className={FIELD}>
            <option value="">All types</option>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {ACTIVITY_TITLE[t]} ({data.countsByType[t]})
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="min-h-10 rounded-md bg-copper px-5 font-medium text-on-copper hover:bg-copper-hover">
          Apply filters
        </button>
        {filtered ? (
          <Link href="/activity" className="inline-flex min-h-10 items-center text-sand underline hover:text-ink">
            Clear filters
          </Link>
        ) : null}
      </form>

      <p className="mt-5 text-sm text-dim" data-testid="activity-total">
        {data.total} {data.total === 1 ? "event" : "events"}
        {filtered ? " match these filters" : " in total"}
        {pages > 1 ? ` · page ${page} of ${pages}` : ""}
      </p>

      {data.rows.length === 0 ? (
        <p className="mt-4 border-y border-rule py-6 text-sand">
          {filtered
            ? "Nothing matches these filters. Try clearing them to see all activity."
            : "Nothing has been recorded yet. Donations, confirmations and payouts appear here as they happen on the blockchain."}
        </p>
      ) : (
        <ol className="mt-2" data-testid="activity-list">
          {data.rows.map((r, i) => {
            const day = formatUtc(r.timestamp).split(",")[0];
            const newDay = i === 0 || formatUtc(data.rows[i - 1].timestamp).split(",")[0] !== day;
            return (
              <li key={r.id} data-testid="activity-row">
                {newDay ? <p className="num border-b border-rule-strong pb-2 pt-8 font-display text-lg text-ink">{day}</p> : null}
                <div className="grid gap-x-8 gap-y-1 border-b border-rule py-4 md:grid-cols-[7rem_1fr]">
                  <p className="num text-sm text-dim">{formatUtc(r.timestamp).split(",")[1]?.trim()}</p>
                  <div className="min-w-0">
                    <p className="text-ink">
                      <span className={`mr-2 inline-block rounded-full border px-2.5 py-0.5 align-middle text-[13px] font-medium ${BADGE[r.type]}`}>{r.title}</span>
                      {r.detail}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-5 text-sm">
                      {r.campaignId ? (
                        <Link href={`/campaigns/${r.campaignId}`} className={LINK}>
                          {r.campaignTitle}
                        </Link>
                      ) : (
                        <span className="inline-flex min-h-8 items-center text-dim">A vault that is not a published VERA campaign</span>
                      )}
                      <a href={explorerTxUrl(r.txHash)} target="_blank" rel="noreferrer" className={`${LINK} font-mono text-[13px]`}>
                        {shortHash(r.txHash)}
                      </a>
                      <details>
                        <summary className="inline-flex min-h-8 cursor-pointer items-center text-dim hover:text-ink">View contract and block</summary>
                        <span className="flex flex-wrap items-center gap-x-5 pb-1">
                          <a href={explorerAddressUrl(r.contractAddress)} target="_blank" rel="noreferrer" className={LINK}>
                            {r.contract}
                          </a>
                          <span className="num text-[13px] text-dim">block {r.blockNumber.toLocaleString("en-US")}</span>
                        </span>
                      </details>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {pages > 1 ? (
        <nav className="mt-8 flex items-center justify-between text-sm" aria-label="Pages">
          {page > 1 ? (
            <Link href={href({ campaign, type, page: page - 1 })} className={LINK}>
              Newer
            </Link>
          ) : (
            <span />
          )}
          {page < pages ? (
            <Link href={href({ campaign, type, page: page + 1 })} className={LINK}>
              Older
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </main>
  );
}
