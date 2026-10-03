import Link from "next/link";
import { PageHead } from "@/components/PageHead";
import { listByOrganizer } from "@/lib/campaigns/service";
import { formatMinorUnits } from "@/lib/campaigns/money";
import { CATEGORY_LABEL } from "@/lib/campaigns/ceilings";
import { requirePageOrganizer } from "@/lib/campaigns/page-guard";

export const metadata = { title: "Your campaigns | VERA" };

export default async function CampaignsPage() {
  const { db, profile } = await requirePageOrganizer();
  const campaigns = listByOrganizer(db, profile.id);

  return (
    <main className="w-full max-w-4xl flex-1 py-12 lg:py-16">
      <PageHead
        title="Your campaigns"
        lead="Each live campaign holds its money in an escrow account of its own. Open one to register milestones, release funds and record payouts."
        aside={
          <Link
            href="/dashboard/campaigns/new"
            className="rounded-md bg-copper px-5 py-2.5 text-sm font-semibold text-on-copper hover:bg-copper-hover"
          >
            New campaign
          </Link>
        }
      />

      {campaigns.length === 0 ? (
        <p className="mt-10 border-y border-rule py-6 text-sand">
          You have not created a campaign yet. Start one to open an escrow account for your cause.
        </p>
      ) : (
        <ul className="mt-10 border-t border-rule">
          {campaigns.map((c) => (
            <li key={c.id} className="border-b border-rule">
              <Link
                href={`/dashboard/campaigns/${c.id}`}
                className="group grid gap-x-10 gap-y-2 py-6 sm:grid-cols-[1fr_auto] sm:items-baseline"
              >
                <span className="min-w-0">
                  <span className="block font-display text-2xl text-ink group-hover:text-copper">{c.title}</span>
                  <span className="num mt-1 block text-sm text-sand">
                    {CATEGORY_LABEL[c.category] ?? c.category} · goal {formatMinorUnits(c.fundingGoalMinorUnits)} ·{" "}
                    {c.milestones.length} {c.milestones.length === 1 ? "milestone" : "milestones"}
                  </span>
                </span>
                {c.status === "LIVE" ? (
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-ok">
                    <span aria-hidden className="h-2 w-2 rounded-full bg-ok" />
                    Live, with escrow
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-warn">
                    <span aria-hidden className="h-2 w-2 rounded-full border border-warn" />
                    Draft, not published yet
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
