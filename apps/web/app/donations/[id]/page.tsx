import { notFound } from "next/navigation";
import { DonationProgress } from "@/components/DonationProgress";
import { PageHead } from "@/components/PageHead";
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
    <main className="w-full max-w-4xl flex-1 py-12 lg:py-16">
      <PageHead
        back={{ href: "/dashboard/donor", label: "Your account" }}
        title="Your donation"
        lead={campaign ? `To ${campaign.title}` : undefined}
      />
      <div className="mt-10 max-w-2xl">
        <DonationProgress initial={donation} campaignHref={`/campaigns/${donation.campaignId}`} />
      </div>
    </main>
  );
}
