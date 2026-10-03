import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OrganizerApplyForm } from "@/components/OrganizerApplyForm";
import { PageHead } from "@/components/PageHead";
import { findUserById } from "@/lib/auth/users";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { getProfileByUser } from "@/lib/organizers/service";

export const metadata = { title: "Organizer status | VERA" };

const STATUS_COPY = {
  pending: {
    title: "Under review",
    tone: "border-warn/50 bg-warn-wash text-warn",
    dot: "border border-warn",
    body: "An administrator is reviewing your application. You cannot create campaigns until it is approved.",
  },
  verified: {
    title: "Verified",
    tone: "border-ok/50 bg-ok-wash text-ok",
    dot: "bg-ok",
    body: "Your organization is verified. You can create campaigns.",
  },
  rejected: {
    title: "Not approved",
    tone: "border-bad/50 bg-bad-wash text-bad",
    dot: "bg-bad",
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
    <main className="w-full max-w-4xl flex-1 py-12 lg:py-16">
      <PageHead
        title={profile ? "Organizer status" : "Become an organizer"}
        lead={
          profile
            ? undefined
            : "Only verified organizations can start campaigns. Tell us about your organization and an administrator will review it."
        }
      />

      {profile && status ? (
        <section className="mt-10" aria-label="Application status">
          <p
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium ${status.tone}`}
            data-testid="kyb-status"
          >
            <span aria-hidden className={`h-2 w-2 rounded-full ${status.dot}`} />
            {status.title}
          </p>
          <p className="mt-3 max-w-[62ch] text-lg text-sand">{status.body}</p>
          {profile.kybStatus === "rejected" && profile.rejectionReason ? (
            <p className="mt-3 max-w-[62ch] rounded-md bg-bad-wash px-4 py-3 text-bad">
              Reason: {profile.rejectionReason}
            </p>
          ) : null}
          <dl className="mt-8 divide-y divide-rule border-y border-rule text-ink">
            <div className="grid gap-x-8 py-3.5 sm:grid-cols-[13rem_1fr]">
              <dt className="text-sm text-dim">Organization</dt>
              <dd>{profile.legalName}</dd>
            </div>
            <div className="grid gap-x-8 py-3.5 sm:grid-cols-[13rem_1fr]">
              <dt className="text-sm text-dim">Registration number</dt>
              <dd>{profile.registrationNumber}</dd>
            </div>
            <div className="grid gap-x-8 py-3.5 sm:grid-cols-[13rem_1fr]">
              <dt className="text-sm text-dim">Registered in</dt>
              <dd>{profile.jurisdiction}</dd>
            </div>
          </dl>
          {profile.kybStatus === "verified" ? (
            <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3">
              <Link
                href="/dashboard/campaigns"
                className="rounded-md bg-copper px-5 py-2.5 text-sm font-semibold text-on-copper hover:bg-copper-hover"
              >
                Your campaigns
              </Link>
              <Link href={`/organizers/${profile.id}`} className="inline-flex min-h-8 items-center text-sm font-medium underline">
                View your public profile
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}

      {!profile || profile.kybStatus === "rejected" ? (
        <div className={profile ? "mt-14" : ""}>
          {profile ? <h2 className="text-2xl text-ink">Apply again</h2> : null}
          <OrganizerApplyForm />
        </div>
      ) : null}
    </main>
  );
}
