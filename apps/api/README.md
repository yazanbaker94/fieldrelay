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

`GET /health` is a process liveness check. `GET /ready` also reads the active store and confirms that the canonical demo seed is available, so deployment health checks can distinguish a running process from a ready API.

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
  "deviceTimestamp": "2026-08-31T14:08:00-06:00",
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

1. Create an isolated reviewer run and use the resource IDs in its response.
2. Resolve its `EX-0037-{RUN}`. Resolution, shipment completion, outbox creation, and `DL-019-{RUN}` creation commit atomically.
3. Send three simulated 503 attempts. The delivery transitions `PENDING → RETRYING → DLQ`.
4. Manually replay with `success`. Attempt 4 returns HTTP 200 and transitions to `DELIVERED`.

The examples below use `reviewer-session-1`; create it first as shown under **Isolated reviewer runs**. Resolve:

```bash
curl -X POST http://localhost:4100/api/v1/exceptions/EX-0037-REVIEWER-SESSION-1/resolve \
  -H 'content-type: application/json' \
  -H 'idempotency-key: resolve-ex-0037' \
  -d '{"category":"DOCUMENTED_TRANSFER_LOSS","acceptedFinalQuantityLiters":7940,"reason":"Meter reading verified","note":"Accepted separately after evidence review","actor":{"id":"ops-1","name":"Alex Morgan","role":"OPERATIONS"}}'
```

Automatic failure (use a new action key for each intentional attempt):

```bash
curl -X POST http://localhost:4100/api/v1/deliveries/DL-019-REVIEWER-SESSION-1/attempt \
  -H 'content-type: application/json' \
  -H 'idempotency-key: dl-019-attempt-1' \
  -d '{"simulatorMode":"retryable-failure"}'
```

Manual replay:

```bash
curl -X POST http://localhost:4100/api/v1/deliveries/DL-019-REVIEWER-SESSION-1/replay \
  -H 'content-type: application/json' \
  -H 'idempotency-key: dl-019-replay-4' \
  -d '{"simulatorMode":"success","actor":{"id":"ops-1","name":"Alex Morgan","role":"OPERATIONS"}}'
```

All destination attempts use the same stable downstream `idempotency-key`, even across retries and manual replay.

## Isolated reviewer runs

The canonical `FR-2026-0842` record remains available at `GET /api/v1/demo`, but an interactive browser should not mutate that shared baseline. Create an isolated run instead:

```bash
curl -X POST http://localhost:4100/api/v1/demo/runs \
  -H 'content-type: application/json' \
  -H 'idempotency-key: create-reviewer-session-1' \
  -d '{"runId":"reviewer-session-1","offlineOfferedQuantityLiters":6123}'
```

Omit `runId` to receive a server-generated one. Repeating the same body with the same action key returns the original run with `replayed: true`. Supplying an already-used run ID with another key returns `DEMO_RUN_EXISTS` instead of modifying that run.

The optional offered quantity is bounded and becomes part of the registration fingerprint. The response contains run-scoped resource IDs plus the exact `offlineRecovery.operation` issued for that quantity. In the public simulator, a mobile client first creates or recovers this registration using its stable registration key; it never submits an arbitrary shipment ID to the read-only shared scope.

To demonstrate a lost mobile response without touching the canonical shipment:

1. Display that operation as saved locally.
2. Send it to the supplied `syncPath` and intentionally ignore the first HTTP response.
3. Send the exact same operation again, or call the supplied `resultPath`.
4. Observe the original HTTP 201 result with `replayed: true` and `recovery: ORIGINAL_RESULT_RETURNED`.

Only one companion shipment and two audit events are committed. `GET /api/v1/demo/runs/{runId}` returns the current run. Starting over creates a new run; it never deletes or rewrites immutable evidence.

Operational lists exclude isolated runs by default so one reviewer cannot clutter another reviewer's console. Use `?runId=reviewer-session-1` for one run, or `?includeDemoRuns=true` for an explicit administrative view.

## Read API

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness and active store |
| GET | `/ready` | Store readiness and canonical-seed availability |
| GET | `/api/v1/meta` | Status vocabulary, adapters, disclaimer |
| GET | `/api/v1/demo` | Complete seeded storyline in one response |
| POST | `/api/v1/demo/runs` | Create an idempotent, isolated interactive baseline |
| GET | `/api/v1/demo/runs/{runId}` | Read one isolated run's current state |
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

This portfolio API does not include production authentication, secrets management, tenant isolation, compliance controls, or a production scheduler. Delivery request/response records are designed for synthetic demo data. Before real use, add identity/authorization, encrypted secret storage, PII redaction, distributed edge limits, operational alerting, retention/archival, and a dedicated outbox worker.

JSON bodies are limited to 64 KiB. IDs, text fields, operation payload size, finite quantities, timestamps, filters, and unknown object keys are validated. Webhook URLs must use HTTP(S) without embedded credentials, query parameters, or fragments; the deterministic `local://delivery-simulator` is the only non-HTTP destination. External redirects are rejected and stored response diagnostics are bounded.

`loadConfig()` enables the internet-facing public-simulator boundary by default. `FR-2026-0842` and every unregistered resource are read-only; writes are accepted only for an isolated run and its one generated offline companion. Actors are replaced with the scenario's synthetic server-controlled actors, outbound delivery is forced to `local://delivery-simulator`, demo-run creation has a hard immutable-evidence capacity, POST requests are limited per client/process, and SSE connections are capped per client and globally. `ALLOW_CANONICAL_MUTATIONS=true` exists only for deliberate local development and contract tests.

`CORS_ORIGIN` accepts `*` or a comma-separated allow-list of exact origins. Production should list `https://fieldrelay.swoop.video` plus the exact private Sites preview origin returned by deployment; wildcard CORS is unnecessary for the guarded demo. The process limit is a safety backstop, not a replacement for a reverse-proxy or distributed rate limit.

The regular test suite exercises the in-memory store contract. Set `TEST_DATABASE_URL` to an isolated PostgreSQL database to run the same rollback, immutable-evidence, and stable-key checks against PostgreSQL; it is skipped when no explicit test database is supplied.
