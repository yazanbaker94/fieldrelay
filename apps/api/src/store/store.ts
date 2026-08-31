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

export interface FieldRelayTransaction {
  acquireLock(key: string): Promise<void>;
  countDemoRuns(): Promise<number>;
  getShipment(id: string): Promise<Shipment | undefined>;
  insertShipment(shipment: Shipment): Promise<void>;
  updateShipment(shipment: Shipment, expectedVersion: number): Promise<void>;

  listAuditEvents(shipmentId: string): Promise<AuditEvent[]>;
  appendAuditEvent(event: AuditEvent): Promise<void>;

  getException(id: string): Promise<ShipmentException | undefined>;
  getExceptionByShipment(shipmentId: string): Promise<ShipmentException | undefined>;
  insertException(exceptionRecord: ShipmentException): Promise<void>;
  updateException(exceptionRecord: ShipmentException, expectedVersion: number): Promise<void>;

  getOutbox(id: string): Promise<OutboxRecord | undefined>;
  insertOutbox(record: OutboxRecord): Promise<void>;
  updateOutbox(record: OutboxRecord): Promise<void>;

  getDelivery(id: string): Promise<DeliveryJob | undefined>;
  getDeliveryByShipment(shipmentId: string): Promise<DeliveryJob | undefined>;
  insertDelivery(job: DeliveryJob): Promise<void>;
  updateDelivery(job: DeliveryJob): Promise<void>;
  appendDeliveryAttempt(attempt: DeliveryAttempt): Promise<void>;

  getIdempotencyResult(key: string): Promise<StoredIdempotencyResult | undefined>;
  insertIdempotencyResult(result: StoredIdempotencyResult): Promise<void>;
  insertConflict(conflict: SyncConflict): Promise<void>;
}

export interface FieldRelayStore {
  readonly kind: "memory" | "postgres";
  transaction<T>(work: (tx: FieldRelayTransaction) => Promise<T>): Promise<T>;
  snapshot(): Promise<FieldRelaySnapshot>;
  close(): Promise<void>;
}
