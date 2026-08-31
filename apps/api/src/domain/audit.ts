import { createHash, randomUUID } from "node:crypto";
import type { Actor, AuditEvent } from "./types.js";

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`);
  return `{${entries.join(",")}}`;
}

export function hashValue(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export interface NewAuditEvent {
  id?: string;
  shipmentId: string;
  sequence: number;
  type: AuditEvent["type"];
  actor: Actor;
  source: AuditEvent["source"];
  occurredAt: string;
  recordedAt: string;
  payload: Record<string, unknown>;
  previousHash: string | null;
}

export function createAuditEvent(input: NewAuditEvent): AuditEvent {
  const eventWithoutHash = {
    id: input.id ?? `EV-${randomUUID().slice(0, 8).toUpperCase()}`,
    shipmentId: input.shipmentId,
    sequence: input.sequence,
    type: input.type,
    actor: input.actor,
    source: input.source,
    // PostgreSQL normalizes timestamptz values to UTC. Hash the same canonical
    // representation so verification remains stable after a database round trip.
    occurredAt: new Date(input.occurredAt).toISOString(),
    recordedAt: new Date(input.recordedAt).toISOString(),
    payload: input.payload,
    previousHash: input.previousHash
  };
  return {
    ...eventWithoutHash,
    eventHash: hashValue(eventWithoutHash)
  };
}

export function verifyAuditChain(events: AuditEvent[]): boolean {
  let previousHash: string | null = null;
  for (const event of [...events].sort((a, b) => a.sequence - b.sequence)) {
    if (event.previousHash !== previousHash) {
      return false;
    }
    const { eventHash, ...eventWithoutHash } = event;
    if (hashValue(eventWithoutHash) !== eventHash) {
      return false;
    }
    previousHash = eventHash;
  }
  return true;
}
