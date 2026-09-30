import Link from "next/link";
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

const BADGE: Record<string, string> = {
  CampaignCreated: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
  DonationReceived: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  MilestoneDefined: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
  MilestoneAttested: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  MilestoneVerified: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  CouncilApproved: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
  MilestoneReleased: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  BeneficiaryRegistered: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
  PayoutRecorded: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
};

const shortHash = (h: string) => `${h.slice(0, 10)}...${h.slice(-6)}`;

function href(params: { campaign?: string; type?: string; page?: number }) {
  const q = new URLSearchParams();
  if (params.campaign) q.set("campaign", params.campaign);
  if (params.type) q.set("type", params.type);
  if (params.page && params.page > 1) q.set("page", String(params.page));
  const s = q.toString();
  return s ? `/activity?${s}` : "/activity";
}

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

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Chain activity</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Every donation, confirmation, approval, release and payout recorded on the blockchain for VERA campaigns, newest first. Each
        line links to the transaction on the public block explorer, so you can check it yourself.
      </p>

      {!data.indexer.configured ? (
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200" data-testid="activity-off">
          The chain reader is switched off on this server, so this list may be empty or out of date.
        </p>
      ) : (
        <p
          className={`mt-4 rounded-md px-3 py-2 text-sm ${data.indexer.freshness === "lagging" ? "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200" : "bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400"}`}
          data-testid="activity-freshness"
        >
          Data as of block {data.indexer.dataAsOfBlock ?? "unknown"}
          {data.indexer.lagBlocks !== null ? ` (${data.indexer.lagBlocks} blocks behind the chain)` : ""}
          {data.indexer.freshness === "lagging" ? ". The newest activity may not be shown yet." : "."}
        </p>
      )}

      <form method="get" action="/activity" className="mt-6 flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">Campaign</span>
          <select name="campaign" defaultValue={campaign ?? ""} className="rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 dark:border-zinc-700">
            <option value="">All campaigns</option>
            {liveCampaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">Type</span>
          <select name="type" defaultValue={type ?? ""} className="rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 dark:border-zinc-700">
            <option value="">All types</option>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {ACTIVITY_TITLE[t]} ({data.countsByType[t]})
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-md bg-zinc-900 px-4 py-1.5 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300">
          Filter
        </button>
        {campaign || type ? (
          <Link href="/activity" className="py-1.5 text-zinc-600 underline dark:text-zinc-400">
            Clear filters
          </Link>
        ) : null}
      </form>

      <p className="mt-4 text-sm text-zinc-500" data-testid="activity-total">
        {data.total} {data.total === 1 ? "event" : "events"}
        {campaign || type ? " match these filters" : " in total"}
        {pages > 1 ? ` · page ${page} of ${pages}` : ""}
      </p>

      {data.rows.length === 0 ? (
        <p className="mt-6 text-zinc-600 dark:text-zinc-400">Nothing to show yet.</p>
      ) : (
        <ol className="mt-3 space-y-3" data-testid="activity-list">
          {data.rows.map((r) => (
            <li key={r.id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800" data-testid="activity-row">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${BADGE[r.type]}`}>{r.title}</span>
                <span className="text-xs text-zinc-500">{formatUtc(r.timestamp)}</span>
                <span className="text-xs text-zinc-500">block {r.blockNumber}</span>
              </div>
              <p className="mt-2 text-sm text-zinc-800 dark:text-zinc-200">{r.detail}</p>
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
                {r.campaignId ? (
                  <Link href={`/campaigns/${r.campaignId}`} className="underline">
                    {r.campaignTitle}
                  </Link>
                ) : (
                  <span>A vault that is not a published VERA campaign</span>
                )}
                <a href={explorerAddressUrl(r.contractAddress)} target="_blank" rel="noreferrer" className="underline">
                  {r.contract}
                </a>
                <a href={explorerTxUrl(r.txHash)} target="_blank" rel="noreferrer" className="font-mono underline">
                  {shortHash(r.txHash)}
                </a>
              </p>
            </li>
          ))}
        </ol>
      )}

      {pages > 1 ? (
        <nav className="mt-6 flex items-center justify-between text-sm" aria-label="Pages">
          {page > 1 ? (
            <Link href={href({ campaign, type, page: page - 1 })} className="underline">
              Newer
            </Link>
          ) : (
            <span />
          )}
          {page < pages ? (
            <Link href={href({ campaign, type, page: page + 1 })} className="underline">
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
