import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHead } from "@/components/PageHead";
import { findUserById } from "@/lib/auth/users";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { formatRupees, getMinrBalance } from "@/lib/chain/balance";
import { getCampaign } from "@/lib/campaigns/service";
import { formatMinorUnits } from "@/lib/campaigns/money";
import { getDb } from "@/lib/db";
import { listDonations } from "@/lib/donations/service";

export const metadata = { title: "Your account | VERA" };
export const dynamic = "force-dynamic";

async function loadBalance(address: string): Promise<string | null> {
  try {
    return formatRupees(await getMinrBalance(address));
  } catch {
    return null;
  }
}

const DONATION_STATE = {
  CONFIRMED: { label: "Confirmed", tone: "text-ok", dot: "bg-ok" },
  FAILED: { label: "Failed, retry", tone: "text-bad", dot: "bg-bad" },
  PENDING: { label: "Pending, view", tone: "text-warn", dot: "border border-warn" },
} as const;

export default async function AccountPage() {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (session === null) redirect("/login");
  const user = findUserById(getDb(), session.userId);
  if (user === null) redirect("/login");

  const balance = await loadBalance(user.walletAddress);
  const db = getDb();
  const myDonations = listDonations(db, user.id).slice(0, 10);

  const workspace =
    user.role === "attestor"
      ? { href: "/dashboard/attestor", label: "Open the attestor console" }
      : user.role === "council"
        ? { href: "/dashboard/council", label: "Open the council console" }
        : user.role === "admin"
          ? { href: "/dashboard/admin", label: "Open the admin console" }
          : {
              href: "/dashboard/organizer",
              label: user.role === "organizer" ? "Your organizer status" : "Want to run a campaign? Become an organizer",
            };

  return (
    <main className="w-full max-w-4xl flex-1 py-12 lg:py-16">
      <PageHead title="Your account" lead={`Signed in as ${user.email}`} />

      <section aria-labelledby="balance-heading" className="mt-10 border-y border-rule py-6">
        <h2 id="balance-heading" className="font-sans text-sm font-medium text-dim">
          Your balance
        </h2>
        {balance !== null ? (
          <p className="num mt-1 font-display text-5xl font-semibold text-ink" data-testid="balance">
            {balance}
          </p>
        ) : (
          <p className="mt-1 text-lg text-warn">We could not load your balance right now. Please refresh in a moment.</p>
        )}
        <p className="mt-3 max-w-[62ch] text-sm text-dim">
          This is practice money on a test network, so nothing here has real value. You can add funds and donate to a
          campaign from its public page.
        </p>
      </section>

      {myDonations.length > 0 ? (
        <section className="mt-12" aria-labelledby="donations-heading">
          <h2 id="donations-heading" className="border-b border-rule pb-3 text-2xl text-ink">
            Your donations
          </h2>
          <ul className="divide-y divide-rule">
            {myDonations.map((d) => {
              const state = DONATION_STATE[d.status];
              return (
                <li key={d.id} className="grid gap-x-8 gap-y-1 py-4 sm:grid-cols-[1fr_auto] sm:items-baseline">
                  <span className="min-w-0 text-ink">
                    <span className="num font-display text-xl font-semibold">{formatMinorUnits(d.amountMinorUnits)}</span>{" "}
                    <span className="text-sand">to</span>{" "}
                    <Link href={`/campaigns/${d.campaignId}`} className="underline">
                      {getCampaign(db, d.campaignId)?.title ?? "a campaign"}
                    </Link>
                  </span>
                  <Link href={`/donations/${d.id}`} className={`inline-flex min-h-8 items-center gap-2 text-sm font-medium ${state.tone} hover:underline`}>
                    <span aria-hidden className={`h-2 w-2 rounded-full ${state.dot}`} />
                    {state.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <p className="mt-10 border-t border-rule pt-5 text-sm">
        <Link href={workspace.href} className="inline-flex min-h-8 items-center font-medium underline">
          {workspace.label}
        </Link>
      </p>

      <details className="mt-6 text-sm text-sand">
        <summary className="cursor-pointer py-2 font-medium">Advanced: account details</summary>
        <dl className="mt-3 divide-y divide-rule border-y border-rule">
          <div className="grid gap-x-8 py-3 sm:grid-cols-[13rem_1fr]">
            <dt className="text-dim">Wallet address</dt>
            <dd className="break-all font-mono text-[13px]">{user.walletAddress}</dd>
          </div>
          <div className="grid gap-x-8 py-3 sm:grid-cols-[13rem_1fr]">
            <dt className="text-dim">Wallet type</dt>
            <dd>{user.walletType === "generated" ? "Created for you by VERA" : "Your own wallet"}</dd>
          </div>
        </dl>
      </details>
    </main>
  );
}
