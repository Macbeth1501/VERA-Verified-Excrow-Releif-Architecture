import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORY_LABEL } from "@/lib/campaigns/ceilings";
import { formatMinorUnits } from "@/lib/campaigns/money";
import { listByOrganizer } from "@/lib/campaigns/service";
import { vaultTotals } from "@/lib/indexer/queries";
import { getDb } from "@/lib/db";
import { getPublicProfile } from "@/lib/organizers/service";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const profile = getPublicProfile(getDb(), (await params).id);
  return { title: profile ? `${profile.legalName} | VERA` : "Organizer | VERA" };
}

export default async function OrganizerPublicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = getPublicProfile(getDb(), id);
  if (profile === null) notFound();
  const db = getDb();
  const campaigns = listByOrganizer(db, id).filter((c) => c.status === "LIVE");
  const sum = { donated: 0n, released: 0n, paidOut: 0n };
  for (const c of campaigns) {
    if (!c.vaultContractAddress) continue;
    const t = vaultTotals(db, c.vaultContractAddress);
    sum.donated += BigInt(t.totalDonated);
    sum.released += BigInt(t.totalReleased);
    sum.paidOut += BigInt(t.totalPaidOut);
  }

  return (
    <main className="w-full flex-1 py-12 lg:py-16">
      <h1 className="text-4xl text-ink sm:text-5xl">{profile.legalName}</h1>
      <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-ok/50 bg-ok-wash px-4 py-1.5 text-sm font-medium text-ok">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 3 5 6v5c0 4.5 2.9 8 7 10 4.1-2 7-5.5 7-10V6l-7-3Z" />
          <path d="m9 12 2.2 2.2L15.5 10" />
        </svg>
        Verified organizer
      </p>
      <dl className="mt-8 divide-y divide-rule border-y border-rule text-ink">
        <div className="grid gap-x-8 py-3.5 sm:grid-cols-[13rem_1fr]">
          <dt className="text-sm text-dim">Registration number</dt>
          <dd>{profile.registrationNumber}</dd>
        </div>
        <div className="grid gap-x-8 py-3.5 sm:grid-cols-[13rem_1fr]">
          <dt className="text-sm text-dim">Registered in</dt>
          <dd>{profile.jurisdiction}</dd>
        </div>
        {profile.verifiedAt ? (
          <div className="grid gap-x-8 py-3.5 sm:grid-cols-[13rem_1fr]">
          <dt className="text-sm text-dim">Verified on</dt>
            <dd>{new Date(profile.verifiedAt).toLocaleDateString("en-IN", { dateStyle: "long" })}</dd>
          </div>
        ) : null}
      </dl>

      <section className="mt-12" aria-labelledby="runs-heading">
        <h2 id="runs-heading" className="border-b border-rule pb-3 text-2xl text-ink">
          Campaigns run
        </h2>
        {campaigns.length > 0 ? (
          <dl className="num mt-4 grid grid-cols-3 gap-x-6 border-b border-rule pb-4" data-testid="organizer-totals">
            <div>
              <dt className="text-sm text-dim">Donated</dt>
              <dd className="font-display text-2xl font-semibold text-ink">{formatMinorUnits(sum.donated.toString())}</dd>
            </div>
            <div>
              <dt className="text-sm text-dim">Released to the organizer</dt>
              <dd className="font-display text-2xl font-semibold text-ink">{formatMinorUnits(sum.released.toString())}</dd>
            </div>
            <div>
              <dt className="text-sm text-dim">Paid out to beneficiaries</dt>
              <dd className="font-display text-2xl font-semibold text-ink">{formatMinorUnits(sum.paidOut.toString())}</dd>
            </div>
          </dl>
        ) : null}
        {campaigns.length === 0 ? (
          <p className="mt-4 text-sand">No campaign has been published yet.</p>
        ) : (
          <ul className="divide-y divide-rule">
            {campaigns.map((c) => {
              const t = c.vaultContractAddress ? vaultTotals(db, c.vaultContractAddress) : null;
              return (
                <li key={c.id}>
                  <Link href={`/campaigns/${c.id}`} className="group grid gap-x-8 gap-y-1 py-4 sm:grid-cols-[1fr_auto] sm:items-baseline">
                    <span>
                      <span className="block font-display text-xl text-ink group-hover:text-copper">{c.title}</span>
                      <span className="text-sm text-sand">{CATEGORY_LABEL[c.category] ?? c.category}</span>
                    </span>
                    {t ? (
                      <span className="num text-sm text-sand sm:text-right">
                        {formatMinorUnits(t.totalDonated)} donated · {formatMinorUnits(t.totalReleased)} released ·{" "}
                        {formatMinorUnits(t.totalPaidOut)} paid out
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
