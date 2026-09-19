import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/ActionButton";
import { MilestoneCard } from "@/components/MilestoneCard";
import { PublishCampaignButton } from "@/components/PublishCampaignButton";
import { CATEGORY_LABEL } from "@/lib/campaigns/ceilings";
import { formatMinorUnits } from "@/lib/campaigns/money";
import { requirePageUser } from "@/lib/campaigns/page-guard";
import { getCampaign, ownerUserId } from "@/lib/campaigns/service";
import { escrowChain } from "@/lib/chain/manager";
import { viewsForCampaign } from "@/lib/escrow/service";

export const dynamic = "force-dynamic";

const CHAIN_COPY = {
  pending: "Not published yet.",
  not_configured: "Saved here only. Publishing to the blockchain is not configured on this server.",
  deployed: "Published. This campaign has its own escrow account on the blockchain.",
  failed: "Publishing failed. Your campaign is safe and you can try again.",
} as const;

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, user } = await requirePageUser();
  const campaign = getCampaign(db, id);
  if (!campaign) notFound();
  if (user.id !== ownerUserId(db, id) && user.role !== "admin") notFound();

  const live = campaign.status === "LIVE";
  const unregistered = campaign.milestones.filter((m) => m.chainStatus !== "defined");
  const chain = escrowChain();
  const views = live ? await viewsForCampaign(db, chain, id) : [];
  const showViews = live && views.length > 0 && unregistered.length === 0;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <Link href="/dashboard/campaigns" className="text-sm text-zinc-600 underline dark:text-zinc-400">
        Back to your campaigns
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{campaign.title}</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {CATEGORY_LABEL[campaign.category]} · Goal {formatMinorUnits(campaign.fundingGoalMinorUnits)} · Admin cost cap{" "}
        {campaign.adminExpenseCapPct}%
      </p>
      <p className="mt-4 text-zinc-700 dark:text-zinc-300">{campaign.summary}</p>

      <section className="mt-8 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-500">Escrow account</h2>
        <p
          className={`mt-1 font-medium ${live ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}
          data-testid="chain-status"
        >
          {CHAIN_COPY[campaign.chainStatus]}
        </p>
        {campaign.chainError ? <p className="mt-1 text-sm text-red-700 dark:text-red-400">{campaign.chainError}</p> : null}
        {campaign.vaultContractAddress ? (
          <p className="mt-2 break-all font-mono text-xs text-zinc-600 dark:text-zinc-400">
            {campaign.vaultContractAddress}
          </p>
        ) : null}
        {campaign.chainTxHash?.startsWith("0x") ? (
          <a
            className="mt-2 inline-block text-sm underline"
            href={`https://amoy.polygonscan.com/address/${campaign.vaultContractAddress}`}
            target="_blank"
            rel="noreferrer"
          >
            Inspect it on the public block explorer
          </a>
        ) : null}
        {live ? (
          <Link href={`/campaigns/${campaign.id}`} className="mt-3 inline-block text-sm font-medium underline">
            View the public page
          </Link>
        ) : null}
        {!live ? <PublishCampaignButton campaignId={campaign.id} label="Publish to the blockchain" /> : null}
      </section>

      <section className="mt-8">
        <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Milestones</h2>
        {live && unregistered.length > 0 ? (
          <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200" data-testid="unregistered">
            <p>
              {unregistered.length} of {campaign.milestones.length} milestones are not registered with the milestone manager
              yet, so attestors cannot confirm them and no money can be released.
            </p>
            {unregistered[0].chainError ? <p className="mt-1">{unregistered[0].chainError}</p> : null}
            {chain.configured() ? (
              <ActionButton url={`/api/v1/campaigns/${campaign.id}/milestones/define`} label="Register milestones" busyLabel="Registering, this can take a minute..." />
            ) : (
              <p className="mt-1">Milestone registration is switched off on this server.</p>
            )}
          </div>
        ) : null}
        {showViews ? (
          <ol className="mt-3 space-y-3">
            {views.map((v) => (
              <MilestoneCard key={v.id} view={v} mode="release" />
            ))}
          </ol>
        ) : null}
        {!showViews ? (
        <ol className="mt-3 space-y-3">
          {campaign.milestones.map((m) => (
            <li key={m.id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="flex items-start justify-between gap-4">
                <p className="text-zinc-800 dark:text-zinc-200">{m.description}</p>
                <span className="shrink-0 text-sm font-medium text-zinc-600 dark:text-zinc-400">{m.targetPct}%</span>
              </div>
              <p className="mt-1 text-sm text-zinc-500">
                {formatMinorUnits(
                  ((BigInt(campaign.fundingGoalMinorUnits) * BigInt(m.targetPct)) / 100n).toString(),
                )}{" "}
                · needs {m.requiredAttestations} independent confirmations · {m.status.toLowerCase()}
              </p>
            </li>
          ))}
        </ol>
        ) : null}
      </section>
    </main>
  );
}
