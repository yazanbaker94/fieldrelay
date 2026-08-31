# FieldRelay

**One shipment. Every handoff. Nothing disappears.**

FieldRelay is an offline-first, auditable shipment-handoff and integration-recovery prototype. It follows one synthetic industrial shipment from an Android device through generator, driver, and receiver handoffs, discrepancy resolution, a transactional outbox, failed destination delivery, dead-lettering, and safe replay.

This is an independent portfolio project created by Yazan Baker after studying public low-connectivity, multi-party industrial workflows. It is not a WiQ Technologies product, does not reproduce WiQ software, and makes no regulatory or production-compliance claim.

## What the demo proves

- Offline work survives application restart.
- A lost API response can be checked with the same idempotency key without creating a duplicate record.
- Offered, pickup, and received quantities remain immutable source evidence.
- A discrepancy opens only when the absolute difference is **greater than 100 L AND greater than 1%** of pickup quantity.
- Resolution creates a separate accepted final quantity, completes the shipment, and inserts an outbox record atomically.
- Failed destination delivery remains visible through retries, DLQ movement, and manual replay.
- One correlation ID connects device, API, audit, outbox, queue, and destination evidence.

## Repository map

| Path | Purpose |
| --- | --- |
| `apps/web` | React 19 / Vinext public case study, guided demo, operations console, handoff flow, architecture, and docs |
| `apps/api` | Fastify / TypeScript API with PostgreSQL adapter, in-memory demo store, audit hashing, outbox, retry, and SSE |
| `apps/mobile` | Expo / React Native Android app with persistent offline queue and the five signature field flows |
| `infra` | Portable VPS Compose, Caddy, backup, reset, health-check, and release assets |
| `docs` | Product research, locked visual direction, design references, architecture, testing, and deployment notes |

All application source, visual assets, documentation, and build/deployment automation live beneath this folder, so the project can be moved as one unit. Private signing and VPS credentials intentionally remain outside the repository.

## The core record

```text
Shipment  FR-2026-0842
Offer     8,200 L
Pickup    8,180 L
Receipt   7,940 L
Variance  −240 L / −2.93%
Exception EX-0037
Delivery  DL-019
```

Four statuses remain independent:

```text
lifecycle  DRAFT → OFFERED → ACCEPTED → PICKED_UP → IN_TRANSIT → RECEIVED → COMPLETED
sync       SAVED_ON_DEVICE → WAITING → SYNCING → SYNCED | NEEDS_REVIEW
exception  NONE → DISCREPANCY_OPEN → RESOLVED
delivery   NOT_STARTED → PENDING → RETRYING → FAILED → DLQ → DELIVERED
```

## Run locally

Requirements: Node.js 22+, npm, Java 17 and the Android SDK for the APK build. PostgreSQL is optional because the API includes a complete in-memory demo store.

```bash
# terminal 1
npm --prefix apps/api ci
npm run dev:api

# terminal 2
npm --prefix apps/web ci
npm run dev:web
```

Open:

- Public case study: `http://localhost:3000`
- Guided trace: `http://localhost:3000/demo`
- Operations console: `http://localhost:3000/app/overview`
- API: `http://localhost:4100`
- API health: `http://localhost:4100/health`

The web console detects the local API and labels itself `Live`; if the API is stopped, it explicitly reports `Preview mode` while preserving the synthetic browser walkthrough.

## Verify

```bash
npm run build
npm run test
npm run typecheck
```

The API test suite covers discrepancy thresholds, state constraints, immutable evidence, idempotency result recovery, conflict review, atomic resolution/outbox creation, retry/DLQ behavior, and stable-key replay. Mobile tests cover its domain and persistent offline-operation behavior.

## Android

The Android client is intentionally a real application, not a responsive web wrapper. It includes:

- Offline Home
- Review Before Save
- Saved on This Device confirmation
- Sync Center
- Receiver Discrepancy
- Explicit uncached-handoff limitation
- Persistent operation metadata: idempotency key, base version, and device timestamp

See `apps/mobile/README.md` for emulator and APK commands. Verified build artifacts are written to `apps/mobile/artifacts`, published as immutable GitHub release assets, and linked from the website download page with a SHA-256 sidecar.

## Deployment

`infra/compose.yaml` defines the VPS stack behind Caddy at `fieldrelay.swoop.video`. PostgreSQL is private, only Caddy exposes host ports, health checks are included, and AWS is optional: the local delivery simulator demonstrates queue semantics until authorized AWS resources are configured.

See `docs/deployment/vps-runbook.md` for the exact local-operator sequence. The existing pinned SSH identity stays on the authorized operator machine; no VPS credential is stored in this repository or GitHub Actions.

## Honest boundaries

- All organizations, people, materials, and shipment data are fictional or synthetic.
- Validation rules are illustrative and must not replace qualified regulatory guidance.
- OData is an example enterprise adapter only; the project does not imply that WiQ uses SAP or OData.
- Real production use would require authenticated tenancy, encrypted device storage, managed secrets, approved jurisdiction rules, monitoring, load/chaos testing, and a full security review.

## Design system

The interface is a **Dispatch Ledger / Instrumented Chain of Custody**: IBM Plex typography, record IDs, ruled surfaces, connected event traces, exact quantities, timestamps, and operational evidence. Industrial photography is a restrained transition accent. The relay mark, lifecycle rails, record notation, rules, and status symbols are native responsive SVG/CSS.

---

FieldRelay is an independent portfolio prototype using fictional organizations, synthetic shipment data, and illustrative validation rules. It is not affiliated with WiQ Technologies and is not intended for production or regulatory use.
