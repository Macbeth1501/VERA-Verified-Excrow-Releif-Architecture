"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { fileToBase64, sha256HexOfFile } from "@/lib/hash";

type FieldErrors = Record<string, string[] | undefined>;

export function OrganizerApplyForm() {
  const router = useRouter();
  const [legalName, setLegalName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [document, setDocument] = useState<{ name: string; hash: string; mimeType: string; data: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return setDocument(null);
    // The hash is what actually proves what was reviewed; the file is also uploaded so an admin can open it.
    const [hash, data] = await Promise.all([sha256HexOfFile(file), fileToBase64(file)]);
    setDocument({ name: file.name, hash, mimeType: file.type, data });
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    setFieldErrors({});
    try {
      const res = await fetch("/api/v1/organizers/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          legalName,
          registrationNumber,
          jurisdiction,
          documentHash: document?.hash ?? "",
          documentName: document?.name ?? "",
          documentMimeType: document?.mimeType || undefined,
          documentData: document?.data,
        }),
      });
      if (res.ok) return router.refresh();
      const body = await res.json().catch(() => null);
      setFieldErrors((body?.error?.details as FieldErrors | undefined) ?? {});
      setFormError(body?.error?.message ?? "Something went wrong. Please try again.");
    } catch {
      setFormError("We could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const input =
    "mt-1 w-full rounded-md border border-rule-strong bg-well px-3 py-2.5 text-ink focus:border-copper";
  const label = "text-sm font-medium text-ink";
  const errors = (key: string) =>
    fieldErrors[key]?.map((m) => (
      <p key={m} className="mt-1 text-sm text-bad">
        {m}
      </p>
    ));

  return (
    <form onSubmit={onSubmit} className="mt-6 max-w-xl space-y-5" noValidate>
      <div>
        <label htmlFor="legalName" className={label}>
          Legal name of your organization
        </label>
        <input id="legalName" value={legalName} onChange={(e) => setLegalName(e.target.value)} className={input} />
        {errors("legalName")}
      </div>
      <div>
        <label htmlFor="registrationNumber" className={label}>
          Registration number
        </label>
        <input
          id="registrationNumber"
          value={registrationNumber}
          onChange={(e) => setRegistrationNumber(e.target.value)}
          className={input}
        />
        {errors("registrationNumber")}
      </div>
      <div>
        <label htmlFor="jurisdiction" className={label}>
          Country or state of registration
        </label>
        <input id="jurisdiction" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} className={input} />
        {errors("jurisdiction")}
      </div>
      <div>
        <label htmlFor="document" className={label}>
          Supporting document (registration certificate)
        </label>
        <input id="document" type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" onChange={onFile} className={input} />
        <p className="mt-1 text-sm text-dim">
          {document
            ? `Selected: ${document.name}. It will be uploaded (JPEG, PNG, WEBP, GIF or PDF, up to 8 MB) so an admin can review it, along with its fingerprint.`
            : "Choose a JPEG, PNG, WEBP, GIF or PDF file, up to 8 MB. An admin will review it before approving your application."}
        </p>
        {errors("documentHash")}
        {errors("documentMimeType")}
        {errors("documentData")}
      </div>

      {formError ? (
        <p role="alert" className="rounded-md bg-bad-wash px-3 py-2 text-sm text-bad">
          {formError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-copper px-6 py-3 font-semibold text-on-copper hover:bg-copper-hover disabled:opacity-60"
      >
        {busy ? "Submitting..." : "Submit for verification"}
      </button>
    </form>
  );
}
