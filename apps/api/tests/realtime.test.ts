import { describe, expect, it } from "vitest";
import { FieldRelayService } from "../src/domain/service.js";
import { createDemoSnapshot } from "../src/seed/demoSeed.js";
import { MemoryFieldRelayStore } from "../src/store/memoryStore.js";

describe("realtime event contract", () => {
  it("emits typed changes once and suppresses duplicate notifications for idempotent recovery", async () => {
    const store = new MemoryFieldRelayStore(createDemoSnapshot());
    const service = new FieldRelayService(store, {
      type: "GENERIC_WEBHOOK",
      name: "ERP Demo / Generic Webhook",
      url: "local://delivery-simulator"
    });
    const events: string[] = [];
    const unsubscribe = service.realtime.subscribe((event) => events.push(event.type));
    try {
      await service.createDemoRun({ requestedRunId: "event-run", actionIdempotencyKey: "event-run-create" });
      await service.createDemoRun({ requestedRunId: "event-run", actionIdempotencyKey: "event-run-create" });
      expect(events).toEqual(["demo.run.created"]);

      await service.resolveException(
        "EX-0037-EVENT-RUN",
        {
          category: "DOCUMENTED_TRANSFER_LOSS",
          acceptedFinalQuantityLiters: 7940,
          reason: "Meter reading verified",
          note: "Original evidence preserved and accepted quantity recorded separately.",
          actor: { id: "jordan-patel", name: "Jordan Patel", role: "OPERATIONS" },
          occurredAt: "2026-08-31T14:30:00-06:00"
        },
        "event-run-resolve"
      );
      await service.processDelivery("DL-019-EVENT-RUN", {
        kind: "AUTOMATIC",
        simulatorMode: "retryable-failure",
        actionIdempotencyKey: "event-run-attempt-1",
        actor: { id: "system", name: "FieldRelay", role: "SYSTEM" }
      });
      expect(events).toEqual(["demo.run.created", "exception.changed", "delivery.changed"]);
    } finally {
      unsubscribe();
      await store.close();
    }
  });
});
