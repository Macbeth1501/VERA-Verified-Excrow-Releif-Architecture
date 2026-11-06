/** Unit tests for display formatting helpers. */

import { describe, expect, it } from "vitest";
import { formatBps, formatIst, shortAddress } from "./format";

describe("display formatting", () => {
  it("shortens long addresses and leaves short ones alone", () => {
    expect(shortAddress("0x6590E3D9E42EDB7e8970b9348CE457b9a2f990F7")).toBe("0x6590E3...f990F7");
    expect(shortAddress("0xabc")).toBe("0xabc");
  });

  it("formats time in fixed IST so server and browser agree", () => {
    expect(formatIst("2026-09-19T04:31:02.000Z")).toBe("19 Sep 2026, 10:01 IST");
    expect(formatIst("2026-09-19T20:00:00.000Z")).toBe("20 Sep 2026, 01:30 IST");
    expect(formatIst("not a date")).toBe("not a date");
  });

  it("formats basis points as a percentage", () => {
    expect(formatBps(2600)).toBe("26.00%");
    expect(formatBps(0)).toBe("0.00%");
    expect(formatBps(33333)).toBe("333.33%");
  });
});
