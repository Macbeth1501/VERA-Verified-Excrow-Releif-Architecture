import { CampaignForm } from "@/components/CampaignForm";
import { PageHead } from "@/components/PageHead";
import { requirePageOrganizer } from "@/lib/campaigns/page-guard";

export const metadata = { title: "New campaign | VERA" };

export default async function NewCampaignPage() {
  await requirePageOrganizer();

  return (
    <main className="w-full max-w-4xl flex-1 py-12 lg:py-16">
      <PageHead
        back={{ href: "/dashboard/campaigns", label: "Your campaigns" }}
        title="Create a campaign"
        lead="Donations go into an escrow account of their own. Money is only released once the milestones below are independently confirmed."
      />
      <CampaignForm />
    </main>
  );
}
