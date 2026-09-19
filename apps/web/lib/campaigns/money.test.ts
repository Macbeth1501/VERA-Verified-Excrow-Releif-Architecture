import { describe, expect, it } from "vitest";
import { formatMinorUnits, rupeesToMinorUnits } from "./money";

describe("rupeesToMinorUnits", () => {
  it("converts whole and fractional rupees to 6-decimal minor units", () => {
    expect(rupeesToMinorUnits("1000")).toBe("1000000000");
    expect(rupeesToMinorUnits("1000.50")).toBe("1000500000");
    expect(rupeesToMinorUnits("0.000001")).toBe("1");
  });

  it("accepts thousands separators and surrounding spaces", () => {
    expect(rupeesToMinorUnits(" 12,34,567 ")).toBe("1234567000000");
  });

  it("rejects zero, negatives, junk and more than 6 decimal places", () => {
    for (const bad of ["0", "0.00", "-5", "", "abc", "1.2.3", "1.0000001"]) {
      expect(rupeesToMinorUnits(bad)).toBeNull();
    }
  });

  it("keeps large amounts exact, without floating-point drift", () => {
    expect(rupeesToMinorUnits("99999999.999999")).toBe("99999999999999");
  });
});

describe("formatMinorUnits", () => {
  it("formats minor units as Indian-grouped rupees", () => {
    expect(formatMinorUnits("1000000000")).toBe("₹1,000.00");
    expect(formatMinorUnits("1000500000")).toBe("₹1,000.50");
    expect(formatMinorUnits("1234567000000")).toBe("₹12,34,567.00");
  });
});
