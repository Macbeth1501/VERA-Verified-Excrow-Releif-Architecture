import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, hashEmail, normalizeEmail } from "./crypto";

const KEY = "ab".repeat(32);

describe("email hashing", () => {
  it("treats case and surrounding spaces as the same email", () => {
    expect(hashEmail("  Donor@Example.COM ")).toBe(hashEmail("donor@example.com"));
    expect(normalizeEmail(" A@B.co ")).toBe("a@b.co");
  });

  it("differs for different emails and is a sha256 hex digest", () => {
    expect(hashEmail("a@example.com")).not.toBe(hashEmail("b@example.com"));
    expect(hashEmail("a@example.com")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("secret encryption", () => {
  it("round-trips and does not store plaintext", () => {
    const enc = encryptSecret("0xdeadbeef", KEY);
    expect(enc).not.toContain("deadbeef");
    expect(decryptSecret(enc, KEY)).toBe("0xdeadbeef");
  });

  it("uses a fresh IV each time", () => {
    expect(encryptSecret("x", KEY)).not.toBe(encryptSecret("x", KEY));
  });

  it("rejects tampered ciphertext and the wrong key", () => {
    const [iv, tag, data] = encryptSecret("secret", KEY).split(":");
    const flipped = (data[0] === "0" ? "1" : "0") + data.slice(1);
    expect(() => decryptSecret(`${iv}:${tag}:${flipped}`, KEY)).toThrow();
    expect(() => decryptSecret(encryptSecret("secret", KEY), "cd".repeat(32))).toThrow();
  });
});
