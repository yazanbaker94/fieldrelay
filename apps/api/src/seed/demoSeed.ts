import { createAuditEvent } from "../domain/audit.js";
import { discrepancyThreshold, evaluateDiscrepancy } from "../domain/discrepancy.js";
import type { AuditEvent, FieldRelaySnapshot, Shipment, ShipmentException, SyncOperation } from "../domain/types.js";
import type { FieldRelayStore, FieldRelayTransaction } from "../store/store.js";

export const canonicalDemoScenario = {
  scenarioId: "fieldrelay-discrepancy-recovery-v1",
  timeZone: "America/Edmonton",
  organizations: {
    generator: "Northstar Field Services",
    carrier: "Prairie Line Transport",
    receiver: "Copper Ridge Recovery"
  },
  people: {
    generatorCoordinator: { id: "maya-chen", name: "Maya Chen", role: "GENERATOR_COORDINATOR" },
    driver: { id: "marcus-lee", name: "Marcus Lee", role: "DRIVER" },
    receiverOperator: { id: "priya-shah", name: "Priya Shah", role: "RECEIVER_OPERATOR" },
    operationsSpecialist: { id: "jordan-patel", name: "Jordan Patel", role: "OPERATIONS" }
  },
  quantitiesLiters: {
    offered: 8200,
    pickup: 8180,
    received: 7940,
    variance: -240,
    variancePercentage: -0.0293398533
  },
  discrepancyRule: discrepancyThreshold,
  disclaimer:
    "Synthetic data for an independent portfolio prototype. Not affiliated with WiQ and not for production or regulatory use."
} as const;

export interface DemoResourceIds {
  shipmentId: string;
  exceptionId: string;
  deliveryId: string;
  eventIds: readonly [string, string, string, string, string, string];
}

const canonicalEventIds = ["EV-0346", "EV-0347", "EV-0348", "EV-0349", "EV-0350", "EV-0351"] as const;

export function demoResourceIds(runId?: string): DemoResourceIds {
  if (!runId) {
    return {
      shipmentId: "FR-2026-0842",
      exceptionId: "EX-0037",
      deliveryId: "DL-019",
      eventIds: canonicalEventIds
    };
  }

  const suffix = runId.toUpperCase();
  return {
    shipmentId: `FR-2026-0842-${suffix}`,
    exceptionId: `EX-0037-${suffix}`,
    deliveryId: `DL-019-${suffix}`,
    eventIds: [
      `EV-0346-${suffix}`,
      `EV-0347-${suffix}`,
      `EV-0348-${suffix}`,
      `EV-0349-${suffix}`,
      `EV-0350-${suffix}`,
      `EV-0351-${suffix}`
    ]
  };
}

export function demoDeliveryIdForShipment(shipmentId: string): string | undefined {
  if (shipmentId === "FR-2026-0842") return "DL-019";
  const match = /^FR-2026-0842-([A-Z0-9-]+)$/.exec(shipmentId);
  return match?.[1] ? `DL-019-${match[1]}` : undefined;
}

export function isIsolatedDemoShipmentId(shipmentId: string): boolean {
  return /^FR-2026-0842-[A-Z0-9-]+$/.test(shipmentId);
}

export function demoOfflineRecoveryOperation(
  runId: string,
  offeredQuantityLiters: number = canonicalDemoScenario.quantitiesLiters.offered
): SyncOperation {
  return {
    operationId: `offline-save-${runId}`,
    idempotencyKey: `demo-${runId}-offline-save`,
    type: "CREATE_SHIPMENT",
    shipmentId: `FR-2026-0842-${runId.toUpperCase()}-OFFLINE`,
    baseVersion: 0,
    deviceTimestamp: "2026-08-31T08:45:00-06:00",
    actor: canonicalDemoScenario.people.generatorCoordinator,
    payload: { offeredQuantityLiters }
  };
}

function buildEvents(resources: DemoResourceIds): AuditEvent[] {
  const { people, organizations } = canonicalDemoScenario;
  const definitions: Array<Omit<Parameters<typeof createAuditEvent>[0], "sequence" | "previousHash">> = [
    {
      id: resources.eventIds[0],
      shipmentId: resources.shipmentId,
      type: "SHIPMENT_CREATED",
      actor: people.generatorCoordinator,
      source: "MOBILE",
      occurredAt: "2026-08-31T09:10:00-06:00",
      recordedAt: "2026-08-31T09:14:23-06:00",
      payload: {
        createdOffline: true,
        deviceTimestamp: "2026-08-31T09:10:00-06:00",
        generator: organizations.generator
      }
    },
    {
      id: resources.eventIds[1],
      shipmentId: resources.shipmentId,
      type: "SHIPMENT_OFFERED",
      actor: people.generatorCoordinator,
      source: "MOBILE",
      occurredAt: "2026-08-31T09:12:00-06:00",
      recordedAt: "2026-08-31T09:14:24-06:00",
      payload: { offeredQuantityLiters: 8200, reportedAtHandoff: true }
    },
    {
      id: resources.eventIds[2],
      shipmentId: resources.shipmentId,
      type: "HANDOFF_ACCEPTED",
      actor: people.driver,
      source: "MOBILE",
      occurredAt: "2026-08-31T09:50:00-06:00",
      recordedAt: "2026-08-31T09:50:04-06:00",
      payload: { accepted: true, carrier: organizations.carrier }
    },
    {
      id: resources.eventIds[3],
      shipmentId: resources.shipmentId,
      type: "PICKUP_CONFIRMED",
      actor: people.driver,
      source: "MOBILE",
      occurredAt: "2026-08-31T10:03:00-06:00",
      recordedAt: "2026-08-31T10:03:02-06:00",
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
      id: resources.eventIds[4],
      shipmentId: resources.shipmentId,
      type: "RECEIPT_RECORDED",
      actor: people.receiverOperator,
      source: "MOBILE",
      occurredAt: "2026-08-31T14:08:00-06:00",
      recordedAt: "2026-08-31T14:08:06-06:00",
      payload: {
        receiver: organizations.receiver,
        receivedQuantityLiters: 7940,
        pickupQuantityLiters: 8180,
        varianceLiters: -240,
        variancePercentage: -0.0293398533
      }
    },
    {
      id: resources.eventIds[5],
      shipmentId: resources.shipmentId,
      type: "DISCREPANCY_OPENED",
      actor: { id: "system", name: "FieldRelay", role: "SYSTEM" },
      source: "SYSTEM",
      occurredAt: "2026-08-31T14:08:06-06:00",
      recordedAt: "2026-08-31T14:08:06-06:00",
      payload: {
        exceptionId: resources.exceptionId,
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

function createSnapshot(resources: DemoResourceIds): FieldRelaySnapshot {
  const discrepancy = evaluateDiscrepancy(8180, 7940);
  const shipment: Shipment = {
    id: resources.shipmentId,
    lifecycleStatus: "RECEIVED",
    syncStatus: "SYNCED",
    exceptionStatus: "DISCREPANCY_OPEN",
    deliveryStatus: "NOT_STARTED",
    offeredQuantityLiters: 8200,
    pickupQuantityLiters: 8180,
    receivedQuantityLiters: 7940,
    version: 4,
    createdAt: "2026-08-31T15:10:00.000Z",
    updatedAt: "2026-08-31T20:08:06.000Z"
  };
  const exceptionRecord: ShipmentException = {
    id: resources.exceptionId,
    shipmentId: shipment.id,
    status: "DISCREPANCY_OPEN",
    pickupQuantityLiters: 8180,
    receivedQuantityLiters: 7940,
    varianceLiters: discrepancy.varianceLiters,
    variancePercentage: discrepancy.variancePercentage,
    threshold: discrepancy.threshold,
    openedAt: "2026-08-31T20:08:06.000Z",
    version: 1
  };
  return {
    shipments: [shipment],
    auditEvents: buildEvents(resources),
    exceptions: [exceptionRecord],
    outbox: [],
    deliveries: [],
    deliveryAttempts: [],
    conflicts: [],
    idempotencyResults: []
  };
}

export function createDemoSnapshot(): FieldRelaySnapshot {
  return createSnapshot(demoResourceIds());
}

export function createDemoRunSnapshot(runId: string): FieldRelaySnapshot {
  return createSnapshot(demoResourceIds(runId));
}

export async function insertSnapshot(tx: FieldRelayTransaction, snapshot: FieldRelaySnapshot): Promise<void> {
  const shipment = snapshot.shipments[0];
  const exceptionRecord = snapshot.exceptions[0];
  if (!shipment || !exceptionRecord) throw new Error("Demo seed is incomplete");
  await tx.insertShipment(shipment);
  for (const event of snapshot.auditEvents) await tx.appendAuditEvent(event);
  await tx.insertException(exceptionRecord);
}

export async function ensureDemoSeed(store: FieldRelayStore): Promise<boolean> {
  const snapshot = createDemoSnapshot();
  return store.transaction(async (tx) => {
    if (await tx.getShipment("FR-2026-0842")) return false;
    await insertSnapshot(tx, snapshot);
    return true;
  });
}
