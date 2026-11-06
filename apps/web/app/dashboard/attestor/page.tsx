import { and, eq, isNotNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { BeneficiaryVerifyForm } from "@/components/BeneficiaryVerifyForm";
import { MilestoneCard } from "@/components/MilestoneCard";
import { PageHead } from "@/components/PageHead";
import { requirePageUser } from "@/lib/campaigns/page-guard";
import { escrowChain } from "@/lib/chain/manager";
import { beneficiaryVerifiesOnChain } from "@/lib/beneficiary/verification";
import { campaigns } from "@/lib/db/schema";
import { listMilestoneViews, roleIsSynced } from "@/lib/escrow/service";

export const dynamic = "force-dynamic";
export const metadata = { title: "Attestor console | VERA" };

/** Attestor console. Attestors only: lists milestones awaiting confirmation so an attestor can sign off that the work is done. */
export default async function AttestorPage() {
  const { db, user } = await requirePageUser();
  if (user.role !== "attestor") redirect("/dashboard");

  const chain = escrowChain();
  const synced = roleIsSynced(db, user.id, "attestor");
  const views = (await listMilestoneViews(db, chain)).filter((v) => v.definedOnChain && v.state?.status !== "Released");
  const liveCampaigns = db
    .select({ id: campaigns.id, title: campaigns.title })
    .from(campaigns)
    .where(and(eq(campaigns.status, "LIVE"), isNotNull(campaigns.vaultContractAddress)))
    .all();
  const onChain = beneficiaryVerifiesOnChain();
  const mine = (v: (typeof views)[number]) =>
    v.actions.some((a) => a.kind === "attestation" && a.status === "CONFIRMED" && a.actorAddress === user.walletAddress.toLowerCase());

  return (
    <main className="w-full max-w-4xl flex-1 py-12 lg:py-16">
      <PageHead title="Milestones waiting for confirmation" lead="You confirm that a milestone is really done. Money is released only after enough independent attestors agree, and no one can release it alone." />
      {!chain.configured() ? (
        <p className="mt-6 max-w-[62ch] rounded-md bg-warn-wash px-4 py-3 text-sm text-warn">
          Milestone confirmations are switched off on this server (the milestone manager or sponsor wallet is not configured).
        </p>
      ) : null}
      {!synced ? (
        <p className="mt-6 max-w-[62ch] rounded-md bg-warn-wash px-4 py-3 text-sm text-warn">
          Your attestor role is not registered on the blockchain yet, so you cannot confirm anything. Ask an admin to sync it.
        </p>
      ) : null}
      {views.length === 0 ? (
        <p className="mt-10 border-y border-rule py-6 text-sand">Nothing to confirm right now.</p>
      ) : (
        <ol className="mt-10 divide-y divide-rule border-y border-rule">
          {views.map((v) => (
            <MilestoneCard key={v.id} view={v} mode="attest" actedByMe={mine(v)} />
          ))}
        </ol>
      )}

      <section className="mt-14" aria-labelledby="verify-heading">
        <h2 id="verify-heading" className="border-b border-rule pb-3 text-2xl text-ink">
          Verify beneficiaries
        </h2>
        <p className="mt-3 max-w-[62ch] text-sand">
          An organizer can register people who do not exist. When you have met a beneficiary in person, confirm them here. A payout
          to someone no attestor has confirmed is refused.{" "}
          {onChain
            ? "Your confirmation is also recorded on the blockchain from your own wallet, and the payout contract itself refuses anyone no attestor has confirmed."
            : "This check is made by VERA's servers and database; the blockchain does not enforce it."}
        </p>
        <BeneficiaryVerifyForm campaigns={liveCampaigns} />
      </section>
    </main>
  );
}
