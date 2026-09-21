"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { hashIdentityFragment } from "@/lib/beneficiary/clientHasher";
import { sha256HexOfFile } from "@/lib/hash";

const INPUT =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

type Notice = { kind: "ok" | "duplicate" | "pending" | "error"; text: string };
const short = (hash: string) => `${hash.slice(0, 10)}...${hash.slice(-6)}`;

const TONE = {
  ok: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  duplicate: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  pending: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  error: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200",
} as const;

/**
 * Registers one beneficiary (FR-IDN-03). The identifying detail is turned into a salted fingerprint in
 * THIS browser; only the fingerprint (and an optional photo fingerprint) is ever sent. The typed
 * detail is cleared from the page's state as soon as it has been hashed, before any network call, so
 * it is never held while waiting on the server and never appears in a request.
 */
export function BeneficiaryForm({ campaignId, programSalt }: { campaignId: string; programSalt: string }) {
  const router = useRouter();
  const [fragment, setFragment] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("Bank transfer");
  const [photo, setPhoto] = useState<{ name: string; hash: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setNotice(null);

    let identityHash: string;
    try {
      identityHash = await hashIdentityFragment(fragment, programSalt);
    } catch (err) {
      setNotice({ kind: "error", text: err instanceof Error ? err.message : "Could not fingerprint this beneficiary." });
      return;
    }
    const photoHash = photo ? `0x${photo.hash}` : undefined;
    setFragment(""); // the raw detail is gone from the page before anything is sent
    setPhoto(null);

    setBusy(true);
    try {
      const res = await fetch(`/api/v1/campaigns/${campaignId}/beneficiaries`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identityHash, photoHash, payoutMethod }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 201) {
        setNotice({ kind: "ok", text: `Registered. Its fingerprint is ${short(identityHash)}. No name or ID number was sent.` });
      } else if (data?.error?.code === "DUPLICATE_BENEFICIARY") {
        setNotice({ kind: "duplicate", text: "Refused: this person is already registered as a beneficiary of this campaign." });
      } else if (res.status === 202 || data?.error?.code === "REGISTRATION_PENDING") {
        setNotice({ kind: "pending", text: data?.error?.message ?? "Sent, but not confirmed yet. It will settle shortly." });
      } else {
        setNotice({ kind: "error", text: data?.error?.message ?? "Something went wrong." });
      }
      router.refresh();
    } catch {
      setNotice({ kind: "error", text: "We could not reach the server." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
      <div>
        <label htmlFor="fragment" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Identifying detail
        </label>
        <input
          id="fragment"
          value={fragment}
          onChange={(e) => setFragment(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder="ID number, or name + date of birth + village"
          className={INPUT}
        />
        <p className="mt-1 text-xs text-zinc-500">
          This never leaves this device. It is scrambled here into a fingerprint, and only the fingerprint is sent, so the
          same person cannot be registered twice but nobody at VERA can see who they are.
        </p>
      </div>

      <div>
        <label htmlFor="payout" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          How will they be paid?
        </label>
        <input id="payout" value={payoutMethod} onChange={(e) => setPayoutMethod(e.target.value)} maxLength={60} className={INPUT} />
      </div>

      <div>
        <label htmlFor="photo" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Photo (optional)
        </label>
        <input
          id="photo"
          type="file"
          accept="image/*"
          className="mt-1 block w-full text-sm"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            setPhoto(file ? { name: file.name, hash: await sha256HexOfFile(file) } : null);
          }}
        />
        <p className="mt-1 text-xs text-zinc-500">Only a fingerprint of the photo is kept; the photo itself is not uploaded.</p>
      </div>

      <button
        type="submit"
        disabled={busy || !fragment.trim()}
        className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {busy ? "Registering on the blockchain..." : "Register beneficiary"}
      </button>

      {notice ? (
        <p role={notice.kind === "error" ? "alert" : "status"} data-testid="beneficiary-notice" className={`rounded-md px-3 py-2 text-sm ${TONE[notice.kind]}`}>
          {notice.text}
        </p>
      ) : null}
    </form>
  );
}
