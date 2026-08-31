import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { FieldRelayConfig } from "../src/config.js";
import { MemoryFieldRelayStore } from "../src/store/memoryStore.js";
import { createDemoSnapshot } from "../src/seed/demoSeed.js";

const config: FieldRelayConfig = {
  port: 4100,
  host: "127.0.0.1",
  logLevel: "silent",
  corsOrigin: "http://localhost:5173",
  destination: {
    type: "GENERIC_WEBHOOK",
    name: "ERP Demo / Generic Webhook",
    url: "local://delivery-simulator"
  }
};

describe("FieldRelay API", () => {
  let app: FastifyInstance;
  let store: MemoryFieldRelayStore;

  beforeEach(async () => {
    store = new MemoryFieldRelayStore(createDemoSnapshot());
    app = await buildApp({ store, config });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("serves the exact seeded shipment story with independent status dimensions", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/demo" });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.shipment).toMatchObject({
      id: "FR-2026-0842",
      lifecycleStatus: "RECEIVED",
      syncStatus: "SYNCED",
      exceptionStatus: "DISCREPANCY_OPEN",
      deliveryStatus: "NOT_STARTED",
      offeredQuantityLiters: 8200,
      pickupQuantityLiters: 8180,
      receivedQuantityLiters: 7940
    });
    expect(body.exception).toMatchObject({ id: "EX-0037", varianceLiters: -240 });
    expect(body.timeline.find((event: { id: string }) => event.id === "EV-0347")).toBeTruthy();
  });

  it("returns the original successful result when a lost offline response is retried", async () => {
    const operation = {
      operationId: "mobile-op-1",
      idempotencyKey: "mobile-idem-1",
      type: "CREATE_SHIPMENT",
      shipmentId: "FR-2026-9999",
      baseVersion: 0,
      deviceTimestamp: "2026-08-31T08:00:00+03:00",
      actor: { id: "maya", name: "Maya", role: "GENERATOR" },
      payload: { offeredQuantityLiters: 5000 }
    };
    const first = await app.inject({ method: "POST", url: "/api/v1/sync/operations", payload: operation });
    const retry = await app.inject({ method: "POST", url: "/api/v1/sync/operations", payload: operation });
    const recovery = await app.inject({ method: "GET", url: "/api/v1/sync/results/mobile-idem-1" });

    expect(first.statusCode).toBe(201);
    expect(retry.statusCode).toBe(201);
    expect(retry.json()).toMatchObject({ replayed: true, recovery: "ORIGINAL_RESULT_RETURNED" });
    expect(recovery.json()).toMatchObject({ replayed: true, recovery: "ORIGINAL_RESULT_RETURNED" });
    expect((await store.snapshot()).shipments.filter((shipment) => shipment.id === "FR-2026-9999")).toHaveLength(1);
  });

  it("rejects reuse of an idempotency key for a different operation", async () => {
    const operation = {
      operationId: "mobile-op-2",
      idempotencyKey: "mobile-idem-2",
      type: "CREATE_SHIPMENT",
      shipmentId: "FR-2026-9998",
      baseVersion: 0,
      deviceTimestamp: "2026-08-31T08:00:00+03:00",
      actor: { id: "maya", name: "Maya" },
      payload: {}
    };
    expect((await app.inject({ method: "POST", url: "/api/v1/sync/operations", payload: operation })).statusCode).toBe(201);
    const changed = await app.inject({
      method: "POST",
      url: "/api/v1/sync/operations",
      payload: { ...operation, payload: { offeredQuantityLiters: 7000 } }
    });
    expect(changed.statusCode).toBe(409);
    expect(changed.json().error.code).toBe("IDEMPOTENCY_KEY_REUSED");
  });

  it("records a no-overwrite conflict with all three review choices", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/sync/operations",
      payload: {
        operationId: "stale-receipt",
        idempotencyKey: "stale-receipt-idem",
        type: "RECORD_RECEIPT",
        shipmentId: "FR-2026-0842",
        baseVersion: 3,
        deviceTimestamp: "2026-08-31T14:09:00+03:00",
        actor: { id: "priya", name: "Priya" },
        payload: { receivedQuantityLiters: 8000 }
      }
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ status: "NEEDS_REVIEW", code: "VERSION_CONFLICT" });
    expect(response.json().conflict.options).toEqual([
      "SEND_LOCAL_FOR_REVIEW",
      "KEEP_SEPARATE_DRAFT",
      "USE_SERVER_VERSION"
    ]);
    const snapshot = await store.snapshot();
    const shipment = snapshot.shipments.find((item) => item.id === "FR-2026-0842");
    expect(shipment?.receivedQuantityLiters).toBe(7940);
    expect(shipment?.syncStatus).toBe("NEEDS_REVIEW");
  });

  it("resolves the discrepancy and creates the outbox and DL-019 atomically without rewriting evidence", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/exceptions/EX-0037/resolve",
      headers: { "idempotency-key": "resolve-ex-0037" },
      payload: {
        category: "DOCUMENTED_TRANSFER_LOSS",
        acceptedFinalQuantityLiters: 7940,
        reason: "Receiver reading verified against calibrated meter",
        note: "Both teams reviewed the original reports; accepted quantity recorded separately.",
        actor: { id: "ops-1", name: "Alex Morgan", role: "OPERATIONS" },
        occurredAt: "2026-08-31T14:30:00+03:00"
      }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().shipment).toMatchObject({
      lifecycleStatus: "COMPLETED",
      exceptionStatus: "RESOLVED",
      deliveryStatus: "PENDING",
      offeredQuantityLiters: 8200,
      pickupQuantityLiters: 8180,
      receivedQuantityLiters: 7940,
      acceptedFinalQuantityLiters: 7940
    });
    expect(response.json().delivery).toMatchObject({ id: "DL-019", status: "PENDING" });

    const snapshot = await store.snapshot();
    expect(snapshot.outbox).toHaveLength(1);
    expect(snapshot.deliveries).toHaveLength(1);
    expect(snapshot.deliveries[0]?.stableIdempotencyKey).toBe(snapshot.outbox[0]?.stableIdempotencyKey);
    expect(snapshot.auditEvents.at(-2)?.type).toBe("DISCREPANCY_RESOLVED");
    expect(snapshot.auditEvents.at(-1)?.type).toBe("DELIVERY_QUEUED");
  });

  it("moves 503 attempts 1-3 to DLQ, then manually replays attempt 4 to 200 using one destination key", async () => {
    await app.inject({
      method: "POST",
      url: "/api/v1/exceptions/EX-0037/resolve",
      headers: { "idempotency-key": "resolve-for-delivery" },
      payload: {
        category: "DOCUMENTED_TRANSFER_LOSS",
        acceptedFinalQuantityLiters: 7940,
        reason: "Verified",
        note: "Accepted separately after review",
        actor: { id: "ops-1", name: "Alex Morgan" }
      }
    });

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/deliveries/DL-019/attempt",
        headers: { "idempotency-key": `attempt-${attempt}` },
        payload: { simulatorMode: "retryable-failure" }
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().attempt).toMatchObject({ attemptNumber: attempt, httpStatus: 503 });
    }

    let snapshot = await store.snapshot();
    expect(snapshot.deliveries[0]?.status).toBe("DLQ");
    expect(snapshot.shipments[0]?.deliveryStatus).toBe("DLQ");

    const replay = await app.inject({
      method: "POST",
      url: "/api/v1/deliveries/DL-019/replay",
      headers: { "idempotency-key": "manual-replay-4" },
      payload: {
        simulatorMode: "success",
        actor: { id: "ops-1", name: "Alex Morgan", role: "OPERATIONS" }
      }
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().attempt).toMatchObject({
      attemptNumber: 4,
      kind: "MANUAL_REPLAY",
      httpStatus: 200,
      outcome: "SUCCEEDED"
    });

    snapshot = await store.snapshot();
    expect(snapshot.deliveries[0]?.status).toBe("DELIVERED");
    expect(snapshot.shipments[0]?.deliveryStatus).toBe("DELIVERED");
    const keys = snapshot.deliveryAttempts.map(
      (attempt) => (attempt.request.headers as Record<string, string>)["idempotency-key"]
    );
    expect(new Set(keys).size).toBe(1);
  });
});
