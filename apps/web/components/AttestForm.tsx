"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fileToBase64, sha256HexOfFile } from "@/lib/hash";

/**
 * The attestor's confirmation: pick the evidence they reviewed (photo, report, receipt). The
 * browser hashes it (the hash is what goes on-chain) and also uploads it, so an admin or council
 * member can later open exactly what was attested to (FR-ESC-01).
 */
export function AttestForm({ milestoneId }: { milestoneId: string }) {
  const router = useRouter();
  const [hash, setHash] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<{ name: string; mimeType: string; data: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-4 space-y-3">
      <label className="block text-sm text-sand">
        Evidence you reviewed (JPEG, PNG, WEBP, GIF or PDF, up to 8 MB)
        <input
          type="file"
          data-testid="evidence"
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
          className="mt-1.5 block w-full"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            setError(null);
            setHash(null);
            setEvidence(null);
            if (!file) return;
            const [fileHash, data] = await Promise.all([sha256HexOfFile(file), fileToBase64(file)]);
            setHash(`0x${fileHash}`);
            setEvidence({ name: file.name, mimeType: file.type, data });
          }}
        />
      </label>
      {hash && evidence ? (
        <p className="break-all font-mono text-[13px] text-dim">
          Fingerprint of {evidence.name}: {hash}
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
              body: JSON.stringify({
                proofHash: hash,
                evidenceMimeType: evidence?.mimeType || undefined,
                evidenceData: evidence?.data,
                evidenceName: evidence?.name,
              }),
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
        className="rounded-md bg-copper px-4 py-2 text-sm font-semibold text-on-copper hover:bg-copper-hover disabled:opacity-60"
      >
        {busy ? "Confirming on the blockchain..." : "Confirm this milestone is complete"}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}
