import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { documents, type DocumentRow } from "../db/schema";

/** Small supporting documents only (KYB certificates, milestone evidence photos/PDFs). */
export const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
] as const;

export class DocumentTooLargeError extends Error {
  constructor() {
    super(`The file is too large. The limit is ${Math.floor(MAX_DOCUMENT_BYTES / (1024 * 1024))} MB.`);
  }
}
export class DocumentTypeNotAllowedError extends Error {
  constructor() {
    super("That file type is not supported. Use a JPEG, PNG, WEBP, GIF or PDF.");
  }
}
export class DocumentHashMismatchError extends Error {
  constructor() {
    super("The uploaded file does not match its fingerprint. Please try attaching it again.");
  }
}
export class DocumentNotFoundError extends Error {
  constructor() {
    super("Document not found");
  }
}

/**
 * Decodes a browser-sent base64 file, verifies it against the hash already computed client-side
 * (so the hash still proves what was reviewed / attested), and stores the bytes. The hash is what
 * is used on-chain and for the existing `documentHash`/`proofHash` columns; this only adds a way
 * to open the file later.
 */
export function saveDocument(
  db: Db,
  input: {
    purpose: DocumentRow["purpose"];
    filename: string;
    mimeType: string;
    base64Data: string;
    expectedHash: string;
    uploadedByUserId: string;
  },
): string {
  if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(input.mimeType as (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number])) {
    throw new DocumentTypeNotAllowedError();
  }
  const data = Buffer.from(input.base64Data, "base64");
  if (data.length === 0 || data.length > MAX_DOCUMENT_BYTES) throw new DocumentTooLargeError();

  const actualHash = createHash("sha256").update(data).digest("hex");
  const expected = input.expectedHash.toLowerCase().replace(/^0x/, "");
  if (actualHash !== expected) throw new DocumentHashMismatchError();

  const id = randomUUID();
  db.insert(documents)
    .values({
      id,
      purpose: input.purpose,
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: data.length,
      sha256Hash: actualHash,
      data,
      uploadedByUserId: input.uploadedByUserId,
    })
    .run();
  return id;
}

export function getDocument(db: Db, id: string): DocumentRow | null {
  return db.select().from(documents).where(eq(documents.id, id)).get() ?? null;
}
