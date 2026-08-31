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

export type OperationKind =
  | 'CREATE_SHIPMENT'
  | 'RECORD_PICKUP'
  | 'RECORD_RECEIPT'
  | 'RESOLVE_EXCEPTION';

export type ConflictChoice = 'SEND_FOR_REVIEW' | 'KEEP_DRAFT' | 'USE_SERVER';

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
  localOperationId: string;
  idempotencyKey: string;
  shipmentId: string;
  kind: OperationKind;
  status: SyncStatus;
  baseVersion: number;
  deviceCreatedAt: string;
  payload: Record<string, unknown>;
  attempts: number;
  serverOperationId?: string;
  lastError?: string;
  conflictChoice?: ConflictChoice;
}

export interface PersistedMobileState {
  schemaVersion: 1;
  queue: SyncOperation[];
  cachedHandoffIds: string[];
  demoConnectivity: 'OFFLINE' | 'ONLINE';
  lastSyncAt?: string;
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

