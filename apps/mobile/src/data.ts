import type { PersistedMobileState, Shipment } from './types';

export const DEMO_SHIPMENT: Shipment = {
  id: 'FR-2026-0842',
  generator: 'Northstar Energy',
  site: 'Alder Creek 14',
  driver: 'Marcus Lee',
  unit: 'PAD 781',
  unitType: 'Vacuum Truck',
  capacityLitres: 12_000,
  product: 'Waste Oil',
  lifecycle: 'RECEIVED',
  sync: 'WAITING',
  exception: 'DISCREPANCY_OPEN',
  delivery: 'NOT_STARTED',
  version: 3,
  events: [
    {
      id: 'EV-0347',
      step: 1,
      label: 'Offer',
      quantityLitres: 8_200,
      actor: 'Maya Chen',
      time: '09:12',
    },
    {
      id: 'EV-0283',
      step: 2,
      label: 'Pickup',
      quantityLitres: 8_180,
      actor: 'Marcus Lee',
      time: '10:03',
    },
    {
      id: 'EV-0309',
      step: 3,
      label: 'Received',
      quantityLitres: 7_940,
      actor: 'Priya Shah',
      time: '14:08',
    },
  ],
};

export const DEMO_SHIPMENTS = [
  DEMO_SHIPMENT,
  {
    ...DEMO_SHIPMENT,
    id: 'FR-2026-0841',
    lifecycle: 'IN_TRANSIT' as const,
    sync: 'SYNCED' as const,
    exception: 'NONE' as const,
    events: DEMO_SHIPMENT.events.slice(0, 2),
  },
  {
    ...DEMO_SHIPMENT,
    id: 'FR-2026-0840',
    lifecycle: 'COMPLETED' as const,
    sync: 'SYNCED' as const,
    exception: 'RESOLVED' as const,
  },
];

export const INITIAL_MOBILE_STATE: PersistedMobileState = {
  schemaVersion: 1,
  cachedHandoffIds: ['FR-2026-0842'],
  demoConnectivity: 'OFFLINE',
  lastSyncAt: '2026-05-07T13:57:00.000Z',
  queue: [
    {
      localOperationId: 'OP-LOCAL-0842-RECEIPT',
      idempotencyKey: 'device-7A3F:FR-2026-0842:receipt:v3',
      shipmentId: 'FR-2026-0842',
      kind: 'RECORD_RECEIPT',
      status: 'WAITING',
      baseVersion: 2,
      deviceCreatedAt: '2026-05-07T14:08:00.000Z',
      payload: { receivedQuantityLitres: 7_940, eventId: 'EV-0309' },
      attempts: 0,
    },
    {
      localOperationId: 'OP-LOCAL-0843-CREATE',
      idempotencyKey: 'device-7A3F:FR-2026-0843:create:v0',
      shipmentId: 'FR-2026-0843',
      kind: 'CREATE_SHIPMENT',
      status: 'CHECKING_RESULT',
      baseVersion: 0,
      deviceCreatedAt: '2026-05-07T13:02:00.000Z',
      payload: { offeredQuantityLitres: 5_600 },
      attempts: 1,
      lastError: 'Response was interrupted; checking the original idempotency key.',
    },
    {
      localOperationId: 'OP-LOCAL-0839-CONFLICT',
      idempotencyKey: 'device-7A3F:FR-2026-0839:pickup:v1',
      shipmentId: 'FR-2026-0839',
      kind: 'RECORD_PICKUP',
      status: 'NEEDS_REVIEW',
      baseVersion: 1,
      deviceCreatedAt: '2026-05-07T11:04:00.000Z',
      payload: { pickupQuantityLitres: 6_120 },
      attempts: 1,
      lastError: 'Server version 2 is newer than this device entry.',
    },
  ],
};

