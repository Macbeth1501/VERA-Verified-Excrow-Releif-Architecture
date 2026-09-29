import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { resetEnvCache } from "../env";
import { getDb, resetDbForTests } from "../db";
import { registerDonor } from "../auth/users";
import {
  DocumentHashMismatchError,
  DocumentTooLargeError,
  DocumentTypeNotAllowedError,
  MAX_DOCUMENT_BYTES,
  getDocument,
  saveDocument,
} from "./service";

const ENC_KEY = "ab".repeat(32);

beforeEach(() => {
  process.env.DATABASE_URL = ":memory:";
  process.env.AUTH_SECRET = "s".repeat(40);
  process.env.WALLET_ENCRYPTION_KEY = ENC_KEY;
  process.env.MOCK_INR_ADDRESS = "0x9b6f00a1ce627a3e0d2da601253704084d8fc52c";
  resetEnvCache();
  resetDbForTests();
});

async function makeUploader() {
  const user = await registerDonor(getDb(), { email: `u${Date.now()}${Math.random()}@example.com`, password: "correct-horse-battery" }, ENC_KEY);
  return user.id;
}

describe("saveDocument", () => {
  it("stores the file and can be read back", async () => {
    const uploaderId = await makeUploader();
    const bytes = Buffer.from("hello world");
    const hash = createHash("sha256").update(bytes).digest("hex");
    const id = saveDocument(getDb(), {
      purpose: "kyb",
      filename: "cert.pdf",
      mimeType: "application/pdf",
      base64Data: bytes.toString("base64"),
      expectedHash: hash,
      uploadedByUserId: uploaderId,
    });
    const row = getDocument(getDb(), id);
    expect(row).not.toBeNull();
    expect(row!.data.equals(bytes)).toBe(true);
    expect(row!.mimeType).toBe("application/pdf");
  });

  it("accepts a 0x-prefixed expected hash", async () => {
    const uploaderId = await makeUploader();
    const bytes = Buffer.from("evidence photo bytes");
    const hash = createHash("sha256").update(bytes).digest("hex");
    const id = saveDocument(getDb(), {
      purpose: "milestone_evidence",
      filename: "photo.png",
      mimeType: "image/png",
      base64Data: bytes.toString("base64"),
      expectedHash: `0x${hash}`,
      uploadedByUserId: uploaderId,
    });
    expect(getDocument(getDb(), id)).not.toBeNull();
  });

  it("rejects a file that does not match its claimed hash", async () => {
    const uploaderId = await makeUploader();
    const bytes = Buffer.from("tampered content");
    expect(() =>
      saveDocument(getDb(), {
        purpose: "kyb",
        filename: "cert.pdf",
        mimeType: "application/pdf",
        base64Data: bytes.toString("base64"),
        expectedHash: "0".repeat(64),
        uploadedByUserId: uploaderId,
      }),
    ).toThrow(DocumentHashMismatchError);
  });

  it("rejects a disallowed mime type", async () => {
    const uploaderId = await makeUploader();
    const bytes = Buffer.from("<script>alert(1)</script>");
    const hash = createHash("sha256").update(bytes).digest("hex");
    expect(() =>
      saveDocument(getDb(), {
        purpose: "kyb",
        filename: "evil.html",
        mimeType: "text/html",
        base64Data: bytes.toString("base64"),
        expectedHash: hash,
        uploadedByUserId: uploaderId,
      }),
    ).toThrow(DocumentTypeNotAllowedError);
  });

  it("rejects a file over the size limit", async () => {
    const uploaderId = await makeUploader();
    const bytes = Buffer.alloc(MAX_DOCUMENT_BYTES + 1, 1);
    const hash = createHash("sha256").update(bytes).digest("hex");
    expect(() =>
      saveDocument(getDb(), {
        purpose: "kyb",
        filename: "big.png",
        mimeType: "image/png",
        base64Data: bytes.toString("base64"),
        expectedHash: hash,
        uploadedByUserId: uploaderId,
      }),
    ).toThrow(DocumentTooLargeError);
  });

  it("returns null for an unknown id", () => {
    expect(getDocument(getDb(), "does-not-exist")).toBeNull();
  });
});
