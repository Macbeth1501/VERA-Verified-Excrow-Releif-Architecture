import { describe, expect, it } from "vitest";
import { goalReachedBps } from "./dashboard";
import { csvField, exportFileName, ledgerToCsv, ledgerToJson } from "./export";
import { freshness, LAG_WARNING_BLOCKS } from "../indexer/freshness";
import type { DashboardData } from "./dashboard";

const data: DashboardData = {
  campaign: {
    id: "c1", title: "Flood relief for Assam", summary: "s", category: "DISASTER_RELIEF",
    fundingGoalMinorUnits: "1000000000", adminExpenseCapPct: 10, createdAt: "2026-09-19T00:00:00.000Z",
  },
  organizer: { id: "o1", legalName: "Trust", jurisdiction: "India" },
  vault: "0x6590E3D9E42EDB7e8970b9348CE457b9a2f990F7",
  escrow: { heldMinorUnits: "260000000", totalDonatedMinorUnits: "260000000", totalReleasedMinorUnits: "0", donationCount: 2, goalReachedBps: 2600 },
  milestones: [],
  ledger: [
    { id: "0xaaa:0", type: "CampaignCreated", milestoneIndex: null, blockNumber: 10, timestamp: "2026-09-19T04:30:22.000Z", txHash: "0xaaa", actor: "0xorg", amount: null },
    { id: "0xbbb:0", type: "DonationReceived", milestoneIndex: null, blockNumber: 20, timestamp: "2026-09-19T04:31:02.000Z", txHash: "0xbbb", actor: "0xdonor", amount: "250500000" },
  ],
  indexer: { configured: true, dataAsOfBlock: 100, headBlock: 102, lagBlocks: 2, freshness: "current" },
  reconciliation: { status: "match", checkedAtBlock: 100 },
  generatedAt: "2026-09-19T05:00:00.000Z",
};

describe("goalReachedBps", () => {
  it("uses exact integer math, in basis points", () => {
    expect(goalReachedBps(260000000n, 1000000000n)).toBe(2600);
    expect(goalReachedBps(1n, 3n)).toBe(3333);
    expect(goalReachedBps(0n, 1000n)).toBe(0);
  });
  it("can exceed 100% and never divides by zero", () => {
    expect(goalReachedBps(2000n, 1000n)).toBe(20000);
    expect(goalReachedBps(5n, 0n)).toBe(0);
  });
});

describe("freshness", () => {
  it("is current within the threshold, lagging beyond it", () => {
    expect(freshness(true, 0)).toBe("current");
    expect(freshness(true, LAG_WARNING_BLOCKS)).toBe("current");
    expect(freshness(true, LAG_WARNING_BLOCKS + 1)).toBe("lagging");
  });
  it("says unknown when lag cannot be measured and off when the indexer is off", () => {
    expect(freshness(true, null)).toBe("unknown");
    expect(freshness(false, 5)).toBe("off");
  });
});

describe("CSV export", () => {
  it("has a header, one row per event, exact rupee amounts and explorer links", () => {
    const lines = ledgerToCsv(data).trim().split("\r\n");
    expect(lines[0]).toBe("timestamp_utc,block,event,tx_hash,address,amount_minor_units,amount_inr,explorer_tx_url");
    expect(lines).toHaveLength(3);
    expect(lines[2]).toBe(
      "2026-09-19T04:31:02.000Z,20,DonationReceived,0xbbb,0xdonor,250500000,250.5,https://amoy.polygonscan.com/tx/0xbbb",
    );
    expect(lines[1].split(",")[5]).toBe("");
  });

  it("quotes commas, quotes and newlines", () => {
    expect(csvField("a,b")).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField("line\nbreak")).toBe('"line\nbreak"');
    expect(csvField("plain")).toBe("plain");
  });

  it("neutralises spreadsheet formula injection", () => {
    for (const evil of ["=1+1", "+cmd", "-2", "@SUM(A1)"]) {
      expect(csvField(evil).startsWith("'")).toBe(true);
    }
  });
});

describe("JSON export and file names", () => {
  it("adds how to verify the figures independently", () => {
    const json = ledgerToJson(data);
    expect(json.verifyYourself.vaultOnExplorer).toBe(`https://amoy.polygonscan.com/address/${data.vault}`);
    expect(json.escrow.heldMinorUnits).toBe("260000000");
  });

  it("makes safe file names", () => {
    expect(exportFileName("Flood relief for Assam!", "csv")).toBe("vera-flood-relief-for-assam-ledger.csv");
    expect(exportFileName("../../etc/passwd", "json")).toBe("vera-etc-passwd-ledger.json");
    expect(exportFileName("!!!", "csv")).toBe("vera-campaign-ledger.csv");
  });
});
