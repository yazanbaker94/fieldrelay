export type LifecycleStatus =
  | 'DRAFT'
  | 'OFFERED'
  | 'ACCEPTED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'RECEIVED'
  | 'COMPLETED';

export type SyncStatus =
  | 'WAITING'
  | 'SYNCING'
  | 'CHECKING_RESULT'
  | 'NEEDS_REVIEW'
  | 'SYNCED';

export type ExceptionStatus = 'NONE' | 'DISCREPANCY_OPEN' | 'RESOLVED';

export type DeliveryStatus =
  | 'NOT_STARTED'
  | 'PENDING'
  | 'RETRYING'
  | 'FAILED'
  | 'DLQ'
  | 'DELIVERED';

export type SyncOperationType =
  | 'CREATE_SHIPMENT'
  | 'OFFER_SHIPMENT'
  | 'ACCEPT_HANDOFF'
  | 'CONFIRM_PICKUP'
  | 'RECORD_RECEIPT';

export type ConflictChoice = 'SEND_FOR_REVIEW' | 'KEEP_DRAFT' | 'USE_SERVER';

export interface Actor {
  id: string;
  name: string;
  role?: string;
}

export interface ShipmentEvent {
  id: string;
  step: number;
  label: string;
  quantityLitres: number;
  actor: string;
  time: string;
}

export interface Shipment {
  id: string;
  generator: string;
  site: string;
  driver: string;
  unit: string;
  unitType: string;
  capacityLitres: number;
  product: string;
  lifecycle: LifecycleStatus;
  sync: SyncStatus;
  exception: ExceptionStatus;
  delivery: DeliveryStatus;
  version: number;
  events: ShipmentEvent[];
}

export interface SyncOperation {
  operationId: string;
  idempotencyKey: string;
  type: SyncOperationType;
  shipmentId: string;
  status: SyncStatus;
  baseVersion: number;
  deviceTimestamp: string;
  actor: Actor;
  payload: Record<string, unknown>;
  attempts: number;
  registrationIdempotencyKey?: string;
  serverRunId?: string;
  serverShipmentId?: string;
  serverOperationId?: string;
  serverIdempotencyKey?: string;
  serverVersion?: number;
  serverResultRecovered?: boolean;
  lastAttemptAt?: string;
  nextAttemptAt?: string;
  lastError?: string;
  conflictChoice?: ConflictChoice;
}

export interface ShipmentDraft {
  shipmentId: string;
  generator: string;
  site: string;
  offeredQuantityLiters: number;
  driver: string;
  unit: string;
  unitType: string;
  capacityLiters: number;
  product: string;
}

export interface PersistedMobileState {
  schemaVersion: 2;
  queue: SyncOperation[];
  cachedHandoffIds: string[];
  demoConnectivity: 'OFFLINE' | 'ONLINE';
  lastSyncAt?: string;
  lastSavedShipmentId?: string;
}

export type RootScreen =
  | 'HOME'
  | 'CREATE'
  | 'REVIEW'
  | 'SAVED'
  | 'SHIPMENTS'
  | 'SYNC'
  | 'DISCREPANCY';

export type BottomTab = 'HOME' | 'CREATE' | 'SHIPMENTS' | 'SYNC';
