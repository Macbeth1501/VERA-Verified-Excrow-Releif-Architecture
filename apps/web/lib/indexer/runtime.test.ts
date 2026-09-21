import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetEnvCache } from "../env";
import { indexerRuntime } from "./runtime";

/**
 * The wiring from environment settings to the indexer's config. Covered on its own because the sync
 * tests build their config by hand, so a stream left unwired here would otherwise go unnoticed.
 */
const FACTORY = "0x6931E776da5db1D9e5890407FE268705D70740bD";
const MANAGER = "0xe6d7222dDe3eE4b9688269427631aDF49229e747";
const REGISTRY = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
const KEYS = ["FACTORY_ADDRESS", "INDEXER_START_BLOCK", "MILESTONE_MANAGER_ADDRESS", "MANAGER_START_BLOCK", "BENEFICIARY_REGISTRY_ADDRESS", "REGISTRY_START_BLOCK"];
const saved = { ...process.env };

beforeEach(() => {
  Object.assign(process.env, {
    AUTH_SECRET: "s".repeat(40),
    WALLET_ENCRYPTION_KEY: "ab".repeat(32),
    MOCK_INR_ADDRESS: "0x9b6f00a1ce627a3e0d2da601253704084d8fc52c",
  });
  for (const k of KEYS) delete process.env[k];
  resetEnvCache();
});
afterEach(() => {
  process.env = { ...saved };
  resetEnvCache();
});

describe("indexerRuntime", () => {
  it("stays off without the factory address and start block", () => {
    expect(indexerRuntime()).toBeNull();
    process.env.FACTORY_ADDRESS = FACTORY;
    resetEnvCache();
    expect(indexerRuntime()).toBeNull();
  });

  it("runs the factory stream alone when only it is configured", () => {
    process.env.FACTORY_ADDRESS = FACTORY;
    process.env.INDEXER_START_BLOCK = "100";
    resetEnvCache();
    const runtime = indexerRuntime();
    expect(runtime?.config.startBlock).toBe(100);
    expect(runtime?.config.managerStartBlock).toBeUndefined();
    expect(runtime?.config.registryStartBlock).toBeUndefined();
    expect(runtime?.registryAddress).toBeUndefined();
  });

  it("wires the manager and registry streams once their addresses are set", () => {
    process.env.FACTORY_ADDRESS = FACTORY;
    process.env.INDEXER_START_BLOCK = "100";
    process.env.MILESTONE_MANAGER_ADDRESS = MANAGER;
    process.env.MANAGER_START_BLOCK = "200";
    process.env.BENEFICIARY_REGISTRY_ADDRESS = REGISTRY;
    process.env.REGISTRY_START_BLOCK = "300";
    resetEnvCache();
    const runtime = indexerRuntime();
    expect(runtime?.config.managerStartBlock).toBe(200);
    expect(runtime?.config.registryStartBlock).toBe(300);
    expect(runtime?.registryAddress).toBe(REGISTRY);
    expect(runtime?.reader.registryEvents).toBeTypeOf("function");
  });

  it("ignores a start block whose contract address is not configured", () => {
    process.env.FACTORY_ADDRESS = FACTORY;
    process.env.INDEXER_START_BLOCK = "100";
    process.env.MANAGER_START_BLOCK = "200";
    process.env.REGISTRY_START_BLOCK = "300";
    resetEnvCache();
    const runtime = indexerRuntime();
    expect(runtime?.config.managerStartBlock).toBeUndefined();
    expect(runtime?.config.registryStartBlock).toBeUndefined();
  });
});
