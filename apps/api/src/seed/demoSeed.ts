import { createAuditEvent } from "../domain/audit.js";
import { discrepancyThreshold, evaluateDiscrepancy } from "../domain/discrepancy.js";
import type { AuditEvent, FieldRelaySnapshot, Shipment, ShipmentException } from "../domain/types.js";
import type { FieldRelayStore } from "../store/store.js";

function buildEvents(): AuditEvent[] {
  const definitions: Array<Omit<Parameters<typeof createAuditEvent>[0], "sequence" | "previousHash">> = [
    {
      id: "EV-0346",
      shipmentId: "FR-2026-0842",
      type: "SHIPMENT_CREATED",
      actor: { id: "maya", name: "Maya", role: "GENERATOR" },
      source: "MOBILE",
      occurredAt: "2026-08-31T09:10:00+03:00",
      recordedAt: "2026-08-31T09:14:23+03:00",
      payload: { createdOffline: true, deviceTimestamp: "2026-08-31T09:10:00+03:00" }
    },
    {
      id: "EV-0347",
      shipmentId: "FR-2026-0842",
      type: "SHIPMENT_OFFERED",
      actor: { id: "maya", name: "Maya", role: "GENERATOR" },
      source: "MOBILE",
      occurredAt: "2026-08-31T09:12:00+03:00",
      recordedAt: "2026-08-31T09:14:24+03:00",
      payload: { offeredQuantityLiters: 8200, reportedAtHandoff: true }
    },
    {
      id: "EV-0348",
      shipmentId: "FR-2026-0842",
      type: "HANDOFF_ACCEPTED",
      actor: { id: "marcus", name: "Marcus", role: "DRIVER" },
      source: "MOBILE",
      occurredAt: "2026-08-31T09:50:00+03:00",
      recordedAt: "2026-08-31T09:50:04+03:00",
      payload: { accepted: true }
    },
    {
      id: "EV-0349",
      shipmentId: "FR-2026-0842",
      type: "PICKUP_CONFIRMED",
      actor: { id: "marcus", name: "Marcus", role: "DRIVER" },
      source: "MOBILE",
      occurredAt: "2026-08-31T10:03:00+03:00",
      recordedAt: "2026-08-31T10:03:02+03:00",
      payload: {
        pickupQuantityLiters: 8180,
        offeredToPickupVarianceLiters: -20,
        offeredToPickupVariancePercentage: -0.0024390244,
        offeredToPickupIsInformationalOnly: true,
        milestoneLifecycleStatus: "PICKED_UP",
        resultingLifecycleStatus: "IN_TRANSIT"
      }
    },
    {
      id: "EV-0350",
      shipmentId: "FR-2026-0842",
      type: "RECEIPT_RECORDED",
      actor: { id: "priya", name: "Priya", role: "RECEIVER" },
      source: "MOBILE",
      occurredAt: "2026-08-31T14:08:00+03:00",
      recordedAt: "2026-08-31T14:08:06+03:00",
      payload: {
        receivedQuantityLiters: 7940,
        pickupQuantityLiters: 8180,
        varianceLiters: -240,
        variancePercentage: -0.0293398533
      }
    },
    {
      id: "EV-0351",
      shipmentId: "FR-2026-0842",
      type: "DISCREPANCY_OPENED",
      actor: { id: "system", name: "FieldRelay", role: "SYSTEM" },
      source: "SYSTEM",
      occurredAt: "2026-08-31T14:08:06+03:00",
      recordedAt: "2026-08-31T14:08:06+03:00",
      payload: {
        exceptionId: "EX-0037",
        varianceLiters: -240,
        variancePercentage: -0.0293398533,
        threshold: discrepancyThreshold,
        explanation:
          "Opened because absolute variance is greater than 100 L AND percentage variance is greater than 1%."
      }
    }
  ];

  const events: AuditEvent[] = [];
  for (const definition of definitions) {
    const previous = events.at(-1);
    events.push(
      createAuditEvent({
        ...definition,
        sequence: events.length + 1,
        previousHash: previous?.eventHash ?? null
      })
    );
  }
  return events;
}

export function createDemoSnapshot(): FieldRelaySnapshot {
  const discrepancy = evaluateDiscrepancy(8180, 7940);
  const shipment: Shipment = {
    id: "FR-2026-0842",
    lifecycleStatus: "RECEIVED",
    syncStatus: "SYNCED",
    exceptionStatus: "DISCREPANCY_OPEN",
    deliveryStatus: "NOT_STARTED",
    offeredQuantityLiters: 8200,
    pickupQuantityLiters: 8180,
    receivedQuantityLiters: 7940,
    version: 4,
    createdAt: "2026-08-31T09:10:00+03:00",
    updatedAt: "2026-08-31T14:08:06+03:00"
  };
  const exceptionRecord: ShipmentException = {
    id: "EX-0037",
    shipmentId: shipment.id,
    status: "DISCREPANCY_OPEN",
    pickupQuantityLiters: 8180,
    receivedQuantityLiters: 7940,
    varianceLiters: discrepancy.varianceLiters,
    variancePercentage: discrepancy.variancePercentage,
    threshold: discrepancy.threshold,
    openedAt: "2026-08-31T14:08:06+03:00",
    version: 1
  };
  return {
    shipments: [shipment],
    auditEvents: buildEvents(),
    exceptions: [exceptionRecord],
    outbox: [],
    deliveries: [],
    deliveryAttempts: [],
    conflicts: [],
    idempotencyResults: []
  };
}

export async function ensureDemoSeed(store: FieldRelayStore): Promise<boolean> {
  const snapshot = createDemoSnapshot();
  return store.transaction(async (tx) => {
    if (await tx.getShipment("FR-2026-0842")) return false;
    const shipment = snapshot.shipments[0];
    const exceptionRecord = snapshot.exceptions[0];
    if (!shipment || !exceptionRecord) throw new Error("Demo seed is incomplete");
    await tx.insertShipment(shipment);
    for (const event of snapshot.auditEvents) await tx.appendAuditEvent(event);
    await tx.insertException(exceptionRecord);
    return true;
  });
}
