import { describe, expect, it } from "vitest";
import { classifyReconcileError } from "./dashboard";

describe("classifyReconcileError", () => {
  it("recognises a node that no longer keeps old state", () => {
    expect(classifyReconcileError(new Error("historical state 43ffbe is not available"))).toBe("state_pruned");
    expect(classifyReconcileError(new Error("missing trie node abc"))).toBe("state_pruned");
  });
  it("recognises an unreachable node", () => {
    expect(classifyReconcileError(new Error("The request timed out."))).toBe("unreachable");
    expect(classifyReconcileError(new Error("HTTP request failed."))).toBe("unreachable");
  });
  it("calls anything else other, including a malformed address", () => {
    expect(classifyReconcileError(new Error('Address "0x0E66" is invalid.'))).toBe("other");
    expect(classifyReconcileError("boom")).toBe("other");
  });
});
