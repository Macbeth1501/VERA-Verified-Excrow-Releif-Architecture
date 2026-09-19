"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";

type FieldErrors = Record<string, string[] | undefined>;

async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function OrganizerApplyForm() {
  const router = useRouter();
  const [legalName, setLegalName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [document, setDocument] = useState<{ name: string; hash: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return setDocument(null);
    // The file never leaves the browser: only its fingerprint is sent.
    setDocument({ name: file.name, hash: await sha256Hex(file) });
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
    "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
  const label = "text-sm font-medium text-zinc-800 dark:text-zinc-200";
  const errors = (key: string) =>
    fieldErrors[key]?.map((m) => (
      <p key={m} className="mt-1 text-sm text-red-600">
        {m}
      </p>
    ));

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-5" noValidate>
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
        <input id="document" type="file" onChange={onFile} className={input} />
        <p className="mt-1 text-sm text-zinc-500">
          {document
            ? `Selected: ${document.name}. Only a fingerprint of this file is sent; the file itself stays on your device.`
            : "Choose a file. Only its fingerprint is sent, never the file itself."}
        </p>
        {errors("documentHash")}
      </div>

      {formError ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {formError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {busy ? "Submitting..." : "Submit for verification"}
      </button>
    </form>
  );
}
