import type { Actor, SyncOperation, SyncOperationType } from '../types';

export const DEFAULT_API_BASE_URL = 'https://fieldrelay.swoop.video';

export interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export interface ServerShipment {
  id: string;
  lifecycleStatus: string;
  syncStatus: string;
  exceptionStatus: string;
  deliveryStatus: string;
  version: number;
  offeredQuantityLiters?: number;
  pickupQuantityLiters?: number;
  receivedQuantityLiters?: number;
  acceptedFinalQuantityLiters?: number;
}

export interface SyncConflictResponse {
  operationId: string;
  idempotencyKey: string;
  replayed: boolean;
  status: 'NEEDS_REVIEW';
  code: 'VERSION_CONFLICT';
  message: string;
  conflict: {
    id: string;
    baseVersion: number;
    serverVersion: number;
    options: ['SEND_LOCAL_FOR_REVIEW', 'KEEP_SEPARATE_DRAFT', 'USE_SERVER_VERSION'];
  };
  shipment: ServerShipment;
}

export interface SyncSuccessResponse {
  operationId: string;
  idempotencyKey: string;
  replayed: boolean;
  recovery?: 'ORIGINAL_RESULT_RETURNED';
  status: 'SYNCED';
  shipment: ServerShipment;
  exception: Record<string, unknown> | null;
  appendedEventIds: string[];
}

export type SyncResponse = SyncSuccessResponse | SyncConflictResponse | ApiErrorBody;

export interface DemoRunRegistrationResponse {
  runId: string;
  isolated: true;
  replayed: boolean;
  recovery?: 'ORIGINAL_RESULT_RETURNED';
  offlineRecovery: {
    operation: ApiSyncOperation;
    syncPath: string;
    resultPath: string;
  };
}

export interface ApiResponse<T> {
  status: number;
  body: T;
}

export interface ApiSyncOperation {
  operationId: string;
  idempotencyKey: string;
  type: SyncOperationType;
  shipmentId: string;
  baseVersion: number;
  deviceTimestamp: string;
  actor: Actor;
  payload: Record<string, unknown>;
}

export interface HealthResponse {
  status: string;
  service: string;
  store: string;
  time: string;
}

export class AmbiguousNetworkError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AmbiguousNetworkError';
  }
}

type FetchLike = typeof fetch;

export function normalizeBaseUrl(value: string | undefined): string {
  const trimmed = value?.trim();
  return (trimmed || DEFAULT_API_BASE_URL).replace(/\/+$/, '');
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: { code: 'INVALID_RESPONSE', message: text.slice(0, 240) } };
  }
}

export class FieldRelayApiClient {
  readonly baseUrl: string;

  constructor(
    baseUrl: string | undefined = process.env.EXPO_PUBLIC_API_URL,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly timeoutMs = 12_000,
  ) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
  }

  private async request<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          accept: 'application/json',
          ...(init?.body ? { 'content-type': 'application/json' } : {}),
          ...init?.headers,
        },
        signal: controller.signal,
      });
      return { status: response.status, body: (await readBody(response)) as T };
    } catch (error) {
      const message =
        error instanceof Error && error.name === 'AbortError'
          ? `Request timed out after ${this.timeoutMs} ms`
          : error instanceof Error
            ? error.message
            : 'Network request failed';
      throw new AmbiguousNetworkError(message, { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }

  health(): Promise<ApiResponse<HealthResponse | ApiErrorBody>> {
    return this.request('/health');
  }

  submitOperation(operation: SyncOperation | ApiSyncOperation): Promise<ApiResponse<SyncResponse>> {
    const body: ApiSyncOperation = {
      operationId: operation.operationId,
      idempotencyKey: operation.idempotencyKey,
      type: operation.type,
      shipmentId: operation.shipmentId,
      baseVersion: operation.baseVersion,
      deviceTimestamp: operation.deviceTimestamp,
      actor: operation.actor,
      payload: operation.payload,
    };
    return this.request('/api/v1/sync/operations', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  getOperationResult(idempotencyKey: string): Promise<ApiResponse<SyncResponse>> {
    return this.request(`/api/v1/sync/results/${encodeURIComponent(idempotencyKey)}`);
  }

  getDemoRunRegistration(
    idempotencyKey: string,
  ): Promise<ApiResponse<DemoRunRegistrationResponse | ApiErrorBody>> {
    return this.request(`/api/v1/sync/results/${encodeURIComponent(idempotencyKey)}`);
  }

  registerOfflineShipment(
    idempotencyKey: string,
    offlineOfferedQuantityLiters: number,
  ): Promise<ApiResponse<DemoRunRegistrationResponse | ApiErrorBody>> {
    return this.request('/api/v1/demo/runs', {
      method: 'POST',
      headers: { 'idempotency-key': idempotencyKey },
      body: JSON.stringify({ offlineOfferedQuantityLiters }),
    });
  }
}
