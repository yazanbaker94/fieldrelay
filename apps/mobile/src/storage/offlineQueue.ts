import AsyncStorage from '@react-native-async-storage/async-storage';
import { INITIAL_MOBILE_STATE } from '../data';
import type {
  ConflictChoice,
  OperationKind,
  PersistedMobileState,
  SyncOperation,
  SyncStatus,
} from '../types';

export const MOBILE_STATE_KEY = '@fieldrelay/mobile-state/v1';

export function cloneInitialState(): PersistedMobileState {
  return JSON.parse(JSON.stringify(INITIAL_MOBILE_STATE)) as PersistedMobileState;
}

export async function loadMobileState(): Promise<PersistedMobileState> {
  const raw = await AsyncStorage.getItem(MOBILE_STATE_KEY);
  if (!raw) {
    return cloneInitialState();
  }

  try {
    const parsed = JSON.parse(raw) as PersistedMobileState;
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.queue)) {
      return cloneInitialState();
    }
    return parsed;
  } catch {
    return cloneInitialState();
  }
}

export async function persistMobileState(state: PersistedMobileState): Promise<void> {
  await AsyncStorage.setItem(MOBILE_STATE_KEY, JSON.stringify(state));
}

function makeSuffix(): string {
  return Math.random().toString(16).slice(2, 10).toUpperCase();
}

export function createLocalOperation(args: {
  shipmentId: string;
  kind: OperationKind;
  baseVersion: number;
  payload: Record<string, unknown>;
  now?: Date;
  suffix?: string;
}): SyncOperation {
  const now = args.now ?? new Date();
  const suffix = args.suffix ?? makeSuffix();
  const versionTag = `v${args.baseVersion}`;
  const kindTag = args.kind.toLowerCase().replaceAll('_', '-');

  return {
    localOperationId: `OP-${now.getTime()}-${suffix}`,
    idempotencyKey: `device-fieldrelay:${args.shipmentId}:${kindTag}:${versionTag}:${suffix}`,
    shipmentId: args.shipmentId,
    kind: args.kind,
    status: 'WAITING',
    baseVersion: args.baseVersion,
    deviceCreatedAt: now.toISOString(),
    payload: args.payload,
    attempts: 0,
  };
}

export function enqueueIdempotently(
  queue: SyncOperation[],
  operation: SyncOperation,
): SyncOperation[] {
  if (queue.some((item) => item.idempotencyKey === operation.idempotencyKey)) {
    return queue;
  }
  return [...queue, operation];
}

export function updateOperationStatus(
  queue: SyncOperation[],
  localOperationId: string,
  status: SyncStatus,
  patch: Partial<SyncOperation> = {},
): SyncOperation[] {
  return queue.map((operation) =>
    operation.localOperationId === localOperationId
      ? { ...operation, ...patch, status }
      : operation,
  );
}

export function resolveConflict(
  queue: SyncOperation[],
  localOperationId: string,
  choice: ConflictChoice,
): SyncOperation[] {
  return queue.map((operation) => {
    if (operation.localOperationId !== localOperationId) {
      return operation;
    }

    if (choice === 'USE_SERVER') {
      return {
        ...operation,
        conflictChoice: choice,
        status: 'SYNCED',
        lastError: undefined,
      };
    }

    return {
      ...operation,
      conflictChoice: choice,
      status: choice === 'SEND_FOR_REVIEW' ? 'WAITING' : 'NEEDS_REVIEW',
      lastError:
        choice === 'KEEP_DRAFT'
          ? 'Kept as a separate device draft. Server data was not overwritten.'
          : undefined,
    };
  });
}

export function pendingOperationCount(queue: SyncOperation[]): number {
  return queue.filter((operation) =>
    ['WAITING', 'SYNCING', 'CHECKING_RESULT'].includes(operation.status),
  ).length;
}

export function groupQueue(queue: SyncOperation[]) {
  return {
    needsAttention: queue.filter((operation) => operation.status === 'NEEDS_REVIEW'),
    waiting: queue.filter((operation) => operation.status === 'WAITING'),
    synchronizing: queue.filter((operation) =>
      ['SYNCING', 'CHECKING_RESULT'].includes(operation.status),
    ),
    synced: queue.filter((operation) => operation.status === 'SYNCED'),
  };
}

