import { INITIAL_MOBILE_STATE } from '../data';
import type {
  Actor,
  ConflictChoice,
  PersistedMobileState,
  SyncOperationType,
  SyncOperation,
  SyncStatus,
} from '../types';

export function cloneInitialState(): PersistedMobileState {
  return JSON.parse(JSON.stringify(INITIAL_MOBILE_STATE)) as PersistedMobileState;
}

function makeSuffix(): string {
  return Math.random().toString(16).slice(2, 10).toUpperCase();
}

export function createLocalOperation(args: {
  shipmentId: string;
  type: SyncOperationType;
  baseVersion: number;
  actor: Actor;
  payload: Record<string, unknown>;
  now?: Date;
  suffix?: string;
}): SyncOperation {
  const now = args.now ?? new Date();
  const suffix = args.suffix ?? makeSuffix();
  const versionTag = `v${args.baseVersion}`;
  const typeTag = args.type.toLowerCase().replaceAll('_', '-');
  const operationId = `OP-${now.getTime()}-${suffix}`;

  return {
    operationId,
    idempotencyKey: `device-fieldrelay:${args.shipmentId}:${typeTag}:${versionTag}:${suffix}`,
    shipmentId: args.shipmentId,
    type: args.type,
    status: 'WAITING',
    baseVersion: args.baseVersion,
    deviceTimestamp: now.toISOString(),
    actor: args.actor,
    payload: args.payload,
    attempts: 0,
    ...(args.type === 'CREATE_SHIPMENT'
      ? { registrationIdempotencyKey: `device-register:${operationId}` }
      : {}),
  };
}

export function registrationIdempotencyKeyFor(operation: SyncOperation): string {
  return operation.registrationIdempotencyKey ?? `device-register:${operation.operationId}`;
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
  operationId: string,
  status: SyncStatus,
  patch: Partial<SyncOperation> = {},
): SyncOperation[] {
  return queue.map((operation) =>
    operation.operationId === operationId
      ? { ...operation, ...patch, status }
      : operation,
  );
}

export function resolveConflict(
  queue: SyncOperation[],
  operationId: string,
  choice: ConflictChoice,
): SyncOperation[] {
  return queue.map((operation) => {
    if (operation.operationId !== operationId) {
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

    const sentForReview = choice === 'SEND_FOR_REVIEW';
    return {
      ...operation,
      conflictChoice: choice,
      status: 'NEEDS_REVIEW',
      lastError:
        choice === 'KEEP_DRAFT'
          ? 'Kept as a separate device draft. Server data was not overwritten.'
          : sentForReview
            ? 'Flagged for Operations review. The original mutation will not be resubmitted automatically.'
            : undefined,
    };
  });
}

export function recoverInterruptedOperations(queue: SyncOperation[]): SyncOperation[] {
  return queue.map((operation) =>
    operation.status === 'SYNCING'
      ? {
          ...operation,
          status: 'CHECKING_RESULT',
          lastError:
            'The app restarted during synchronization. Checking the original idempotency key before sending anything again.',
        }
      : operation,
  );
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

export function nextDraftShipmentId(queue: SyncOperation[]): string {
  const highest = queue.reduce((current, operation) => {
    const match = /^FR-2026-(\d{4})$/.exec(operation.shipmentId);
    return match ? Math.max(current, Number(match[1])) : current;
  }, 843);
  return `FR-2026-${String(highest + 1).padStart(4, '0')}`;
}
