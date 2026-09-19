import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getPublicProfile } from "@/lib/organizers/service";

export const dynamic = "force-dynamic";

export default async function OrganizerPublicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = getPublicProfile(getDb(), id);
  if (profile === null) notFound();

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-16">
      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Verified organizer</p>
      <h1 className="mt-1 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">{profile.legalName}</h1>
      <dl className="mt-6 space-y-3 text-zinc-700 dark:text-zinc-300">
        <div>
          <dt className="text-sm text-zinc-500">Registration number</dt>
          <dd>{profile.registrationNumber}</dd>
        </div>
        <div>
          <dt className="text-sm text-zinc-500">Registered in</dt>
          <dd>{profile.jurisdiction}</dd>
        </div>
        {profile.verifiedAt ? (
          <div>
            <dt className="text-sm text-zinc-500">Verified on</dt>
            <dd>{new Date(profile.verifiedAt).toLocaleDateString("en-IN", { dateStyle: "long" })}</dd>
          </div>
        ) : null}
      </dl>
    </main>
  );
}
