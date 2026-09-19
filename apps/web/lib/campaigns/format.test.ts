import { describe, expect, it } from "vitest";
import { formatBps, formatUtc, shortAddress } from "./format";

describe("display formatting", () => {
  it("shortens long addresses and leaves short ones alone", () => {
    expect(shortAddress("0x6590E3D9E42EDB7e8970b9348CE457b9a2f990F7")).toBe("0x6590E3...f990F7");
    expect(shortAddress("0xabc")).toBe("0xabc");
  });

  it("formats time in fixed UTC so server and browser agree", () => {
    expect(formatUtc("2026-09-19T04:31:02.000Z")).toBe("19 Sep 2026, 04:31 UTC");
    expect(formatUtc("not a date")).toBe("not a date");
  });

  it("formats basis points as a percentage", () => {
    expect(formatBps(2600)).toBe("26.00%");
    expect(formatBps(0)).toBe("0.00%");
    expect(formatBps(33333)).toBe("333.33%");
  });
});
