import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError, z } from "zod";
import type { FieldRelayConfig } from "./config.js";
import { DomainError } from "./domain/errors.js";
import { hashValue, verifyAuditChain } from "./domain/audit.js";
import { FieldRelayService } from "./domain/service.js";
import { lifecycleStatuses, syncStatuses, exceptionStatuses, deliveryStatuses } from "./domain/types.js";
import type { Actor, DeliveryAttempt, DeliveryJob, FieldRelaySnapshot } from "./domain/types.js";
import type { FieldRelayStore } from "./store/store.js";
import { PublicWriteRateLimiter, SseConnectionLimiter } from "./publicSafety.js";
import {
  canonicalDemoScenario,
  demoOfflineRecoveryOperation,
  demoResourceIds,
  isIsolatedDemoShipmentId
} from "./seed/demoSeed.js";

const idSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._~-]*$/, "Must use letters, numbers, dot, underscore, tilde, or hyphen");

const idempotencyKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:~-]*$/, "Idempotency key contains unsupported characters");
const shortTextSchema = z.string().trim().min(1).max(120);
const noteSchema = z.string().trim().min(1).max(2_000);
const quantitySchema = z.number().finite().min(0).max(1_000_000_000);

const actorSchema = z.object({
  id: idSchema,
  name: shortTextSchema,
  role: z.string().trim().min(1).max(80).optional()
}).strict();

const operationPayloadSchema = z
  .record(z.string().max(80), z.unknown())
  .superRefine((payload, context) => {
    if (Object.keys(payload).length > 20 || JSON.stringify(payload).length > 8_192) {
      context.addIssue({ code: "custom", message: "payload exceeds the demo operation limit" });
    }
  });

const syncOperationSchema = z.object({
  operationId: idSchema,
  idempotencyKey: idempotencyKeySchema,
  type: z.enum([
    "CREATE_SHIPMENT",
    "OFFER_SHIPMENT",
    "ACCEPT_HANDOFF",
    "CONFIRM_PICKUP",
    "RECORD_RECEIPT"
  ]),
  shipmentId: idSchema,
  baseVersion: z.number().int().nonnegative(),
  deviceTimestamp: z.string().datetime({ offset: true }),
  actor: actorSchema,
  payload: operationPayloadSchema
}).strict().superRefine((operation, context) => {
  const quantityField =
    operation.type === "CREATE_SHIPMENT" || operation.type === "OFFER_SHIPMENT"
      ? "offeredQuantityLiters"
      : operation.type === "CONFIRM_PICKUP"
        ? "pickupQuantityLiters"
        : operation.type === "RECORD_RECEIPT"
          ? "receivedQuantityLiters"
          : undefined;
  if (!quantityField) return;
  const value = operation.payload[quantityField];
  if (operation.type === "CREATE_SHIPMENT" && value === undefined) return;
  const parsed = quantitySchema.safeParse(value);
  if (!parsed.success || (operation.type !== "RECORD_RECEIPT" && parsed.data === 0)) {
    context.addIssue({
      code: "custom",
      path: ["payload", quantityField],
      message: `${quantityField} must be ${operation.type === "RECORD_RECEIPT" ? "a non-negative" : "a positive"} finite number`
    });
  }
});

const resolutionSchema = z.object({
  category: z.string().trim().min(1).max(80),
  acceptedFinalQuantityLiters: quantitySchema,
  reason: z.string().trim().min(1).max(500),
  note: noteSchema,
  actor: actorSchema,
  occurredAt: z.string().datetime({ offset: true }).optional()
}).strict();

const deliveryProcessSchema = z.object({
  simulatorMode: z.enum(["success", "retryable-failure", "permanent-failure"]).optional(),
  actor: actorSchema.default({ id: "system", name: "FieldRelay", role: "SYSTEM" })
}).strict();

const runIdSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(24)
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "runId must contain lowercase letters, numbers, or internal hyphens");

const demoRunSchema = z.object({
  runId: runIdSchema.optional(),
  offlineOfferedQuantityLiters: quantitySchema.positive().optional()
}).strict();
const booleanQuerySchema = z.enum(["true", "false"]).transform((value) => value === "true");
const PUBLIC_DEMO_SHIPMENT_PREFIX = "FR-2026-0842-";
const PUBLIC_DEMO_EXCEPTION_PREFIX = "EX-0037-";
const localPublicDestination = {
  type: "GENERIC_WEBHOOK",
  name: "FieldRelay local delivery simulator",
  url: "local://delivery-simulator"
} as const;

export interface BuildAppOptions {
  store: FieldRelayStore;
  config: FieldRelayConfig;
  logger?: boolean;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function requiredIdempotencyKey(headers: Record<string, string | string[] | undefined>): string {
  const value = headerValue(headers["idempotency-key"]);
  if (!value) throw new DomainError("Idempotency-Key header is required", 400, "IDEMPOTENCY_KEY_REQUIRED");
  return idempotencyKeySchema.parse(value);
}

function requestClientKey(request: { headers: Record<string, unknown>; ip: string }): string {
  const forwarded = headerValue(request.headers["x-forwarded-for"] as string | string[] | undefined);
  const candidate = forwarded?.split(",").at(-1)?.trim();
  return candidate && candidate.length <= 128 && /^[A-Fa-f0-9:.]+$/.test(candidate) ? candidate : request.ip;
}

function corsAllows(config: FieldRelayConfig, origin: string): boolean {
  if (config.corsOrigin === "*") return true;
  return (config.corsOrigins ?? [config.corsOrigin]).includes(origin);
}

function publicScopeError(resourceType: "shipment" | "exception" | "delivery"): DomainError {
  return new DomainError(
    `The shared or unregistered ${resourceType} is read-only in the public simulator; create an isolated demo run first`,
    403,
    "PUBLIC_DEMO_READ_ONLY",
    { resourceType, createRunPath: "/api/v1/demo/runs" }
  );
}

function registeredDemoRunRoots(snapshot: FieldRelaySnapshot): string[] {
  return snapshot.exceptions
    .filter(
      (record) =>
        record.id.startsWith(PUBLIC_DEMO_EXCEPTION_PREFIX) &&
        record.shipmentId.startsWith(PUBLIC_DEMO_SHIPMENT_PREFIX)
    )
    .map((record) => record.shipmentId);
}

function isRegisteredDemoRunShipment(snapshot: FieldRelaySnapshot, shipmentId: string): boolean {
  return registeredDemoRunRoots(snapshot).some(
    (rootShipmentId) => shipmentId === rootShipmentId || shipmentId === `${rootShipmentId}-OFFLINE`
  );
}

function issuedOfflineOperation(
  snapshot: FieldRelaySnapshot,
  runId: string
): z.infer<typeof syncOperationSchema> {
  const rootShipmentId = demoResourceIds(runId).shipmentId;
  const registration = snapshot.idempotencyResults.find(
    (result) => result.operationType === "CREATE_DEMO_RUN" && result.shipmentId === rootShipmentId
  );
  const response = registration?.response as {
    offlineRecovery?: { operation?: unknown };
  } | undefined;
  const parsed = syncOperationSchema.safeParse(response?.offlineRecovery?.operation);
  if (
    parsed.success &&
    parsed.data.type === "CREATE_SHIPMENT" &&
    parsed.data.shipmentId === `${rootShipmentId}-OFFLINE`
  ) {
    return parsed.data;
  }
  // Compatibility for runs created before customizable mobile registration was
  // introduced. New runs always recover the exact operation persisted in the
  // CREATE_DEMO_RUN idempotency record.
  return demoOfflineRecoveryOperation(runId);
}

function publicActorForOperation(type: z.infer<typeof syncOperationSchema>["type"]): Actor {
  if (type === "ACCEPT_HANDOFF" || type === "CONFIRM_PICKUP") return canonicalDemoScenario.people.driver;
  if (type === "RECORD_RECEIPT") return canonicalDemoScenario.people.receiverOperator;
  return canonicalDemoScenario.people.generatorCoordinator;
}

function assertPublicSyncScope(
  snapshot: FieldRelaySnapshot,
  operation: z.infer<typeof syncOperationSchema>
): void {
  // CREATE_SHIPMENT is narrower than the general run scope: a run exposes one
  // server-issued operation that may create only its offline companion record.
  if (operation.type === "CREATE_SHIPMENT" && operation.shipmentId.endsWith("-OFFLINE")) {
    const rootShipmentId = operation.shipmentId.slice(0, -"-OFFLINE".length);
    const runId = rootShipmentId.startsWith(PUBLIC_DEMO_SHIPMENT_PREFIX)
      ? rootShipmentId.slice(PUBLIC_DEMO_SHIPMENT_PREFIX.length).toLowerCase()
      : "";
    const rootIsRegistered = registeredDemoRunRoots(snapshot).includes(rootShipmentId);
    const expected = runId ? issuedOfflineOperation(snapshot, runId) : undefined;
    if (
      rootIsRegistered &&
      expected &&
      hashValue(operation) === hashValue(expected)
    ) {
      return;
    }
    throw publicScopeError("shipment");
  }

  if (isRegisteredDemoRunShipment(snapshot, operation.shipmentId)) return;
  throw publicScopeError("shipment");
}

function assertPublicExceptionScope(snapshot: FieldRelaySnapshot, exceptionId: string): void {
  const record = snapshot.exceptions.find((exceptionRecord) => exceptionRecord.id === exceptionId);
  if (!record || !isRegisteredDemoRunShipment(snapshot, record.shipmentId)) {
    throw publicScopeError("exception");
  }
}

function assertPublicDeliveryScope(snapshot: FieldRelaySnapshot, deliveryId: string): void {
  const record = snapshot.deliveries.find((delivery) => delivery.id === deliveryId);
  if (!record || !isRegisteredDemoRunShipment(snapshot, record.shipmentId)) {
    throw publicScopeError("delivery");
  }
}

function presentDelivery(delivery: DeliveryJob, publicView: boolean) {
  if (!publicView) return delivery;
  return {
    id: delivery.id,
    shipmentId: delivery.shipmentId,
    outboxId: delivery.outboxId,
    destinationType: delivery.destinationType,
    destinationName: delivery.destinationName,
    status: delivery.status,
    stableIdempotencyKey: delivery.stableIdempotencyKey,
    attemptCount: delivery.attemptCount,
    maxAttempts: delivery.maxAttempts,
    correlationId: delivery.correlationId,
    ...(delivery.lastHttpStatus === undefined ? {} : { lastHttpStatus: delivery.lastHttpStatus }),
    createdAt: delivery.createdAt,
    updatedAt: delivery.updatedAt,
    ...(delivery.deliveredAt === undefined ? {} : { deliveredAt: delivery.deliveredAt })
  };
}

function presentDeliveryAttempt(attempt: DeliveryAttempt, publicView: boolean) {
  if (!publicView) return attempt;
  return {
    id: attempt.id,
    deliveryId: attempt.deliveryId,
    attemptNumber: attempt.attemptNumber,
    kind: attempt.kind,
    httpStatus: attempt.httpStatus,
    outcome: attempt.outcome,
    occurredAt: attempt.occurredAt
  };
}

function presentServiceBody(body: Record<string, unknown>, publicView: boolean): Record<string, unknown> {
  if (!publicView) return body;

  const presented = { ...body };
  if (body.delivery && typeof body.delivery === "object" && "destinationUrl" in body.delivery) {
    presented.delivery = presentDelivery(body.delivery as DeliveryJob, true);
  }
  if (body.attempt && typeof body.attempt === "object" && "request" in body.attempt) {
    presented.attempt = presentDeliveryAttempt(body.attempt as DeliveryAttempt, true);
  }
  if (Array.isArray(body.deliveryAttempts)) {
    presented.deliveryAttempts = body.deliveryAttempts.map((attempt) =>
      attempt && typeof attempt === "object" && "request" in attempt
        ? presentDeliveryAttempt(attempt as DeliveryAttempt, true)
        : attempt
    );
  }
  if (Array.isArray(body.attempts)) {
    presented.attempts = body.attempts.map((attempt) =>
      attempt && typeof attempt === "object" && "request" in attempt
        ? presentDeliveryAttempt(attempt as DeliveryAttempt, true)
        : attempt
    );
  }
  return presented;
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ? { level: options.config.logLevel } : false,
    bodyLimit: 64 * 1024
  });
  const publicSafetyEnabled = options.config.allowCanonicalMutations === false;
  const service = new FieldRelayService(
    options.store,
    publicSafetyEnabled ? localPublicDestination : options.config.destination
  );
  const writeLimiter = options.config.publicWriteLimitPerHour
    ? new PublicWriteRateLimiter(options.config.publicWriteLimitPerHour)
    : undefined;
  const sseLimiter =
    options.config.maxSseConnectionsPerClient && options.config.maxSseConnectionsGlobal
      ? new SseConnectionLimiter(
          options.config.maxSseConnectionsPerClient,
          options.config.maxSseConnectionsGlobal
        )
      : undefined;
  const closeSseConnections = new Set<() => void>();

  app.addHook("onSend", async (request, reply, payload) => {
    const requestOrigin = headerValue(request.headers.origin);
    if (requestOrigin) {
      reply.header("vary", "Origin");
      if (corsAllows(options.config, requestOrigin)) {
        reply.header("access-control-allow-origin", requestOrigin);
      }
    }
    reply.header("access-control-allow-headers", "content-type,idempotency-key,last-event-id");
    reply.header("access-control-allow-methods", "GET,POST,OPTIONS");
    reply.header("x-content-type-options", "nosniff");
    return payload;
  });

  app.addHook("onRequest", async (request, reply) => {
    if (!writeLimiter || request.method !== "POST" || !request.url.startsWith("/api/v1/")) return;
    const decision = writeLimiter.consume(requestClientKey(request));
    reply.header("x-ratelimit-limit", decision.limit);
    reply.header("x-ratelimit-remaining", decision.remaining);
    reply.header("x-ratelimit-reset", Math.ceil(decision.resetAt / 1_000));
    if (!decision.allowed) {
      reply.header("retry-after", Math.max(1, Math.ceil((decision.resetAt - Date.now()) / 1_000)));
      return reply.code(429).send({
        error: {
          code: "PUBLIC_WRITE_RATE_LIMIT_EXCEEDED",
          message: "This client has reached the public demo write limit",
          details: { limit: decision.limit, window: "1 hour" }
        }
      });
    }
  });

  app.options("*", async (_request, reply) => reply.code(204).send());

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof DomainError) {
      return reply.code(error.statusCode).send({
        error: { code: error.code, message: error.message, details: error.details ?? null }
      });
    }
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: { code: "VALIDATION_ERROR", message: "Request validation failed", details: error.flatten() }
      });
    }
    const clientError = error as { statusCode?: unknown; message?: unknown };
    const clientStatus = typeof clientError.statusCode === "number" ? clientError.statusCode : undefined;
    if (clientStatus && clientStatus >= 400 && clientStatus < 500) {
      return reply.code(clientStatus).send({
        error: {
          code: clientStatus === 413 ? "PAYLOAD_TOO_LARGE" : "BAD_REQUEST",
          message:
            clientStatus === 413
              ? "Request body exceeds 64 KiB"
              : typeof clientError.message === "string"
                ? clientError.message
                : "Invalid request"
        }
      });
    }
    app.log.error(error);
    return reply.code(500).send({
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" }
    });
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "fieldrelay-api",
    store: options.store.kind,
    time: new Date().toISOString()
  }));

  app.get("/ready", async (_request, reply) => {
    const snapshot = await options.store.snapshot();
    const canonicalDemoSeeded = snapshot.shipments.some((shipment) => shipment.id === "FR-2026-0842");
    return reply.code(canonicalDemoSeeded ? 200 : 503).send({
      status: canonicalDemoSeeded ? "ready" : "not-ready",
      service: "fieldrelay-api",
      store: options.store.kind,
      canonicalDemoSeeded,
      time: new Date().toISOString()
    });
  });

  app.get("/api/v1/meta", async () => ({
    name: "FieldRelay",
    description: "Offline-first chain-of-custody portfolio prototype",
    statuses: {
      lifecycle: lifecycleStatuses,
      sync: syncStatuses,
      exception: exceptionStatuses,
      delivery: deliveryStatuses
    },
    disclaimer:
      "Independent portfolio prototype using synthetic data and illustrative rules. Not affiliated with WiQ. Not for production or regulatory use.",
    integrations: {
      primary: "GENERIC_WEBHOOK",
      illustrativeExample: "ODATA_EXAMPLE",
      note: "The OData adapter is an example only and does not imply WiQ uses SAP or OData."
    },
    demoRuns: {
      isolated: true,
      create: "POST /api/v1/demo/runs",
      note: "Starting over creates a fresh run; immutable evidence from earlier runs is not deleted."
    },
    publicSimulator: {
      canonicalReadOnly: publicSafetyEnabled,
      isolatedWritesOnly: publicSafetyEnabled,
      localDeliveryOnly: publicSafetyEnabled,
      maxDemoRuns: options.config.maxDemoRuns ?? null
    }
  }));

  app.get("/api/v1/demo", async () => {
    const snapshot = await options.store.snapshot();
    const shipment = snapshot.shipments.find((item) => item.id === "FR-2026-0842");
    if (!shipment) throw new DomainError("Demo shipment was not seeded", 404, "DEMO_NOT_SEEDED");
    return {
      runId: null,
      isolated: false,
      baseline: "DISCREPANCY_OPEN",
      resources: {
        shipmentId: "FR-2026-0842",
        exceptionId: "EX-0037",
        deliveryId: "DL-019"
      },
      scenario: canonicalDemoScenario,
      shipment,
      timeline: snapshot.auditEvents.filter((event) => event.shipmentId === shipment.id),
      exception: snapshot.exceptions.find((record) => record.shipmentId === shipment.id) ?? null,
      delivery: (() => {
        const delivery = snapshot.deliveries.find((record) => record.shipmentId === shipment.id);
        return delivery ? presentDelivery(delivery, publicSafetyEnabled) : null;
      })(),
      deliveryAttempts: snapshot.deliveryAttempts.filter(
        (attempt) => snapshot.deliveries.find((delivery) => delivery.id === attempt.deliveryId)?.shipmentId === shipment.id
      ).map((attempt) => presentDeliveryAttempt(attempt, publicSafetyEnabled))
    };
  });

  app.post("/api/v1/demo/runs", async (request, reply) => {
    const body = demoRunSchema.parse(request.body ?? {});
    const result = await service.createDemoRun({
      ...(body.runId ? { requestedRunId: body.runId } : {}),
      ...(body.offlineOfferedQuantityLiters === undefined
        ? {}
        : { offlineOfferedQuantityLiters: body.offlineOfferedQuantityLiters }),
      actionIdempotencyKey: requiredIdempotencyKey(request.headers),
      ...(options.config.maxDemoRuns ? { maxDemoRuns: options.config.maxDemoRuns } : {})
    });
    return reply.code(result.statusCode).send(presentServiceBody(result.body, publicSafetyEnabled));
  });

  app.get("/api/v1/demo/runs/:runId", async (request) => {
    const { runId } = z.object({ runId: runIdSchema }).strict().parse(request.params);
    const resources = demoResourceIds(runId);
    const snapshot = await options.store.snapshot();
    const shipment = snapshot.shipments.find((item) => item.id === resources.shipmentId);
    if (!shipment) throw new DomainError(`Demo run ${runId} was not found`, 404, "NOT_FOUND", { runId });
    const delivery = snapshot.deliveries.find((record) => record.shipmentId === shipment.id) ?? null;
    return {
      runId,
      isolated: true,
      resources: {
        shipmentId: resources.shipmentId,
        exceptionId: resources.exceptionId,
        deliveryId: resources.deliveryId
      },
      scenario: canonicalDemoScenario,
      offlineRecovery: {
        operation: issuedOfflineOperation(snapshot, runId),
        syncPath: "/api/v1/sync/operations",
        resultPath: `/api/v1/sync/results/demo-${runId}-offline-save`,
        expectedServerMutations: 1,
        instructions:
          "Send this operation, discard the first response to simulate loss, then resend it unchanged or recover by resultPath."
      },
      shipment,
      timeline: snapshot.auditEvents.filter((event) => event.shipmentId === shipment.id),
      exception: snapshot.exceptions.find((record) => record.shipmentId === shipment.id) ?? null,
      delivery: delivery ? presentDelivery(delivery, publicSafetyEnabled) : null,
      deliveryAttempts: delivery
        ? snapshot.deliveryAttempts
            .filter((attempt) => attempt.deliveryId === delivery.id)
            .map((attempt) => presentDeliveryAttempt(attempt, publicSafetyEnabled))
        : [],
      conflicts: snapshot.conflicts.filter((record) => record.shipmentId === shipment.id)
    };
  });

  app.get("/api/v1/shipments", async (request) => {
    const query = z
      .object({
        lifecycleStatus: z.enum(lifecycleStatuses).optional(),
        exceptionStatus: z.enum(exceptionStatuses).optional(),
        deliveryStatus: z.enum(deliveryStatuses).optional(),
        runId: runIdSchema.optional(),
        includeDemoRuns: booleanQuerySchema.optional().default(false)
      })
      .strict()
      .parse(request.query);
    const snapshot = await options.store.snapshot();
    const runPrefix = query.runId ? `FR-2026-0842-${query.runId.toUpperCase()}` : undefined;
    return {
      items: snapshot.shipments.filter(
        (shipment) =>
          (runPrefix
            ? shipment.id === runPrefix || shipment.id.startsWith(`${runPrefix}-`)
            : query.includeDemoRuns || !isIsolatedDemoShipmentId(shipment.id)) &&
          (!query.lifecycleStatus || shipment.lifecycleStatus === query.lifecycleStatus) &&
          (!query.exceptionStatus || shipment.exceptionStatus === query.exceptionStatus) &&
          (!query.deliveryStatus || shipment.deliveryStatus === query.deliveryStatus)
      )
    };
  });

  app.get("/api/v1/shipments/:id", async (request) => {
    const { id } = z.object({ id: idSchema }).strict().parse(request.params);
    const snapshot = await options.store.snapshot();
    const shipment = snapshot.shipments.find((item) => item.id === id);
    if (!shipment) throw new DomainError(`Shipment ${id} was not found`, 404, "NOT_FOUND");
    const delivery = snapshot.deliveries.find((record) => record.shipmentId === id);
    return {
      shipment,
      timeline: snapshot.auditEvents.filter((event) => event.shipmentId === id),
      exception: snapshot.exceptions.find((record) => record.shipmentId === id) ?? null,
      delivery: delivery ? presentDelivery(delivery, publicSafetyEnabled) : null,
      conflicts: snapshot.conflicts.filter((record) => record.shipmentId === id)
    };
  });

  app.get("/api/v1/shipments/:id/audit/verify", async (request) => {
    const { id } = z.object({ id: idSchema }).strict().parse(request.params);
    const snapshot = await options.store.snapshot();
    const timeline = snapshot.auditEvents.filter((event) => event.shipmentId === id);
    if (!snapshot.shipments.some((shipment) => shipment.id === id)) {
      throw new DomainError(`Shipment ${id} was not found`, 404, "NOT_FOUND");
    }
    return { shipmentId: id, eventCount: timeline.length, chainValid: verifyAuditChain(timeline) };
  });

  app.get("/api/v1/exceptions", async (request) => {
    const query = z
      .object({
        status: z.enum(["DISCREPANCY_OPEN", "RESOLVED"]).optional(),
        runId: runIdSchema.optional(),
        includeDemoRuns: booleanQuerySchema.optional().default(false)
      })
      .strict()
      .parse(request.query);
    const snapshot = await options.store.snapshot();
    const runShipmentId = query.runId ? demoResourceIds(query.runId).shipmentId : undefined;
    return {
      items: snapshot.exceptions.filter(
        (record) =>
          (runShipmentId
            ? record.shipmentId === runShipmentId
            : query.includeDemoRuns || !isIsolatedDemoShipmentId(record.shipmentId)) &&
          (!query.status || record.status === query.status)
      )
    };
  });

  app.get("/api/v1/exceptions/:id", async (request) => {
    const { id } = z.object({ id: idSchema }).strict().parse(request.params);
    const snapshot = await options.store.snapshot();
    const exceptionRecord = snapshot.exceptions.find((item) => item.id === id);
    if (!exceptionRecord) throw new DomainError(`Exception ${id} was not found`, 404, "NOT_FOUND");
    return {
      exception: exceptionRecord,
      shipment: snapshot.shipments.find((item) => item.id === exceptionRecord.shipmentId),
      evidence: snapshot.auditEvents.filter(
        (event) =>
          event.shipmentId === exceptionRecord.shipmentId &&
          ["SHIPMENT_OFFERED", "PICKUP_CONFIRMED", "RECEIPT_RECORDED", "DISCREPANCY_OPENED"].includes(event.type)
      )
    };
  });

  app.get("/api/v1/deliveries", async (request) => {
    const query = z
      .object({
        status: z.enum(["PENDING", "RETRYING", "FAILED", "DLQ", "DELIVERED"]).optional(),
        runId: runIdSchema.optional(),
        includeDemoRuns: booleanQuerySchema.optional().default(false)
      })
      .strict()
      .parse(request.query);
    const snapshot = await options.store.snapshot();
    const runShipmentId = query.runId ? demoResourceIds(query.runId).shipmentId : undefined;
    return {
      items: snapshot.deliveries.filter(
        (delivery) =>
          (runShipmentId
            ? delivery.shipmentId === runShipmentId
            : query.includeDemoRuns || !isIsolatedDemoShipmentId(delivery.shipmentId)) &&
          (!query.status || delivery.status === query.status)
      ).map((delivery) => presentDelivery(delivery, publicSafetyEnabled))
    };
  });

  app.get("/api/v1/deliveries/:id", async (request) => {
    const { id } = z.object({ id: idSchema }).strict().parse(request.params);
    const snapshot = await options.store.snapshot();
    const delivery = snapshot.deliveries.find((item) => item.id === id);
    if (!delivery) throw new DomainError(`Delivery ${id} was not found`, 404, "NOT_FOUND");
    return {
      delivery: presentDelivery(delivery, publicSafetyEnabled),
      attempts: snapshot.deliveryAttempts
        .filter((attempt) => attempt.deliveryId === id)
        .map((attempt) => presentDeliveryAttempt(attempt, publicSafetyEnabled)),
      outbox: snapshot.outbox.find((record) => record.id === delivery.outboxId),
      shipment: snapshot.shipments.find((shipment) => shipment.id === delivery.shipmentId)
    };
  });

  app.post("/api/v1/sync/operations", async (request, reply) => {
    const operation = syncOperationSchema.parse(request.body);
    const safeOperation = publicSafetyEnabled
      ? { ...operation, actor: publicActorForOperation(operation.type) }
      : operation;
    if (publicSafetyEnabled) assertPublicSyncScope(await options.store.snapshot(), safeOperation);
    const result = await service.sync(safeOperation);
    return reply.code(result.statusCode).send(presentServiceBody(result.body, publicSafetyEnabled));
  });

  app.get("/api/v1/sync/results/:idempotencyKey", async (request, reply) => {
    const { idempotencyKey } = z
      .object({ idempotencyKey: idempotencyKeySchema })
      .strict()
      .parse(request.params);
    const result = await service.getIdempotencyResult(idempotencyKey);
    return reply.code(result.statusCode).send(presentServiceBody(result.body, publicSafetyEnabled));
  });

  app.post("/api/v1/exceptions/:id/resolve", async (request, reply) => {
    const { id } = z.object({ id: idSchema }).strict().parse(request.params);
    const body = resolutionSchema.parse(request.body);
    const idempotencyKey = requiredIdempotencyKey(request.headers);
    if (publicSafetyEnabled) assertPublicExceptionScope(await options.store.snapshot(), id);
    const safeBody = publicSafetyEnabled
      ? {
          category: body.category,
          acceptedFinalQuantityLiters: body.acceptedFinalQuantityLiters,
          reason: body.reason,
          note: body.note,
          actor: canonicalDemoScenario.people.operationsSpecialist
        }
      : body;
    const result = await service.resolveException(id, safeBody, idempotencyKey);
    return reply.code(result.statusCode).send(presentServiceBody(result.body, publicSafetyEnabled));
  });

  app.post("/api/v1/deliveries/:id/attempt", async (request, reply) => {
    const { id } = z.object({ id: idSchema }).strict().parse(request.params);
    const body = deliveryProcessSchema.parse(request.body ?? {});
    const idempotencyKey = requiredIdempotencyKey(request.headers);
    if (publicSafetyEnabled) assertPublicDeliveryScope(await options.store.snapshot(), id);
    const result = await service.processDelivery(id, {
      kind: "AUTOMATIC",
      ...(body.simulatorMode ? { simulatorMode: body.simulatorMode } : {}),
      actor: publicSafetyEnabled ? { id: "system", name: "FieldRelay", role: "SYSTEM" } : body.actor,
      actionIdempotencyKey: idempotencyKey
    });
    return reply.code(result.statusCode).send(presentServiceBody(result.body, publicSafetyEnabled));
  });

  app.post("/api/v1/deliveries/:id/replay", async (request, reply) => {
    const { id } = z.object({ id: idSchema }).strict().parse(request.params);
    const body = deliveryProcessSchema.parse(request.body ?? {});
    const idempotencyKey = requiredIdempotencyKey(request.headers);
    if (publicSafetyEnabled) assertPublicDeliveryScope(await options.store.snapshot(), id);
    const result = await service.processDelivery(id, {
      kind: "MANUAL_REPLAY",
      ...(body.simulatorMode ? { simulatorMode: body.simulatorMode } : {}),
      actor: publicSafetyEnabled ? canonicalDemoScenario.people.operationsSpecialist : body.actor,
      actionIdempotencyKey: idempotencyKey
    });
    return reply.code(result.statusCode).send(presentServiceBody(result.body, publicSafetyEnabled));
  });

  app.get("/api/v1/events", async (request, reply) => {
    const releaseConnection = sseLimiter?.acquire(requestClientKey(request));
    if (sseLimiter && !releaseConnection) {
      return reply.code(429).header("retry-after", "30").send({
        error: {
          code: "SSE_CONNECTION_LIMIT_EXCEEDED",
          message: "This public demo has reached its live-event connection limit",
          details: {
            perClient: options.config.maxSseConnectionsPerClient,
            global: options.config.maxSseConnectionsGlobal
          }
        }
      });
    }

    reply.hijack();
    const requestOrigin = headerValue(request.headers.origin);
    const responseHeaders: Record<string, string> = {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no"
    };
    if (requestOrigin) {
      responseHeaders.vary = "Origin";
      if (corsAllows(options.config, requestOrigin)) {
        responseHeaders["access-control-allow-origin"] = requestOrigin;
      }
    }
    let cleanedUp = false;
    let unsubscribe = (): void => undefined;
    let heartbeat: NodeJS.Timeout | undefined;
    let shutdown = (): void => undefined;
    const cleanup = (): void => {
      if (cleanedUp) return;
      cleanedUp = true;
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe();
      releaseConnection?.();
      closeSseConnections.delete(shutdown);
    };
    shutdown = (): void => {
      cleanup();
      if (!reply.raw.destroyed) reply.raw.end();
    };
    closeSseConnections.add(shutdown);
    request.raw.once("close", cleanup);
    reply.raw.once("close", cleanup);

    unsubscribe = service.realtime.subscribe((event) => {
      if (!reply.raw.destroyed) {
        reply.raw.write(`event: ${event.type}\nid: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`);
      }
    });
    heartbeat = setInterval(() => {
      if (!reply.raw.destroyed) reply.raw.write(": heartbeat\n\n");
    }, 20_000);
    reply.raw.writeHead(200, responseHeaders);
    reply.raw.write(`retry: 3000\nevent: connected\nid: ${randomUUID()}\ndata: {"connected":true}\n\n`);
  });

  app.addHook("preClose", async () => {
    for (const closeConnection of [...closeSseConnections]) closeConnection();
  });
  app.addHook("onClose", async () => options.store.close());
  return app;
}
