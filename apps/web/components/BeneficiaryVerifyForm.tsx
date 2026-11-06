"use client";

import { useState, type FormEvent } from "react";
import { hashIdentityFragment } from "@/lib/beneficiary/clientHasher";
import { fileToBase64, sha256HexOfFile } from "@/lib/hash";

const INPUT = "mt-1.5 w-full rounded-md border border-rule-strong bg-well px-3 py-2.5 text-ink focus:border-copper";

type Notice = { kind: "ok" | "none" | "error"; text: string };
const TONE = { ok: "bg-ok-wash text-ok", none: "bg-warn-wash text-warn", error: "bg-bad-wash text-bad" } as const;

/**
 * An attestor confirms a beneficiary they have met (C5). The identifying detail is fingerprinted in THIS
 * browser with the campaign's salt and cleared from the page before anything is sent; only the
 * fingerprint (and an optional evidence file with its own fingerprint) travels. The answer is just
 * "matched" or "no match", so a wrong guess teaches nothing about who is registered.
 */
export function BeneficiaryVerifyForm({ campaigns }: { campaigns: Array<{ id: string; title: string }> }) {
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? "");
  const [fragment, setFragment] = useState("");
  const [evidence, setEvidence] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !campaignId) return;
    setNotice(null);
    setBusy(true);
    try {
      const saltRes = await fetch(`/api/v1/campaigns/${campaignId}/beneficiaries/salt`);
      const saltData = await saltRes.json().catch(() => null);
      if (!saltRes.ok) {
        setNotice({ kind: "error", text: saltData?.error?.message ?? "Could not get this campaign's details." });
        return;
      }
      let identityHash: string;
      try {
        identityHash = await hashIdentityFragment(fragment, saltData.salt);
      } catch (err) {
        setNotice({ kind: "error", text: err instanceof Error ? err.message : "Could not fingerprint this person." });
        return;
      }
      const file = evidence;
      setFragment(""); // the raw detail is gone from the page before anything is sent
      setEvidence(null);

      const body: Record<string, string> = { identityHash };
      if (file) {
        body.evidenceHash = `0x${await sha256HexOfFile(file)}`;
        body.evidenceMimeType = file.type;
        body.evidenceData = await fileToBase64(file);
        body.evidenceName = file.name;
      }
      const res = await fetch(`/api/v1/campaigns/${campaignId}/beneficiaries/attestations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 201 && data?.matched) {
        setNotice({
          kind: "ok",
          text: `Confirmed. This person is now confirmed by ${data.attestations} of ${data.required} attestor${data.required === 1 ? "" : "s"}${data.verified ? " and can be paid" : ""}. No name or ID number was sent.`,
        });
      } else if (res.ok && data?.matched === false) {
        setNotice({ kind: "none", text: "No match: nobody registered on this campaign has that fingerprint. Check the details and the campaign." });
      } else {
        setNotice({ kind: "error", text: data?.error?.message ?? "Something went wrong." });
      }
    } catch {
      setNotice({ kind: "error", text: "We could not reach the server." });
    } finally {
      setBusy(false);
    }
  }

  if (campaigns.length === 0) return <p className="mt-4 border-y border-rule py-5 text-sand">No campaign is live yet.</p>;

  return (
    <form onSubmit={submit} className="mt-4 max-w-xl space-y-4" noValidate>
      <div>
        <label htmlFor="verify-campaign" className="text-sm font-medium text-ink">
          Campaign
        </label>
        <select id="verify-campaign" value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className={INPUT}>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="verify-fragment" className="text-sm font-medium text-ink">
          Identifying detail of the person you met
        </label>
        <input
          id="verify-fragment"
          value={fragment}
          onChange={(e) => setFragment(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder="Exactly as the organizer registered it"
          className={INPUT}
        />
        <p className="mt-1 text-sm text-dim">
          This never leaves this device. It is scrambled here into a fingerprint and only the fingerprint is sent, so nobody at VERA
          learns who the person is.
        </p>
      </div>
      <div>
        <label htmlFor="verify-evidence" className="text-sm font-medium text-ink">
          Evidence (optional)
        </label>
        <input
          id="verify-evidence"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
          className="mt-1.5 block w-full"
          onChange={(e) => setEvidence(e.target.files?.[0] ?? null)}
        />
        <p className="mt-1 text-sm text-dim">A photo or document of the visit. Admins and other attestors can open it.</p>
      </div>
      <button
        type="submit"
        disabled={busy || !fragment.trim()}
        className="rounded-md bg-copper px-5 py-2.5 text-sm font-semibold text-on-copper hover:bg-copper-hover disabled:opacity-60"
      >
        {busy ? "Checking..." : "Confirm this person exists"}
      </button>
      {notice ? (
        <p role={notice.kind === "error" ? "alert" : "status"} data-testid="verify-notice" className={`rounded-md px-3 py-2 text-sm ${TONE[notice.kind]}`}>
          {notice.text}
        </p>
      ) : null}
    </form>
  );
}
