import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { bytesToHex, sha256Hex, sha256HexOfFile } from "../hash";
import { hashIdentityFragment, normalizeIdentityFragment } from "./clientHasher";

const SALT = "campaign-salt-1";
const node = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

describe("sha256 helpers", () => {
  it("matches the published SHA-256 test vector for 'abc'", async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("agrees with Node's own SHA-256 for text, including non-ASCII", async () => {
    for (const s of ["", "hello", "आशा देवी", "Zoë 1990-01-01"]) expect(await sha256Hex(s)).toBe(node(s));
  });

  it("hashes a file's bytes, not its name", async () => {
    const a = new File(["same bytes"], "a.txt");
    const b = new File(["same bytes"], "b.pdf");
    expect(await sha256HexOfFile(a)).toBe(await sha256HexOfFile(b));
    expect(await sha256HexOfFile(a)).toBe(node("same bytes"));
  });

  it("formats bytes as fixed-width lower-case hex", () => {
    expect(bytesToHex(new Uint8Array([0, 1, 15, 16, 255]))).toBe("00010f10ff");
  });
});

describe("normalizeIdentityFragment", () => {
  it("ignores case, outer and repeated whitespace", () => {
    expect(normalizeIdentityFragment(" Asha  Devi ")).toBe("asha devi");
    expect(normalizeIdentityFragment("ASHA\tDEVI\n")).toBe("asha devi");
  });

  it("treats differently composed Unicode and full-width digits as the same text", () => {
    expect(normalizeIdentityFragment("Zoe\u0308")).toBe(normalizeIdentityFragment("Zo\u00eb"));
    expect(normalizeIdentityFragment("１２３４")).toBe("1234");
  });
});

describe("hashIdentityFragment", () => {
  it("is deterministic and returns bytes32 (0x plus 64 hex)", async () => {
    const one = await hashIdentityFragment("asha devi 1990-01-01", SALT);
    expect(one).toMatch(/^0x[0-9a-f]{64}$/);
    expect(await hashIdentityFragment("asha devi 1990-01-01", SALT)).toBe(one);
  });

  it("gives the same fingerprint for the same person however it was typed", async () => {
    const a = await hashIdentityFragment(" Asha  Devi 1990-01-01 ", SALT);
    const b = await hashIdentityFragment("asha devi 1990-01-01", SALT);
    expect(a).toBe(b);
  });

  it("gives different fingerprints for different people", async () => {
    expect(await hashIdentityFragment("asha devi", SALT)).not.toBe(await hashIdentityFragment("asha rani", SALT));
  });

  it("depends on the campaign's salt, so campaigns cannot be cross-matched", async () => {
    expect(await hashIdentityFragment("asha devi", "salt-a")).not.toBe(await hashIdentityFragment("asha devi", "salt-b"));
  });

  it("cannot be confused by moving characters between salt and fragment", async () => {
    expect(await hashIdentityFragment("bc", "a")).not.toBe(await hashIdentityFragment("c", "ab"));
  });

  it("equals SHA-256 of salt, a NUL, then the normalized fragment (independent check)", async () => {
    expect(await hashIdentityFragment(" Asha  Devi ", SALT)).toBe(`0x${node(`${SALT}\u0000asha devi`)}`);
  });

  it("never contains the raw fragment", async () => {
    const h = await hashIdentityFragment("asha devi 1990-01-01", SALT);
    expect(h).not.toContain("asha");
    expect(h).not.toContain("1990");
  });

  it("refuses an empty fragment or a missing salt rather than hashing nothing", async () => {
    await expect(hashIdentityFragment("   ", SALT)).rejects.toThrow(/identifying detail/);
    await expect(hashIdentityFragment("asha devi", "")).rejects.toThrow(/salt/);
  });
});
