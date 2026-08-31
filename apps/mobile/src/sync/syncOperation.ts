import {
  AmbiguousNetworkError,
  type ApiErrorBody,
  type ApiResponse,
  type ApiSyncOperation,
  type DemoRunRegistrationResponse,
  FieldRelayApiClient,
  type SyncConflictResponse,
  type SyncResponse,
  type SyncSuccessResponse,
} from '../api/client';
import { registrationIdempotencyKeyFor } from '../storage/offlineQueue';
import type { SyncOperation } from '../types';

interface ServerScope {
  registrationIdempotencyKey: string;
  serverRunId: string;
  serverShipmentId: string;
  serverOperationId: string;
  serverIdempotencyKey: string;
}

export type SyncOutcome =
  | {
      status: 'SYNCED';
      serverVersion: number;
      recovered: boolean;
      message?: string;
    } & Partial<ServerScope>
  | {
      status: 'NEEDS_REVIEW';
      serverVersion?: number;
      message: string;
    } & Partial<ServerScope>
  | {
      status: 'CHECKING_RESULT';
      message: string;
    } & Partial<ServerScope>;

function errorMessage(body: ApiErrorBody, fallback: string): string {
  return body.error?.message || fallback;
}

function interpret(
  response: ApiResponse<SyncResponse>,
  scope: Partial<ServerScope> = {},
  registrationRecovered = false,
): SyncOutcome {
  const body = response.body;
  if (
    (response.status === 200 || response.status === 201) &&
    'status' in body &&
    body.status === 'SYNCED'
  ) {
    const success = body as SyncSuccessResponse;
    return {
      status: 'SYNCED',
      serverVersion: success.shipment.version,
      recovered: Boolean(
        registrationRecovered || success.replayed || success.recovery === 'ORIGINAL_RESULT_RETURNED'
      ),
      ...scope,
    };
  }

  if (response.status === 409 && 'status' in body && body.status === 'NEEDS_REVIEW') {
    const conflict = body as SyncConflictResponse;
    return {
      status: 'NEEDS_REVIEW',
      serverVersion: conflict.conflict.serverVersion,
      message: conflict.message,
      ...scope,
    };
  }

  if (response.status >= 500) {
    return {
      status: 'CHECKING_RESULT',
      message: `Server returned HTTP ${response.status}. Checking the original key before any retry.`,
      ...scope,
    };
  }

  return {
    status: 'NEEDS_REVIEW',
    message: errorMessage(body as ApiErrorBody, `Server rejected the operation (HTTP ${response.status}).`),
    ...scope,
  };
}

function issuedCreateOperation(body: DemoRunRegistrationResponse): ApiSyncOperation | undefined {
  const operation = body.offlineRecovery?.operation;
  if (
    !operation ||
    operation.type !== 'CREATE_SHIPMENT' ||
    typeof operation.operationId !== 'string' ||
    typeof operation.idempotencyKey !== 'string' ||
    typeof operation.shipmentId !== 'string' ||
    operation.baseVersion !== 0 ||
    typeof operation.deviceTimestamp !== 'string' ||
    !operation.actor ||
    typeof operation.payload !== 'object' ||
    operation.payload === null
  ) {
    return undefined;
  }
  return operation;
}

function registrationFailure(
  response: ApiResponse<DemoRunRegistrationResponse | ApiErrorBody>,
  registrationIdempotencyKey: string,
): SyncOutcome {
  if (response.status >= 500) {
    return {
      status: 'CHECKING_RESULT',
      registrationIdempotencyKey,
      message: `Run registration returned HTTP ${response.status}. The same registration key will be checked before any retry.`,
    };
  }
  return {
    status: 'NEEDS_REVIEW',
    registrationIdempotencyKey,
    message: errorMessage(
      response.body as ApiErrorBody,
      `Server rejected isolated-run registration (HTTP ${response.status}).`,
    ),
  };
}

async function synchronizeCreateOperation(
  operation: SyncOperation,
  client: FieldRelayApiClient,
): Promise<SyncOutcome> {
  const registrationIdempotencyKey = registrationIdempotencyKeyFor(operation);
  const offeredQuantityLiters = operation.payload.offeredQuantityLiters;
  if (
    typeof offeredQuantityLiters !== 'number' ||
    !Number.isFinite(offeredQuantityLiters) ||
    offeredQuantityLiters <= 0 ||
    offeredQuantityLiters > 1_000_000_000
  ) {
    return {
      status: 'NEEDS_REVIEW',
      registrationIdempotencyKey,
      message: 'Offered quantity must be a positive finite number before this draft can be registered.',
    };
  }

  let registration: ApiResponse<DemoRunRegistrationResponse | ApiErrorBody>;
  try {
    registration = await client.getDemoRunRegistration(registrationIdempotencyKey);
    if (registration.status === 404) {
      registration = await client.registerOfflineShipment(
        registrationIdempotencyKey,
        offeredQuantityLiters,
      );
    }
  } catch (error) {
    if (error instanceof AmbiguousNetworkError) {
      return {
        status: 'CHECKING_RESULT',
        registrationIdempotencyKey,
        message: `${error.message}. Run registration may have succeeded; the next pass will query the same registration key.`,
      };
    }
    throw error;
  }
  if (registration.status !== 200 && registration.status !== 201) {
    return registrationFailure(registration, registrationIdempotencyKey);
  }

  const registrationBody = registration.body as DemoRunRegistrationResponse;
  const issuedOperation = issuedCreateOperation(registrationBody);
  if (!issuedOperation || typeof registrationBody.runId !== 'string') {
    return {
      status: 'NEEDS_REVIEW',
      registrationIdempotencyKey,
      message: 'The server registration response did not contain a valid scoped create operation.',
    };
  }

  const scope: ServerScope = {
    registrationIdempotencyKey,
    serverRunId: registrationBody.runId,
    serverShipmentId: issuedOperation.shipmentId,
    serverOperationId: issuedOperation.operationId,
    serverIdempotencyKey: issuedOperation.idempotencyKey,
  };
  const registrationRecovered = Boolean(
    registrationBody.replayed || registrationBody.recovery === 'ORIGINAL_RESULT_RETURNED'
  );

  try {
    const existing = await client.getOperationResult(issuedOperation.idempotencyKey);
    if (existing.status !== 404) {
      return interpret(existing, scope, registrationRecovered);
    }
    return interpret(
      await client.submitOperation(issuedOperation),
      scope,
      registrationRecovered,
    );
  } catch (error) {
    if (error instanceof AmbiguousNetworkError) {
      return {
        status: 'CHECKING_RESULT',
        ...scope,
        message: `${error.message}. The scoped operation may have reached the server; the next pass will query its server-issued key.`,
      };
    }
    throw error;
  }
}

export async function synchronizeOperation(
  operation: SyncOperation,
  client: FieldRelayApiClient,
): Promise<SyncOutcome> {
  try {
    if (operation.type === 'CREATE_SHIPMENT') {
      return await synchronizeCreateOperation(operation, client);
    }
    if (operation.status === 'CHECKING_RESULT' || operation.status === 'SYNCING') {
      const recovered = await client.getOperationResult(operation.idempotencyKey);
      if (recovered.status !== 404) return interpret(recovered);
    }

    return interpret(await client.submitOperation(operation));
  } catch (error) {
    if (error instanceof AmbiguousNetworkError) {
      return {
        status: 'CHECKING_RESULT',
        message: `${error.message}. The mutation may have reached the server; the next pass will query this same idempotency key.`,
      };
    }
    throw error;
  }
}
