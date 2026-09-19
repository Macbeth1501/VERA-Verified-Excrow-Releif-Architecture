import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OrganizerApplyForm } from "@/components/OrganizerApplyForm";
import { findUserById } from "@/lib/auth/users";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { getProfileByUser } from "@/lib/organizers/service";

export const metadata = { title: "Become an organizer | VERA" };

const STATUS_COPY = {
  pending: {
    title: "Under review",
    tone: "text-amber-700 dark:text-amber-400",
    body: "An administrator is reviewing your application. You cannot create campaigns until it is approved.",
  },
  verified: {
    title: "Verified",
    tone: "text-emerald-700 dark:text-emerald-400",
    body: "Your organization is verified. You can create campaigns.",
  },
  rejected: {
    title: "Not approved",
    tone: "text-red-700 dark:text-red-400",
    body: "Your application was not approved. You can fix the issue and apply again.",
  },
} as const;

export default async function OrganizerPage() {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (session === null) redirect("/login");
  const db = getDb();
  const user = findUserById(db, session.userId);
  if (user === null) redirect("/login");
  if (user.role === "admin") redirect("/dashboard/admin");

  const profile = getProfileByUser(db, user.id);
  const status = profile ? STATUS_COPY[profile.kybStatus] : null;

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-16">
      <Link href="/account" className="text-sm text-zinc-600 underline dark:text-zinc-400">
        Back to your account
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Become an organizer</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Only verified organizations can start campaigns. Tell us about your organization and an administrator will
        review it.
      </p>

      {profile && status ? (
        <section className="mt-8 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
          <p className={`text-lg font-semibold ${status.tone}`} data-testid="kyb-status">
            {status.title}
          </p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{status.body}</p>
          {profile.kybStatus === "rejected" && profile.rejectionReason ? (
            <p className="mt-3 text-sm text-zinc-800 dark:text-zinc-200">Reason: {profile.rejectionReason}</p>
          ) : null}
          <div className="mt-4 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
            <div>{profile.legalName}</div>
            <div>
              Registration {profile.registrationNumber}, {profile.jurisdiction}
            </div>
          </div>
          {profile.kybStatus === "verified" ? (
            <div className="mt-4 flex gap-4 text-sm font-medium">
              <Link href="/dashboard/campaigns" className="underline">
                Your campaigns
              </Link>
              <Link href={`/organizers/${profile.id}`} className="underline">
                View your public profile
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}

      {!profile || profile.kybStatus === "rejected" ? <OrganizerApplyForm /> : null}
    </main>
  );
}
