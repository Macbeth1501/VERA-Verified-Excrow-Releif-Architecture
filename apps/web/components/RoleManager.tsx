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
      <h2 id="roles-heading" className="border-b border-rule pb-3 text-2xl text-ink">
        Attestors and council
      </h2>
      <p className="mt-3 max-w-[62ch] text-sand">
        Attestors confirm milestones; the council approves large payouts. Each person needs an existing account. Their
        role is also registered on the milestone manager contract, which is what actually lets them act.
      </p>

      <form
        className="mt-5 flex flex-wrap items-end gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void call({ email, role, active: true });
        }}
      >
        <label className="text-sm text-sand">
          Account email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 block w-64 rounded-md border border-rule-strong bg-well px-3 py-2.5 text-ink"
          />
        </label>
        <label className="text-sm text-sand">
          Role
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "attestor" | "council")}
            className="mt-1.5 block rounded-md border border-rule-strong bg-well px-3 py-2.5 text-ink"
          >
            <option value="attestor">Attestor</option>
            <option value="council">Council member</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-copper px-5 py-2.5 text-sm font-semibold text-on-copper hover:bg-copper-hover disabled:opacity-60"
        >
          {busy ? "Working..." : "Grant role"}
        </button>
      </form>
      {error ? (
        <p role="alert" className="mt-3 rounded-md bg-bad-wash px-3 py-2 text-sm text-bad">
          {error}
        </p>
      ) : null}

      {grants.length === 0 ? (
        <p className="mt-6 border-y border-rule py-5 text-sand">Nobody holds these roles yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-rule border-y border-rule">
          {grants.map((g) => (
            <li key={g.id} className="py-4" data-testid="role-grant">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-ink">
                    {g.email} <span className="text-sm font-normal text-dim">· {ROLE_LABEL[g.role]}</span>
                  </p>
                  <p className="mt-1 text-sm text-sand">{SYNC_LABEL[g.chainSync]}</p>
                  {g.chainError ? <p className="text-sm text-bad">{g.chainError}</p> : null}
                </div>
                <div className="flex gap-2">
                  {g.chainSync !== "synced" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => call({ email: g.email, role: g.role, active: true })}
                      className="rounded-md border border-rule-strong px-4 py-2 text-sm font-medium text-ink hover:bg-panel disabled:opacity-60"
                    >
                      Retry sync
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => call({ email: g.email, role: g.role, active: false })}
                    className="rounded-md border border-bad/50 px-4 py-2 text-sm font-medium text-bad hover:bg-bad-wash disabled:opacity-60"
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
