import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { isAddress } from "viem";
import { generateWallet } from "./wallet";
import { formatRupees } from "./balance";
import { parseRpcUrls } from "../env";

describe("generateWallet", () => {
  it("returns a valid address that matches its private key", () => {
    const w = generateWallet();
    expect(isAddress(w.address)).toBe(true);
    expect(privateKeyToAccount(w.privateKey).address).toBe(w.address);
  });

  it("produces a different wallet every time", () => {
    expect(generateWallet().address).not.toBe(generateWallet().address);
  });
});

describe("formatRupees", () => {
  it("shows a zero balance as 0.00 rupees", () => {
    expect(formatRupees(0n)).toBe("\u20b90.00");
  });

  it("formats 6-decimal token amounts", () => {
    expect(formatRupees(250_000_000n)).toBe("\u20b9250.00");
    expect(formatRupees(1_500_000n)).toBe("\u20b91.50");
    expect(formatRupees(1_234_567_890_000n)).toBe("\u20b912,34,567.89");
  });
});

describe("parseRpcUrls", () => {
  it("splits a comma-separated list, trimming spaces and empty entries", () => {
    expect(parseRpcUrls(" https://a.example , https://b.example,, ")).toEqual(["https://a.example", "https://b.example"]);
  });
});
