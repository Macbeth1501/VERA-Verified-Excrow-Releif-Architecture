"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { RoleGrantView } from "@/lib/escrow/service";

const ROLE_LABEL = { attestor: "Attestor", council: "Council member" } as const;
const SYNC_LABEL: Record<RoleGrantView["chainSync"], string> = {
  none: "Not yet recorded on-chain",
  not_configured: "Saved here only: the milestone manager is not configured on this server",
  synced: "Registered on the blockchain",
  failed: "Registering on the blockchain failed",
};

/** Admin tool: make an account an attestor or council member, retry a failed sync, or remove a role. */
export function RoleManager({ grants }: { grants: RoleGrantView[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"attestor" | "council">("attestor");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(body: { email: string; role: "attestor" | "council"; active: boolean }) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/roles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error?.message ?? "Something went wrong.");
      } else if (body.active) {
        setEmail("");
      }
      router.refresh();
    } catch {
      setError("We could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-12" aria-labelledby="roles-heading">
      <h2 id="roles-heading" className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Attestors and council
      </h2>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Attestors confirm milestones; the council approves large payouts. Each person needs an existing account. Their
        role is also registered on the milestone manager contract, which is what actually lets them act.
      </p>

      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void call({ email, role, active: true });
        }}
      >
        <label className="text-sm text-zinc-700 dark:text-zinc-300">
          Account email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-64 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="text-sm text-zinc-700 dark:text-zinc-300">
          Role
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "attestor" | "council")}
            className="mt-1 block rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="attestor">Attestor</option>
            <option value="council">Council member</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {busy ? "Working..." : "Grant role"}
        </button>
      </form>
      {error ? (
        <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {grants.length === 0 ? (
        <p className="mt-6 text-zinc-600 dark:text-zinc-400">Nobody holds these roles yet.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {grants.map((g) => (
            <li key={g.id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800" data-testid="role-grant">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">
                    {g.email} <span className="text-sm font-normal text-zinc-500">· {ROLE_LABEL[g.role]}</span>
                  </p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{SYNC_LABEL[g.chainSync]}</p>
                  {g.chainError ? <p className="text-sm text-red-700 dark:text-red-400">{g.chainError}</p> : null}
                </div>
                <div className="flex gap-2">
                  {g.chainSync !== "synced" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => call({ email: g.email, role: g.role, active: true })}
                      className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
                    >
                      Retry sync
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => call({ email: g.email, role: g.role, active: false })}
                    className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:hover:bg-red-950"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
