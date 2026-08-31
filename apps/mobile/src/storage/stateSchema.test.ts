import { describe, expect, it } from 'vitest';
import { migrateV1State, parseV2State, serializeState } from './stateSchema';
import { cloneInitialState } from './offlineQueue';

describe('persisted device ledger schema', () => {
  it('restores a v2 queue and changes interrupted work to result recovery', () => {
    const state = cloneInitialState();
    state.queue[0] = { ...state.queue[0]!, status: 'SYNCING' };
    const restored = parseV2State(serializeState(state));
    expect(restored?.queue[0]?.status).toBe('CHECKING_RESULT');
    expect(restored?.queue[0]?.idempotencyKey).toBe(state.queue[0]?.idempotencyKey);
  });

  it('migrates the old pickup vocabulary and litre spelling without changing the key', () => {
    const restored = migrateV1State(
      JSON.stringify({
        schemaVersion: 1,
        queue: [
          {
            localOperationId: 'OP-1',
            idempotencyKey: 'stable-key',
            shipmentId: 'FR-1',
            kind: 'RECORD_PICKUP',
            status: 'WAITING',
            baseVersion: 1,
            deviceCreatedAt: '2026-08-31T08:00:00.000Z',
            payload: { pickupQuantityLitres: 6_120 },
            attempts: 0,
          },
        ],
        cachedHandoffIds: [],
        demoConnectivity: 'OFFLINE',
      }),
    );
    expect(restored?.queue[0]).toMatchObject({
      operationId: 'OP-1',
      idempotencyKey: 'stable-key',
      type: 'CONFIRM_PICKUP',
      payload: { pickupQuantityLiters: 6_120 },
    });
  });

  it('refuses to silently discard an unknown legacy operation', () => {
    const restored = migrateV1State(
      JSON.stringify({
        schemaVersion: 1,
        queue: [
          {
            localOperationId: 'OP-UNKNOWN',
            idempotencyKey: 'stable-key',
            shipmentId: 'FR-1',
            kind: 'RESOLVE_EXCEPTION',
            status: 'WAITING',
            baseVersion: 1,
            deviceCreatedAt: '2026-08-31T08:00:00.000Z',
            payload: {},
            attempts: 0,
          },
        ],
      }),
    );
    expect(restored).toBeNull();
  });
});
