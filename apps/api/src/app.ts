import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError, z } from "zod";
import type { FieldRelayConfig } from "./config.js";
import { DomainError } from "./domain/errors.js";
import { verifyAuditChain } from "./domain/audit.js";
import { FieldRelayService } from "./domain/service.js";
import { lifecycleStatuses, syncStatuses, exceptionStatuses, deliveryStatuses } from "./domain/types.js";
import type { FieldRelayStore } from "./store/store.js";

const actorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1).optional()
});

const syncOperationSchema = z.object({
  operationId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  type: z.enum([
    "CREATE_SHIPMENT",
    "OFFER_SHIPMENT",
    "ACCEPT_HANDOFF",
    "CONFIRM_PICKUP",
    "RECORD_RECEIPT"
  ]),
  shipmentId: z.string().min(1),
  baseVersion: z.number().int().nonnegative(),
  deviceTimestamp: z.string().datetime({ offset: true }),
  actor: actorSchema,
  payload: z.record(z.string(), z.unknown())
});

const resolutionSchema = z.object({
  category: z.string().min(1),
  acceptedFinalQuantityLiters: z.number().nonnegative(),
  reason: z.string().min(1),
  note: z.string().min(1),
  actor: actorSchema,
  occurredAt: z.string().datetime({ offset: true }).optional()
});

const deliveryProcessSchema = z.object({
  simulatorMode: z.enum(["success", "retryable-failure", "permanent-failure"]).optional(),
  actor: actorSchema.default({ id: "system", name: "FieldRelay", role: "SYSTEM" })
});

export interface BuildAppOptions {
  store: FieldRelayStore;
  config: FieldRelayConfig;
  logger?: boolean;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false });
  const service = new FieldRelayService(options.store, options.config.destination);

  app.addHook("onSend", async (request, reply, payload) => {
    const requestOrigin = headerValue(request.headers.origin);
    if (requestOrigin && (options.config.corsOrigin === "*" || requestOrigin === options.config.corsOrigin)) {
      reply.header("access-control-allow-origin", requestOrigin);
      reply.header("vary", "Origin");
    }
    reply.header("access-control-allow-headers", "content-type,idempotency-key,last-event-id");
    reply.header("access-control-allow-methods", "GET,POST,OPTIONS");
    reply.header("x-content-type-options", "nosniff");
    return payload;
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
    }
  }));

  app.get("/api/v1/demo", async () => {
    const snapshot = await options.store.snapshot();
    const shipment = snapshot.shipments.find((item) => item.id === "FR-2026-0842");
    if (!shipment) throw new DomainError("Demo shipment was not seeded", 404, "DEMO_NOT_SEEDED");
    return {
      shipment,
      timeline: snapshot.auditEvents.filter((event) => event.shipmentId === shipment.id),
      exception: snapshot.exceptions.find((record) => record.shipmentId === shipment.id) ?? null,
      delivery: snapshot.deliveries.find((record) => record.shipmentId === shipment.id) ?? null,
      deliveryAttempts: snapshot.deliveryAttempts.filter(
        (attempt) => snapshot.deliveries.find((delivery) => delivery.id === attempt.deliveryId)?.shipmentId === shipment.id
      )
    };
  });

  app.get("/api/v1/shipments", async (request) => {
    const query = z
      .object({
        lifecycleStatus: z.enum(lifecycleStatuses).optional(),
        exceptionStatus: z.enum(exceptionStatuses).optional(),
        deliveryStatus: z.enum(deliveryStatuses).optional()
      })
      .parse(request.query);
    const snapshot = await options.store.snapshot();
    return {
      items: snapshot.shipments.filter(
        (shipment) =>
          (!query.lifecycleStatus || shipment.lifecycleStatus === query.lifecycleStatus) &&
          (!query.exceptionStatus || shipment.exceptionStatus === query.exceptionStatus) &&
          (!query.deliveryStatus || shipment.deliveryStatus === query.deliveryStatus)
      )
    };
  });

  app.get("/api/v1/shipments/:id", async (request) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const snapshot = await options.store.snapshot();
    const shipment = snapshot.shipments.find((item) => item.id === id);
    if (!shipment) throw new DomainError(`Shipment ${id} was not found`, 404, "NOT_FOUND");
    return {
      shipment,
      timeline: snapshot.auditEvents.filter((event) => event.shipmentId === id),
      exception: snapshot.exceptions.find((record) => record.shipmentId === id) ?? null,
      delivery: snapshot.deliveries.find((record) => record.shipmentId === id) ?? null,
      conflicts: snapshot.conflicts.filter((record) => record.shipmentId === id)
    };
  });

  app.get("/api/v1/shipments/:id/audit/verify", async (request) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const snapshot = await options.store.snapshot();
    const timeline = snapshot.auditEvents.filter((event) => event.shipmentId === id);
    if (!snapshot.shipments.some((shipment) => shipment.id === id)) {
      throw new DomainError(`Shipment ${id} was not found`, 404, "NOT_FOUND");
    }
    return { shipmentId: id, eventCount: timeline.length, chainValid: verifyAuditChain(timeline) };
  });

  app.get("/api/v1/exceptions", async () => {
    const snapshot = await options.store.snapshot();
    return { items: snapshot.exceptions };
  });

  app.get("/api/v1/exceptions/:id", async (request) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
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

  app.get("/api/v1/deliveries", async () => {
    const snapshot = await options.store.snapshot();
    return { items: snapshot.deliveries };
  });

  app.get("/api/v1/deliveries/:id", async (request) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const snapshot = await options.store.snapshot();
    const delivery = snapshot.deliveries.find((item) => item.id === id);
    if (!delivery) throw new DomainError(`Delivery ${id} was not found`, 404, "NOT_FOUND");
    return {
      delivery,
      attempts: snapshot.deliveryAttempts.filter((attempt) => attempt.deliveryId === id),
      outbox: snapshot.outbox.find((record) => record.id === delivery.outboxId),
      shipment: snapshot.shipments.find((shipment) => shipment.id === delivery.shipmentId)
    };
  });

  app.post("/api/v1/sync/operations", async (request, reply) => {
    const operation = syncOperationSchema.parse(request.body);
    const result = await service.sync(operation);
    return reply.code(result.statusCode).send(result.body);
  });

  app.get("/api/v1/sync/results/:idempotencyKey", async (request, reply) => {
    const { idempotencyKey } = z.object({ idempotencyKey: z.string().min(1) }).parse(request.params);
    const result = await service.getIdempotencyResult(idempotencyKey);
    return reply.code(result.statusCode).send(result.body);
  });

  app.post("/api/v1/exceptions/:id/resolve", async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = resolutionSchema.parse(request.body);
    const idempotencyKey = headerValue(request.headers["idempotency-key"]);
    if (!idempotencyKey) {
      throw new DomainError("Idempotency-Key header is required", 400, "IDEMPOTENCY_KEY_REQUIRED");
    }
    const result = await service.resolveException(id, body, idempotencyKey);
    return reply.code(result.statusCode).send(result.body);
  });

  app.post("/api/v1/deliveries/:id/attempt", async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = deliveryProcessSchema.parse(request.body ?? {});
    const idempotencyKey = headerValue(request.headers["idempotency-key"]);
    if (!idempotencyKey) {
      throw new DomainError("Idempotency-Key header is required", 400, "IDEMPOTENCY_KEY_REQUIRED");
    }
    const result = await service.processDelivery(id, {
      kind: "AUTOMATIC",
      ...(body.simulatorMode ? { simulatorMode: body.simulatorMode } : {}),
      actor: body.actor,
      actionIdempotencyKey: idempotencyKey
    });
    return reply.code(result.statusCode).send(result.body);
  });

  app.post("/api/v1/deliveries/:id/replay", async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = deliveryProcessSchema.parse(request.body ?? {});
    const idempotencyKey = headerValue(request.headers["idempotency-key"]);
    if (!idempotencyKey) {
      throw new DomainError("Idempotency-Key header is required", 400, "IDEMPOTENCY_KEY_REQUIRED");
    }
    const result = await service.processDelivery(id, {
      kind: "MANUAL_REPLAY",
      ...(body.simulatorMode ? { simulatorMode: body.simulatorMode } : {}),
      actor: body.actor,
      actionIdempotencyKey: idempotencyKey
    });
    return reply.code(result.statusCode).send(result.body);
  });

  app.get("/api/v1/events", async (request, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
      "access-control-allow-origin": options.config.corsOrigin
    });
    reply.raw.write(`event: connected\nid: ${randomUUID()}\ndata: {"connected":true}\n\n`);

    const unsubscribe = service.realtime.subscribe((event) => {
      reply.raw.write(`event: ${event.type}\nid: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`);
    });
    const heartbeat = setInterval(() => reply.raw.write(": heartbeat\n\n"), 20_000);
    request.raw.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  app.addHook("onClose", async () => options.store.close());
  return app;
}
