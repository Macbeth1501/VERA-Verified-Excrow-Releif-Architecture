import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "./validation";

const good = { email: "donor@example.com", password: "a-long-enough-pass" };

describe("registerSchema", () => {
  it("accepts a valid email and 12+ character password", () => {
    expect(registerSchema.safeParse(good).success).toBe(true);
  });

  it("rejects malformed emails", () => {
    expect(registerSchema.safeParse({ ...good, email: "not-an-email" }).success).toBe(false);
  });

  it("enforces the 12 character minimum password (SPDD 13.4)", () => {
    expect(registerSchema.safeParse({ ...good, password: "x".repeat(11) }).success).toBe(false);
    expect(registerSchema.safeParse({ ...good, password: "x".repeat(12) }).success).toBe(true);
  });

  it("validates an optional own-wallet address", () => {
    expect(registerSchema.safeParse({ ...good, walletAddress: "0x1234" }).success).toBe(false);
    expect(
      registerSchema.safeParse({ ...good, walletAddress: "0xb2Ab1471d98909237B3F3828E7422182584E11E3" }).success,
    ).toBe(true);
  });
});

describe("loginSchema", () => {
  it("requires both fields", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
  });
});
