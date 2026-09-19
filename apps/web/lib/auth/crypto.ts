import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Deterministic hash of a normalised email, used for the duplicate-account check.
 * Ref: FR-IDN-01 ("duplicate-account check by hashed email").
 */
export function hashEmail(email: string): string {
  return createHash("sha256").update(normalizeEmail(email)).digest("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * AES-256-GCM encryption for the generated demo wallet's private key. Output format is
 * `iv:tag:ciphertext`, all hex. These are worthless testnet keys, but they are still never
 * stored in plaintext.
 */
export function encryptSecret(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((b) => b.toString("hex")).join(":");
}

export function decryptSecret(payload: string, keyHex: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(":");
  if (!ivHex || !tagHex || !dataHex) throw new Error("Malformed encrypted payload");
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(keyHex, "hex"), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString("utf8");
}
