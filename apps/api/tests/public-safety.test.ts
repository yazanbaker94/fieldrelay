import type { AddressInfo } from "node:net";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { FieldRelayConfig } from "../src/config.js";
import { canonicalDemoScenario, createDemoSnapshot } from "../src/seed/demoSeed.js";
import { MemoryFieldRelayStore } from "../src/store/memoryStore.js";

const externalDestination = {
  type: "GENERIC_WEBHOOK" as const,
  name: "Must not be reached",
  url: "https://example.test/delivery"
};

function safeConfig(overrides: Partial<FieldRelayConfig> = {}): FieldRelayConfig {
  return {
    port: 4100,
    host: "127.0.0.1",
    logLevel: "silent",
    corsOrigin: "https://fieldrelay.swoop.video",
    allowCanonicalMutations: false,
    publicWriteLimitPerHour: 100,
    maxDemoRuns: 10,
    maxSseConnectionsPerClient: 2,
    maxSseConnectionsGlobal: 4,
    destination: externalDestination,
    ...overrides
  };
}

const resolutionPayload = {
  category: "DOCUMENTED_TRANSFER_LOSS",
  acceptedFinalQuantityLiters: 7940,
  reason: "Receiver reading verified against calibrated meter",
  note: "Both immutable reports remain visible and the accepted quantity is separate.",
  actor: { id: "untrusted-user", name: "Untrusted User", role: "ADMIN" },
  occurredAt: "2099-01-01T00:00:00Z"
};

describe("public simulator safety boundary", () => {
  const apps: FastifyInstance[] = [];

  async function makeApp(config = safeConfig()): Promise<{ app: FastifyInstance; store: MemoryFieldRelayStore }> {
    const store = new MemoryFieldRelayStore(createDemoSnapshot());
    const app = await buildApp({ store, config });
    await app.ready();
    apps.push(app);
    return { app, store };
  }

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("keeps canonical and unregistered resources read-only", async () => {
    const { app, store } = await makeApp();

    const canonicalResolution = await app.inject({
      method: "POST",
      url: "/api/v1/exceptions/EX-0037/resolve",
      headers: { "idempotency-key": "blocked-canonical-resolution" },
      payload: resolutionPayload
    });
    expect(canonicalResolution.statusCode).toBe(403);
    expect(canonicalResolution.json().error.code).toBe("PUBLIC_DEMO_READ_ONLY");

    const canonicalSync = await app.inject({
      method: "POST",
      url: "/api/v1/sync/operations",
      payload: {
        operationId: "blocked-canonical-sync",
        idempotencyKey: "blocked-canonical-sync",
        type: "RECORD_RECEIPT",
        shipmentId: "FR-2026-0842",
        baseVersion: 4,
        deviceTimestamp: "2026-08-31T14:09:00-06:00",
        actor: resolutionPayload.actor,
        payload: { receivedQuantityLiters: 7900 }
      }
    });
    expect(canonicalSync.statusCode).toBe(403);

    const arbitraryCreate = await app.inject({
      method: "POST",
      url: "/api/v1/sync/operations",
      payload: {
        operationId: "arbitrary-create",
        idempotencyKey: "arbitrary-create",
        type: "CREATE_SHIPMENT",
        shipmentId: "FR-ATTACKER-0001",
        baseVersion: 0,
        deviceTimestamp: "2026-08-31T08:00:00-06:00",
        actor: resolutionPayload.actor,
        payload: { offeredQuantityLiters: 1 }
      }
    });
    expect(arbitraryCreate.statusCode).toBe(403);

    const canonicalDelivery = await app.inject({
      method: "POST",
      url: "/api/v1/deliveries/DL-019/attempt",
      headers: { "idempotency-key": "blocked-canonical-delivery" },
      payload: { simulatorMode: "success" }
    });
    expect(canonicalDelivery.statusCode).toBe(403);

    expect((await store.snapshot()).shipments[0]).toMatchObject({
      id: "FR-2026-0842",
      version: 4,
      exceptionStatus: "DISCREPANCY_OPEN",
      deliveryStatus: "NOT_STARTED"
    });
  });

  it("allows only generated isolated-run writes, controls actors, and forces local delivery", async () => {
    const { app, store } = await makeApp();
    const create = await app.inject({
      method: "POST",
      url: "/api/v1/demo/runs",
      headers: { "idempotency-key": "create-guarded-one" },
      payload: { runId: "guarded-one", offlineOfferedQuantityLiters: 7331 }
    });
    expect(create.statusCode).toBe(201);
    expect(create.json().scenario.timeZone).toBe("America/Edmonton");
    expect(create.json().offlineRecovery.operation.deviceTimestamp).toContain("-06:00");
    expect(create.json().offlineRecovery.operation.payload).toEqual({ offeredQuantityLiters: 7331 });

    const tamperedOfflineSave = await app.inject({
      method: "POST",
      url: "/api/v1/sync/operations",
      payload: {
        ...create.json().offlineRecovery.operation,
        payload: { offeredQuantityLiters: 7332 }
      }
    });
    expect(tamperedOfflineSave.statusCode).toBe(403);
    expect(tamperedOfflineSave.json().error.code).toBe("PUBLIC_DEMO_READ_ONLY");

    const offlineOperation = {
      ...create.json().offlineRecovery.operation,
      actor: resolutionPayload.actor
    };
    const offlineSave = await app.inject({
      method: "POST",
      url: "/api/v1/sync/operations",
      payload: offlineOperation
    });
    expect(offlineSave.statusCode).toBe(201);

    const resources = create.json().resources;
    const resolution = await app.inject({
      method: "POST",
      url: `/api/v1/exceptions/${resources.exceptionId}/resolve`,
      headers: { "idempotency-key": "resolve-guarded-one" },
      payload: resolutionPayload
    });
    expect(resolution.statusCode).toBe(200);
    expect(resolution.json().exception.resolvedBy).toEqual(canonicalDemoScenario.people.operationsSpecialist);
    expect(resolution.json().exception.resolvedAt).not.toBe(resolutionPayload.occurredAt);
    expect(resolution.json().delivery).toMatchObject({
      id: "DL-019-GUARDED-ONE",
      destinationType: "GENERIC_WEBHOOK",
      destinationName: "FieldRelay local delivery simulator"
    });
    expect(resolution.json().delivery).not.toHaveProperty("destinationUrl");
    expect(resolution.json().delivery).not.toHaveProperty("lastError");

    const recoveredResolution = await app.inject({
      method: "GET",
      url: "/api/v1/sync/results/resolve-guarded-one"
    });
    expect(recoveredResolution.statusCode).toBe(200);
    expect(recoveredResolution.json()).toMatchObject({ replayed: true, recovery: "ORIGINAL_RESULT_RETURNED" });
    expect(recoveredResolution.json().delivery).not.toHaveProperty("destinationUrl");
    expect(recoveredResolution.json().delivery).not.toHaveProperty("lastError");

    const attempt = await app.inject({
      method: "POST",
      url: `/api/v1/deliveries/${resources.deliveryId}/attempt`,
      headers: { "idempotency-key": "attempt-guarded-one" },
      payload: { simulatorMode: "retryable-failure", actor: resolutionPayload.actor }
    });
    expect(attempt.statusCode).toBe(200);
    expect(attempt.json().attempt).toMatchObject({ outcome: "RETRYABLE_FAILURE", httpStatus: 503 });
    expect(attempt.json().delivery).not.toHaveProperty("destinationUrl");
    expect(attempt.json().delivery).not.toHaveProperty("lastError");
    expect(attempt.json().attempt).not.toHaveProperty("request");
    expect(attempt.json().attempt).not.toHaveProperty("response");

    const recoveredAttempt = await app.inject({
      method: "GET",
      url: "/api/v1/sync/results/attempt-guarded-one"
    });
    expect(recoveredAttempt.statusCode).toBe(200);
    expect(recoveredAttempt.json()).toMatchObject({ replayed: true, recovery: "ORIGINAL_RESULT_RETURNED" });
    expect(recoveredAttempt.json().delivery).not.toHaveProperty("destinationUrl");
    expect(recoveredAttempt.json().delivery).not.toHaveProperty("lastError");
    expect(recoveredAttempt.json().attempt).not.toHaveProperty("request");
    expect(recoveredAttempt.json().attempt).not.toHaveProperty("response");

    const publicDetail = await app.inject({
      method: "GET",
      url: `/api/v1/deliveries/${resources.deliveryId}`
    });
    expect(publicDetail.statusCode).toBe(200);
    expect(publicDetail.json().delivery).not.toHaveProperty("destinationUrl");
    expect(publicDetail.json().delivery).not.toHaveProperty("lastError");
    expect(publicDetail.json().attempts[0]).not.toHaveProperty("request");
    expect(publicDetail.json().attempts[0]).not.toHaveProperty("response");

    const publicRun = await app.inject({ method: "GET", url: "/api/v1/demo/runs/guarded-one" });
    expect(publicRun.statusCode).toBe(200);
    expect(publicRun.json().delivery).not.toHaveProperty("destinationUrl");
    expect(publicRun.json().deliveryAttempts[0]).not.toHaveProperty("request");

    const publicShipment = await app.inject({
      method: "GET",
      url: `/api/v1/shipments/${resources.shipmentId}`
    });
    expect(publicShipment.statusCode).toBe(200);
    expect(publicShipment.json().delivery).not.toHaveProperty("destinationUrl");
    expect(publicShipment.json().delivery).not.toHaveProperty("lastError");

    const snapshot = await store.snapshot();
    const offlineCreated = snapshot.auditEvents.find(
      (event) => event.shipmentId === offlineOperation.shipmentId && event.type === "SHIPMENT_CREATED"
    );
    expect(offlineCreated?.actor).toEqual(canonicalDemoScenario.people.generatorCoordinator);
    expect(snapshot.shipments.find((shipment) => shipment.id === offlineOperation.shipmentId)).toMatchObject({
      offeredQuantityLiters: 7331
    });
    expect(snapshot.deliveries.find((delivery) => delivery.id === resources.deliveryId)).toMatchObject({
      destinationUrl: "local://delivery-simulator"
    });
    const deliveryAttempted = snapshot.auditEvents.find(
      (event) => event.shipmentId === resources.shipmentId && event.type === "DELIVERY_ATTEMPTED"
    );
    expect(deliveryAttempted?.actor).toEqual({ id: "system", name: "FieldRelay", role: "SYSTEM" });
  });

  it("limits public POST writes per client without coupling distinct clients", async () => {
    const { app } = await makeApp(safeConfig({ publicWriteLimitPerHour: 2 }));
    for (const [index, expected] of [201, 201, 429].entries()) {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/demo/runs",
        headers: {
          "idempotency-key": `rate-client-a-${index}`,
          "x-forwarded-for": "203.0.113.10"
        },
        payload: { runId: `rate-a-${index}` }
      });
      expect(response.statusCode).toBe(expected);
      if (expected === 429) expect(response.json().error.code).toBe("PUBLIC_WRITE_RATE_LIMIT_EXCEEDED");
    }

    const otherClient = await app.inject({
      method: "POST",
      url: "/api/v1/demo/runs",
      headers: { "idempotency-key": "rate-client-b", "x-forwarded-for": "203.0.113.11" },
      payload: { runId: "rate-client-b" }
    });
    expect(otherClient.statusCode).toBe(201);
  });

  it("enforces the immutable run cap after honoring an existing idempotent result", async () => {
    const { app } = await makeApp(safeConfig({ maxDemoRuns: 1 }));
    const request = {
      method: "POST" as const,
      url: "/api/v1/demo/runs",
      headers: { "idempotency-key": "capacity-first" },
      payload: { runId: "capacity-one" }
    };
    expect((await app.inject(request)).statusCode).toBe(201);
    const replay = await app.inject(request);
    expect(replay.statusCode).toBe(201);
    expect(replay.json()).toMatchObject({ replayed: true, runId: "capacity-one" });

    const full = await app.inject({
      method: "POST",
      url: "/api/v1/demo/runs",
      headers: { "idempotency-key": "capacity-second" },
      payload: { runId: "capacity-two" }
    });
    expect(full.statusCode).toBe(503);
    expect(full.json().error).toMatchObject({ code: "DEMO_RUN_CAPACITY_REACHED", details: { limit: 1 } });
  });

  it("serializes concurrent run-cap claims", async () => {
    const { app } = await makeApp(safeConfig({ maxDemoRuns: 1 }));
    const [left, right] = await Promise.all(
      ["left", "right"].map((side) =>
        app.inject({
          method: "POST",
          url: "/api/v1/demo/runs",
          headers: { "idempotency-key": `capacity-concurrent-${side}` },
          payload: { runId: `capacity-${side}` }
        })
      )
    );
    expect([left.statusCode, right.statusCode].sort()).toEqual([201, 503]);
  });

  it("allows only configured CORS origins", async () => {
    const { app } = await makeApp(
      safeConfig({
        corsOrigin: "https://fieldrelay.swoop.video,https://private-preview.example",
        corsOrigins: ["https://fieldrelay.swoop.video", "https://private-preview.example"]
      })
    );
    const preview = await app.inject({
      method: "GET",
      url: "/api/v1/meta",
      headers: { origin: "https://private-preview.example" }
    });
    expect(preview.headers["access-control-allow-origin"]).toBe("https://private-preview.example");
    const denied = await app.inject({
      method: "GET",
      url: "/api/v1/meta",
      headers: { origin: "https://unlisted.example" }
    });
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("caps SSE per client and globally, then releases capacity when a stream closes", async () => {
    const { app } = await makeApp(
      safeConfig({ maxSseConnectionsPerClient: 1, maxSseConnectionsGlobal: 2 })
    );
    await app.listen({ host: "127.0.0.1", port: 0 });
    const { port } = app.server.address() as AddressInfo;
    const endpoint = `http://127.0.0.1:${port}/api/v1/events`;

    const first = await fetch(endpoint, { headers: { "x-forwarded-for": "203.0.113.20" } });
    expect(first.status).toBe(200);
    const sameClient = await fetch(endpoint, { headers: { "x-forwarded-for": "203.0.113.20" } });
    expect(sameClient.status).toBe(429);
    await sameClient.body?.cancel();

    const second = await fetch(endpoint, { headers: { "x-forwarded-for": "203.0.113.21" } });
    expect(second.status).toBe(200);
    const globalLimit = await fetch(endpoint, { headers: { "x-forwarded-for": "203.0.113.22" } });
    expect(globalLimit.status).toBe(429);
    await globalLimit.body?.cancel();

    await first.body?.cancel();
    let replacement: Response | undefined;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      replacement = await fetch(endpoint, { headers: { "x-forwarded-for": "203.0.113.22" } });
      if (replacement.status === 200) break;
      await replacement.body?.cancel();
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(replacement?.status).toBe(200);
    await replacement?.body?.cancel();
    await second.body?.cancel();
  });
});
