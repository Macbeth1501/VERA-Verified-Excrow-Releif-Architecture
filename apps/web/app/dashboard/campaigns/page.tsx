import Link from "next/link";
import { listByOrganizer } from "@/lib/campaigns/service";
import { formatMinorUnits } from "@/lib/campaigns/money";
import { CATEGORY_LABEL } from "@/lib/campaigns/ceilings";
import { requirePageOrganizer } from "@/lib/campaigns/page-guard";

export const metadata = { title: "Your campaigns | VERA" };

export default async function CampaignsPage() {
  const { db, profile } = await requirePageOrganizer();
  const campaigns = listByOrganizer(db, profile.id);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <Link href="/account" className="text-sm text-zinc-600 underline dark:text-zinc-400">
        Back to your account
      </Link>
      <div className="mt-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Your campaigns</h1>
        <Link
          href="/dashboard/campaigns/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900"
        >
          New campaign
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <p className="mt-8 text-zinc-600 dark:text-zinc-400">
          You have not created a campaign yet. Start one to open an escrow account for your cause.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {campaigns.map((c) => (
            <li key={c.id} className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
              <Link href={`/dashboard/campaigns/${c.id}`} className="font-medium text-zinc-900 underline dark:text-zinc-50">
                {c.title}
              </Link>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {CATEGORY_LABEL[c.category]} · Goal {formatMinorUnits(c.fundingGoalMinorUnits)} · {c.milestones.length}{" "}
                milestones
              </p>
              <p className="mt-1 text-sm font-medium">
                {c.status === "LIVE" ? (
                  <span className="text-emerald-700 dark:text-emerald-400">Live, with escrow</span>
                ) : (
                  <span className="text-amber-700 dark:text-amber-400">Draft, not published yet</span>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
