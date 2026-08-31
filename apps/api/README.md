# FieldRelay API

FieldRelay is an offline-first chain-of-custody portfolio prototype. This package is the complete Node.js/TypeScript API behind the web console and Android demo. It runs immediately with an in-memory, pre-seeded data store and switches to PostgreSQL when `DATABASE_URL` is set.

> Independent portfolio prototype using synthetic data and illustrative rules. Not affiliated with WiQ. Not for production or regulatory use.

## Run locally

Requirements: Node.js 22+.

```bash
npm install
cp .env.example .env
npm run dev
```

With no `DATABASE_URL`, the API starts on `http://localhost:4100` with `FR-2026-0842` already at the open-discrepancy stage. No AWS account or external ERP is needed.

Useful checks:

```bash
npm run typecheck
npm test
npm run build
```

## PostgreSQL

Set `DATABASE_URL` and start the API. Startup applies the idempotent SQL migration and inserts the demo shipment only if it is absent. The commands are also available separately:

```bash
npm run migrate
npm run seed
```

The migration provides relational constraints, optimistic versions, immutable quantity guards, append-only audit/delivery-attempt triggers, transactional outbox tables, and indexes for operational views. Concurrent first use of an idempotency key is serialized with a PostgreSQL transaction advisory lock.

## The four independent status dimensions

FieldRelay deliberately avoids one overloaded status field:

| Dimension | States |
| --- | --- |
| Lifecycle | Draft → Offered → Accepted → Picked up → In transit → Received → Completed |
| Device sync | Saved on device → Waiting → Syncing → Synced → Needs review |
| Exception | None → Discrepancy open → Resolved |
| Delivery | Not started → Pending → Retrying → Failed / DLQ → Delivered |

`CONFIRM_PICKUP` records an immutable `PICKED_UP` milestone and immediately advances the aggregate to `IN_TRANSIT`. The event timeline therefore preserves both lifecycle facts without introducing an artificial pause.

## Discrepancy rule

An exception opens only when both conditions are true:

```text
abs(received - pickup) > 100 L
AND
abs(received - pickup) / pickup > 1%
```

For the seeded record, `8,180 L → 7,940 L` produces `−240 L / −2.93%`. Offered-to-pickup variance (`8,200 L → 8,180 L`) is recorded as informational only.

Original offered, pickup, and receipt reports are immutable. Resolution adds a separate accepted final quantity, category, reason, note, actor, and time. It never edits the original evidence.

## Offline sync and lost responses

`POST /api/v1/sync/operations` accepts a durable mobile operation:

```json
{
  "operationId": "device-op-51",
  "idempotencyKey": "device-a:51",
  "type": "RECORD_RECEIPT",
  "shipmentId": "FR-2026-0842",
  "baseVersion": 3,
  "deviceTimestamp": "2026-08-31T14:08:00+03:00",
  "actor": { "id": "priya", "name": "Priya", "role": "RECEIVER" },
  "payload": { "receivedQuantityLiters": 7940 }
}
```

The server stores the request fingerprint and full response in the same transaction as the domain change. If connectivity drops after the server commits, resend the identical operation or query:

```text
GET /api/v1/sync/results/{idempotencyKey}
```

The original response is returned with `replayed: true`; no duplicate event is appended. Reusing the key for different content returns `IDEMPOTENCY_KEY_REUSED`.

When `baseVersion` is stale, FieldRelay records a review item, changes only the independent sync status, and returns HTTP 409 with three explicit choices:

- `SEND_LOCAL_FOR_REVIEW`
- `KEEP_SEPARATE_DRAFT`
- `USE_SERVER_VERSION`

The offline payload never overwrites server evidence.

## Demo sequence

The initial state is `RECEIVED / SYNCED / DISCREPANCY_OPEN / NOT_STARTED`.

1. Resolve `EX-0037`. Resolution, shipment completion, outbox creation, and `DL-019` creation commit atomically.
2. Send three simulated 503 attempts. The delivery transitions `PENDING → RETRYING → DLQ`.
3. Manually replay with `success`. Attempt 4 returns HTTP 200 and transitions to `DELIVERED`.

Resolve:

```bash
curl -X POST http://localhost:4100/api/v1/exceptions/EX-0037/resolve \
  -H 'content-type: application/json' \
  -H 'idempotency-key: resolve-ex-0037' \
  -d '{"category":"DOCUMENTED_TRANSFER_LOSS","acceptedFinalQuantityLiters":7940,"reason":"Meter reading verified","note":"Accepted separately after evidence review","actor":{"id":"ops-1","name":"Alex Morgan","role":"OPERATIONS"}}'
```

Automatic failure (use a new action key for each intentional attempt):

```bash
curl -X POST http://localhost:4100/api/v1/deliveries/DL-019/attempt \
  -H 'content-type: application/json' \
  -H 'idempotency-key: dl-019-attempt-1' \
  -d '{"simulatorMode":"retryable-failure"}'
```

Manual replay:

```bash
curl -X POST http://localhost:4100/api/v1/deliveries/DL-019/replay \
  -H 'content-type: application/json' \
  -H 'idempotency-key: dl-019-replay-4' \
  -d '{"simulatorMode":"success","actor":{"id":"ops-1","name":"Alex Morgan","role":"OPERATIONS"}}'
```

All destination attempts use the same stable downstream `idempotency-key`, even across retries and manual replay.

## Read API

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness and active store |
| GET | `/api/v1/meta` | Status vocabulary, adapters, disclaimer |
| GET | `/api/v1/demo` | Complete seeded storyline in one response |
| GET | `/api/v1/shipments` | Filterable shipment list |
| GET | `/api/v1/shipments/{id}` | Aggregate, timeline, exception, delivery, conflicts |
| GET | `/api/v1/shipments/{id}/audit/verify` | Verify the SHA-256 event chain |
| GET | `/api/v1/exceptions` | Exception workbench list |
| GET | `/api/v1/exceptions/{id}` | Exception and immutable evidence |
| GET | `/api/v1/deliveries` | Integration delivery list |
| GET | `/api/v1/deliveries/{id}` | Job, sanitized request/response attempts, outbox |
| GET | `/api/v1/events` | Server-sent operational events |

The OpenAPI contract is in [`openapi.yaml`](./openapi.yaml).

## Integration adapters

`GENERIC_WEBHOOK` is the primary adapter. `local://delivery-simulator` makes the full demo deterministic without an external system; an `http(s)` destination performs a real POST with a stable idempotency key and correlation ID.

`ODATA_EXAMPLE` is an illustrative enterprise adapter. It is intentionally named as an example and **does not imply WiQ uses SAP or OData**.

## Security and production boundaries

This portfolio API does not include production authentication, secrets management, tenant isolation, compliance controls, or a production scheduler. Delivery request/response records are designed for synthetic demo data. Before real use, add identity/authorization, encrypted secret storage, PII redaction, rate limits, operational alerting, and a dedicated outbox worker.
