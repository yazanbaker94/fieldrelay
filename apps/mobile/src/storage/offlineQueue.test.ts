import { describe, expect, it } from 'vitest';
import {
  createLocalOperation,
  enqueueIdempotently,
  groupQueue,
  nextDraftShipmentId,
  pendingOperationCount,
  recoverInterruptedOperations,
  resolveConflict,
} from './offlineQueue';

describe('offline queue', () => {
  const operation = createLocalOperation({
    shipmentId: 'FR-2026-0842',
    type: 'RECORD_RECEIPT',
    baseVersion: 2,
    actor: { id: 'priya', name: 'Priya Shah', role: 'RECEIVER' },
    payload: { receivedQuantityLiters: 7_940 },
    now: new Date('2026-05-07T14:08:00.000Z'),
    suffix: 'TEST0001',
  });

  it('keeps a stable idempotency key and does not enqueue a duplicate', () => {
    const once = enqueueIdempotently([], operation);
    const twice = enqueueIdempotently(once, { ...operation });

    expect(operation.idempotencyKey).toBe(
      'device-fieldrelay:FR-2026-0842:record-receipt:v2:TEST0001',
    );
    expect(twice).toHaveLength(1);
    expect(twice).toBe(once);
  });

  it('separates pending synchronization from conflicts needing attention', () => {
    const conflict = { ...operation, operationId: 'CONFLICT', status: 'NEEDS_REVIEW' as const };
    const queue = [operation, conflict];
    expect(pendingOperationCount(queue)).toBe(1);
    expect(groupQueue(queue).needsAttention).toHaveLength(1);
  });

  it('never overwrites server state when keeping a separate draft', () => {
    const conflict = { ...operation, status: 'NEEDS_REVIEW' as const };
    const [resolved] = resolveConflict([conflict], operation.operationId, 'KEEP_DRAFT');
    expect(resolved.status).toBe('NEEDS_REVIEW');
    expect(resolved.conflictChoice).toBe('KEEP_DRAFT');
    expect(resolved.lastError).toContain('Server data was not overwritten');
  });

  it('checks the original result after an app restart during a request', () => {
    const [recovered] = recoverInterruptedOperations([{ ...operation, status: 'SYNCING' }]);
    expect(recovered.status).toBe('CHECKING_RESULT');
    expect(recovered.idempotencyKey).toBe(operation.idempotencyKey);
    expect(recovered.lastError).toContain('before sending anything again');
  });

  it('does not automatically resubmit a conflict that was flagged for review', () => {
    const conflict = { ...operation, status: 'NEEDS_REVIEW' as const };
    const [resolved] = resolveConflict([conflict], operation.operationId, 'SEND_FOR_REVIEW');
    expect(resolved.status).toBe('NEEDS_REVIEW');
    expect(resolved.conflictChoice).toBe('SEND_FOR_REVIEW');
  });

  it('allocates a new draft id after a saved operation survives restart', () => {
    expect(nextDraftShipmentId([])).toBe('FR-2026-0844');
    expect(
      nextDraftShipmentId([
        operation,
        { ...operation, operationId: 'OP-2', shipmentId: 'FR-2026-0844' },
      ]),
    ).toBe('FR-2026-0845');
  });
});
