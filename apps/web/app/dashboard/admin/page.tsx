import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminReviewList } from "@/components/AdminReviewList";
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
  if (user.role !== "admin") redirect("/account");

  const items = listProfiles(db);
  const pending = items.filter((i) => i.kybStatus === "pending").length;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <Link href="/account" className="text-sm text-zinc-600 underline dark:text-zinc-400">
        Back to your account
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Organizer applications</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        {pending} waiting for review. Approving an organizer also records them as verified on the CampaignFactory
        contract, when on-chain sync is configured.
      </p>
      <AdminReviewList items={items} />
      <RoleManager grants={listRoleGrants(db)} />
    </main>
  );
}
