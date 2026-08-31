import { describe, expect, it } from "vitest";
import { verifyAuditChain } from "../src/domain/audit.js";
import { createDemoSnapshot } from "../src/seed/demoSeed.js";

describe("append-only audit chain", () => {
  it("verifies the seeded chain", () => {
    expect(verifyAuditChain(createDemoSnapshot().auditEvents)).toBe(true);
  });

  it("detects evidence tampering", () => {
    const events = createDemoSnapshot().auditEvents;
    const receipt = events.find((event) => event.type === "RECEIPT_RECORDED");
    expect(receipt).toBeDefined();
    if (receipt) receipt.payload.receivedQuantityLiters = 8_000;
    expect(verifyAuditChain(events)).toBe(false);
  });
});
