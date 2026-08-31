export type LifecycleStatus =
  | 'DRAFT'
  | 'OFFERED'
  | 'ACCEPTED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'RECEIVED'
  | 'COMPLETED';

export type SyncStatus = 'SAVED_ON_DEVICE' | 'WAITING' | 'SYNCING' | 'SYNCED' | 'NEEDS_REVIEW';
export type ExceptionStatus = 'NONE' | 'DISCREPANCY_OPEN' | 'RESOLVED';
export type DeliveryStatus = 'NOT_STARTED' | 'PENDING' | 'RETRYING' | 'FAILED' | 'DLQ' | 'DELIVERED';

export interface ShipmentRecord {
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
}

export interface ExceptionRecord {
  id: string;
  shipmentId: string;
  status: 'DISCREPANCY_OPEN' | 'RESOLVED';
  varianceLiters: number;
  variancePercentage: number;
  acceptedFinalQuantityLiters?: number;
  version: number;
}

export interface DeliveryRecord {
  id: string;
  shipmentId: string;
  status: Exclude<DeliveryStatus, 'NOT_STARTED'>;
  destinationName: string;
  destinationType: 'GENERIC_WEBHOOK' | 'ODATA_EXAMPLE';
  stableIdempotencyKey: string;
  correlationId: string;
  attemptCount: number;
  maxAttempts: number;
  lastHttpStatus?: number;
}

export interface DeliveryAttemptRecord {
  id: string;
  deliveryId: string;
  attemptNumber: number;
  kind: 'AUTOMATIC' | 'MANUAL_REPLAY';
  httpStatus: number;
  outcome: 'SUCCEEDED' | 'RETRYABLE_FAILURE' | 'PERMANENT_FAILURE';
  occurredAt: string;
}

export interface DemoRunSnapshot {
  runId: string | null;
  isolated: boolean;
  replayed?: boolean;
  baseline?: string;
  resources: {
    shipmentId: string;
    exceptionId: string;
    deliveryId: string;
  };
  shipment: ShipmentRecord;
  exception: ExceptionRecord | null;
  delivery: DeliveryRecord | null;
  timeline: Array<{ id: string; type: string; sequence: number }>;
  deliveryAttempts: DeliveryAttemptRecord[];
  offlineRecovery?: {
    operation: {
      operationId: string;
      idempotencyKey: string;
      type: 'CREATE_SHIPMENT';
      shipmentId: string;
      baseVersion: number;
      deviceTimestamp: string;
      actor: { id: string; name: string; role?: string };
      payload: Record<string, unknown>;
    };
    syncPath: string;
    resultPath: string;
    expectedServerMutations: number;
    instructions: string;
  };
}

export interface DeliveryDetail {
  delivery: DeliveryRecord;
  attempts: DeliveryAttemptRecord[];
  outbox: {
    id: string;
    payload: Record<string, unknown>;
    stableIdempotencyKey: string;
    status: string;
  } | null;
  shipment: ShipmentRecord;
}

export interface ExceptionResolutionInput {
  category: 'RECEIVER_QUANTITY_VERIFIED' | 'MEASUREMENT_ADJUSTED' | 'DOCUMENTATION_CORRECTED';
  acceptedFinalQuantityLiters: number;
  reason: string;
  note: string;
}

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

export class FieldRelayApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code = 'API_ERROR',
  ) {
    super(message);
    this.name = 'FieldRelayApiError';
  }
}

export function apiBase(): string {
  const configured = process.env.NEXT_PUBLIC_FIELDRELAY_API_BASE?.replace(/\/$/, '');
  if (configured) return configured;
  if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return 'http://127.0.0.1:4100';
  }
  if (typeof window !== 'undefined' && window.location.hostname !== 'fieldrelay.swoop.video') {
    return 'https://fieldrelay.swoop.video';
  }
  return '';
}

export function newActionKey(prefix: string): string {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${suffix}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has('accept')) headers.set('accept', 'application/json');
  const timeoutSignal = AbortSignal.timeout(15_000);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal;
  let response: Response;
  try {
    response = await fetch(`${apiBase()}${path}`, {
      ...init,
      headers,
      signal,
    });
  } catch (cause) {
    if (timeoutSignal.aborted && !init?.signal?.aborted) {
      throw new FieldRelayApiError('The FieldRelay API did not respond within 15 seconds.', 408, 'API_TIMEOUT');
    }
    throw cause;
  }
  if (!response.ok) {
    let body: ApiErrorBody = {};
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      // The typed fallback below is clearer than exposing an HTML proxy error.
    }
    throw new FieldRelayApiError(
      body.error?.message ?? `FieldRelay API returned HTTP ${response.status}`,
      response.status,
      body.error?.code,
    );
  }
  return response.json() as Promise<T>;
}

export function getCanonicalDemo(signal?: AbortSignal): Promise<DemoRunSnapshot> {
  return request<DemoRunSnapshot>('/api/v1/demo', { signal });
}

export function createDemoRun(actionKey: string): Promise<DemoRunSnapshot> {
  return request<DemoRunSnapshot>('/api/v1/demo/runs', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': actionKey },
    body: '{}',
  });
}

export function getDemoRun(runId: string, signal?: AbortSignal): Promise<DemoRunSnapshot> {
  return request<DemoRunSnapshot>(`/api/v1/demo/runs/${encodeURIComponent(runId)}`, { signal });
}

export async function proveOfflineRecovery(snapshot: DemoRunSnapshot): Promise<{
  replayed: boolean;
  recovery: string;
  shipment: ShipmentRecord;
}> {
  const plan = snapshot.offlineRecovery;
  if (!plan) throw new FieldRelayApiError('This API run did not include an offline recovery plan.', 409, 'RECOVERY_PLAN_MISSING');
  const init: RequestInit = {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(plan.operation),
  };
  try {
    await request(plan.syncPath, init);
  } catch (cause) {
    // A transport failure leaves the commit outcome unknown. Only a typed API
    // rejection proves the server did not accept this exact operation.
    if (cause instanceof FieldRelayApiError && cause.status < 500) throw cause;
  }
  return request(plan.syncPath, init);
}

export function getDelivery(deliveryId: string, signal?: AbortSignal): Promise<DeliveryDetail> {
  return request<DeliveryDetail>(`/api/v1/deliveries/${encodeURIComponent(deliveryId)}`, { signal });
}

export async function replayDelivery(deliveryId: string, actionKey: string): Promise<DeliveryDetail> {
  await request(`/api/v1/deliveries/${encodeURIComponent(deliveryId)}/replay`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': actionKey,
    },
    body: JSON.stringify({
      simulatorMode: 'success',
      actor: { id: 'jordan-patel', name: 'Jordan Patel', role: 'OPERATIONS' },
    }),
  });
  return getDelivery(deliveryId);
}

export async function resolveDemoException(
  snapshot: DemoRunSnapshot,
  input: ExceptionResolutionInput = {
    category: 'RECEIVER_QUANTITY_VERIFIED',
    acceptedFinalQuantityLiters: 7940,
    reason: 'Receiver scale record accepted',
    note: 'Receiver scale ticket verified against the offload record. Original source reports remain immutable.',
  },
  actionKey = `resolve-${snapshot.runId ?? 'canonical-demo'}`,
): Promise<DemoRunSnapshot> {
  await request(`/api/v1/exceptions/${encodeURIComponent(snapshot.resources.exceptionId)}/resolve`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': actionKey,
    },
    body: JSON.stringify({
      ...input,
      actor: { id: 'jordan-patel', name: 'Jordan Patel', role: 'OPERATIONS' },
    }),
  });
  if (!snapshot.runId) return getCanonicalDemo();
  return getDemoRun(snapshot.runId);
}

export async function attemptDemoDelivery(
  snapshot: DemoRunSnapshot,
  attemptNumber: number,
): Promise<DemoRunSnapshot> {
  await request(`/api/v1/deliveries/${encodeURIComponent(snapshot.resources.deliveryId)}/attempt`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': `attempt-${snapshot.runId ?? 'canonical-demo'}-${attemptNumber}`,
    },
    body: JSON.stringify({ simulatorMode: 'retryable-failure' }),
  });
  if (!snapshot.runId) return getCanonicalDemo();
  return getDemoRun(snapshot.runId);
}

export async function replayDemoDelivery(snapshot: DemoRunSnapshot): Promise<DemoRunSnapshot> {
  await request(`/api/v1/deliveries/${encodeURIComponent(snapshot.resources.deliveryId)}/replay`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': `replay-${snapshot.runId ?? 'canonical-demo'}`,
    },
    body: JSON.stringify({
      simulatorMode: 'success',
      actor: { id: 'jordan-patel', name: 'Jordan Patel', role: 'OPERATIONS' },
    }),
  });
  if (!snapshot.runId) return getCanonicalDemo();
  return getDemoRun(snapshot.runId);
}
