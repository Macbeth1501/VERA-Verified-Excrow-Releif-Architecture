"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * A button that POSTs to one API route and refreshes the page. Failures show the server's own
 * message (for example a contract refusal in plain language) and leave the button usable to retry.
 */
export function ActionButton({
  url,
  label,
  busyLabel,
  body,
  tone = "neutral",
}: {
  url: string;
  label: string;
  busyLabel: string;
  body?: unknown;
  tone?: "neutral" | "primary";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const style =
    tone === "primary"
      ? "bg-emerald-700 text-white hover:bg-emerald-800"
      : "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900";

  return (
    <div className="mt-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const res = await fetch(url, {
              method: "POST",
              headers: body === undefined ? undefined : { "content-type": "application/json" },
              body: body === undefined ? undefined : JSON.stringify(body),
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
        className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-60 ${style}`}
      >
        {busy ? busyLabel : label}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
