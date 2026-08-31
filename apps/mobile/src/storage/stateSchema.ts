import type { Actor, PersistedMobileState, SyncOperation, SyncOperationType } from '../types';
import { recoverInterruptedOperations } from './offlineQueue';

export const SQLITE_STATE_KEY = '@fieldrelay/mobile-state/v2';
export const LEGACY_ASYNC_STORAGE_KEY = '@fieldrelay/mobile-state/v1';

interface LegacyOperation {
  localOperationId?: string;
  operationId?: string;
  idempotencyKey?: string;
  shipmentId?: string;
  kind?: string;
  type?: string;
  status?: SyncOperation['status'];
  baseVersion?: number;
  deviceCreatedAt?: string;
  deviceTimestamp?: string;
  payload?: Record<string, unknown>;
  attempts?: number;
  serverOperationId?: string;
  lastError?: string;
  conflictChoice?: SyncOperation['conflictChoice'];
}

interface LegacyState {
  schemaVersion?: number;
  queue?: LegacyOperation[];
  cachedHandoffIds?: string[];
  demoConnectivity?: 'OFFLINE' | 'ONLINE';
  lastSyncAt?: string;
}

const operationTypes = new Set<SyncOperationType>([
  'CREATE_SHIPMENT',
  'OFFER_SHIPMENT',
  'ACCEPT_HANDOFF',
  'CONFIRM_PICKUP',
  'RECORD_RECEIPT',
]);

function actorFor(type: SyncOperationType): Actor {
  if (type === 'CREATE_SHIPMENT' || type === 'OFFER_SHIPMENT') {
    return { id: 'maya', name: 'Maya Chen', role: 'GENERATOR' };
  }
  if (type === 'ACCEPT_HANDOFF' || type === 'CONFIRM_PICKUP') {
    return { id: 'marcus', name: 'Marcus Lee', role: 'DRIVER' };
  }
  return { id: 'priya', name: 'Priya Shah', role: 'RECEIVER' };
}

function migrateType(value: string | undefined): SyncOperationType | null {
  if (value === 'RECORD_PICKUP') return 'CONFIRM_PICKUP';
  if (value && operationTypes.has(value as SyncOperationType)) {
    return value as SyncOperationType;
  }
  return null;
}

function migratePayload(payload: Record<string, unknown> | undefined): Record<string, unknown> {
  const source = payload ?? {};
  const next = { ...source };
  if ('offeredQuantityLitres' in next) {
    next.offeredQuantityLiters = next.offeredQuantityLitres;
    delete next.offeredQuantityLitres;
  }
  if ('pickupQuantityLitres' in next) {
    next.pickupQuantityLiters = next.pickupQuantityLitres;
    delete next.pickupQuantityLitres;
  }
  if ('receivedQuantityLitres' in next) {
    next.receivedQuantityLiters = next.receivedQuantityLitres;
    delete next.receivedQuantityLitres;
  }
  delete next.eventId;
  return next;
}

function migrateOperation(operation: LegacyOperation): SyncOperation | null {
  const type = migrateType(operation.type ?? operation.kind);
  const operationId = operation.operationId ?? operation.localOperationId;
  const timestamp = operation.deviceTimestamp ?? operation.deviceCreatedAt;
  if (
    !type ||
    !operationId ||
    !operation.idempotencyKey ||
    !operation.shipmentId ||
    !timestamp ||
    !Number.isInteger(operation.baseVersion)
  ) {
    return null;
  }

  return {
    operationId,
    idempotencyKey: operation.idempotencyKey,
    type,
    shipmentId: operation.shipmentId,
    status: operation.status ?? 'WAITING',
    baseVersion: operation.baseVersion as number,
    deviceTimestamp: timestamp,
    actor: actorFor(type),
    payload: migratePayload(operation.payload),
    attempts: operation.attempts ?? 0,
    ...(operation.lastError ? { lastError: operation.lastError } : {}),
    ...(operation.conflictChoice ? { conflictChoice: operation.conflictChoice } : {}),
  };
}

export function parseV2State(raw: string | null): PersistedMobileState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistedMobileState;
    if (
      parsed.schemaVersion !== 2 ||
      !Array.isArray(parsed.queue) ||
      !Array.isArray(parsed.cachedHandoffIds) ||
      !['OFFLINE', 'ONLINE'].includes(parsed.demoConnectivity)
    ) {
      return null;
    }
    return { ...parsed, queue: recoverInterruptedOperations(parsed.queue) };
  } catch {
    return null;
  }
}

export function migrateV1State(raw: string | null): PersistedMobileState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LegacyState;
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.queue)) return null;
    const migrated = parsed.queue.map(migrateOperation);
    // Never silently discard a legacy action we cannot understand. Keeping the v1
    // record untouched allows a future migration to recover it.
    if (migrated.some((operation) => operation === null)) return null;
    return {
      schemaVersion: 2,
      queue: recoverInterruptedOperations(migrated as SyncOperation[]),
      cachedHandoffIds: parsed.cachedHandoffIds ?? [],
      demoConnectivity: parsed.demoConnectivity ?? 'OFFLINE',
      ...(parsed.lastSyncAt ? { lastSyncAt: parsed.lastSyncAt } : {}),
    };
  } catch {
    return null;
  }
}

export function serializeState(state: PersistedMobileState): string {
  return JSON.stringify(state);
}
