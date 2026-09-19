import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getEnv, resetEnvCache } from "./env";

const BASE = {
  AUTH_SECRET: "s".repeat(40),
  WALLET_ENCRYPTION_KEY: "ab".repeat(32),
  MOCK_INR_ADDRESS: "0x9b6f00a1ce627a3e0d2da601253704084d8fc52c",
};
const saved = { ...process.env };

beforeEach(() => {
  Object.assign(process.env, BASE);
  for (const k of ["FACTORY_ADDRESS", "PLATFORM_FEE_ADDRESS", "PLATFORM_FEE_MINOR_UNITS"]) delete process.env[k];
  resetEnvCache();
});
afterEach(() => {
  process.env = { ...saved };
  resetEnvCache();
});

describe("address configuration", () => {
  it("accepts lowercase and correctly checksummed addresses", () => {
    process.env.FACTORY_ADDRESS = "0x6931E776da5db1D9e5890407FE268705D70740bD";
    expect(getEnv().FACTORY_ADDRESS).toBe("0x6931E776da5db1D9e5890407FE268705D70740bD");
    resetEnvCache();
    process.env.FACTORY_ADDRESS = "0x6931e776da5db1d9e5890407fe268705d70740bd";
    expect(() => getEnv()).not.toThrow();
  });

  it("rejects a mixed-case address with a bad checksum up front, before any transaction", () => {
    process.env.PLATFORM_FEE_ADDRESS = "0x00000000000000000000000000000000000fEE01";
    expect(() => getEnv()).toThrow(/PLATFORM_FEE_ADDRESS/);
  });

  it("rejects malformed addresses", () => {
    process.env.FACTORY_ADDRESS = "0x1234";
    expect(() => getEnv()).toThrow(/FACTORY_ADDRESS/);
  });
});

describe("platform fee configuration", () => {
  it("defaults to no fee", () => {
    expect(getEnv().PLATFORM_FEE_MINOR_UNITS).toBe(0);
  });

  it("requires a fee address whenever a fee is set", () => {
    process.env.PLATFORM_FEE_MINOR_UNITS = "2000000";
    expect(() => getEnv()).toThrow(/PLATFORM_FEE_ADDRESS/);
    process.env.PLATFORM_FEE_ADDRESS = "0x000000000000000000000000000000000000fee1";
    resetEnvCache();
    expect(getEnv().PLATFORM_FEE_MINOR_UNITS).toBe(2000000);
  });
});
