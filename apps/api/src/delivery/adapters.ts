import type { DeliveryJob, OutboxRecord } from "../domain/types.js";

export type SimulatorMode = "success" | "retryable-failure" | "permanent-failure";

export interface AdapterResult {
  httpStatus: number;
  outcome: "SUCCEEDED" | "RETRYABLE_FAILURE" | "PERMANENT_FAILURE";
  response: Record<string, unknown>;
}

export interface DeliveryAdapter {
  deliver(job: DeliveryJob, outbox: OutboxRecord, simulatorMode?: SimulatorMode): Promise<AdapterResult>;
}

function localSimulator(mode: SimulatorMode = "success"): AdapterResult {
  if (mode === "retryable-failure") {
    return {
      httpStatus: 503,
      outcome: "RETRYABLE_FAILURE",
      response: { code: "UPSTREAM_UNAVAILABLE", message: "Demo ERP is temporarily unavailable" }
    };
  }
  if (mode === "permanent-failure") {
    return {
      httpStatus: 422,
      outcome: "PERMANENT_FAILURE",
      response: { code: "PAYLOAD_REJECTED", message: "Demo ERP rejected the illustrative payload" }
    };
  }
  return {
    httpStatus: 200,
    outcome: "SUCCEEDED",
    response: { accepted: true, reference: "ERP-DEMO-0842" }
  };
}

function safeResponseBody(body: string, truncated = false): Record<string, unknown> {
  if (!body) return {};
  if (!truncated) {
    try {
      return JSON.parse(body) as Record<string, unknown>;
    } catch {
      // Preserve a bounded text diagnostic below.
    }
  }
  return { body: body.slice(0, 2_000), ...(truncated ? { truncated: true } : {}) };
}

abstract class HttpDeliveryAdapter implements DeliveryAdapter {
  protected abstract buildHeaders(job: DeliveryJob): Record<string, string>;
  protected abstract buildBody(outbox: OutboxRecord): unknown;

  async deliver(job: DeliveryJob, outbox: OutboxRecord, simulatorMode?: SimulatorMode): Promise<AdapterResult> {
    if (job.destinationUrl.startsWith("local://")) {
      return localSimulator(simulatorMode);
    }

    try {
      const response = await fetch(job.destinationUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": job.stableIdempotencyKey,
          "x-correlation-id": job.correlationId,
          ...this.buildHeaders(job)
        },
        body: JSON.stringify(this.buildBody(outbox)),
        signal: AbortSignal.timeout(10_000),
        redirect: "error"
      });
      const rawResponseBody = await response.text();
      const responseWasTruncated = rawResponseBody.length > 64 * 1024;
      const responseBody = safeResponseBody(rawResponseBody.slice(0, 64 * 1024), responseWasTruncated);
      if (response.ok) {
        return { httpStatus: response.status, outcome: "SUCCEEDED", response: responseBody };
      }
      if (response.status === 408 || response.status === 429 || response.status >= 500) {
        return { httpStatus: response.status, outcome: "RETRYABLE_FAILURE", response: responseBody };
      }
      return { httpStatus: response.status, outcome: "PERMANENT_FAILURE", response: responseBody };
    } catch (error) {
      return {
        httpStatus: 503,
        outcome: "RETRYABLE_FAILURE",
        response: { code: "DESTINATION_UNREACHABLE", message: error instanceof Error ? error.message : "Unknown error" }
      };
    }
  }
}

export class GenericWebhookAdapter extends HttpDeliveryAdapter {
  protected buildHeaders(): Record<string, string> {
    return { "x-fieldrelay-adapter": "generic-webhook" };
  }

  protected buildBody(outbox: OutboxRecord): unknown {
    return {
      eventId: outbox.id,
      eventType: outbox.eventType,
      occurredAt: outbox.createdAt,
      shipment: outbox.payload
    };
  }
}

/**
 * Illustrative enterprise adapter only. Its presence does not imply that WiQ,
 * or any other target company, uses SAP or OData.
 */
export class ODataExampleAdapter extends HttpDeliveryAdapter {
  protected buildHeaders(): Record<string, string> {
    return {
      accept: "application/json",
      "odata-version": "4.0",
      "x-fieldrelay-adapter": "odata-example"
    };
  }

  protected buildBody(outbox: OutboxRecord): unknown {
    return {
      ShipmentId: outbox.shipmentId,
      CompletionEventId: outbox.id,
      ...outbox.payload
    };
  }
}

export class DeliveryAdapterRegistry {
  private readonly generic = new GenericWebhookAdapter();
  private readonly odataExample = new ODataExampleAdapter();

  for(job: DeliveryJob): DeliveryAdapter {
    return job.destinationType === "ODATA_EXAMPLE" ? this.odataExample : this.generic;
  }
}
