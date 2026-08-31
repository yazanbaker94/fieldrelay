import { randomUUID } from "node:crypto";
import { createAuditEvent, hashValue } from "./audit.js";
import { evaluateDiscrepancy } from "./discrepancy.js";
import { DomainError, invalidState, notFound, validationError } from "./errors.js";
import type {
  Actor,
  AuditEvent,
  DeliveryAttempt,
  DeliveryDestinationConfig,
  DeliveryJob,
  OutboxRecord,
  Shipment,
  ShipmentException,
  StoredIdempotencyResult,
  SyncConflict,
  SyncOperation
} from "./types.js";
import type { FieldRelayStore, FieldRelayTransaction } from "../store/store.js";
import { DeliveryAdapterRegistry, type SimulatorMode } from "../delivery/adapters.js";
import { FieldRelayEventBus } from "../realtime/eventBus.js";
import {
  canonicalDemoScenario,
  createDemoRunSnapshot,
  demoDeliveryIdForShipment,
  demoOfflineRecoveryOperation,
  demoResourceIds,
  insertSnapshot
} from "../seed/demoSeed.js";
import type { RealtimeEvent } from "../realtime/eventBus.js";

interface ServiceResult {
  statusCode: number;
  body: Record<string, unknown>;
}

export interface ResolutionInput {
  category: string;
  acceptedFinalQuantityLiters: number;
  reason: string;
  note: string;
  actor: Actor;
  occurredAt?: string;
}

export interface ProcessDeliveryInput {
  kind: "AUTOMATIC" | "MANUAL_REPLAY";
  simulatorMode?: SimulatorMode;
  actionIdempotencyKey: string;
  actor: Actor;
}

export interface CreateDemoRunInput {
  requestedRunId?: string;
  offlineOfferedQuantityLiters?: number;
  actionIdempotencyKey: string;
  maxDemoRuns?: number;
}

const systemActor: Actor = { id: "system", name: "FieldRelay", role: "SYSTEM" };

function now(): string {
  return new Date().toISOString();
}

function requireQuantity(value: unknown, field: string, allowZero = false): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value > 1_000_000_000 ||
    (allowZero ? value < 0 : value <= 0)
  ) {
    throw validationError(`${field} must be ${allowZero ? "a non-negative" : "a positive"} number`, { field });
  }
  return value;
}

function requireText(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw validationError(`${field} is required`, { field });
  return trimmed;
}

function newExceptionId(shipmentId: string): string {
  return shipmentId === "FR-2026-0842" ? "EX-0037" : `EX-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function newDeliveryId(shipmentId: string): string {
  return demoDeliveryIdForShipment(shipmentId) ?? `DL-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function newOutboxId(): string {
  return `OB-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export class FieldRelayService {
  constructor(
    private readonly store: FieldRelayStore,
    private readonly destination: DeliveryDestinationConfig,
    private readonly eventBus = new FieldRelayEventBus(),
    private readonly adapters = new DeliveryAdapterRegistry()
  ) {}

  get realtime(): FieldRelayEventBus {
    return this.eventBus;
  }

  async createDemoRun(input: CreateDemoRunInput): Promise<ServiceResult> {
    requireText(input.actionIdempotencyKey, "Idempotency-Key");
    const requestedRunId = input.requestedRunId?.trim().toLowerCase();
    if (requestedRunId && !/^[a-z0-9][a-z0-9-]{1,22}[a-z0-9]$/.test(requestedRunId)) {
      throw validationError("runId must be 3-24 lowercase letters, numbers, or internal hyphens");
    }
    const offlineOfferedQuantityLiters =
      input.offlineOfferedQuantityLiters === undefined
        ? undefined
        : requireQuantity(input.offlineOfferedQuantityLiters, "offlineOfferedQuantityLiters");
    const requestHash = hashValue({
      requestedRunId: requestedRunId ?? null,
      offlineOfferedQuantityLiters: offlineOfferedQuantityLiters ?? null
    });
    const result = await this.store.transaction(async (tx) => {
      const existing = await tx.getIdempotencyResult(input.actionIdempotencyKey);
      if (existing) return this.replay(existing, requestHash);

      if (input.maxDemoRuns !== undefined) {
        await tx.acquireLock("demo-runs:capacity");
        const currentRunCount = await tx.countDemoRuns();
        if (currentRunCount >= input.maxDemoRuns) {
          throw new DomainError(
            "The public demo has reached its immutable run capacity",
            503,
            "DEMO_RUN_CAPACITY_REACHED",
            { limit: input.maxDemoRuns }
          );
        }
      }

      const runId = requestedRunId ?? randomUUID().replaceAll("-", "").slice(0, 12);
      const resources = demoResourceIds(runId);
      await tx.acquireLock(`demo-run:${runId}`);
      if (await tx.getShipment(resources.shipmentId)) {
        throw new DomainError("This demo run already exists", 409, "DEMO_RUN_EXISTS", { runId });
      }

      const snapshot = createDemoRunSnapshot(runId);
      await insertSnapshot(tx, snapshot);
      const shipment = snapshot.shipments[0];
      const exceptionRecord = snapshot.exceptions[0];
      if (!shipment || !exceptionRecord) throw new Error("Demo run snapshot is incomplete");

      const offlineOperation = demoOfflineRecoveryOperation(
        runId,
        offlineOfferedQuantityLiters ?? canonicalDemoScenario.quantitiesLiters.offered
      );
      const response = {
        runId,
        isolated: true,
        replayed: false,
        baseline: "DISCREPANCY_OPEN",
        resources: {
          shipmentId: resources.shipmentId,
          exceptionId: resources.exceptionId,
          deliveryId: resources.deliveryId
        },
        scenario: canonicalDemoScenario,
        offlineRecovery: {
          operation: offlineOperation,
          syncPath: "/api/v1/sync/operations",
          resultPath: `/api/v1/sync/results/${offlineOperation.idempotencyKey}`,
          expectedServerMutations: 1,
          instructions:
            "Send this operation, discard the first response to simulate loss, then resend it unchanged or recover by resultPath."
        },
        shipment,
        exception: exceptionRecord,
        timeline: snapshot.auditEvents,
        delivery: null,
        deliveryAttempts: [],
        conflicts: [],
        resetStrategy:
          "Create another isolated run with a new Idempotency-Key; existing evidence is never deleted or rewritten."
      };
      await this.saveIdempotency(tx, {
        key: input.actionIdempotencyKey,
        requestHash,
        operationType: "CREATE_DEMO_RUN",
        shipmentId: shipment.id,
        statusCode: 201,
        response,
        createdAt: now()
      });
      return { statusCode: 201, body: response };
    });

    this.publishFromResult(result, String((result.body.shipment as Shipment | undefined)?.id ?? ""), "demo.run.created");
    return result;
  }

  async getIdempotencyResult(key: string): Promise<ServiceResult> {
    return this.store.transaction(async (tx) => {
      const result = await tx.getIdempotencyResult(key);
      if (!result) throw notFound("Idempotency result", key);
      return {
        statusCode: result.statusCode,
        body: {
          ...result.response,
          replayed: true,
          recovery: "ORIGINAL_RESULT_RETURNED",
          idempotencyKey: result.key
        }
      };
    });
  }

  async sync(operation: SyncOperation): Promise<ServiceResult> {
    const requestHash = hashValue(operation);
    const result = await this.store.transaction(async (tx) => {
      const existing = await tx.getIdempotencyResult(operation.idempotencyKey);
      if (existing) return this.replay(existing, requestHash);

      if (!operation.operationId.trim() || !operation.idempotencyKey.trim()) {
        throw validationError("operationId and idempotencyKey are required");
      }
      if (!Number.isInteger(operation.baseVersion) || operation.baseVersion < 0) {
        throw validationError("baseVersion must be a non-negative integer");
      }
      if (Number.isNaN(Date.parse(operation.deviceTimestamp))) {
        throw validationError("deviceTimestamp must be an ISO-8601 timestamp");
      }

      if (operation.type === "CREATE_SHIPMENT") {
        return this.createShipment(tx, operation, requestHash);
      }

      const current = await tx.getShipment(operation.shipmentId);
      if (!current) throw notFound("Shipment", operation.shipmentId);
      if (current.version !== operation.baseVersion) {
        return this.recordConflict(tx, current, operation, requestHash);
      }

      const occurredAt = operation.deviceTimestamp;
      const recordedAt = now();
      const updated: Shipment = {
        ...current,
        syncStatus: "SYNCED",
        version: current.version + 1,
        updatedAt: recordedAt
      };
      let exceptionRecord: ShipmentException | undefined;
      const events: AuditEvent[] = [];

      if (operation.type === "OFFER_SHIPMENT") {
        if (current.lifecycleStatus !== "DRAFT" || current.offeredQuantityLiters !== undefined) {
          throw invalidState("Only a draft shipment without an offered quantity can be offered", {
            lifecycleStatus: current.lifecycleStatus
          });
        }
        const offered = requireQuantity(operation.payload.offeredQuantityLiters, "offeredQuantityLiters");
        updated.lifecycleStatus = "OFFERED";
        updated.offeredQuantityLiters = offered;
        events.push(
          await this.appendEvent(tx, {
            shipmentId: current.id,
            type: "SHIPMENT_OFFERED",
            actor: operation.actor,
            source: "MOBILE",
            occurredAt,
            recordedAt,
            payload: { offeredQuantityLiters: offered }
          })
        );
      } else if (operation.type === "ACCEPT_HANDOFF") {
        if (current.lifecycleStatus !== "OFFERED") {
          throw invalidState("Only an offered shipment can be accepted", {
            lifecycleStatus: current.lifecycleStatus
          });
        }
        updated.lifecycleStatus = "ACCEPTED";
        events.push(
          await this.appendEvent(tx, {
            shipmentId: current.id,
            type: "HANDOFF_ACCEPTED",
            actor: operation.actor,
            source: "MOBILE",
            occurredAt,
            recordedAt,
            payload: { accepted: true }
          })
        );
      } else if (operation.type === "CONFIRM_PICKUP") {
        if (current.lifecycleStatus !== "ACCEPTED" || current.pickupQuantityLiters !== undefined) {
          throw invalidState("Pickup can be confirmed once, after acceptance", {
            lifecycleStatus: current.lifecycleStatus
          });
        }
        const pickup = requireQuantity(operation.payload.pickupQuantityLiters, "pickupQuantityLiters");
        updated.pickupQuantityLiters = pickup;
        // The immutable event records the PICKED_UP milestone. The aggregate immediately
        // advances to IN_TRANSIT, preserving the agreed lifecycle semantics without a pause.
        updated.lifecycleStatus = "IN_TRANSIT";
        events.push(
          await this.appendEvent(tx, {
            shipmentId: current.id,
            type: "PICKUP_CONFIRMED",
            actor: operation.actor,
            source: "MOBILE",
            occurredAt,
            recordedAt,
            payload: {
              pickupQuantityLiters: pickup,
              offeredToPickupVarianceLiters:
                current.offeredQuantityLiters === undefined ? null : pickup - current.offeredQuantityLiters,
              offeredToPickupIsInformationalOnly: true,
              milestoneLifecycleStatus: "PICKED_UP",
              resultingLifecycleStatus: "IN_TRANSIT"
            }
          })
        );
      } else if (operation.type === "RECORD_RECEIPT") {
        if (current.lifecycleStatus !== "IN_TRANSIT" || current.receivedQuantityLiters !== undefined) {
          throw invalidState("Receipt can be recorded once, while the shipment is in transit", {
            lifecycleStatus: current.lifecycleStatus
          });
        }
        if (current.pickupQuantityLiters === undefined) {
          throw invalidState("A pickup quantity is required before receipt");
        }
        const received = requireQuantity(operation.payload.receivedQuantityLiters, "receivedQuantityLiters", true);
        const discrepancy = evaluateDiscrepancy(current.pickupQuantityLiters, received);
        updated.receivedQuantityLiters = received;
        updated.lifecycleStatus = "RECEIVED";
        events.push(
          await this.appendEvent(tx, {
            shipmentId: current.id,
            type: "RECEIPT_RECORDED",
            actor: operation.actor,
            source: "MOBILE",
            occurredAt,
            recordedAt,
            payload: {
              receivedQuantityLiters: received,
              pickupQuantityLiters: current.pickupQuantityLiters,
              varianceLiters: discrepancy.varianceLiters,
              variancePercentage: discrepancy.variancePercentage
            }
          })
        );

        if (discrepancy.isDiscrepancy) {
          exceptionRecord = {
            id: newExceptionId(current.id),
            shipmentId: current.id,
            status: "DISCREPANCY_OPEN",
            pickupQuantityLiters: current.pickupQuantityLiters,
            receivedQuantityLiters: received,
            varianceLiters: discrepancy.varianceLiters,
            variancePercentage: discrepancy.variancePercentage,
            threshold: discrepancy.threshold,
            openedAt: recordedAt,
            version: 1
          };
          updated.exceptionStatus = "DISCREPANCY_OPEN";
          updated.deliveryStatus = "NOT_STARTED";
          await tx.insertException(exceptionRecord);
          events.push(
            await this.appendEvent(tx, {
              shipmentId: current.id,
              type: "DISCREPANCY_OPENED",
              actor: systemActor,
              source: "SYSTEM",
              occurredAt: recordedAt,
              recordedAt,
              payload: {
                exceptionId: exceptionRecord.id,
                varianceLiters: discrepancy.varianceLiters,
                variancePercentage: discrepancy.variancePercentage,
                threshold: discrepancy.threshold,
                explanation:
                  "Opened because absolute variance is greater than 100 L AND percentage variance is greater than 1%."
              }
            })
          );
        } else {
          updated.acceptedFinalQuantityLiters = received;
          updated.lifecycleStatus = "COMPLETED";
          updated.deliveryStatus = "PENDING";
          await this.queueCompletion(tx, updated, systemActor, recordedAt);
        }
      }

      await tx.updateShipment(updated, current.version);
      const response = {
        operationId: operation.operationId,
        idempotencyKey: operation.idempotencyKey,
        replayed: false,
        status: "SYNCED",
        shipment: updated,
        exception: exceptionRecord ?? null,
        appendedEventIds: events.map((event) => event.id)
      };
      await this.saveIdempotency(tx, {
        key: operation.idempotencyKey,
        requestHash,
        operationType: operation.type,
        shipmentId: operation.shipmentId,
        statusCode: 200,
        response,
        createdAt: recordedAt
      });
      return { statusCode: 200, body: response };
    });

    this.publishFromResult(result, operation.shipmentId);
    return result;
  }

  async resolveException(
    exceptionId: string,
    input: ResolutionInput,
    idempotencyKey: string
  ): Promise<ServiceResult> {
    requireText(idempotencyKey, "Idempotency-Key");
    const requestHash = hashValue({ exceptionId, input });
    const result = await this.store.transaction(async (tx) => {
      const existing = await tx.getIdempotencyResult(idempotencyKey);
      if (existing) return this.replay(existing, requestHash);

      const exceptionRecord = await tx.getException(exceptionId);
      if (!exceptionRecord) throw notFound("Exception", exceptionId);
      const shipment = await tx.getShipment(exceptionRecord.shipmentId);
      if (!shipment) throw notFound("Shipment", exceptionRecord.shipmentId);
      if (exceptionRecord.status !== "DISCREPANCY_OPEN" || shipment.exceptionStatus !== "DISCREPANCY_OPEN") {
        throw invalidState("Only an open discrepancy can be resolved");
      }
      if (shipment.lifecycleStatus !== "RECEIVED") {
        throw invalidState("The shipment must remain received until its discrepancy is resolved", {
          lifecycleStatus: shipment.lifecycleStatus
        });
      }

      // The synthetic scenario may be seeded slightly ahead of the wall clock
      // on the day it is demonstrated. A server-timed resolution must never
      // predate its immutable opening event.
      const occurredAt = input.occurredAt
        ? new Date(input.occurredAt).toISOString()
        : new Date(Math.max(Date.now(), Date.parse(exceptionRecord.openedAt))).toISOString();
      if (Date.parse(occurredAt) < Date.parse(exceptionRecord.openedAt)) {
        throw validationError("occurredAt cannot be earlier than the discrepancy opening time", {
          occurredAt,
          openedAt: exceptionRecord.openedAt
        });
      }
      const acceptedFinalQuantityLiters = requireQuantity(
        input.acceptedFinalQuantityLiters,
        "acceptedFinalQuantityLiters",
        true
      );
      const resolved: ShipmentException = {
        ...exceptionRecord,
        status: "RESOLVED",
        category: requireText(input.category, "category"),
        acceptedFinalQuantityLiters,
        reason: requireText(input.reason, "reason"),
        note: requireText(input.note, "note"),
        resolvedBy: input.actor,
        resolvedAt: occurredAt,
        version: exceptionRecord.version + 1
      };
      const completed: Shipment = {
        ...shipment,
        lifecycleStatus: "COMPLETED",
        exceptionStatus: "RESOLVED",
        deliveryStatus: "PENDING",
        acceptedFinalQuantityLiters,
        version: shipment.version + 1,
        updatedAt: occurredAt
      };

      await tx.updateException(resolved, exceptionRecord.version);
      await this.appendEvent(tx, {
        shipmentId: shipment.id,
        type: "DISCREPANCY_RESOLVED",
        actor: input.actor,
        source: "WEB",
        occurredAt,
        recordedAt: now(),
        payload: {
          exceptionId,
          category: resolved.category,
          acceptedFinalQuantityLiters,
          reason: resolved.reason,
          note: resolved.note,
          immutableOriginalReports: {
            offeredQuantityLiters: shipment.offeredQuantityLiters,
            pickupQuantityLiters: shipment.pickupQuantityLiters,
            receivedQuantityLiters: shipment.receivedQuantityLiters
          }
        }
      });
      const delivery = await this.queueCompletion(tx, completed, input.actor, occurredAt);
      await tx.updateShipment(completed, shipment.version);

      const response = {
        idempotencyKey,
        replayed: false,
        shipment: completed,
        exception: resolved,
        delivery
      };
      await this.saveIdempotency(tx, {
        key: idempotencyKey,
        requestHash,
        operationType: "RESOLVE_DISCREPANCY",
        shipmentId: shipment.id,
        statusCode: 200,
        response,
        createdAt: occurredAt
      });
      return { statusCode: 200, body: response };
    });

    this.publishFromResult(
      result,
      String((result.body.shipment as Shipment | undefined)?.id ?? ""),
      "exception.changed"
    );
    return result;
  }

  async processDelivery(deliveryId: string, input: ProcessDeliveryInput): Promise<ServiceResult> {
    requireText(input.actionIdempotencyKey, "Idempotency-Key");
    const requestHash = hashValue({ deliveryId, ...input });
    const result = await this.store.transaction(async (tx) => {
      const existing = await tx.getIdempotencyResult(input.actionIdempotencyKey);
      if (existing) return this.replay(existing, requestHash);

      const delivery = await tx.getDelivery(deliveryId);
      if (!delivery) throw notFound("Delivery", deliveryId);
      if (input.kind === "AUTOMATIC" && !["PENDING", "RETRYING"].includes(delivery.status)) {
        throw invalidState("Automatic delivery can run only while pending or retrying", { status: delivery.status });
      }
      if (input.kind === "MANUAL_REPLAY" && !["FAILED", "DLQ"].includes(delivery.status)) {
        throw invalidState("Manual replay is available only for failed or DLQ deliveries", {
          status: delivery.status
        });
      }
      const outbox = await tx.getOutbox(delivery.outboxId);
      if (!outbox) throw notFound("Outbox record", delivery.outboxId);
      const shipment = await tx.getShipment(delivery.shipmentId);
      if (!shipment) throw notFound("Shipment", delivery.shipmentId);

      const adapterResult = await this.adapters.for(delivery).deliver(delivery, outbox, input.simulatorMode);
      const occurredAt = now();
      const attemptNumber = delivery.attemptCount + 1;
      const attempt: DeliveryAttempt = {
        id: `DA-${randomUUID().slice(0, 8).toUpperCase()}`,
        deliveryId,
        attemptNumber,
        kind: input.kind,
        request: {
          method: "POST",
          destinationType: delivery.destinationType,
          destinationName: delivery.destinationName,
          destinationUrl: delivery.destinationUrl,
          headers: {
            "content-type": "application/json",
            "idempotency-key": delivery.stableIdempotencyKey,
            "x-correlation-id": delivery.correlationId
          },
          payload: outbox.payload
        },
        response: adapterResult.response,
        httpStatus: adapterResult.httpStatus,
        outcome: adapterResult.outcome,
        occurredAt
      };

      const updatedDelivery: DeliveryJob = {
        ...delivery,
        attemptCount: attemptNumber,
        lastHttpStatus: adapterResult.httpStatus,
        lastError:
          adapterResult.outcome === "SUCCEEDED"
            ? undefined
            : String(adapterResult.response.message ?? adapterResult.response.code ?? "Delivery failed"),
        updatedAt: occurredAt
      };
      const updatedShipment: Shipment = {
        ...shipment,
        version: shipment.version + 1,
        updatedAt: occurredAt
      };
      const updatedOutbox: OutboxRecord = { ...outbox };

      if (adapterResult.outcome === "SUCCEEDED") {
        updatedDelivery.status = "DELIVERED";
        updatedDelivery.deliveredAt = occurredAt;
        updatedShipment.deliveryStatus = "DELIVERED";
        updatedOutbox.status = "DELIVERED";
        updatedOutbox.deliveredAt = occurredAt;
      } else if (adapterResult.outcome === "PERMANENT_FAILURE") {
        updatedDelivery.status = "FAILED";
        updatedShipment.deliveryStatus = "FAILED";
        updatedOutbox.status = "FAILED";
      } else if (input.kind === "MANUAL_REPLAY" || attemptNumber >= delivery.maxAttempts) {
        updatedDelivery.status = "DLQ";
        updatedShipment.deliveryStatus = "DLQ";
        updatedOutbox.status = "DLQ";
      } else {
        updatedDelivery.status = "RETRYING";
        updatedShipment.deliveryStatus = "RETRYING";
      }

      await tx.appendDeliveryAttempt(attempt);
      await tx.updateDelivery(updatedDelivery);
      await tx.updateOutbox(updatedOutbox);
      await tx.updateShipment(updatedShipment, shipment.version);
      await this.appendEvent(tx, {
        shipmentId: shipment.id,
        type: input.kind === "MANUAL_REPLAY" ? "DELIVERY_REPLAYED" : "DELIVERY_ATTEMPTED",
        actor: input.actor,
        source: input.kind === "MANUAL_REPLAY" ? "WEB" : "SYSTEM",
        occurredAt,
        recordedAt: occurredAt,
        payload: {
          deliveryId,
          attemptNumber,
          kind: input.kind,
          httpStatus: adapterResult.httpStatus,
          outcome: adapterResult.outcome,
          resultingStatus: updatedDelivery.status,
          stableDestinationIdempotencyKey: delivery.stableIdempotencyKey
        }
      });

      const response = {
        idempotencyKey: input.actionIdempotencyKey,
        replayed: false,
        delivery: updatedDelivery,
        attempt,
        shipment: updatedShipment
      };
      await this.saveIdempotency(tx, {
        key: input.actionIdempotencyKey,
        requestHash,
        operationType: input.kind === "MANUAL_REPLAY" ? "MANUAL_REPLAY_DELIVERY" : "PROCESS_DELIVERY",
        shipmentId: shipment.id,
        statusCode: 200,
        response,
        createdAt: occurredAt
      });
      return { statusCode: 200, body: response };
    });
    this.publishFromResult(
      result,
      String((result.body.shipment as Shipment | undefined)?.id ?? ""),
      "delivery.changed"
    );
    return result;
  }

  private async createShipment(
    tx: FieldRelayTransaction,
    operation: SyncOperation,
    requestHash: string
  ): Promise<ServiceResult> {
    if (operation.baseVersion !== 0) {
      throw validationError("A new shipment must have baseVersion 0");
    }
    await tx.acquireLock(`shipment:${operation.shipmentId}`);
    if (await tx.getShipment(operation.shipmentId)) {
      throw new DomainError("Shipment already exists", 409, "DUPLICATE_SHIPMENT", {
        shipmentId: operation.shipmentId
      });
    }
    const recordedAt = now();
    const hasOfferedQuantity = operation.payload.offeredQuantityLiters !== undefined;
    const offeredQuantityLiters = hasOfferedQuantity
      ? requireQuantity(operation.payload.offeredQuantityLiters, "offeredQuantityLiters")
      : undefined;
    const shipment: Shipment = {
      id: operation.shipmentId,
      lifecycleStatus: hasOfferedQuantity ? "OFFERED" : "DRAFT",
      syncStatus: "SYNCED",
      exceptionStatus: "NONE",
      deliveryStatus: "NOT_STARTED",
      ...(offeredQuantityLiters === undefined ? {} : { offeredQuantityLiters }),
      version: 1,
      createdAt: new Date(operation.deviceTimestamp).toISOString(),
      updatedAt: recordedAt
    };
    await tx.insertShipment(shipment);
    const created = await this.appendEvent(tx, {
      shipmentId: shipment.id,
      type: "SHIPMENT_CREATED",
      actor: operation.actor,
      source: "MOBILE",
      occurredAt: operation.deviceTimestamp,
      recordedAt,
      payload: { createdOffline: true, deviceTimestamp: operation.deviceTimestamp }
    });
    const appendedEventIds = [created.id];
    if (offeredQuantityLiters !== undefined) {
      const offered = await this.appendEvent(tx, {
        shipmentId: shipment.id,
        type: "SHIPMENT_OFFERED",
        actor: operation.actor,
        source: "MOBILE",
        occurredAt: operation.deviceTimestamp,
        recordedAt,
        payload: { offeredQuantityLiters }
      });
      appendedEventIds.push(offered.id);
    }
    const response = {
      operationId: operation.operationId,
      idempotencyKey: operation.idempotencyKey,
      replayed: false,
      status: "SYNCED",
      shipment,
      exception: null,
      appendedEventIds
    };
    await this.saveIdempotency(tx, {
      key: operation.idempotencyKey,
      requestHash,
      operationType: operation.type,
      shipmentId: operation.shipmentId,
      statusCode: 201,
      response,
      createdAt: recordedAt
    });
    return { statusCode: 201, body: response };
  }

  private async recordConflict(
    tx: FieldRelayTransaction,
    shipment: Shipment,
    operation: SyncOperation,
    requestHash: string
  ): Promise<ServiceResult> {
    const createdAt = now();
    const needsReview: Shipment = {
      ...shipment,
      syncStatus: "NEEDS_REVIEW",
      version: shipment.version + 1,
      updatedAt: createdAt
    };
    await tx.updateShipment(needsReview, shipment.version);
    const conflict: SyncConflict = {
      id: `SC-${randomUUID().slice(0, 8).toUpperCase()}`,
      shipmentId: shipment.id,
      idempotencyKey: operation.idempotencyKey,
      operationType: operation.type,
      baseVersion: operation.baseVersion,
      serverVersion: needsReview.version,
      localPayload: operation.payload,
      options: ["SEND_LOCAL_FOR_REVIEW", "KEEP_SEPARATE_DRAFT", "USE_SERVER_VERSION"],
      createdAt
    };
    await tx.insertConflict(conflict);
    const response = {
      operationId: operation.operationId,
      idempotencyKey: operation.idempotencyKey,
      replayed: false,
      status: "NEEDS_REVIEW",
      code: "VERSION_CONFLICT",
      message: "The server changed after this offline action was created. Nothing was overwritten.",
      conflict,
      shipment: needsReview
    };
    await this.saveIdempotency(tx, {
      key: operation.idempotencyKey,
      requestHash,
      operationType: operation.type,
      shipmentId: shipment.id,
      statusCode: 409,
      response,
      createdAt
    });
    return { statusCode: 409, body: response };
  }

  private async queueCompletion(
    tx: FieldRelayTransaction,
    shipment: Shipment,
    actor: Actor,
    occurredAt: string
  ): Promise<DeliveryJob> {
    if (shipment.lifecycleStatus !== "COMPLETED") {
      throw invalidState("Only a completed shipment can be queued for delivery");
    }
    const stableIdempotencyKey = `fieldrelay:shipment-completed:${shipment.id}:v${shipment.version}`;
    const outbox: OutboxRecord = {
      id: newOutboxId(),
      shipmentId: shipment.id,
      eventType: "SHIPMENT_COMPLETED",
      payload: {
        shipmentId: shipment.id,
        lifecycleStatus: shipment.lifecycleStatus,
        offeredQuantityLiters: shipment.offeredQuantityLiters,
        pickupQuantityLiters: shipment.pickupQuantityLiters,
        receivedQuantityLiters: shipment.receivedQuantityLiters,
        acceptedFinalQuantityLiters: shipment.acceptedFinalQuantityLiters,
        completedAt: occurredAt
      },
      destinationType: this.destination.type,
      status: "PENDING",
      stableIdempotencyKey,
      createdAt: occurredAt
    };
    const delivery: DeliveryJob = {
      id: newDeliveryId(shipment.id),
      shipmentId: shipment.id,
      outboxId: outbox.id,
      destinationType: this.destination.type,
      destinationName: this.destination.name,
      destinationUrl: this.destination.url,
      status: "PENDING",
      stableIdempotencyKey,
      attemptCount: 0,
      maxAttempts: 3,
      correlationId: `corr-${randomUUID()}`,
      createdAt: occurredAt,
      updatedAt: occurredAt
    };
    await tx.insertOutbox(outbox);
    await tx.insertDelivery(delivery);
    await this.appendEvent(tx, {
      shipmentId: shipment.id,
      type: "DELIVERY_QUEUED",
      actor,
      source: "SYSTEM",
      occurredAt,
      recordedAt: now(),
      payload: {
        deliveryId: delivery.id,
        outboxId: outbox.id,
        destinationType: delivery.destinationType,
        stableIdempotencyKey
      }
    });
    return delivery;
  }

  private async appendEvent(
    tx: FieldRelayTransaction,
    input: Omit<Parameters<typeof createAuditEvent>[0], "sequence" | "previousHash">
  ): Promise<AuditEvent> {
    const events = await tx.listAuditEvents(input.shipmentId);
    const previous = events.at(-1);
    const event = createAuditEvent({
      ...input,
      sequence: (previous?.sequence ?? 0) + 1,
      previousHash: previous?.eventHash ?? null
    });
    await tx.appendAuditEvent(event);
    return event;
  }

  private replay(existing: StoredIdempotencyResult, requestHash: string): ServiceResult {
    if (existing.requestHash !== requestHash) {
      throw new DomainError(
        "This idempotency key was already used for a different request",
        409,
        "IDEMPOTENCY_KEY_REUSED",
        { idempotencyKey: existing.key, originalOperationType: existing.operationType }
      );
    }
    return {
      statusCode: existing.statusCode,
      body: {
        ...existing.response,
        replayed: true,
        recovery: "ORIGINAL_RESULT_RETURNED"
      }
    };
  }

  private async saveIdempotency(
    tx: FieldRelayTransaction,
    result: StoredIdempotencyResult
  ): Promise<void> {
    await tx.insertIdempotencyResult(result);
  }

  private publishFromResult(
    result: ServiceResult,
    shipmentId: string,
    defaultType: RealtimeEvent["type"] = "shipment.changed"
  ): void {
    if (result.body.replayed === true) return;
    const status = String(result.body.status ?? "");
    const isConflict = status === "NEEDS_REVIEW";
    this.eventBus.publish({
      id: randomUUID(),
      type: isConflict ? "sync.conflict" : defaultType,
      occurredAt: now(),
      data: { shipmentId, result: result.body }
    });
  }
}
