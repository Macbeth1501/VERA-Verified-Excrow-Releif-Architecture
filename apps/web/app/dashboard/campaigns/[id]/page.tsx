import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/ActionButton";
import { MilestoneCard } from "@/components/MilestoneCard";
import { PageHead } from "@/components/PageHead";
import { PayoutForm } from "@/components/PayoutForm";
import { PublishCampaignButton } from "@/components/PublishCampaignButton";
import { CATEGORY_LABEL } from "@/lib/campaigns/ceilings";
import { formatMinorUnits } from "@/lib/campaigns/money";
import { requirePageUser } from "@/lib/campaigns/page-guard";
import { getCampaign, ownerUserId } from "@/lib/campaigns/service";
import { disbursementChain } from "@/lib/chain/disbursement";
import { escrowChain } from "@/lib/chain/manager";
import { beneficiaries } from "@/lib/db/schema";
import { getDisbursement } from "@/lib/disbursement/service";
import { viewsForCampaign } from "@/lib/escrow/service";
import { vaultLedger } from "@/lib/indexer/queries";
import { asc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const ROW = "flex items-center justify-between gap-3 py-2.5 font-medium text-copper hover:text-copper-hover";

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
  const payoutsOn = disbursementChain().configured();
  const payable = db
    .select()
    .from(beneficiaries)
    .where(eq(beneficiaries.campaignId, id))
    .orderBy(asc(beneficiaries.createdAt))
    .all()
    .filter((b) => b.chainStatus === "CONFIRMED")
    .map((b) => ({ id: b.id, identityHash: b.identityHash, payoutMethod: b.payoutMethod }));
  // What the manager released per milestone, as the indexer saw it; only a suggestion for the amount field.
  const releasedAmounts = new Map(
    live && campaign.vaultContractAddress
      ? vaultLedger(db, campaign.vaultContractAddress)
          .filter((e) => e.type === "MilestoneReleased" && e.milestoneIndex !== null)
          .map((e) => [e.milestoneIndex as number, e.amount])
      : [],
  );

  return (
    <main className="w-full flex-1 py-12 lg:py-16">
      <PageHead
        back={{ href: "/dashboard/campaigns", label: "Your campaigns" }}
        title={campaign.title}
        lead={campaign.summary}
      />
      <p className="num mt-4 text-sm text-sand">
        {CATEGORY_LABEL[campaign.category] ?? campaign.category} · goal {formatMinorUnits(campaign.fundingGoalMinorUnits)} ·
        admin cost cap {campaign.adminExpenseCapPct}%
      </p>

      <div className="mt-10 grid gap-x-14 gap-y-12 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <section aria-labelledby="milestones-heading">
          <h2 id="milestones-heading" className="border-b border-rule pb-3 text-2xl text-ink">
            Milestones
          </h2>
          {live && unregistered.length > 0 ? (
            <div className="mt-4 rounded-md bg-warn-wash px-4 py-3 text-sm text-warn" data-testid="unregistered">
              <p>
                {unregistered.length} of {campaign.milestones.length} milestones are not registered with the milestone
                manager yet, so attestors cannot confirm them and no money can be released.
              </p>
              {unregistered[0].chainError ? <p className="mt-1">{unregistered[0].chainError}</p> : null}
              {chain.configured() ? (
                <ActionButton
                  url={`/api/v1/campaigns/${campaign.id}/milestones/define`}
                  label="Register milestones"
                  busyLabel="Registering, this can take a minute..."
                />
              ) : (
                <p className="mt-1">Milestone registration is switched off on this server.</p>
              )}
            </div>
          ) : null}
          {showViews ? (
            <ol className="divide-y divide-rule">
              {views.map((v) => (
                <MilestoneCard
                  key={v.id}
                  view={v}
                  mode="release"
                  hideCampaign
                  releasedSlot={
                    payoutsOn ? (
                      <PayoutForm
                        milestoneId={v.id}
                        beneficiaries={payable}
                        existing={getDisbursement(db, v.id)}
                        suggestedMinorUnits={releasedAmounts.get(v.index) ?? null}
                      />
                    ) : null
                  }
                />
              ))}
            </ol>
          ) : (
            <ol className="divide-y divide-rule">
              {campaign.milestones.map((m, i) => (
                <li key={m.id} className="grid gap-x-6 py-5 sm:grid-cols-[2.5rem_1fr_auto]">
                  <span aria-hidden className="font-display text-2xl text-copper">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-lg text-ink">{m.description}</p>
                    <p className="mt-1 text-sm text-dim">
                      Needs {m.requiredAttestations} independent confirmations · {m.status.toLowerCase()}
                    </p>
                  </div>
                  <p className="num mt-2 text-sm text-sand sm:mt-0 sm:text-right">
                    <span className="block font-display text-xl font-semibold text-ink">
                      {formatMinorUnits(((BigInt(campaign.fundingGoalMinorUnits) * BigInt(m.targetPct)) / 100n).toString())}
                    </span>
                    {m.targetPct}% of the goal
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>

        <aside aria-labelledby="escrow-heading" className="self-start rounded-lg border border-rule bg-panel p-5">
          <h2 id="escrow-heading" className="text-xl text-ink">
            Escrow account
          </h2>
          <p
            className={`mt-3 flex items-start gap-2 font-medium ${live ? "text-ok" : "text-warn"}`}
            data-testid="chain-status"
          >
            <span aria-hidden className={`mt-2 h-2 w-2 shrink-0 rounded-full ${live ? "bg-ok" : "border border-warn"}`} />
            {CHAIN_COPY[campaign.chainStatus]}
          </p>
          {campaign.chainError ? <p className="mt-2 text-sm text-bad">{campaign.chainError}</p> : null}
          {campaign.vaultContractAddress ? (
            <p className="mt-3 break-all rounded-md bg-well px-3 py-2 font-mono text-[13px] text-sand">
              {campaign.vaultContractAddress}
            </p>
          ) : null}
          {live || campaign.chainTxHash?.startsWith("0x") ? (
            <ul className="mt-4 divide-y divide-rule border-y border-rule text-sm">
              {live ? (
                <li>
                  <Link href={`/dashboard/campaigns/${campaign.id}/beneficiaries`} className={ROW}>
                    Manage beneficiaries <span aria-hidden>&rarr;</span>
                  </Link>
                </li>
              ) : null}
              {live ? (
                <li>
                  <Link href={`/campaigns/${campaign.id}`} className={ROW}>
                    View the public page <span aria-hidden>&rarr;</span>
                  </Link>
                </li>
              ) : null}
              {live ? (
                <li>
                  <Link href={`/activity?campaign=${campaign.id}`} className={ROW}>
                    See on-chain activity <span aria-hidden>&rarr;</span>
                  </Link>
                </li>
              ) : null}
              {campaign.chainTxHash?.startsWith("0x") ? (
                <li>
                  <a
                    className={ROW}
                    href={`https://amoy.polygonscan.com/address/${campaign.vaultContractAddress}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Inspect it on the block explorer <span aria-hidden>↗</span>
                  </a>
                </li>
              ) : null}
            </ul>
          ) : null}
          {!live ? <PublishCampaignButton campaignId={campaign.id} label="Publish to the blockchain" /> : null}
        </aside>
      </div>
    </main>
  );
}
