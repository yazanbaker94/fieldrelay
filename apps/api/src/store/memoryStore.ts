import { DomainError } from "../domain/errors.js";
import { isDeepStrictEqual } from "node:util";
import type {
  AuditEvent,
  DeliveryAttempt,
  DeliveryJob,
  FieldRelaySnapshot,
  OutboxRecord,
  Shipment,
  ShipmentException,
  StoredIdempotencyResult,
  SyncConflict
} from "../domain/types.js";
import type { FieldRelayStore, FieldRelayTransaction } from "./store.js";

type MemoryState = FieldRelaySnapshot;

function emptyState(): MemoryState {
  return {
    shipments: [],
    auditEvents: [],
    exceptions: [],
    outbox: [],
    deliveries: [],
    deliveryAttempts: [],
    conflicts: [],
    idempotencyResults: []
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

class MemoryTransaction implements FieldRelayTransaction {
  constructor(private readonly state: MemoryState) {}

  async acquireLock(_key: string): Promise<void> {
    // Memory transactions are serialized by MemoryFieldRelayStore.
  }

  async countDemoRuns(): Promise<number> {
    return this.state.exceptions.filter((record) => /^EX-0037-[A-Z0-9-]+$/.test(record.id)).length;
  }

  async getShipment(id: string): Promise<Shipment | undefined> {
    return clone(this.state.shipments.find((shipment) => shipment.id === id));
  }

  async insertShipment(shipment: Shipment): Promise<void> {
    if (this.state.shipments.some((existing) => existing.id === shipment.id)) {
      throw new DomainError("Shipment already exists", 409, "DUPLICATE_SHIPMENT", { shipmentId: shipment.id });
    }
    this.state.shipments.push(clone(shipment));
  }

  async updateShipment(shipment: Shipment, expectedVersion: number): Promise<void> {
    const index = this.state.shipments.findIndex((existing) => existing.id === shipment.id);
    if (index < 0) {
      throw new DomainError("Shipment not found", 404, "NOT_FOUND", { shipmentId: shipment.id });
    }
    const current = this.state.shipments[index];
    if (!current || current.version !== expectedVersion) {
      throw new DomainError("Shipment changed during the transaction", 409, "VERSION_CONFLICT", {
        shipmentId: shipment.id,
        expectedVersion,
        currentVersion: current?.version
      });
    }
    for (const field of [
      "offeredQuantityLiters",
      "pickupQuantityLiters",
      "receivedQuantityLiters",
      "acceptedFinalQuantityLiters"
    ] as const) {
      if (current[field] !== undefined && shipment[field] !== current[field]) {
        throw new DomainError(`${field} is immutable once recorded`, 409, "IMMUTABLE_EVIDENCE", {
          shipmentId: shipment.id,
          field
        });
      }
    }
    this.state.shipments[index] = clone(shipment);
  }

  async listAuditEvents(shipmentId: string): Promise<AuditEvent[]> {
    return clone(
      this.state.auditEvents
        .filter((event) => event.shipmentId === shipmentId)
        .sort((a, b) => a.sequence - b.sequence)
    );
  }

  async appendAuditEvent(event: AuditEvent): Promise<void> {
    if (
      this.state.auditEvents.some(
        (existing) => existing.id === event.id ||
          (existing.shipmentId === event.shipmentId && existing.sequence === event.sequence)
      )
    ) {
      throw new DomainError("Audit event is not unique", 409, "DUPLICATE_AUDIT_EVENT");
    }
    this.state.auditEvents.push(clone(event));
  }

  async getException(id: string): Promise<ShipmentException | undefined> {
    return clone(this.state.exceptions.find((record) => record.id === id));
  }

  async getExceptionByShipment(shipmentId: string): Promise<ShipmentException | undefined> {
    return clone(this.state.exceptions.find((record) => record.shipmentId === shipmentId));
  }

  async insertException(exceptionRecord: ShipmentException): Promise<void> {
    if (
      this.state.exceptions.some(
        (existing) => existing.id === exceptionRecord.id || existing.shipmentId === exceptionRecord.shipmentId
      )
    ) {
      throw new DomainError("Shipment exception already exists", 409, "DUPLICATE_EXCEPTION");
    }
    this.state.exceptions.push(clone(exceptionRecord));
  }

  async updateException(exceptionRecord: ShipmentException, expectedVersion: number): Promise<void> {
    const index = this.state.exceptions.findIndex((existing) => existing.id === exceptionRecord.id);
    const current = this.state.exceptions[index];
    if (index < 0 || !current) {
      throw new DomainError("Shipment exception not found", 404, "NOT_FOUND");
    }
    if (current.version !== expectedVersion) {
      throw new DomainError("Exception changed during the transaction", 409, "VERSION_CONFLICT");
    }
    for (const field of [
      "shipmentId",
      "pickupQuantityLiters",
      "receivedQuantityLiters",
      "varianceLiters",
      "variancePercentage",
      "threshold",
      "openedAt"
    ] as const) {
      if (!isDeepStrictEqual(current[field], exceptionRecord[field])) {
        throw new DomainError("Original discrepancy evidence is immutable", 409, "IMMUTABLE_EVIDENCE", {
          exceptionId: exceptionRecord.id,
          field
        });
      }
    }
    this.state.exceptions[index] = clone(exceptionRecord);
  }

  async getOutbox(id: string): Promise<OutboxRecord | undefined> {
    return clone(this.state.outbox.find((record) => record.id === id));
  }

  async insertOutbox(record: OutboxRecord): Promise<void> {
    if (
      this.state.outbox.some(
        (existing) => existing.id === record.id || existing.stableIdempotencyKey === record.stableIdempotencyKey
      )
    ) {
      throw new DomainError("Outbox record already exists", 409, "DUPLICATE_OUTBOX");
    }
    this.state.outbox.push(clone(record));
  }

  async updateOutbox(record: OutboxRecord): Promise<void> {
    const index = this.state.outbox.findIndex((existing) => existing.id === record.id);
    const current = this.state.outbox[index];
    if (index < 0 || !current) {
      throw new DomainError("Outbox record not found", 404, "NOT_FOUND");
    }
    for (const field of [
      "shipmentId",
      "eventType",
      "payload",
      "destinationType",
      "stableIdempotencyKey",
      "createdAt"
    ] as const) {
      if (!isDeepStrictEqual(current[field], record[field])) {
        throw new DomainError("Outbox evidence is immutable", 409, "IMMUTABLE_EVIDENCE", {
          outboxId: record.id,
          field
        });
      }
    }
    if (current.deliveredAt !== undefined && current.deliveredAt !== record.deliveredAt) {
      throw new DomainError("Outbox delivery time is immutable once recorded", 409, "IMMUTABLE_EVIDENCE");
    }
    this.state.outbox[index] = clone(record);
  }

  async getDelivery(id: string): Promise<DeliveryJob | undefined> {
    return clone(this.state.deliveries.find((job) => job.id === id));
  }

  async getDeliveryByShipment(shipmentId: string): Promise<DeliveryJob | undefined> {
    return clone(this.state.deliveries.find((job) => job.shipmentId === shipmentId));
  }

  async insertDelivery(job: DeliveryJob): Promise<void> {
    if (
      this.state.deliveries.some(
        (existing) =>
          existing.id === job.id ||
          existing.outboxId === job.outboxId ||
          existing.correlationId === job.correlationId
      )
    ) {
      throw new DomainError("Delivery already exists", 409, "DUPLICATE_DELIVERY");
    }
    this.state.deliveries.push(clone(job));
  }

  async updateDelivery(job: DeliveryJob): Promise<void> {
    const index = this.state.deliveries.findIndex((existing) => existing.id === job.id);
    const current = this.state.deliveries[index];
    if (index < 0 || !current) {
      throw new DomainError("Delivery not found", 404, "NOT_FOUND");
    }
    for (const field of [
      "shipmentId",
      "outboxId",
      "destinationType",
      "destinationName",
      "destinationUrl",
      "stableIdempotencyKey",
      "maxAttempts",
      "correlationId",
      "createdAt"
    ] as const) {
      if (current[field] !== job[field]) {
        throw new DomainError("Delivery identity is immutable", 409, "IMMUTABLE_EVIDENCE", {
          deliveryId: job.id,
          field
        });
      }
    }
    if (current.deliveredAt !== undefined && current.deliveredAt !== job.deliveredAt) {
      throw new DomainError("Delivery time is immutable once recorded", 409, "IMMUTABLE_EVIDENCE");
    }
    this.state.deliveries[index] = clone(job);
  }

  async appendDeliveryAttempt(attempt: DeliveryAttempt): Promise<void> {
    if (
      this.state.deliveryAttempts.some(
        (existing) =>
          existing.id === attempt.id ||
          (existing.deliveryId === attempt.deliveryId && existing.attemptNumber === attempt.attemptNumber)
      )
    ) {
      throw new DomainError("Delivery attempt already exists", 409, "DUPLICATE_DELIVERY_ATTEMPT");
    }
    this.state.deliveryAttempts.push(clone(attempt));
  }

  async getIdempotencyResult(key: string): Promise<StoredIdempotencyResult | undefined> {
    return clone(this.state.idempotencyResults.find((result) => result.key === key));
  }

  async insertIdempotencyResult(result: StoredIdempotencyResult): Promise<void> {
    if (this.state.idempotencyResults.some((existing) => existing.key === result.key)) {
      throw new DomainError("Idempotency result already exists", 409, "DUPLICATE_IDEMPOTENCY_KEY");
    }
    this.state.idempotencyResults.push(clone(result));
  }

  async insertConflict(conflict: SyncConflict): Promise<void> {
    this.state.conflicts.push(clone(conflict));
  }
}

export class MemoryFieldRelayStore implements FieldRelayStore {
  readonly kind = "memory" as const;
  private state: MemoryState;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(seed?: FieldRelaySnapshot) {
    this.state = seed ? clone(seed) : emptyState();
  }

  async transaction<T>(work: (tx: FieldRelayTransaction) => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      const draft = clone(this.state);
      const result = await work(new MemoryTransaction(draft));
      this.state = draft;
      return clone(result);
    };
    const result = this.queue.then(run, run);
    this.queue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  async snapshot(): Promise<FieldRelaySnapshot> {
    await this.queue;
    return clone(this.state);
  }

  async replace(snapshot: FieldRelaySnapshot): Promise<void> {
    const run = async (): Promise<void> => {
      this.state = clone(snapshot);
    };
    const result = this.queue.then(run, run);
    this.queue = result;
    await result;
  }

  async close(): Promise<void> {
    await this.queue;
  }
}
