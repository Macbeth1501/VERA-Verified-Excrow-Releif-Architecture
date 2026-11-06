import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHead } from "@/components/PageHead";
import { listUsers, parseRole, USER_ROLES } from "@/lib/admin/users";
import { requirePageUser } from "@/lib/campaigns/page-guard";
import { formatIst, shortAddress } from "@/lib/campaigns/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Registered users | VERA" };

const PAGE_SIZE = 50;
const ROLE_LABEL = { donor: "Donor", organizer: "Organizer", attestor: "Attestor", council: "Council member", admin: "Admin" } as const;
const STATUS_LABEL = { pending: "Application pending", verified: "Verified", rejected: "Rejected" } as const;

/** Admin-only directory of every registered account and its email address, with a search box and a role filter. */
export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; page?: string }> }) {
  const { db, user } = await requirePageUser();
  // The API enforces this too; redirecting here just avoids showing a dead page.
  if (user.role !== "admin") redirect("/dashboard");

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const role = parseRole(params.role);
  const page = Math.max(Number.parseInt(params.page ?? "1", 10) || 1, 1);
  const result = listUsers(db, { q, role, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  const everyone = USER_ROLES.reduce((sum, r) => sum + result.countsByRole[r], 0);
  const pages = Math.max(Math.ceil(result.total / PAGE_SIZE), 1);
  const link = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (role) sp.set("role", role);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return `/dashboard/admin/users${s ? `?${s}` : ""}`;
  };

  return (
    <main className="w-full max-w-5xl flex-1 py-12 lg:py-16">
      <PageHead
        back={{ href: "/dashboard/admin", label: "Admin console" }}
        title="Registered users"
        lead="Everyone with an account, newest first. Email addresses are personal data: this page is for admins only."
      />

      <p className="mt-6 text-sm text-sand" data-testid="user-counts">
        {everyone} account{everyone === 1 ? "" : "s"} in all:{" "}
        {USER_ROLES.map((r) => `${result.countsByRole[r]} ${ROLE_LABEL[r].toLowerCase()}${result.countsByRole[r] === 1 ? "" : "s"}`).join(" · ")}
      </p>

      <form method="get" action="/dashboard/admin/users" className="mt-5 flex flex-wrap items-end gap-4" role="search">
        <label className="text-sm text-sand">
          Find an email
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="part of an email address"
            className="mt-1.5 block w-72 rounded-md border border-rule-strong bg-well px-3 py-2.5 text-ink"
          />
        </label>
        <label className="text-sm text-sand">
          Role
          <select name="role" defaultValue={role ?? ""} className="mt-1.5 block rounded-md border border-rule-strong bg-well px-3 py-2.5 text-ink">
            <option value="">All roles</option>
            {USER_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]} ({result.countsByRole[r]})
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-md bg-copper px-5 py-2.5 text-sm font-semibold text-on-copper hover:bg-copper-hover">
          Search
        </button>
        {q || role ? (
          <Link href="/dashboard/admin/users" className="py-2.5 text-sm text-sand underline hover:text-copper">
            Clear
          </Link>
        ) : null}
      </form>

      {result.users.length === 0 ? (
        <p className="mt-8 border-y border-rule py-6 text-sand" data-testid="no-users">
          {q || role ? "No account matches that search." : "Nobody has registered yet."}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[40rem] border-y border-rule text-left text-sm" data-testid="users-table">
            <caption className="sr-only">Registered accounts</caption>
            <thead className="text-dim">
              <tr className="border-b border-rule">
                <th scope="col" className="py-3 pr-4 font-medium">Email</th>
                <th scope="col" className="py-3 pr-4 font-medium">Role</th>
                <th scope="col" className="py-3 pr-4 font-medium">Wallet</th>
                <th scope="col" className="py-3 pr-4 font-medium">Organizer application</th>
                <th scope="col" className="py-3 font-medium">Registered (IST)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {result.users.map((u) => (
                <tr key={u.id} data-testid="user-row">
                  <td className="py-3 pr-4 text-ink">{u.email}</td>
                  <td className="py-3 pr-4 text-sand">{ROLE_LABEL[u.role]}</td>
                  <td className="py-3 pr-4 font-mono text-[13px] text-sand" title={u.walletAddress}>
                    {shortAddress(u.walletAddress)}
                    {u.walletType === "external" ? <span className="ml-2 font-sans text-dim">(own wallet)</span> : null}
                  </td>
                  <td className="py-3 pr-4 text-sand">{u.organizerStatus ? STATUS_LABEL[u.organizerStatus] : "None"}</td>
                  <td className="num py-3 text-sand">{formatIst(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-sand">
        <p data-testid="user-range">
          {result.total === 0
            ? "0 matching accounts"
            : `Showing ${result.offset + 1}-${result.offset + result.users.length} of ${result.total} matching account${result.total === 1 ? "" : "s"}`}
        </p>
        {pages > 1 ? (
          <nav aria-label="Pages" className="flex items-center gap-4">
            {page > 1 ? (
              <Link href={link(page - 1)} className="underline hover:text-copper">
                &larr; Newer
              </Link>
            ) : null}
            <span>
              Page {page} of {pages}
            </span>
            {page < pages ? (
              <Link href={link(page + 1)} className="underline hover:text-copper">
                Older &rarr;
              </Link>
            ) : null}
          </nav>
        ) : null}
      </div>
    </main>
  );
}
