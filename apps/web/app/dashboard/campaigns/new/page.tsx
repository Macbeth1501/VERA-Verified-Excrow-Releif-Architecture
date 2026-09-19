import Link from "next/link";
import { CampaignForm } from "@/components/CampaignForm";
import { requirePageOrganizer } from "@/lib/campaigns/page-guard";

export const metadata = { title: "New campaign | VERA" };

export default async function NewCampaignPage() {
  await requirePageOrganizer();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <Link href="/dashboard/campaigns" className="text-sm text-zinc-600 underline dark:text-zinc-400">
        Back to your campaigns
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Create a campaign</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Donations go into an escrow account of their own. Money is only released once the milestones below are
        independently confirmed.
      </p>
      <CampaignForm />
    </main>
  );
}
