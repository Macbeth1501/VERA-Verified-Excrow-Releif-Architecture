import Link from "next/link";
import { StageRail, type StageKey } from "@/components/StageRail";
import { networkTotals, type NetworkTotals } from "@/lib/campaigns/network";
import { formatMinorUnits } from "@/lib/campaigns/money";
import { getDb } from "@/lib/db";
import { indexerRuntime, syncWithinBudget } from "@/lib/indexer/runtime";

export const dynamic = "force-dynamic";

/** Live totals for the rail, or null when the chain reader is off or nothing is published: never a made-up figure. */
async function loadTotals(): Promise<NetworkTotals | null> {
  const runtime = indexerRuntime();
  if (!runtime) return null;
  const db = getDb();
  try {
    await syncWithinBudget(db, runtime);
  } catch {
    // Show what is already indexed rather than fail the home page.
  }
  return networkTotals(db);
}

export default async function Home() {
  const totals = await loadTotals();
  const figures: Partial<Record<StageKey, string>> | undefined = totals
    ? {
        locked: `${formatMinorUnits(totals.donated)} donated`,
        confirmed: `${totals.confirmedMilestones} ${totals.confirmedMilestones === 1 ? "milestone" : "milestones"}`,
        released: formatMinorUnits(totals.released),
        paid: formatMinorUnits(totals.paidOut),
      }
    : undefined;

  return (
    <main className="grid flex-1 items-center gap-x-20 gap-y-14 py-16 lg:grid-cols-12 lg:py-24">
      <section className="lg:col-span-7">
        <h1 className="max-w-[16ch] text-5xl leading-[1.05] text-ink sm:text-6xl">Money that moves only when the work is done.</h1>
        <p className="mt-6 max-w-[52ch] text-lg text-sand">
          Every donation is locked in a public escrow account. Independent people confirm each stage of the work on the ground before
          a rupee is released, and every step can be checked on the blockchain by anyone.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
          <Link
            href="/campaigns"
            className="inline-flex min-h-11 items-center rounded-md bg-copper px-6 font-medium text-on-copper hover:bg-copper-hover"
          >
            Browse campaigns
          </Link>
          <Link href="/activity" className="inline-flex min-h-11 items-center font-medium text-ink underline decoration-copper decoration-2 underline-offset-[6px] hover:text-copper">
            See every transaction
          </Link>
        </div>
        <p className="mt-10 max-w-[52ch] text-sm text-dim">
          This is a testnet demonstration. The money is practice money and no real funds are involved, but every transaction shown is
          real and public.
        </p>
      </section>

      <section className="lg:col-span-5" aria-labelledby="rail-heading">
        <h2 id="rail-heading" className="mb-7 text-2xl text-ink">
          Follow one donation
        </h2>
        <StageRail figures={figures} />
        {totals ? (
          <p className="mt-8 text-sm text-dim" data-testid="home-freshness">
            Read live from the blockchain across {totals.campaigns} {totals.campaigns === 1 ? "campaign" : "campaigns"}
            {totals.indexedThroughBlock !== null ? `, as of block ${totals.indexedThroughBlock.toLocaleString("en-US")}` : ""}.
          </p>
        ) : null}
      </section>
    </main>
  );
}
