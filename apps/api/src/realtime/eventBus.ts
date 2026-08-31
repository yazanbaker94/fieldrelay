import { EventEmitter } from "node:events";

export interface RealtimeEvent {
  id: string;
  type: "shipment.changed" | "exception.changed" | "delivery.changed" | "sync.conflict" | "demo.run.created";
  occurredAt: string;
  data: Record<string, unknown>;
}

export class FieldRelayEventBus {
  private readonly emitter = new EventEmitter();

  publish(event: RealtimeEvent): void {
    this.emitter.emit("event", event);
  }

  subscribe(listener: (event: RealtimeEvent) => void): () => void {
    this.emitter.on("event", listener);
    return () => this.emitter.off("event", listener);
  }
}
