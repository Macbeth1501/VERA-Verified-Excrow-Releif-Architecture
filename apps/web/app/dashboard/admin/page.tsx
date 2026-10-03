import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminReviewList } from "@/components/AdminReviewList";
import { PageHead } from "@/components/PageHead";
import { RoleManager } from "@/components/RoleManager";
import { findUserById } from "@/lib/auth/users";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { listRoleGrants } from "@/lib/escrow/service";
import { listProfiles } from "@/lib/organizers/service";

export const metadata = { title: "Admin console | VERA" };

export default async function AdminPage() {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (session === null) redirect("/login");
  const db = getDb();
  const user = findUserById(db, session.userId);
  if (user === null) redirect("/login");
  // The API enforces this too; redirecting here just avoids showing a dead page.
  if (user.role !== "admin") redirect("/dashboard");

  // Waiting applications first: they are the admin's work.
  const rank = { pending: 0, rejected: 1, verified: 2 } as const;
  const items = listProfiles(db).sort((a, b) => rank[a.kybStatus] - rank[b.kybStatus]);
  const pending = items.filter((i) => i.kybStatus === "pending").length;

  return (
    <main className="w-full max-w-4xl flex-1 py-12 lg:py-16">
      <PageHead
        title="Admin console"
        lead="Review organizer applications and appoint the attestors and council members who keep releases honest."
      />
      <section className="mt-12" aria-labelledby="applications-heading">
        <h2 id="applications-heading" className="border-b border-rule pb-3 text-2xl text-ink">
          Organizer applications
        </h2>
        <p className="mt-3 max-w-[62ch] text-sand">
          {pending} waiting for review. Approving an organizer also records them as verified on the CampaignFactory
          contract, when on-chain sync is configured.
        </p>
        <AdminReviewList items={items} />
      </section>
      <RoleManager grants={listRoleGrants(db)} />
    </main>
  );
}
