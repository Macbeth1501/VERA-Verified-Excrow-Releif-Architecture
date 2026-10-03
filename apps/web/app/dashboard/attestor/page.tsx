import { redirect } from "next/navigation";
import { MilestoneCard } from "@/components/MilestoneCard";
import { PageHead } from "@/components/PageHead";
import { requirePageUser } from "@/lib/campaigns/page-guard";
import { escrowChain } from "@/lib/chain/manager";
import { listMilestoneViews, roleIsSynced } from "@/lib/escrow/service";

export const dynamic = "force-dynamic";
export const metadata = { title: "Attestor console | VERA" };

export default async function AttestorPage() {
  const { db, user } = await requirePageUser();
  if (user.role !== "attestor") redirect("/dashboard");

  const chain = escrowChain();
  const synced = roleIsSynced(db, user.id, "attestor");
  const views = (await listMilestoneViews(db, chain)).filter((v) => v.definedOnChain && v.state?.status !== "Released");
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
    </main>
  );
}
