import { describe, expect, it } from 'vitest';
import {
  type ApiSyncOperation,
  type DemoRunRegistrationResponse,
  FieldRelayApiClient,
} from '../api/client';
import {
  createLocalOperation,
  registrationIdempotencyKeyFor,
} from '../storage/offlineQueue';
import type { SyncOperation } from '../types';
import { synchronizeOperation } from './syncOperation';

function operation(): SyncOperation {
  return createLocalOperation({
    shipmentId: 'FR-2026-9001',
    type: 'CREATE_SHIPMENT',
    baseVersion: 0,
    actor: { id: 'maya', name: 'Maya Chen', role: 'GENERATOR' },
    payload: { offeredQuantityLiters: 5_000, site: 'Device-only draft context' },
    now: new Date('2026-08-31T08:00:00.000Z'),
    suffix: 'SYNC0001',
  });
}

function issuedOperation(): ApiSyncOperation {
  return {
    operationId: 'offline-save-mobile-run',
    idempotencyKey: 'demo-mobile-run-offline-save',
    type: 'CREATE_SHIPMENT',
    shipmentId: 'FR-2026-0842-MOBILE-RUN-OFFLINE',
    baseVersion: 0,
    deviceTimestamp: '2026-08-31T08:45:00-06:00',
    actor: { id: 'maya-chen', name: 'Maya Chen', role: 'GENERATOR_COORDINATOR' },
    payload: { offeredQuantityLiters: 5_000 },
  };
}

function registration(replayed = false): DemoRunRegistrationResponse {
  return {
    runId: 'mobile-run',
    isolated: true,
    replayed,
    ...(replayed ? { recovery: 'ORIGINAL_RESULT_RETURNED' as const } : {}),
    offlineRecovery: {
      operation: issuedOperation(),
      syncPath: '/api/v1/sync/operations',
      resultPath: '/api/v1/sync/results/demo-mobile-run-offline-save',
    },
  };
}

function syncSuccess(replayed = false) {
  return {
    operationId: issuedOperation().operationId,
    idempotencyKey: issuedOperation().idempotencyKey,
    replayed,
    ...(replayed ? { recovery: 'ORIGINAL_RESULT_RETURNED' as const } : {}),
    status: 'SYNCED' as const,
    shipment: { id: issuedOperation().shipmentId, version: 1 },
    exception: null,
    appendedEventIds: ['EV-1', 'EV-2'],
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('mobile synchronization', () => {
  it('registers an isolated run, preserves the offered quantity, and submits only the server-issued operation', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const registrationKey = registrationIdempotencyKeyFor(operation());
    const client = new FieldRelayApiClient(
      'https://fieldrelay.example',
      (async (url, init) => {
        const request = { url: String(url), init };
        requests.push(request);
        if (request.url.endsWith(`/sync/results/${encodeURIComponent(registrationKey)}`)) {
          return jsonResponse({ error: { code: 'NOT_FOUND', message: 'not found' } }, 404);
        }
        if (request.url.endsWith('/demo/runs')) return jsonResponse(registration(), 201);
        if (request.url.endsWith(`/sync/results/${issuedOperation().idempotencyKey}`)) {
          return jsonResponse({ error: { code: 'NOT_FOUND', message: 'not found' } }, 404);
        }
        if (request.url.endsWith('/sync/operations')) return jsonResponse(syncSuccess(), 201);
        throw new Error(`Unexpected request: ${request.url}`);
      }) as typeof fetch,
    );

    const outcome = await synchronizeOperation(operation(), client);
    expect(outcome).toMatchObject({
      status: 'SYNCED',
      serverVersion: 1,
      recovered: false,
      registrationIdempotencyKey: registrationKey,
      serverRunId: 'mobile-run',
      serverShipmentId: issuedOperation().shipmentId,
      serverOperationId: issuedOperation().operationId,
      serverIdempotencyKey: issuedOperation().idempotencyKey,
    });
    expect(requests).toHaveLength(4);

    const registrationRequest = requests.find((request) => request.url.endsWith('/demo/runs'));
    expect(registrationRequest?.init?.headers).toMatchObject({
      'idempotency-key': registrationKey,
    });
    expect(JSON.parse(String(registrationRequest?.init?.body))).toEqual({
      offlineOfferedQuantityLiters: 5_000,
    });

    const syncRequest = requests.find((request) => request.url.endsWith('/sync/operations'));
    expect(JSON.parse(String(syncRequest?.init?.body))).toEqual(issuedOperation());
    expect(String(syncRequest?.init?.body)).not.toContain('Device-only draft context');
    expect(String(syncRequest?.init?.body)).not.toContain('FR-2026-9001');
  });

  it('recovers a lost registration response with the same key and creates only one run', async () => {
    let registered = false;
    let registrationPosts = 0;
    let syncPosts = 0;
    const registrationKey = registrationIdempotencyKeyFor(operation());
    const client = new FieldRelayApiClient(
      'https://fieldrelay.example',
      (async (url, init) => {
        const path = String(url);
        if (path.endsWith(`/sync/results/${encodeURIComponent(registrationKey)}`)) {
          return registered
            ? jsonResponse(registration(true), 201)
            : jsonResponse({ error: { code: 'NOT_FOUND', message: 'not found' } }, 404);
        }
        if (path.endsWith('/demo/runs')) {
          registrationPosts += 1;
          registered = true;
          throw new TypeError('connection reset after run registration committed');
        }
        if (path.endsWith(`/sync/results/${issuedOperation().idempotencyKey}`)) {
          return jsonResponse({ error: { code: 'NOT_FOUND', message: 'not found' } }, 404);
        }
        if (path.endsWith('/sync/operations') && init?.method === 'POST') {
          syncPosts += 1;
          return jsonResponse(syncSuccess(), 201);
        }
        throw new Error(`Unexpected request: ${path}`);
      }) as typeof fetch,
    );

    const first = await synchronizeOperation(operation(), client);
    expect(first).toMatchObject({
      status: 'CHECKING_RESULT',
      registrationIdempotencyKey: registrationKey,
    });
    const second = await synchronizeOperation({ ...operation(), status: 'CHECKING_RESULT' }, client);
    expect(second).toMatchObject({ status: 'SYNCED', recovered: true, serverRunId: 'mobile-run' });
    expect(registrationPosts).toBe(1);
    expect(syncPosts).toBe(1);
  });

  it('recovers a lost scoped-operation response without a second mutation and retains the mapping', async () => {
    let stored = false;
    let syncPosts = 0;
    const registrationKey = registrationIdempotencyKeyFor(operation());
    const client = new FieldRelayApiClient(
      'https://fieldrelay.example',
      (async (url, init) => {
        const path = String(url);
        if (path.endsWith(`/sync/results/${encodeURIComponent(registrationKey)}`)) {
          return jsonResponse(registration(true), 201);
        }
        if (path.endsWith(`/sync/results/${issuedOperation().idempotencyKey}`)) {
          return stored
            ? jsonResponse(syncSuccess(true), 201)
            : jsonResponse({ error: { code: 'NOT_FOUND', message: 'not found' } }, 404);
        }
        if (path.endsWith('/sync/operations') && init?.method === 'POST') {
          syncPosts += 1;
          stored = true;
          throw new TypeError('connection reset after shipment creation committed');
        }
        throw new Error(`Unexpected request: ${path}`);
      }) as typeof fetch,
    );

    const first = await synchronizeOperation(operation(), client);
    expect(first).toMatchObject({
      status: 'CHECKING_RESULT',
      serverRunId: 'mobile-run',
      serverShipmentId: issuedOperation().shipmentId,
      serverIdempotencyKey: issuedOperation().idempotencyKey,
    });
    const second = await synchronizeOperation({ ...operation(), status: 'CHECKING_RESULT' }, client);
    expect(second).toMatchObject({ status: 'SYNCED', recovered: true, serverVersion: 1 });
    expect(syncPosts).toBe(1);
  });

  it('resumes after restart from a recovered registration before posting the missing scoped operation once', async () => {
    const methods: string[] = [];
    const registrationKey = registrationIdempotencyKeyFor(operation());
    const client = new FieldRelayApiClient(
      'https://fieldrelay.example',
      (async (url, init) => {
        const path = String(url);
        methods.push(`${init?.method ?? 'GET'} ${new URL(path).pathname}`);
        if (path.endsWith(`/sync/results/${encodeURIComponent(registrationKey)}`)) {
          return jsonResponse(registration(true), 201);
        }
        if (path.endsWith(`/sync/results/${issuedOperation().idempotencyKey}`)) {
          return jsonResponse({ error: { code: 'NOT_FOUND', message: 'not found' } }, 404);
        }
        if (path.endsWith('/sync/operations')) return jsonResponse(syncSuccess(), 201);
        throw new Error(`Unexpected request: ${path}`);
      }) as typeof fetch,
    );

    const result = await synchronizeOperation({ ...operation(), status: 'CHECKING_RESULT' }, client);
    expect(result).toMatchObject({ status: 'SYNCED', recovered: true });
    expect(methods).toEqual([
      `GET /api/v1/sync/results/${encodeURIComponent(registrationKey)}`,
      `GET /api/v1/sync/results/${issuedOperation().idempotencyKey}`,
      'POST /api/v1/sync/operations',
    ]);
  });

  it('turns a scoped-operation version conflict into an explicit mapped review state', async () => {
    const registrationKey = registrationIdempotencyKeyFor(operation());
    const client = new FieldRelayApiClient(
      'https://fieldrelay.example',
      (async (url) => {
        const path = String(url);
        if (path.endsWith(`/sync/results/${encodeURIComponent(registrationKey)}`)) {
          return jsonResponse(registration(true), 201);
        }
        if (path.endsWith(`/sync/results/${issuedOperation().idempotencyKey}`)) {
          return jsonResponse({ error: { code: 'NOT_FOUND', message: 'not found' } }, 404);
        }
        return jsonResponse(
          {
            operationId: issuedOperation().operationId,
            idempotencyKey: issuedOperation().idempotencyKey,
            replayed: false,
            status: 'NEEDS_REVIEW',
            code: 'VERSION_CONFLICT',
            message: 'Nothing was overwritten.',
            conflict: {
              id: 'SC-1',
              baseVersion: 0,
              serverVersion: 2,
              options: ['SEND_LOCAL_FOR_REVIEW', 'KEEP_SEPARATE_DRAFT', 'USE_SERVER_VERSION'],
            },
            shipment: { id: issuedOperation().shipmentId, version: 2 },
          },
          409,
        );
      }) as typeof fetch,
    );

    expect(await synchronizeOperation(operation(), client)).toMatchObject({
      status: 'NEEDS_REVIEW',
      serverVersion: 2,
      serverShipmentId: issuedOperation().shipmentId,
      message: 'Nothing was overwritten.',
    });
  });
});
