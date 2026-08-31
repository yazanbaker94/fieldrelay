export type Tone = 'neutral' | 'blue' | 'warning' | 'danger' | 'success' | 'violet';

export const demoShipment = {
  id: 'FR-2026-0842',
  shortId: 'FR / 2026 / 0842',
  material: 'Demo Solvent Mixture — training data',
  unNumber: 'UN1993',
  classification: 'Class 3 · Packing Group III',
  generator: 'Northstar Field Services',
  source: 'Alder Creek Site 14',
  carrier: 'Prairie Line Transport',
  driver: 'Marcus Lee',
  receiver: 'Copper Ridge Recovery',
  destination: 'Copper Ridge Facility 02',
  offered: 8200,
  pickup: 8180,
  received: 7940,
  variance: -240,
  variancePercent: -2.93,
  lifecycle: 'RECEIVED',
  sync: 'SYNCED',
  exception: 'DISCREPANCY_OPEN',
  delivery: 'NOT_STARTED',
  correlationId: 'corr_fr0842_b17e',
};

export const shipmentEvents = [
  { no: '01', id: 'EV-0347', title: 'Generator offer', actor: 'Maya Chen', time: '09:12 MDT', quantity: '8,200 L', meta: 'Android · saved offline', tone: 'neutral' as Tone },
  { no: '02', id: 'EV-0351', title: 'Offer synchronized', actor: 'Field device', time: '09:18 MDT', quantity: 'Exactly once', meta: 'op_01J6FR84 · attempt 02', tone: 'blue' as Tone },
  { no: '03', id: 'EV-0358', title: 'Driver pickup', actor: 'Marcus Lee', time: '10:03 MDT', quantity: '8,180 L', meta: '−20 L / −0.24%', tone: 'neutral' as Tone },
  { no: '04', id: 'EV-0369', title: 'Receiver report', actor: 'Priya Shah', time: '14:08 MDT', quantity: '7,940 L', meta: '−240 L / −2.93%', tone: 'warning' as Tone },
  { no: '05', id: 'EV-0370', title: 'Discrepancy opened', actor: 'Rules engine', time: '14:08 MDT', quantity: 'EX / 0037', meta: '>100 L AND >1%', tone: 'warning' as Tone },
];

export const shipments = [
  { id: 'FR-2026-0842', material: 'Demo Solvent Mixture', generator: 'Northstar Field Services', receiver: 'Copper Ridge Recovery', lifecycle: 'Received', secondary: 'Discrepancy open', tone: 'warning' as Tone, time: '2 min ago' },
  { id: 'FR-2026-0839', material: 'Production Rinse Water', generator: 'Pine River Operations', receiver: 'Westbend Treatment', lifecycle: 'In transit', secondary: 'Synced', tone: 'blue' as Tone, time: '9 min ago' },
  { id: 'FR-2026-0837', material: 'Separator Sludge', generator: 'Northstar Field Services', receiver: 'Copper Ridge Recovery', lifecycle: 'Offered', secondary: 'Saved on device', tone: 'neutral' as Tone, time: '18 min ago' },
  { id: 'FR-2026-0834', material: 'Hydrocarbon Soil', generator: 'Fiction Basin Energy', receiver: 'Red Willow Landfill', lifecycle: 'Completed', secondary: 'Delivery failed', tone: 'danger' as Tone, time: '31 min ago' },
  { id: 'FR-2026-0828', material: 'Tank Bottoms', generator: 'Alder Creek Services', receiver: 'Westbend Treatment', lifecycle: 'Completed', secondary: 'Delivered', tone: 'success' as Tone, time: '1 hr ago' },
  { id: 'FR-2026-0821', material: 'Wash Fluid', generator: 'Fiction Basin Energy', receiver: 'Copper Ridge Recovery', lifecycle: 'Accepted', secondary: 'Waiting for connection', tone: 'neutral' as Tone, time: '2 hr ago' },
];

export const exceptions = [
  { id: 'EX-0037', shipment: 'FR-2026-0842', type: 'Quantity discrepancy', variance: '−240 L / −2.93%', owner: 'Operations', age: '2 min', state: 'Open', tone: 'warning' as Tone },
  { id: 'EX-0034', shipment: 'FR-2026-0831', type: 'Conflicting offline update', variance: 'Version 06 ↔ 07', owner: 'Support', age: '22 min', state: 'Needs review', tone: 'danger' as Tone },
  { id: 'EX-0032', shipment: 'FR-2026-0819', type: 'Stalled handoff', variance: 'Receiver pending', owner: 'Dispatch', age: '1 hr 14 min', state: 'Open', tone: 'neutral' as Tone },
];

export const deliveryAttempts = [
  { time: '14:33:02', label: 'Attempt 1', result: '503', detail: 'Service Unavailable', tone: 'danger' as Tone },
  { time: '14:34:05', label: 'Attempt 2', result: '503', detail: 'Backoff 60 s', tone: 'danger' as Tone },
  { time: '14:36:11', label: 'Attempt 3', result: '503', detail: 'Retry limit reached', tone: 'danger' as Tone },
  { time: '14:37:12', label: 'Moved to DLQ', result: 'DLQ', detail: 'Awaiting review', tone: 'warning' as Tone },
  { time: '14:41:28', label: 'Manual replay', result: '04', detail: 'Jordan Patel', tone: 'violet' as Tone },
  { time: '14:41:29', label: 'Attempt 4', result: '200 OK', detail: 'Delivered once', tone: 'success' as Tone },
];

export const auditEvents = [
  { time: '14:41:29.448', actor: 'Delivery worker', event: 'delivery.succeeded', entity: 'DL-019', source: 'worker-02', result: '200 OK', correlation: 'corr_fr0842_b17e' },
  { time: '14:41:28.102', actor: 'Jordan Patel', event: 'delivery.replayed', entity: 'DL-019', source: 'Web console', result: 'Queued', correlation: 'corr_fr0842_b17e' },
  { time: '14:37:12.201', actor: 'Delivery worker', event: 'delivery.dead_lettered', entity: 'DL-019', source: 'worker-02', result: 'DLQ', correlation: 'corr_fr0842_b17e' },
  { time: '14:22:16.023', actor: 'Jordan Patel', event: 'exception.resolved', entity: 'EX-0037', source: 'Web console', result: 'Completed', correlation: 'corr_fr0842_b17e' },
  { time: '14:08:44.991', actor: 'Rules engine', event: 'exception.opened', entity: 'EX-0037', source: 'api-01', result: 'Review', correlation: 'corr_fr0842_b17e' },
  { time: '14:08:44.708', actor: 'Priya Shah', event: 'shipment.received', entity: 'FR-2026-0842', source: 'Android 1.0.0', result: '7,940 L', correlation: 'corr_fr0842_b17e' },
  { time: '10:03:12.114', actor: 'Marcus Lee', event: 'shipment.picked_up', entity: 'FR-2026-0842', source: 'Handoff web', result: '8,180 L', correlation: 'corr_fr0842_b17e' },
  { time: '09:18:06.332', actor: 'Maya Chen', event: 'sync.operation_applied', entity: 'FR-2026-0842', source: 'Android offline queue', result: 'Created once', correlation: 'corr_fr0842_b17e' },
];

export const sanitizedPayload = `{
  "event": "shipment.completed",
  "shipmentId": "FR-2026-0842",
  "acceptedFinalQuantity": {
    "value": 7940,
    "unit": "L"
  },
  "destination": "example-odata-adapter",
  "idempotencyKey": "dest_fr0842_completed_v1",
  "correlationId": "corr_fr0842_b17e"
}`;
