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
    <main className="w-full flex-1 py-12 lg:py-16">
      <h1 className="text-4xl text-ink sm:text-5xl">Campaigns</h1>
      <p className="mt-3 max-w-[56ch] text-lg text-sand">
        Every campaign here holds its money in a public escrow account you can inspect yourself.
      </p>

      {campaigns.length === 0 ? (
        <p className="mt-10 border-y border-rule py-6 text-sand">
          No campaigns have been published yet. When an organizer publishes one, it appears here with its escrow account.
        </p>
      ) : (
        <ul className="mt-10 border-t border-rule">
          {campaigns.map((c) => {
            const totals = c.vaultContractAddress ? vaultTotals(db, c.vaultContractAddress) : null;
            return (
              <li key={c.id} className="border-b border-rule">
                <Link href={`/campaigns/${c.id}`} className="group grid gap-x-10 gap-y-2 py-6 sm:grid-cols-[1fr_auto] sm:items-baseline">
                  <span className="min-w-0">
                    <span className="block font-display text-2xl text-ink group-hover:text-copper">{c.title}</span>
                    <span className="mt-1 block text-sm text-sand">
                      {CATEGORY_LABEL[c.category]} · goal {formatMinorUnits(c.fundingGoalMinorUnits)}
                    </span>
                  </span>
                  {totals ? (
                    <span className="num text-sm text-sand sm:text-right">
                      <span className="block font-display text-2xl font-semibold text-ink">{formatMinorUnits(totals.totalDonated)}</span>
                      donated
                      <span className="mt-1 block text-dim">
                        {BigInt(totals.balance) === 0n && BigInt(totals.totalDonated) > 0n
                          ? "All released"
                          : `${formatMinorUnits(totals.balance)} still held in escrow`}
                        {" · "}
                        {formatMinorUnits(totals.totalPaidOut)} paid out
                      </span>
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-10 max-w-[62ch] text-sm text-dim">
        Released means moved to the organizer after independent confirmation; paid out means recorded to a registered beneficiary.{" "}
        <Link href="/how-it-works" className="underline">
          How VERA works
        </Link>
        .
      </p>
    </main>
  );
}
