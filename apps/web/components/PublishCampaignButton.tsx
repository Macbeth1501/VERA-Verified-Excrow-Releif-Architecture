"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PublishCampaignButton({ campaignId, label }: { campaignId: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const res = await fetch(`/api/v1/campaigns/${campaignId}/deploy`, { method: "POST" });
            if (!res.ok) {
              const body = await res.json().catch(() => null);
              setError(body?.error?.message ?? "Something went wrong.");
            } else {
              // Publishing made the vault; now register its milestones on the milestone manager.
              // A failure here is shown on the campaign page with its own retry button.
              await fetch(`/api/v1/campaigns/${campaignId}/milestones/define`, { method: "POST" }).catch(() => null);
            }
            router.refresh();
          } catch {
            setError("We could not reach the server.");
          } finally {
            setBusy(false);
          }
        }}
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        {busy ? "Publishing, this can take a minute..." : label}
      </button>
      {error ? <p className="mt-2 text-sm text-red-700 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
