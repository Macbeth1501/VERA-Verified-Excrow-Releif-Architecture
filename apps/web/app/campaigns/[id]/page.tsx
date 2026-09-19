import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DonatePanel, type DonateState } from "@/components/DonatePanel";
import { LedgerDashboard } from "@/components/LedgerDashboard";
import { buildDashboard } from "@/lib/campaigns/dashboard";
import { getOptionalPageUser } from "@/lib/campaigns/page-guard";
import { getCampaign } from "@/lib/campaigns/service";
import { donationsConfigured } from "@/lib/chain/donations";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { indexerRuntime } from "@/lib/indexer/runtime";

// Always rendered on request: this page shows live chain data and must never be cached.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const campaign = getCampaign(getDb(), id);
  return { title: campaign && campaign.status === "LIVE" ? `${campaign.title} | VERA` : "Campaign | VERA" };
}

/** The public, login-free audit page for a campaign (FR-LDG-01), with the donation panel (FR-CMP-02). */
export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await buildDashboard(getDb(), indexerRuntime(), id);
  if (data === null) notFound();

  const user = await getOptionalPageUser();
  let state: DonateState = "ready";
  if (!user) state = "signed_out";
  else if (user.walletType !== "generated") state = "own_wallet";
  else if (!donationsConfigured()) state = "off";

  const donate = (
    <DonatePanel
      campaignId={id}
      campaignHref={`/campaigns/${id}`}
      state={state}
      feeMinorUnits={String(getEnv().PLATFORM_FEE_MINOR_UNITS)}
    />
  );
  return <LedgerDashboard initial={data} donateSlot={donate} />;
}
