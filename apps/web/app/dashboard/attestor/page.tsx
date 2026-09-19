import Link from "next/link";
import { redirect } from "next/navigation";
import { MilestoneCard } from "@/components/MilestoneCard";
import { requirePageUser } from "@/lib/campaigns/page-guard";
import { escrowChain } from "@/lib/chain/manager";
import { listMilestoneViews, roleIsSynced } from "@/lib/escrow/service";

export const dynamic = "force-dynamic";
export const metadata = { title: "Attestor console | VERA" };

export default async function AttestorPage() {
  const { db, user } = await requirePageUser();
  if (user.role !== "attestor") redirect("/account");

  const chain = escrowChain();
  const synced = roleIsSynced(db, user.id, "attestor");
  const views = (await listMilestoneViews(db, chain)).filter((v) => v.definedOnChain && v.state?.status !== "Released");
  const mine = (v: (typeof views)[number]) =>
    v.actions.some((a) => a.kind === "attestation" && a.status === "CONFIRMED" && a.actorAddress === user.walletAddress.toLowerCase());

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <Link href="/account" className="text-sm text-zinc-600 underline dark:text-zinc-400">
        Back to your account
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Milestones waiting for confirmation</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        You confirm that a milestone is really done. Money is released only after enough independent attestors agree,
        and no one can release it alone.
      </p>
      {!chain.configured() ? (
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Milestone confirmations are switched off on this server (the milestone manager or sponsor wallet is not configured).
        </p>
      ) : null}
      {!synced ? (
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Your attestor role is not registered on the blockchain yet, so you cannot confirm anything. Ask an admin to sync it.
        </p>
      ) : null}
      {views.length === 0 ? (
        <p className="mt-8 text-zinc-600 dark:text-zinc-400">Nothing to confirm right now.</p>
      ) : (
        <ol className="mt-6 space-y-4">
          {views.map((v) => (
            <MilestoneCard key={v.id} view={v} mode="attest" actedByMe={mine(v)} />
          ))}
        </ol>
      )}
    </main>
  );
}
