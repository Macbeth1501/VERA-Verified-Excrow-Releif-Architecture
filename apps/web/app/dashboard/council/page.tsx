import { redirect } from "next/navigation";
import { MilestoneCard } from "@/components/MilestoneCard";
import { PageHead } from "@/components/PageHead";
import { requirePageUser } from "@/lib/campaigns/page-guard";
import { escrowChain } from "@/lib/chain/manager";
import { listMilestoneViews, roleIsSynced } from "@/lib/escrow/service";

export const dynamic = "force-dynamic";
export const metadata = { title: "Council console | VERA" };

export default async function CouncilPage() {
  const { db, user } = await requirePageUser();
  if (user.role !== "council") redirect("/dashboard");

  const chain = escrowChain();
  const synced = roleIsSynced(db, user.id, "council");
  const views = (await listMilestoneViews(db, chain)).filter((v) => v.state?.status === "Verified");
  const mine = (v: (typeof views)[number]) =>
    v.actions.some((a) => a.kind === "council_approval" && a.status === "CONFIRMED" && a.actorAddress === user.walletAddress.toLowerCase());

  return (
    <main className="w-full max-w-4xl flex-1 py-12 lg:py-16">
      <PageHead title="Releases waiting for the council" lead="These milestones have been confirmed by attestors. Small payouts are released without the council. Larger ones need several council members to approve, so no single person can move a large sum." />
      {!chain.configured() ? (
        <p className="mt-6 max-w-[62ch] rounded-md bg-warn-wash px-4 py-3 text-sm text-warn">
          Council actions are switched off on this server (the milestone manager or sponsor wallet is not configured).
        </p>
      ) : null}
      {!synced ? (
        <p className="mt-6 max-w-[62ch] rounded-md bg-warn-wash px-4 py-3 text-sm text-warn">
          Your council role is not registered on the blockchain yet, so you cannot approve anything. Ask an admin to sync it.
        </p>
      ) : null}
      {views.length === 0 ? (
        <p className="mt-10 border-y border-rule py-6 text-sand">No verified milestones are waiting.</p>
      ) : (
        <ol className="mt-10 divide-y divide-rule border-y border-rule">
          {views.map((v) => (
            <MilestoneCard key={v.id} view={v} mode="approve" actedByMe={mine(v)} />
          ))}
        </ol>
      )}
    </main>
  );
}
