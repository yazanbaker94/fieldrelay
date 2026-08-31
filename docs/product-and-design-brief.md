# FieldRelay Product, UX, Content, and Design Brief

Version: 1.0  
Purpose: design and implementation handoff  
Primary audience: product/UI designer and implementation agent  
Deployment target: `fieldrelay.swoop.video`

## 1. Product summary

FieldRelay is an original portfolio prototype demonstrating how an industrial shipment can move reliably from an offline field device through generator, driver, and receiver handoffs, discrepancy resolution, and delivery to an external system of record.

It is being built to demonstrate fit for WiQ Technologies' Intermediate Software Developer role. It must feel like an independent, production-minded B2B SaaS product, not a visual clone of WiQ.

The product consists of four connected surfaces:

1. A public portfolio and product-story website.
2. A web operations console.
3. A React Native Android field application distributed as a signed APK.
4. A Node.js/PostgreSQL backend with real-time events, offline synchronization, and integration recovery.

## 2. What the demo must prove

The demo must visibly prove the following:

- A user can create and sign a shipment while offline.
- The Android application stores the operation locally and clearly communicates its sync state.
- Reconnecting synchronizes idempotently, even if a request is replayed.
- Generator, driver, and receiver actions form one traceable shipment history.
- A quantity mismatch becomes a discrepancy; it does not silently overwrite history.
- An operations user can investigate and resolve the discrepancy.
- Completed shipment data can be delivered to an external system.
- A failed delivery is observable, retried safely, and recoverable from a dead-letter state.
- Every meaningful action appears in an immutable audit timeline.
- Mobile, web, backend, database, and queue all form one coherent product.

## 3. Product boundaries

FieldRelay is not:

- A WiQ product or official integration.
- A regulatory-compliance system.
- A reproduction of WiQ's screens or branding.
- A complete Canadian waste-management platform.
- A production SAP connector.
- An AI waste-classification tool.

Every public surface must include this disclaimer:

> FieldRelay is an independent portfolio prototype using fictional organizations, synthetic shipment data, and illustrative validation rules. It is not affiliated with WiQ Technologies and is not intended for production or regulatory use.

## 4. Users and demo personas

All data is synthetic.

### Maya Chen - Generator Coordinator

- Organization: Northstar Field Services
- Goal: create a correct shipment quickly, including while offline.
- Device: Android phone at a remote source location.
- Key concerns: speed, required fields, knowing whether data synchronized.

### Marcus Lee - Driver

- Organization: Prairie Line Transport
- Goal: accept the assigned load and confirm pickup without creating an account.
- Device: Android phone opened from a one-time link or QR code.
- Key concerns: simple instructions, minimal typing, current document access.

### Priya Shah - Receiver Operator

- Organization: Copper Ridge Recovery
- Goal: confirm what was received and record the actual offloaded quantity.
- Device: Android phone or responsive web handoff.
- Key concerns: correct shipment, actual quantity, visible discrepancy warning.

### Jordan Patel - Operations Specialist

- Organization: Northstar Field Services
- Goal: monitor active loads, investigate exceptions, preserve an audit trail, and recover failed integrations.
- Device: desktop web console.
- Key concerns: operational visibility, reliable filters, clear responsibility, fast recovery.

## 5. Core demo shipment

Primary guided-demo record:

- Shipment: `FR-2026-0842`
- Material: `Demo Solvent Mixture - training data`
- Reference fields: `UN1993`, Class `3`, Packing Group `III`
- Generator: Northstar Field Services
- Source: Alder Creek Site 14
- Carrier: Prairie Line Transport
- Driver: Marcus Lee
- Receiver: Copper Ridge Recovery
- Offered quantity: 8,200 L
- Pickup quantity: 8,180 L
- Received quantity: 7,940 L
- Result: 240 L variance from pickup to receipt
- External destination: `ERP Demo / OData Adapter`
- Initial integration result: simulated HTTP 503 failure
- Final integration result: successful replay

The material values are illustrative only. The UI must visibly label them as training data.

Secondary seeded shipments should demonstrate normal, pending, offline, discrepant, completed, and integration-failed states.

## 6. Information architecture

### Public site routes

- `/` - product story and portfolio landing page
- `/demo` - guided demo entry
- `/architecture` - technical architecture and decisions
- `/download/android` - Android download and installation page
- `/docs` - API and implementation notes
- `/app/*` - authenticated/demo operations console
- `/handoff/:token` - one-time driver or receiver handoff

### Web console routes

- `/app/overview`
- `/app/shipments`
- `/app/shipments/:shipmentId`
- `/app/exceptions`
- `/app/exceptions/:exceptionId`
- `/app/integrations`
- `/app/integrations/:deliveryId`
- `/app/audit`
- `/app/system`

### Android navigation

- Launch / demo access
- Persona selection
- Home
- Shipments
- New shipment
- Shipment detail
- Driver handoff
- Receiver handoff
- QR scanner
- Sync centre
- Settings / demo controls

## 7. Public website content

The public site is a project presentation, not a marketing site pretending FieldRelay is a real company.

### 7.1 Navigation

Left:

- FieldRelay wordmark

Centre/right:

- Product
- Demo
- Architecture
- Android APK
- GitHub

Persistent primary action:

- `Launch live demo`

### 7.2 Hero

Eyebrow:

> Portfolio prototype for an industrial software-development role

Headline:

> Reliable handoffs from offline field work to the system of record.

Supporting copy:

> FieldRelay demonstrates an offline-first industrial shipment workflow built with React Native, React, Node.js, PostgreSQL, real-time events, and recoverable integrations.

Primary CTA:

- `Run the guided demo`

Secondary CTA:

- `Download Android APK`

Tertiary text link:

- `View architecture`

Hero visual:

- Android shipment screen in front.
- Web operations console behind it.
- Small status transition showing `Offline saved -> Syncing -> Synced`.
- Avoid fake testimonial cards, vanity statistics, or abstract AI artwork.

### 7.3 Capability strip

Four concise proof points:

- Offline-first field workflow
- Idempotent synchronization
- Auditable exception handling
- Recoverable system integrations

### 7.4 Product story: one shipment, every handoff

Section headline:

> One shipment. Four systems. No invisible failures.

Four-stage sequence:

1. **Created offline** - Maya creates and signs a shipment without connectivity.
2. **Transferred safely** - Marcus accepts the load through a one-time handoff.
3. **Reconciled transparently** - Priya records the received quantity and FieldRelay flags the variance.
4. **Delivered reliably** - Jordan resolves the exception and replays a failed ERP export.

Each stage should have a real product screenshot or designed product frame, not an illustration.

### 7.5 Failure-first engineering section

Headline:

> Designed around what happens when the happy path breaks.

Cards or rows:

- Connectivity disappears during field entry.
- The same request is submitted twice.
- Two parties report different quantities.
- An external system returns an error.
- Support needs to reconstruct exactly what happened.

Each item should pair the failure with the product response.

### 7.6 Mobile section

Headline:

> Field work that remains trustworthy offline.

Copy:

> The Android application stores work locally, exposes every pending operation, and synchronizes safely when connectivity returns. Users never have to guess whether a shipment was saved.

Visuals:

- Mobile home
- New-shipment review
- Offline queue
- Successful sync state

CTA:

- `Get the signed APK`

### 7.7 Operations-console section

Headline:

> Exceptions become workflows, not phone calls.

Copy:

> Operations can compare reported values, inspect the complete event history, resolve discrepancies with a reason, and preserve the original record.

Visuals:

- Exceptions queue
- Side-by-side quantity comparison
- Audit timeline

### 7.8 Integration-recovery section

Headline:

> External delivery you can observe and recover.

Copy:

> Completed shipments enter a transactional outbox, are delivered through a queue, and remain visible through every attempt. Failed deliveries can be diagnosed and replayed without duplicating the destination record.

Show:

- Generic webhook destination
- Optional OData example adapter
- Attempt history
- Dead-letter status
- Replay success

Do not suggest WiQ uses SAP. Label the OData adapter as an example enterprise connector.

### 7.9 Architecture section

Headline:

> One domain model across mobile, web, and backend.

Diagram nodes:

- React Native Android
- React operations console
- Node/Express API
- PostgreSQL
- Socket.IO
- Transactional outbox
- AWS SQS + DLQ
- Generic webhook / example OData endpoint

Key decisions:

- Shared TypeScript domain package
- Explicit state machine
- Idempotency keys
- Append-only audit events
- Offline operation queue
- Correlation IDs across services

CTA:

- `Read the technical decisions`

### 7.10 Why I built this

Headline:

> Built to demonstrate product ownership, not just UI implementation.

Copy:

> I built FieldRelay after studying public industrial shipment workflows and the reliability challenges of low-connectivity, multi-party software. The project combines my React and Node.js experience with real-time systems, production troubleshooting, AWS queues, and enterprise API integration.

Links:

- Resume
- LinkedIn
- GitHub

### 7.11 Final CTA

Headline:

> See the complete failure-and-recovery flow in under two minutes.

Actions:

- `Start guided demo`
- `Watch walkthrough`
- `View source`

### 7.12 Footer

- FieldRelay
- Project overview
- GitHub
- Architecture
- APK
- Contact
- Full disclaimer

## 8. Guided demo experience

The guided demo is crucial. A reviewer should not need to understand the whole system before seeing value.

### Entry screen

Headline:

> Run the complete FieldRelay scenario

Estimated duration:

> About 90 seconds

Steps preview:

1. Inspect an offline-created shipment.
2. Synchronize it into operations.
3. record receiver quantity.
4. resolve the discrepancy.
5. recover a failed integration.

Buttons:

- `Start guided demo`
- `Explore freely`

### Guided-demo mechanics

- A compact stepper remains visible.
- Each step highlights the relevant control.
- Explanations are one sentence, not tutorial walls.
- The reviewer can skip or exit at any point.
- The scenario can be reset instantly.
- The system should seed a fresh demo run with a unique correlation ID.

## 9. Web operations console

### 9.1 Global shell

Left sidebar:

- FieldRelay mark
- Overview
- Shipments
- Exceptions with count badge
- Integrations with failure badge
- Audit
- System

Top bar:

- Search
- Environment badge: `Portfolio demo`
- System connection indicator
- `Run guided demo`
- Demo persona menu
- Reset demo action

Global principles:

- Desktop-first but usable at tablet widths.
- Operational density without visual clutter.
- Status text must accompany colour.
- Filters must be visible and reversible.
- Important timestamps should include timezone.

### 9.2 Overview page

Page title:

> Operations overview

Subtitle:

> Live status across field work, exceptions, and external deliveries.

Summary metrics:

- Active shipments: 12
- Offline pending: 2
- Open exceptions: 3
- Failed integrations: 1

Primary modules:

1. **Needs attention**
   - Shipment ID
   - Issue
   - Owner
   - Age
   - Recommended action
2. **Live shipment activity**
   - Compact event stream
3. **Shipment state distribution**
   - Useful chart only; avoid decorative charting
4. **Integration health**
   - Queue depth, successful deliveries, retries, DLQ
5. **System health**
   - API, database, WebSocket, queue

### 9.3 Shipments list

Page title:

> Shipments

Controls:

- Search by shipment, party, or location
- Filters: state, sync state, exception state, destination, date
- Saved view: `Needs attention`
- Export demo CSV

Table columns:

- Shipment
- Material
- Generator
- Carrier
- Receiver
- Current state
- Sync state
- Exception
- Scheduled date
- Last activity

Row states:

- Normal
- Offline pending
- Syncing
- Discrepancy open
- Integration failed
- Completed

### 9.4 Shipment detail

Header:

- Shipment ID
- Current state
- Sync state
- Exception status
- Primary next action

Tabs or sections:

1. **Summary**
   - Parties and route
   - Material lines
   - Offered/pickup/received quantities
   - Current responsibility
2. **Timeline**
   - Append-only event history
   - Actor, device, timestamp, result
3. **Documents**
   - Illustrative generated document preview
   - Attachments with synthetic filenames
4. **Sync history**
   - Client operation IDs
   - Attempts and results
5. **Integration delivery**
   - Destination and current delivery state

Right-side contextual panel:

- Current blocker
- Recommended next action
- Correlation ID
- Related exception

### 9.5 Exceptions queue

Page title:

> Exceptions

Queue columns:

- Severity
- Shipment
- Exception type
- Reported variance
- Responsible team
- Age
- SLA indicator
- Status

Exception types:

- Quantity mismatch
- Required information missing
- Conflicting offline update
- Stalled handoff
- External delivery failure

### 9.6 Exception workbench

This is one of the product's hero screens.

Header:

- Exception ID
- Shipment ID
- Severity
- Age
- Owner

Comparison area:

| Field | Generator | Driver | Receiver |
|---|---:|---:|---:|
| Quantity | 8,200 L | 8,180 L | 7,940 L |
| Timestamp | ... | ... | ... |
| Device state | Offline | Synced | Online |

Supporting context:

- Route
- Material profile
- Notes
- Source operation IDs
- Timeline excerpt

Resolution form:

- Resolution category
- Accepted final quantity
- Reason
- Internal note
- Optional attachment
- `Resolve exception`

The interface must explain that original values remain preserved.

### 9.7 Integrations list

Page title:

> Integration deliveries

Summary:

- Delivered today
- Retrying
- Failed
- Dead-letter queue

Table columns:

- Delivery ID
- Shipment
- Destination
- Event type
- Attempts
- Last result
- Next retry
- State

Destinations:

- Generic accounting webhook
- Example OData ERP adapter

### 9.8 Integration delivery detail

Header:

- Delivery ID
- Destination
- Status
- Shipment

Sections:

- Sanitized request payload
- Response status and body
- Attempt history
- Backoff schedule
- Idempotency key
- Correlation ID
- Queue and DLQ status
- `Replay delivery`

Replay confirmation should explain that the destination idempotency key prevents duplication.

### 9.9 Audit page

Page title:

> Audit history

Filters:

- Shipment
- Actor
- Event type
- Source device
- Date range
- Correlation ID

Columns:

- Time
- Actor
- Event
- Entity
- Source
- Result
- Correlation ID

Audit detail drawer:

- Previous state
- New state
- Metadata diff
- Device and application version
- Linked sync or integration event

### 9.10 System page

Purpose: prove production thinking without pretending to be a complete observability platform.

Modules:

- API health
- Database health
- WebSocket connections
- Queue depth
- DLQ depth
- Recent errors
- Demo-data reset status
- Deployed version and commit

## 10. Android application

The mobile product must be designed for a driver or field operator using one hand, outdoors, sometimes under time pressure.

### 10.1 Launch screen

- FieldRelay mark
- `Portfolio prototype` label
- Current API environment
- Fast load; no decorative animation longer than one second

### 10.2 Demo access / persona selection

Headline:

> Choose a field role

Cards:

- Generator coordinator
- Driver
- Receiver operator

Each card includes the persona name, organization, and one-sentence task.

Secondary action:

- `Scan handoff QR`

### 10.3 Mobile home

Top status region:

- Greeting and persona
- Online/offline state
- Pending sync count

Primary action:

- `Create shipment`

Sections:

- Needs your action
- Today's shipments
- Recently synchronized

Bottom navigation:

- Home
- Shipments
- Scan
- Sync

### 10.4 New shipment flow

Use a short, explicit stepper.

#### Step 1: Route

- Generator
- Source location
- Receiver
- Destination
- Scheduled date/time
- Template selection

#### Step 2: Material

- Waste/material profile
- Training-data warning
- UN number
- Shipping name
- Class
- Packing group
- Quantity and unit
- Add material line

Most classification fields should come from the selected profile rather than requiring typing.

#### Step 3: Transport

- Carrier
- Driver
- Truck/unit number
- Trailer number
- Contact phone

#### Step 4: Review and sign

- Compact route summary
- Material summary
- Required-field check
- Signature/name confirmation
- Current network state
- `Save shipment`

When offline, the success message must say:

> Saved on this device. FieldRelay will synchronize automatically when connectivity returns.

Do not say `Submitted` while offline.

### 10.5 Shipment detail

Header:

- Shipment ID
- State
- Offline/sync indicator

Sections:

- Current action
- Route
- Material
- Quantities
- Parties
- Activity timeline

Primary actions change by persona and state.

### 10.6 Driver handoff

Entry:

- One-time link or QR scan
- No account creation

Screen content:

- Verify shipment and route
- Offered quantity
- Record pickup quantity
- Truck/trailer confirmation
- Driver declaration
- Signature
- `Confirm pickup`

### 10.7 Receiver handoff

Screen content:

- Verify shipment
- Record received quantity
- Disposition/result
- Notes
- Signature
- `Confirm receipt`

If the quantity differs beyond the demo threshold:

> A quantity variance was detected. Your original entry will be preserved and Operations will review the discrepancy.

### 10.8 Sync centre

This is another hero screen.

Summary states:

- Online / offline
- Pending operations
- Last successful sync

Operation rows:

- Local operation ID
- Shipment
- Action
- Created time
- Attempt count
- Current state

States:

- Waiting for connection
- Ready to sync
- Syncing
- Synced
- Needs attention

Actions:

- Retry
- Inspect error
- Copy diagnostic ID

### 10.9 Conflict state

If the server changed while the device was offline, do not show a generic error.

Show:

- What changed on the server
- What the device attempted
- Which fields conflict
- Safe action: refresh, keep as draft, or send for review

The demo should not allow a user to overwrite a completed shipment silently.

### 10.10 QR scanner

- Camera view
- Clear permission explanation
- Manual code-entry fallback
- Result preview before opening
- Invalid/expired token state

### 10.11 Settings and demo controls

- Persona switch
- Simulate offline mode
- Force next integration failure
- Reset local demo data
- API environment
- App version
- Disclaimer

The real network state and simulated demo state must be visually distinguishable.

## 11. Required product states

The design system must include these semantic states with icon, text, and colour:

- Draft
- Offered
- Accepted
- Picked up
- In transit
- Received
- Completed
- Offline saved
- Sync pending
- Syncing
- Synced
- Conflict
- Discrepancy open
- Discrepancy resolved
- Export pending
- Export retrying
- Export failed
- Dead-lettered
- Export completed

Also design:

- Loading skeletons
- Empty states
- Partial-data states
- Permission denied
- Expired handoff link
- Invalid QR code
- Server unavailable
- Form validation
- Success confirmation
- Destructive confirmation

## 12. Design-system requirements

### Character

The visual language should feel:

- Operational
- Trustworthy
- Calm under failure
- Industrial but modern
- Data-aware
- Human and field-friendly

It must not feel:

- Like a cryptocurrency dashboard
- Like an AI-generated landing-page template
- Like a WiQ visual clone
- Overly glossy or decorative
- Filled with oversized rounded cards
- Dependent on gradients and glass effects
- Sparse to the point of hiding operational information

### Layout

- Use an 8 px spacing system.
- Web target: 1440 px desktop with a functional 1024 px tablet layout.
- Mobile target: Android frame around 412 x 915, with support down to 360 px width.
- Minimum mobile touch target: 44 x 44 px.
- Persistent offline state must never depend on colour alone.
- Dense tables should maintain readable row height and sticky headers.

### Typography

Choose a highly legible sans-serif suitable for operational UI. Suggested directions:

- Inter
- Geist
- IBM Plex Sans
- Public Sans

Use a monospace face only for IDs, payloads, logs, and correlation values.

### Colour

The designer can derive the palette from supplied references, subject to:

- Original FieldRelay identity.
- Do not copy WiQ's green palette.
- One restrained primary colour.
- Clearly differentiated warning, critical, success, and informational states.
- WCAG AA contrast.
- Outdoor-readable mobile surfaces.

### Components

Required components:

- Buttons and icon buttons
- Inputs, selects, comboboxes, date/time fields
- Search and filter bar
- Status badges
- Stepper
- Tabs
- Table and data grid
- Timeline
- Event/audit row
- Metric card
- Alert and offline banner
- Toast
- Dialog and drawer
- File attachment row
- Code/payload viewer
- Retry-attempt list
- Mobile bottom navigation
- Signature input
- QR scanner frame
- Sync operation card
- Empty, loading, and error states

## 13. Design deliverables expected from the design agent

### Foundation

- FieldRelay wordmark and simple application icon
- Colour tokens
- Typography scale
- Spacing, radius, border, shadow, and motion tokens
- Icon direction
- Component library

### Public website

- Desktop landing page
- Mobile landing page
- Guided-demo entry
- Architecture page
- Android download page

### Web console

- Global application shell
- Overview
- Shipments list
- Shipment detail
- Exceptions queue
- Exception workbench
- Integration list
- Integration detail
- Audit page
- System page

### Android

- Persona selection
- Home online
- Home offline
- New-shipment steps
- Review and offline-save success
- Shipment detail
- Driver handoff
- Receiver handoff
- Discrepancy warning
- Sync centre
- Conflict resolution
- QR scanner
- Settings/demo controls

### Prototype

The clickable prototype should cover:

1. Mobile offline shipment creation.
2. Successful synchronization.
3. Receiver discrepancy.
4. Web exception resolution.
5. Integration failure and replay.

### Handoff

- Component states and variants
- Responsive behaviour
- Empty/loading/error states
- Exportable assets
- Exact spacing and typography values
- Notes explaining unusual interaction decisions

## 14. Technical implementation plan

### Monorepo

```text
apps/
  mobile/        React Native + Expo Android application
  web/           React operations console and public site
  api/           Node.js + TypeScript + Express API
  worker/        Queue and integration-delivery worker
packages/
  domain/        State machine, validation, shared types
  api-client/    Generated/shared API client
  ui-tokens/     Shared design tokens
  test-data/     Synthetic fixtures and demo scenario
infra/
  docker/
  aws/
  caddy/
```

### Domain model

Primary entities:

- Organization
- User/persona
- Location
- Material profile
- Shipment
- Shipment line
- Party assignment
- Handoff token
- Signature
- Domain event
- Sync operation
- Exception
- Exception resolution
- Integration destination
- Integration delivery
- Delivery attempt
- Audit event

### Shipment state machine

```text
DRAFT
  -> OFFERED
  -> ACCEPTED
  -> PICKED_UP
  -> IN_TRANSIT
  -> RECEIVED
  -> COMPLETED
```

Parallel/exception states:

```text
SYNC_PENDING -> SYNCED | CONFLICT
DISCREPANCY_OPEN -> DISCREPANCY_RESOLVED
EXPORT_PENDING -> EXPORT_RETRYING -> EXPORT_COMPLETE
                                -> EXPORT_FAILED -> DEAD_LETTERED
```

### Offline sync design

- Android stores local operations in SQLite.
- Each operation receives a UUID idempotency key.
- Operations include base entity version and device timestamp.
- The API records processed idempotency keys.
- Duplicate requests return the original result.
- Version conflicts create a reviewable conflict; they do not overwrite server state.
- Successful server changes append domain and audit events.
- The client advances its local cursor and marks the operation synced.

### Backend reliability

- PostgreSQL transaction wraps business mutation and outbox insert.
- Worker publishes outbox events to SQS.
- Delivery worker applies exponential backoff.
- Persistent failure moves to a DLQ.
- Manual replay preserves the same destination idempotency key.
- Correlation IDs connect API request, event, queue message, delivery attempt, and audit record.

### API surface

Representative endpoints:

```text
POST   /api/demo/runs
POST   /api/sync/operations
GET    /api/sync/operations/:id
GET    /api/shipments
POST   /api/shipments
GET    /api/shipments/:id
POST   /api/shipments/:id/offer
POST   /api/handoffs/:token/accept
POST   /api/handoffs/:token/receive
GET    /api/exceptions
POST   /api/exceptions/:id/resolve
GET    /api/integrations/deliveries
POST   /api/integrations/deliveries/:id/replay
GET    /api/audit
GET    /api/system/health
```

### Authentication and demo security

- No public registration.
- Web uses preconfigured demo access.
- Driver and receiver handoffs use short-lived, one-time tokens.
- Demo data is synthetic.
- Rate limiting on public endpoints.
- Request-size limits and server-side validation.
- Secrets never ship inside the APK.
- Demo database resets on schedule and on explicit reset.

### Testing

- Unit tests for state transitions and discrepancy rules.
- Unit tests for idempotency behaviour.
- Integration tests for database mutation plus outbox.
- Integration tests for retry and DLQ behaviour.
- API contract tests.
- Playwright guided-demo test.
- Android offline/sync smoke test.
- Accessibility checks for critical web screens.

## 15. Deployment plan

Primary domain:

- `fieldrelay.swoop.video`

Recommended same-origin paths:

- `/api`
- `/socket`
- `/download/android`
- `/docs`

VPS services:

- Caddy or Nginx reverse proxy
- React static application
- Node API container
- Worker container
- PostgreSQL container or managed database

External services:

- AWS SQS
- AWS SQS dead-letter queue
- AWS SNS failure notification
- GitHub Actions
- GitHub Releases for the signed APK

Operational requirements:

- HTTPS everywhere
- Health checks
- Structured logs
- Basic uptime monitoring
- Automated database backup
- Daily demo reset
- Deployment version visible in the UI

## 16. Build sequence

### Phase 1 - design and domain

- Approve product flows and supplied visual references.
- Complete the design system and hero screens.
- Implement shared domain types and state machine.

### Phase 2 - backend foundation

- Database schema and migrations.
- Shipment and handoff APIs.
- Audit-event pipeline.
- Seed data and demo-run reset.

### Phase 3 - web console

- Application shell.
- Overview and shipment pages.
- Exception workbench.
- Integration monitor and audit history.

### Phase 4 - Android application

- Persona and home flows.
- Offline shipment creation.
- SQLite operation queue.
- Driver/receiver handoffs.
- Sync centre and conflict handling.

### Phase 5 - event delivery

- Transactional outbox.
- SQS and DLQ.
- Generic webhook destination.
- Example OData adapter.
- Replay workflow.

### Phase 6 - portfolio presentation

- Public website.
- Guided-demo orchestration.
- Architecture page.
- APK signing and download.
- Walkthrough video.
- Final accessibility, responsiveness, and reliability testing.

## 17. Final deliverables

- Live site at `fieldrelay.swoop.video`
- Live operations console
- Signed Android APK
- GitHub Release with checksum
- Public or reviewable GitHub repository
- README with setup and architectural decisions
- Architecture diagram
- OpenAPI documentation
- Synthetic demo dataset
- Automated tests
- Docker-based local setup
- 90-second primary walkthrough
- 3-5 minute technical walkthrough
- Application-ready portfolio description

## 18. Acceptance criteria

The project is ready to send only when:

- A reviewer can run the guided scenario without assistance.
- Offline mobile work survives application restart.
- Replaying the same operation does not duplicate the shipment.
- A discrepancy preserves all original reported quantities.
- Integration failure and recovery are visible end to end.
- Every major action appears in the audit timeline.
- Android APK installs and connects over HTTPS.
- Web console works at 1440 px and 1024 px widths.
- Mobile works at 360-412 px widths.
- Empty, loading, error, and offline states are intentionally designed.
- No WiQ trademarks, copied interface, or compliance claims appear.
- No real customer data or secrets are present.
- The product looks authored and operational, not template-generated.
