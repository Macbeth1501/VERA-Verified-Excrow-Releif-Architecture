import { describe, expect, it } from "vitest";
import { MAX_GAS_PRICE_WEI, gasPriceRefusal } from "./sponsor";

const gwei = (n: number) => BigInt(n) * 1_000_000_000n;

describe("gas price guard", () => {
  it("lets normal Amoy gas prices through", () => {
    expect(gasPriceRefusal(gwei(30))).toBeNull();
    expect(gasPriceRefusal(gwei(40))).toBeNull();
    expect(gasPriceRefusal(MAX_GAS_PRICE_WEI)).toBeNull();
  });

  it("refuses during a spike, with a message saying so and to retry later", () => {
    const message = gasPriceRefusal(gwei(570));
    expect(message).toContain("570 gwei");
    expect(message).toContain("try again");
    expect(gasPriceRefusal(MAX_GAS_PRICE_WEI + 1n)).not.toBeNull();
  });
});
