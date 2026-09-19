import Link from "next/link";
import { redirect } from "next/navigation";
import { MilestoneCard } from "@/components/MilestoneCard";
import { requirePageUser } from "@/lib/campaigns/page-guard";
import { escrowChain } from "@/lib/chain/manager";
import { listMilestoneViews, roleIsSynced } from "@/lib/escrow/service";

export const dynamic = "force-dynamic";
export const metadata = { title: "Council console | VERA" };

export default async function CouncilPage() {
  const { db, user } = await requirePageUser();
  if (user.role !== "council") redirect("/account");

  const chain = escrowChain();
  const synced = roleIsSynced(db, user.id, "council");
  const views = (await listMilestoneViews(db, chain)).filter((v) => v.state?.status === "Verified");
  const mine = (v: (typeof views)[number]) =>
    v.actions.some((a) => a.kind === "council_approval" && a.status === "CONFIRMED" && a.actorAddress === user.walletAddress.toLowerCase());

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <Link href="/account" className="text-sm text-zinc-600 underline dark:text-zinc-400">
        Back to your account
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Releases waiting for the council</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        These milestones have been confirmed by attestors. Small payouts are released without the council. Larger ones
        need several council members to approve, so no single person can move a large sum.
      </p>
      {!chain.configured() ? (
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Council actions are switched off on this server (the milestone manager or sponsor wallet is not configured).
        </p>
      ) : null}
      {!synced ? (
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Your council role is not registered on the blockchain yet, so you cannot approve anything. Ask an admin to sync it.
        </p>
      ) : null}
      {views.length === 0 ? (
        <p className="mt-8 text-zinc-600 dark:text-zinc-400">No verified milestones are waiting.</p>
      ) : (
        <ol className="mt-6 space-y-4">
          {views.map((v) => (
            <MilestoneCard key={v.id} view={v} mode="approve" actedByMe={mine(v)} />
          ))}
        </ol>
      )}
    </main>
  );
}
