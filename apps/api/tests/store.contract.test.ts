import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { runMigrations } from "../src/cli/migrate.js";
import type { OutboxRecord, Shipment } from "../src/domain/types.js";
import { MemoryFieldRelayStore } from "../src/store/memoryStore.js";
import { PostgresFieldRelayStore } from "../src/store/postgresStore.js";
import type { FieldRelayStore } from "../src/store/store.js";

function shipment(id: string): Shipment {
  return {
    id,
    lifecycleStatus: "OFFERED",
    syncStatus: "SYNCED",
    exceptionStatus: "NONE",
    deliveryStatus: "NOT_STARTED",
    offeredQuantityLiters: 8200,
    version: 1,
    createdAt: "2026-08-31T06:10:00.000Z",
    updatedAt: "2026-08-31T06:14:24.000Z"
  };
}

async function verifyStoreContract(store: FieldRelayStore): Promise<void> {
  const suffix = randomUUID().replaceAll("-", "").toUpperCase();
  const committed = shipment(`FR-CONTRACT-${suffix}`);
  await store.transaction(async (tx) => tx.insertShipment(committed));

  await expect(
    store.transaction(async (tx) => {
      await tx.updateShipment(
        { ...committed, offeredQuantityLiters: 8100, version: 2, updatedAt: "2026-08-31T06:15:00.000Z" },
        1
      );
    })
  ).rejects.toBeTruthy();
  expect((await store.snapshot()).shipments.find((record) => record.id === committed.id)).toMatchObject({
    offeredQuantityLiters: 8200,
    version: 1
  });

  const stableIdempotencyKey = `contract:${suffix}`;
  const firstOutbox: OutboxRecord = {
    id: `OB-${suffix}`,
    shipmentId: committed.id,
    eventType: "SHIPMENT_COMPLETED",
    payload: { shipmentId: committed.id },
    destinationType: "GENERIC_WEBHOOK",
    status: "PENDING",
    stableIdempotencyKey,
    createdAt: "2026-08-31T06:20:00.000Z"
  };
  await store.transaction(async (tx) => tx.insertOutbox(firstOutbox));
  await expect(
    store.transaction(async (tx) =>
      tx.insertOutbox({ ...firstOutbox, id: `OB-DUP-${suffix}`, payload: { shipmentId: "different" } })
    )
  ).rejects.toBeTruthy();
  expect((await store.snapshot()).outbox.filter((record) => record.stableIdempotencyKey === stableIdempotencyKey)).toHaveLength(1);

  const rolledBackId = `FR-ROLLBACK-${suffix}`;
  await expect(
    store.transaction(async (tx) => {
      await tx.insertShipment(shipment(rolledBackId));
      throw new Error("force rollback");
    })
  ).rejects.toThrow("force rollback");
  expect((await store.snapshot()).shipments.some((record) => record.id === rolledBackId)).toBe(false);
}

describe("FieldRelay store contract", () => {
  it("enforces transaction rollback, immutable evidence, and downstream-key uniqueness in memory", async () => {
    const store = new MemoryFieldRelayStore();
    try {
      await verifyStoreContract(store);
    } finally {
      await store.close();
    }
  });

  const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
  it.skipIf(!testDatabaseUrl)(
    "enforces the same contract in PostgreSQL when TEST_DATABASE_URL is provided",
    async () => {
      await runMigrations(testDatabaseUrl!);
      const store = new PostgresFieldRelayStore(testDatabaseUrl!);
      try {
        await verifyStoreContract(store);
      } finally {
        await store.close();
      }
    },
    30_000
  );
});
