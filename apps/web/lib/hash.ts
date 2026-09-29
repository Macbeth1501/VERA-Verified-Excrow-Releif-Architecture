/**
 * SHA-256 helpers that run in the browser (Web Crypto) and in Node. Used wherever a file or a piece
 * of text must be fingerprinted BEFORE anything is sent: organizer documents, attestor evidence and
 * beneficiary identity fragments. Beneficiary identity fragments never leave the browser except as
 * their hash; organizer/attestor documents are also uploaded (base64) so a reviewer can open them,
 * but the hash always travels with them and the server re-checks it.
 */

/** Lower-case hex of the bytes, no prefix. */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 of a string (as UTF-8) or of raw bytes, as 64 lower-case hex characters. */
export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return bytesToHex(new Uint8Array(digest));
}

/** SHA-256 of a file's contents as 64 hex characters. */
export async function sha256HexOfFile(file: Blob): Promise<string> {
  return sha256Hex(new Uint8Array(await file.arrayBuffer()));
}

/** Base64-encodes a file's contents, for the (optional) upload alongside its hash. */
export async function fileToBase64(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
