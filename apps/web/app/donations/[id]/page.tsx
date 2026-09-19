import Link from "next/link";
import { notFound } from "next/navigation";
import { DonationProgress } from "@/components/DonationProgress";
import { requirePageUser } from "@/lib/campaigns/page-guard";
import { getCampaign } from "@/lib/campaigns/service";
import { DonationNotFoundError, getDonation } from "@/lib/donations/service";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your donation | VERA" };

/** A donor's receipt. A donation that is still pending resumes here, so leaving the page loses nothing. */
export default async function DonationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, user } = await requirePageUser();
  let donation;
  try {
    donation = getDonation(db, id, user.id);
  } catch (err) {
    if (err instanceof DonationNotFoundError) notFound();
    throw err;
  }
  const campaign = getCampaign(db, donation.campaignId);

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-16">
      <Link href="/account" className="text-sm text-zinc-600 underline dark:text-zinc-400">
        Back to your account
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Your donation</h1>
      {campaign ? <p className="mt-1 text-zinc-600 dark:text-zinc-400">To {campaign.title}</p> : null}
      <div className="mt-6">
        <DonationProgress initial={donation} campaignHref={`/campaigns/${donation.campaignId}`} />
      </div>
    </main>
  );
}
