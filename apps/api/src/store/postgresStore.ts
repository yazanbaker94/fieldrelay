import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { DomainError } from "../domain/errors.js";
import type {
  Actor,
  AuditEvent,
  DeliveryAttempt,
  DeliveryJob,
  FieldRelaySnapshot,
  OutboxRecord,
  Shipment,
  ShipmentException,
  StoredIdempotencyResult,
  SyncConflict
} from "../domain/types.js";
import type { FieldRelayStore, FieldRelayTransaction } from "./store.js";

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function optionalNumber(value: string | number | null): number | undefined {
  return value === null ? undefined : Number(value);
}

function shipmentFromRow(row: QueryResultRow): Shipment {
  return {
    id: row.id,
    lifecycleStatus: row.lifecycle_status,
    syncStatus: row.sync_status,
    exceptionStatus: row.exception_status,
    deliveryStatus: row.delivery_status,
    ...(row.offered_quantity_liters === null ? {} : { offeredQuantityLiters: Number(row.offered_quantity_liters) }),
    ...(row.pickup_quantity_liters === null ? {} : { pickupQuantityLiters: Number(row.pickup_quantity_liters) }),
    ...(row.received_quantity_liters === null ? {} : { receivedQuantityLiters: Number(row.received_quantity_liters) }),
    ...(row.accepted_final_quantity_liters === null
      ? {}
      : { acceptedFinalQuantityLiters: Number(row.accepted_final_quantity_liters) }),
    version: row.version,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at)
  };
}

function eventFromRow(row: QueryResultRow): AuditEvent {
  return {
    id: row.id,
    shipmentId: row.shipment_id,
    sequence: row.sequence,
    type: row.event_type,
    actor: row.actor as Actor,
    source: row.source,
    occurredAt: iso(row.occurred_at),
    recordedAt: iso(row.recorded_at),
    payload: row.payload,
    previousHash: row.previous_hash,
    eventHash: row.event_hash
  };
}

function exceptionFromRow(row: QueryResultRow): ShipmentException {
  return {
    id: row.id,
    shipmentId: row.shipment_id,
    status: row.status,
    pickupQuantityLiters: Number(row.pickup_quantity_liters),
    receivedQuantityLiters: Number(row.received_quantity_liters),
    varianceLiters: Number(row.variance_liters),
    variancePercentage: Number(row.variance_percentage),
    threshold: row.threshold,
    ...(row.category === null ? {} : { category: row.category }),
    ...(row.accepted_final_quantity_liters === null
      ? {}
      : { acceptedFinalQuantityLiters: Number(row.accepted_final_quantity_liters) }),
    ...(row.reason === null ? {} : { reason: row.reason }),
    ...(row.note === null ? {} : { note: row.note }),
    openedAt: iso(row.opened_at),
    ...(row.resolved_by === null ? {} : { resolvedBy: row.resolved_by }),
    ...(row.resolved_at === null ? {} : { resolvedAt: iso(row.resolved_at) }),
    version: row.version
  };
}

function outboxFromRow(row: QueryResultRow): OutboxRecord {
  return {
    id: row.id,
    shipmentId: row.shipment_id,
    eventType: row.event_type,
    payload: row.payload,
    destinationType: row.destination_type,
    status: row.status,
    stableIdempotencyKey: row.stable_idempotency_key,
    createdAt: iso(row.created_at),
    ...(row.delivered_at === null ? {} : { deliveredAt: iso(row.delivered_at) })
  };
}

function deliveryFromRow(row: QueryResultRow): DeliveryJob {
  return {
    id: row.id,
    shipmentId: row.shipment_id,
    outboxId: row.outbox_id,
    destinationType: row.destination_type,
    destinationName: row.destination_name,
    destinationUrl: row.destination_url,
    status: row.status,
    stableIdempotencyKey: row.stable_idempotency_key,
    attemptCount: row.attempt_count,
    maxAttempts: row.max_attempts,
    correlationId: row.correlation_id,
    ...(row.last_http_status === null ? {} : { lastHttpStatus: row.last_http_status }),
    ...(row.last_error === null ? {} : { lastError: row.last_error }),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    ...(row.delivered_at === null ? {} : { deliveredAt: iso(row.delivered_at) })
  };
}

function attemptFromRow(row: QueryResultRow): DeliveryAttempt {
  return {
    id: row.id,
    deliveryId: row.delivery_id,
    attemptNumber: row.attempt_number,
    kind: row.kind,
    request: row.request,
    response: row.response,
    httpStatus: row.http_status,
    outcome: row.outcome,
    occurredAt: iso(row.occurred_at)
  };
}

function idempotencyFromRow(row: QueryResultRow): StoredIdempotencyResult {
  return {
    key: row.key,
    requestHash: row.request_hash,
    operationType: row.operation_type,
    ...(row.shipment_id === null ? {} : { shipmentId: row.shipment_id }),
    statusCode: row.status_code,
    response: row.response,
    createdAt: iso(row.created_at)
  };
}

function conflictFromRow(row: QueryResultRow): SyncConflict {
  return {
    id: row.id,
    shipmentId: row.shipment_id,
    idempotencyKey: row.idempotency_key,
    operationType: row.operation_type,
    baseVersion: row.base_version,
    serverVersion: row.server_version,
    localPayload: row.local_payload,
    options: row.options,
    createdAt: iso(row.created_at)
  };
}

class PostgresTransaction implements FieldRelayTransaction {
  constructor(private readonly client: PoolClient) {}

  async getShipment(id: string): Promise<Shipment | undefined> {
    const result = await this.client.query("SELECT * FROM shipments WHERE id = $1 FOR UPDATE", [id]);
    return result.rows[0] ? shipmentFromRow(result.rows[0]) : undefined;
  }

  async insertShipment(shipment: Shipment): Promise<void> {
    await this.client.query(
      `INSERT INTO shipments (
        id,lifecycle_status,sync_status,exception_status,delivery_status,
        offered_quantity_liters,pickup_quantity_liters,received_quantity_liters,accepted_final_quantity_liters,
        version,created_at,updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        shipment.id,
        shipment.lifecycleStatus,
        shipment.syncStatus,
        shipment.exceptionStatus,
        shipment.deliveryStatus,
        shipment.offeredQuantityLiters ?? null,
        shipment.pickupQuantityLiters ?? null,
        shipment.receivedQuantityLiters ?? null,
        shipment.acceptedFinalQuantityLiters ?? null,
        shipment.version,
        shipment.createdAt,
        shipment.updatedAt
      ]
    );
  }

  async updateShipment(shipment: Shipment, expectedVersion: number): Promise<void> {
    const result = await this.client.query(
      `UPDATE shipments SET
        lifecycle_status=$2,sync_status=$3,exception_status=$4,delivery_status=$5,
        offered_quantity_liters=$6,pickup_quantity_liters=$7,received_quantity_liters=$8,accepted_final_quantity_liters=$9,
        version=$10,updated_at=$11
       WHERE id=$1 AND version=$12`,
      [
        shipment.id,
        shipment.lifecycleStatus,
        shipment.syncStatus,
        shipment.exceptionStatus,
        shipment.deliveryStatus,
        shipment.offeredQuantityLiters ?? null,
        shipment.pickupQuantityLiters ?? null,
        shipment.receivedQuantityLiters ?? null,
        shipment.acceptedFinalQuantityLiters ?? null,
        shipment.version,
        shipment.updatedAt,
        expectedVersion
      ]
    );
    if (result.rowCount !== 1) {
      throw new DomainError("Shipment changed during the transaction", 409, "VERSION_CONFLICT", {
        shipmentId: shipment.id,
        expectedVersion
      });
    }
  }

  async listAuditEvents(shipmentId: string): Promise<AuditEvent[]> {
    const result = await this.client.query(
      "SELECT * FROM audit_events WHERE shipment_id=$1 ORDER BY sequence FOR UPDATE",
      [shipmentId]
    );
    return result.rows.map(eventFromRow);
  }

  async appendAuditEvent(event: AuditEvent): Promise<void> {
    await this.client.query(
      `INSERT INTO audit_events (
        id,shipment_id,sequence,event_type,actor,source,occurred_at,recorded_at,payload,previous_hash,event_hash
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        event.id,
        event.shipmentId,
        event.sequence,
        event.type,
        event.actor,
        event.source,
        event.occurredAt,
        event.recordedAt,
        event.payload,
        event.previousHash,
        event.eventHash
      ]
    );
  }

  async getException(id: string): Promise<ShipmentException | undefined> {
    const result = await this.client.query("SELECT * FROM shipment_exceptions WHERE id=$1 FOR UPDATE", [id]);
    return result.rows[0] ? exceptionFromRow(result.rows[0]) : undefined;
  }

  async getExceptionByShipment(shipmentId: string): Promise<ShipmentException | undefined> {
    const result = await this.client.query(
      "SELECT * FROM shipment_exceptions WHERE shipment_id=$1 FOR UPDATE",
      [shipmentId]
    );
    return result.rows[0] ? exceptionFromRow(result.rows[0]) : undefined;
  }

  async insertException(record: ShipmentException): Promise<void> {
    await this.client.query(
      `INSERT INTO shipment_exceptions (
        id,shipment_id,status,pickup_quantity_liters,received_quantity_liters,variance_liters,variance_percentage,
        threshold,category,accepted_final_quantity_liters,reason,note,opened_at,resolved_by,resolved_at,version
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        record.id,
        record.shipmentId,
        record.status,
        record.pickupQuantityLiters,
        record.receivedQuantityLiters,
        record.varianceLiters,
        record.variancePercentage,
        record.threshold,
        record.category ?? null,
        record.acceptedFinalQuantityLiters ?? null,
        record.reason ?? null,
        record.note ?? null,
        record.openedAt,
        record.resolvedBy ?? null,
        record.resolvedAt ?? null,
        record.version
      ]
    );
  }

  async updateException(record: ShipmentException, expectedVersion: number): Promise<void> {
    const result = await this.client.query(
      `UPDATE shipment_exceptions SET
        status=$2,category=$3,accepted_final_quantity_liters=$4,reason=$5,note=$6,resolved_by=$7,resolved_at=$8,version=$9
       WHERE id=$1 AND version=$10`,
      [
        record.id,
        record.status,
        record.category ?? null,
        record.acceptedFinalQuantityLiters ?? null,
        record.reason ?? null,
        record.note ?? null,
        record.resolvedBy ?? null,
        record.resolvedAt ?? null,
        record.version,
        expectedVersion
      ]
    );
    if (result.rowCount !== 1) throw new DomainError("Exception changed", 409, "VERSION_CONFLICT");
  }

  async getOutbox(id: string): Promise<OutboxRecord | undefined> {
    const result = await this.client.query("SELECT * FROM outbox_records WHERE id=$1 FOR UPDATE", [id]);
    return result.rows[0] ? outboxFromRow(result.rows[0]) : undefined;
  }

  async insertOutbox(record: OutboxRecord): Promise<void> {
    await this.client.query(
      `INSERT INTO outbox_records (
        id,shipment_id,event_type,payload,destination_type,status,stable_idempotency_key,created_at,delivered_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        record.id,
        record.shipmentId,
        record.eventType,
        record.payload,
        record.destinationType,
        record.status,
        record.stableIdempotencyKey,
        record.createdAt,
        record.deliveredAt ?? null
      ]
    );
  }

  async updateOutbox(record: OutboxRecord): Promise<void> {
    await this.client.query(
      "UPDATE outbox_records SET status=$2,delivered_at=$3 WHERE id=$1",
      [record.id, record.status, record.deliveredAt ?? null]
    );
  }

  async getDelivery(id: string): Promise<DeliveryJob | undefined> {
    const result = await this.client.query("SELECT * FROM delivery_jobs WHERE id=$1 FOR UPDATE", [id]);
    return result.rows[0] ? deliveryFromRow(result.rows[0]) : undefined;
  }

  async getDeliveryByShipment(shipmentId: string): Promise<DeliveryJob | undefined> {
    const result = await this.client.query("SELECT * FROM delivery_jobs WHERE shipment_id=$1 FOR UPDATE", [shipmentId]);
    return result.rows[0] ? deliveryFromRow(result.rows[0]) : undefined;
  }

  async insertDelivery(job: DeliveryJob): Promise<void> {
    await this.client.query(
      `INSERT INTO delivery_jobs (
        id,shipment_id,outbox_id,destination_type,destination_name,destination_url,status,stable_idempotency_key,
        attempt_count,max_attempts,correlation_id,last_http_status,last_error,created_at,updated_at,delivered_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        job.id,
        job.shipmentId,
        job.outboxId,
        job.destinationType,
        job.destinationName,
        job.destinationUrl,
        job.status,
        job.stableIdempotencyKey,
        job.attemptCount,
        job.maxAttempts,
        job.correlationId,
        job.lastHttpStatus ?? null,
        job.lastError ?? null,
        job.createdAt,
        job.updatedAt,
        job.deliveredAt ?? null
      ]
    );
  }

  async updateDelivery(job: DeliveryJob): Promise<void> {
    await this.client.query(
      `UPDATE delivery_jobs SET
        status=$2,attempt_count=$3,last_http_status=$4,last_error=$5,updated_at=$6,delivered_at=$7
       WHERE id=$1`,
      [
        job.id,
        job.status,
        job.attemptCount,
        job.lastHttpStatus ?? null,
        job.lastError ?? null,
        job.updatedAt,
        job.deliveredAt ?? null
      ]
    );
  }

  async appendDeliveryAttempt(attempt: DeliveryAttempt): Promise<void> {
    await this.client.query(
      `INSERT INTO delivery_attempts (
        id,delivery_id,attempt_number,kind,request,response,http_status,outcome,occurred_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        attempt.id,
        attempt.deliveryId,
        attempt.attemptNumber,
        attempt.kind,
        attempt.request,
        attempt.response,
        attempt.httpStatus,
        attempt.outcome,
        attempt.occurredAt
      ]
    );
  }

  async getIdempotencyResult(key: string): Promise<StoredIdempotencyResult | undefined> {
    // A missing row cannot be row-locked. The transaction-scoped advisory lock
    // serializes concurrent first use of the same key before the unique insert.
    await this.client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [key]);
    const result = await this.client.query("SELECT * FROM idempotency_results WHERE key=$1 FOR UPDATE", [key]);
    return result.rows[0] ? idempotencyFromRow(result.rows[0]) : undefined;
  }

  async insertIdempotencyResult(result: StoredIdempotencyResult): Promise<void> {
    await this.client.query(
      `INSERT INTO idempotency_results (
        key,request_hash,operation_type,shipment_id,status_code,response,created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        result.key,
        result.requestHash,
        result.operationType,
        result.shipmentId ?? null,
        result.statusCode,
        result.response,
        result.createdAt
      ]
    );
  }

  async insertConflict(conflict: SyncConflict): Promise<void> {
    await this.client.query(
      `INSERT INTO sync_conflicts (
        id,shipment_id,idempotency_key,operation_type,base_version,server_version,local_payload,options,created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        conflict.id,
        conflict.shipmentId,
        conflict.idempotencyKey,
        conflict.operationType,
        conflict.baseVersion,
        conflict.serverVersion,
        conflict.localPayload,
        conflict.options,
        conflict.createdAt
      ]
    );
  }
}

export class PostgresFieldRelayStore implements FieldRelayStore {
  readonly kind = "postgres" as const;
  readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000 });
  }

  async transaction<T>(work: (tx: FieldRelayTransaction) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work(new PostgresTransaction(client));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async snapshot(): Promise<FieldRelaySnapshot> {
    const [shipments, events, exceptions, outbox, deliveries, attempts, conflicts, idempotency] = await Promise.all([
      this.pool.query("SELECT * FROM shipments ORDER BY created_at DESC"),
      this.pool.query("SELECT * FROM audit_events ORDER BY shipment_id, sequence"),
      this.pool.query("SELECT * FROM shipment_exceptions ORDER BY opened_at DESC"),
      this.pool.query("SELECT * FROM outbox_records ORDER BY created_at DESC"),
      this.pool.query("SELECT * FROM delivery_jobs ORDER BY created_at DESC"),
      this.pool.query("SELECT * FROM delivery_attempts ORDER BY occurred_at"),
      this.pool.query("SELECT * FROM sync_conflicts ORDER BY created_at DESC"),
      this.pool.query("SELECT * FROM idempotency_results ORDER BY created_at DESC")
    ]);
    return {
      shipments: shipments.rows.map(shipmentFromRow),
      auditEvents: events.rows.map(eventFromRow),
      exceptions: exceptions.rows.map(exceptionFromRow),
      outbox: outbox.rows.map(outboxFromRow),
      deliveries: deliveries.rows.map(deliveryFromRow),
      deliveryAttempts: attempts.rows.map(attemptFromRow),
      conflicts: conflicts.rows.map(conflictFromRow),
      idempotencyResults: idempotency.rows.map(idempotencyFromRow)
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
