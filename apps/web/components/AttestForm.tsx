"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** SHA-256 of the file, in the browser, as 0x plus 64 hex characters. The file itself is never uploaded. */
async function hashFile(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return `0x${[...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * The attestor's confirmation: pick the evidence they reviewed (photo, report, receipt), the browser
 * hashes it, and only the hash goes to the server and the blockchain (FR-ESC-01).
 */
export function AttestForm({ milestoneId }: { milestoneId: string }) {
  const router = useRouter();
  const [hash, setHash] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-3 space-y-2">
      <label className="block text-sm text-zinc-700 dark:text-zinc-300">
        Evidence you reviewed
        <input
          type="file"
          data-testid="evidence"
          className="mt-1 block w-full text-sm"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            setError(null);
            setHash(null);
            setName(file?.name ?? null);
            if (file) setHash(await hashFile(file));
          }}
        />
      </label>
      {hash ? (
        <p className="break-all font-mono text-xs text-zinc-500">
          Fingerprint of {name}: {hash}
        </p>
      ) : null}
      <button
        type="button"
        disabled={busy || !hash}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const res = await fetch(`/api/v1/milestones/${milestoneId}/attestations`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ proofHash: hash }),
            });
            if (!res.ok) {
              const data = await res.json().catch(() => null);
              setError(data?.error?.message ?? "Something went wrong.");
            }
            router.refresh();
          } catch {
            setError("We could not reach the server.");
          } finally {
            setBusy(false);
          }
        }}
        className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {busy ? "Confirming on the blockchain..." : "Confirm this milestone is complete"}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
