export const lifecycleStatuses = [
  "DRAFT",
  "OFFERED",
  "ACCEPTED",
  "PICKED_UP",
  "IN_TRANSIT",
  "RECEIVED",
  "COMPLETED"
] as const;

export const syncStatuses = [
  "SAVED_ON_DEVICE",
  "WAITING",
  "SYNCING",
  "SYNCED",
  "NEEDS_REVIEW"
] as const;

export const exceptionStatuses = ["NONE", "DISCREPANCY_OPEN", "RESOLVED"] as const;

export const deliveryStatuses = [
  "NOT_STARTED",
  "PENDING",
  "RETRYING",
  "FAILED",
  "DLQ",
  "DELIVERED"
] as const;

export type LifecycleStatus = (typeof lifecycleStatuses)[number];
export type SyncStatus = (typeof syncStatuses)[number];
export type ExceptionStatus = (typeof exceptionStatuses)[number];
export type DeliveryStatus = (typeof deliveryStatuses)[number];

export interface Actor {
  id: string;
  name: string;
  role?: string;
}

export interface Shipment {
  id: string;
  lifecycleStatus: LifecycleStatus;
  syncStatus: SyncStatus;
  exceptionStatus: ExceptionStatus;
  deliveryStatus: DeliveryStatus;
  offeredQuantityLiters?: number;
  pickupQuantityLiters?: number;
  receivedQuantityLiters?: number;
  acceptedFinalQuantityLiters?: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEvent {
  id: string;
  shipmentId: string;
  sequence: number;
  type:
    | "SHIPMENT_CREATED"
    | "SHIPMENT_OFFERED"
    | "HANDOFF_ACCEPTED"
    | "PICKUP_CONFIRMED"
    | "RECEIPT_RECORDED"
    | "DISCREPANCY_OPENED"
    | "DISCREPANCY_RESOLVED"
    | "DELIVERY_QUEUED"
    | "DELIVERY_ATTEMPTED"
    | "DELIVERY_REPLAYED";
  actor: Actor;
  source: "MOBILE" | "WEB" | "SYSTEM";
  occurredAt: string;
  recordedAt: string;
  payload: Record<string, unknown>;
  previousHash: string | null;
  eventHash: string;
}

export interface DiscrepancyThreshold {
  absoluteLiters: 100;
  percentage: 0.01;
  operator: "AND";
}

export interface ShipmentException {
  id: string;
  shipmentId: string;
  status: "DISCREPANCY_OPEN" | "RESOLVED";
  pickupQuantityLiters: number;
  receivedQuantityLiters: number;
  varianceLiters: number;
  variancePercentage: number;
  threshold: DiscrepancyThreshold;
  category?: string;
  acceptedFinalQuantityLiters?: number;
  reason?: string;
  note?: string;
  openedAt: string;
  resolvedBy?: Actor;
  resolvedAt?: string;
  version: number;
}

export type DestinationType = "GENERIC_WEBHOOK" | "ODATA_EXAMPLE";

export interface OutboxRecord {
  id: string;
  shipmentId: string;
  eventType: "SHIPMENT_COMPLETED";
  payload: Record<string, unknown>;
  destinationType: DestinationType;
  status: "PENDING" | "DELIVERED" | "DLQ" | "FAILED";
  stableIdempotencyKey: string;
  createdAt: string;
  deliveredAt?: string;
}

export interface DeliveryJob {
  id: string;
  shipmentId: string;
  outboxId: string;
  destinationType: DestinationType;
  destinationName: string;
  destinationUrl: string;
  status: Exclude<DeliveryStatus, "NOT_STARTED">;
  stableIdempotencyKey: string;
  attemptCount: number;
  maxAttempts: number;
  correlationId: string;
  lastHttpStatus?: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string;
}

export interface DeliveryAttempt {
  id: string;
  deliveryId: string;
  attemptNumber: number;
  kind: "AUTOMATIC" | "MANUAL_REPLAY";
  request: Record<string, unknown>;
  response: Record<string, unknown>;
  httpStatus: number;
  outcome: "SUCCEEDED" | "RETRYABLE_FAILURE" | "PERMANENT_FAILURE";
  occurredAt: string;
}

export interface SyncConflict {
  id: string;
  shipmentId: string;
  idempotencyKey: string;
  operationType: SyncOperationType;
  baseVersion: number;
  serverVersion: number;
  localPayload: Record<string, unknown>;
  options: ["SEND_LOCAL_FOR_REVIEW", "KEEP_SEPARATE_DRAFT", "USE_SERVER_VERSION"];
  createdAt: string;
}

export type SyncOperationType =
  | "CREATE_SHIPMENT"
  | "OFFER_SHIPMENT"
  | "ACCEPT_HANDOFF"
  | "CONFIRM_PICKUP"
  | "RECORD_RECEIPT";

export interface SyncOperation {
  operationId: string;
  idempotencyKey: string;
  type: SyncOperationType;
  shipmentId: string;
  baseVersion: number;
  deviceTimestamp: string;
  actor: Actor;
  payload: Record<string, unknown>;
}

export interface StoredIdempotencyResult {
  key: string;
  requestHash: string;
  operationType: string;
  shipmentId?: string;
  statusCode: number;
  response: Record<string, unknown>;
  createdAt: string;
}

export interface DeliveryDestinationConfig {
  type: DestinationType;
  name: string;
  url: string;
}

export interface FieldRelaySnapshot {
  shipments: Shipment[];
  auditEvents: AuditEvent[];
  exceptions: ShipmentException[];
  outbox: OutboxRecord[];
  deliveries: DeliveryJob[];
  deliveryAttempts: DeliveryAttempt[];
  conflicts: SyncConflict[];
  idempotencyResults: StoredIdempotencyResult[];
}
