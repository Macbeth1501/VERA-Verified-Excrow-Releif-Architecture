import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminReviewList } from "@/components/AdminReviewList";
import { PageHead } from "@/components/PageHead";
import { CouncilThresholdManager } from "@/components/CouncilThresholdManager";
import { ReleaseLimitManager } from "@/components/ReleaseLimitManager";
import { RoleManager } from "@/components/RoleManager";
import { escrowChain } from "@/lib/chain/manager";
import { campaigns } from "@/lib/db/schema";
import { getReleaseLimit } from "@/lib/escrow/limits";
import { getThreshold } from "@/lib/escrow/threshold";
import { findUserById } from "@/lib/auth/users";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { countSyncedRole, listRoleGrants, maxOpenRequirement } from "@/lib/escrow/service";
import { listProfiles } from "@/lib/organizers/service";

export const metadata = { title: "Admin console | VERA" };

/** Admin console. Admins only (anyone else is redirected): organizer verification review and role management. */
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

  // C3 (warn only): removing an attestor must not strand a live milestone that needs them all.
  const attestors = countSyncedRole(db, "attestor");
  const needed = maxOpenRequirement(db);
  const attestorWarning =
    needed > 0 && attestors <= needed
      ? `Live milestones need up to ${needed} confirmations and ${attestors} attestor${attestors === 1 ? " is" : "s are"} registered. ${
          attestors < needed ? "Some milestones cannot be verified until more attestors are added." : "Removing any attestor would leave some milestones unable to be verified."
        }`
      : null;

  const limit = await getReleaseLimit(escrowChain());
  const threshold = await getThreshold(db, escrowChain());
  const goals = db.select({ goal: campaigns.fundingGoal }).from(campaigns).all();
  const largestGoal = goals.reduce<bigint | null>((max, g) => (max === null || BigInt(g.goal) > max ? BigInt(g.goal) : max), null)?.toString() ?? null;

  return (
    <main className="w-full max-w-4xl flex-1 py-12 lg:py-16">
      <PageHead
        title="Admin console"
        lead="Review organizer applications and appoint the attestors and council members who keep releases honest."
      />
      <p className="mt-6">
        <Link href="/dashboard/admin/users" className="text-sand underline hover:text-copper" data-testid="users-link">
          See all registered users and their email addresses &rarr;
        </Link>
      </p>
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
      {attestorWarning ? (
        <p role="note" data-testid="attestor-warning" className="mt-12 max-w-[62ch] rounded-md bg-warn-wash px-3 py-2 text-sm text-warn">
          {attestorWarning}
        </p>
      ) : null}
      <RoleManager grants={listRoleGrants(db)} />
      <ReleaseLimitManager configured={limit.configured} limitMinorUnits={limit.limitMinorUnits} largestGoalMinorUnits={largestGoal} />
      <CouncilThresholdManager
        configured={threshold.configured}
        threshold={threshold.threshold}
        councilMembers={threshold.councilMembers}
        inFlight={threshold.inFlight}
      />
    </main>
  );
}
