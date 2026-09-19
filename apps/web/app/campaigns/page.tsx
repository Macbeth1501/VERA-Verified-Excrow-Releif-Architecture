import Link from "next/link";
import { CATEGORY_LABEL } from "@/lib/campaigns/ceilings";
import { formatMinorUnits } from "@/lib/campaigns/money";
import { listLive } from "@/lib/campaigns/service";
import { getDb } from "@/lib/db";
import { vaultTotals } from "@/lib/indexer/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Campaigns | VERA" };

export default function CampaignsIndexPage() {
  const db = getDb();
  const campaigns = listLive(db);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Campaigns</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Every campaign here holds its money in a public escrow account you can inspect yourself.
      </p>

      {campaigns.length === 0 ? (
        <p className="mt-8 text-zinc-600 dark:text-zinc-400">No campaigns have been published yet.</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {campaigns.map((c) => {
            const totals = c.vaultContractAddress ? vaultTotals(db, c.vaultContractAddress) : null;
            return (
              <li key={c.id} className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
                <Link href={`/campaigns/${c.id}`} className="text-lg font-medium text-zinc-900 underline dark:text-zinc-50">
                  {c.title}
                </Link>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {CATEGORY_LABEL[c.category]} · goal {formatMinorUnits(c.fundingGoalMinorUnits)}
                  {totals ? ` · ${formatMinorUnits(totals.totalDonated)} held in escrow` : ""}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
