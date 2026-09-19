import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/LogoutButton";
import { findUserById } from "@/lib/auth/users";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { formatRupees, getMinrBalance } from "@/lib/chain/balance";
import { getCampaign } from "@/lib/campaigns/service";
import { formatMinorUnits } from "@/lib/campaigns/money";
import { getDb } from "@/lib/db";
import { listDonations } from "@/lib/donations/service";

export const metadata = { title: "Your account | VERA" };

async function loadBalance(address: string): Promise<string | null> {
  try {
    return formatRupees(await getMinrBalance(address));
  } catch {
    return null;
  }
}

export default async function AccountPage() {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (session === null) redirect("/login");
  const user = findUserById(getDb(), session.userId);
  if (user === null) redirect("/login");

  const balance = await loadBalance(user.walletAddress);
  const db = getDb();
  const myDonations = listDonations(db, user.id).slice(0, 10);

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Your account</h1>
        <LogoutButton />
      </div>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">Signed in as {user.email}</p>

      <section className="mt-8 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-500">Your balance</h2>
        {balance !== null ? (
          <p className="mt-1 text-4xl font-semibold text-zinc-900 dark:text-zinc-50" data-testid="balance">
            {balance}
          </p>
        ) : (
          <p className="mt-1 text-lg text-amber-700 dark:text-amber-400">
            We could not load your balance right now. Please refresh in a moment.
          </p>
        )}
        <p className="mt-3 text-sm text-zinc-500">
          This is practice money on a test network, so nothing here has real value. You will be able to add funds and
          donate to campaigns soon.
        </p>
      </section>

      {myDonations.length > 0 ? (
        <section className="mt-8" aria-labelledby="donations-heading">
          <h2 id="donations-heading" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Your donations</h2>
          <ul className="mt-3 space-y-2">
            {myDonations.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                <span className="text-zinc-800 dark:text-zinc-200">
                  {formatMinorUnits(d.amountMinorUnits)} to {getCampaign(db, d.campaignId)?.title ?? "a campaign"}
                </span>
                <Link href={`/donations/${d.id}`} className="shrink-0 font-medium underline">
                  {d.status === "CONFIRMED" ? "Confirmed" : d.status === "FAILED" ? "Failed, retry" : "Pending, view"}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        {user.role === "attestor" ? (
          <Link href="/dashboard/attestor" className="font-medium text-zinc-900 underline dark:text-zinc-50">
            Open the attestor console
          </Link>
        ) : user.role === "council" ? (
          <Link href="/dashboard/council" className="font-medium text-zinc-900 underline dark:text-zinc-50">
            Open the council console
          </Link>
        ) : user.role === "admin" ? (
          <Link href="/dashboard/admin" className="font-medium text-zinc-900 underline dark:text-zinc-50">
            Open the admin console
          </Link>
        ) : (
          <Link href="/dashboard/organizer" className="font-medium text-zinc-900 underline dark:text-zinc-50">
            {user.role === "organizer" ? "Your organizer status" : "Want to run a campaign? Become an organizer"}
          </Link>
        )}
      </section>

      <details className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        <summary className="cursor-pointer font-medium">Advanced: account details</summary>
        <dl className="mt-3 space-y-2">
          <div>
            <dt className="font-medium">Wallet address</dt>
            <dd className="break-all font-mono text-xs">{user.walletAddress}</dd>
          </div>
          <div>
            <dt className="font-medium">Wallet type</dt>
            <dd>{user.walletType === "generated" ? "Created for you by VERA" : "Your own wallet"}</dd>
          </div>
        </dl>
      </details>
    </main>
  );
}
