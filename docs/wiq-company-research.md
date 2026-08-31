# WiQ Technologies: Company, Product, Role, and Demo Research

Research date: 2026-08-31  
Target role: Intermediate Software Developer, Calgary  
Candidate: Yazan Baker

## Executive conclusion

WiQ is a legitimate Calgary product team with a live full-stack developer opening. It is not a staffing firm or an anonymous job-posting shell. The team is small (14 visible employees on LinkedIn), but WiQ is a wholly owned subsidiary of SECURE Waste Infrastructure Corp., a large Calgary-based industrial waste company. SECURE originally built WiQ in-house and commercialized it as a separate product company.

The best demo is **FieldRelay: an offline manifest-to-ERP reliability and exception-recovery console**. It should demonstrate an end-to-end generator/carrier/receiver workflow, offline-first synchronization, idempotent event processing, discrepancies, an immutable audit trail, and a mocked SAP OData handoff with retry/dead-letter handling.

This is better than a generic manifest clone because it addresses the hardest engineering problems visible in WiQ's public product and release history while using Yazan's strongest differentiators: React, TypeScript, Node.js, SQL, Socket.IO, AWS SQS/SNS, REST/OData, SAP integration, CI/CD, and production troubleshooting.

## 1. Corporate identity and credibility

### What WiQ is

- WiQ Technologies Inc. is headquartered at 2300-225 6 Ave SW in Calgary.
- LinkedIn lists 11-50 employees and 14 visible employees, founded in 2022.
- The official team page identifies a director, product manager, software-development manager, three software developers, a QA analyst, customer-success staff, and waste-domain specialists.
- WiQ is a wholly owned Canadian subsidiary of SECURE Waste Infrastructure Corp.
- SECURE's public reporting says it built WiQ in-house and began commercializing it as a logistics and compliance optimization product.
- The WASTE IQ trademark was transferred from SECURE Energy Services Inc. to WiQ Technologies Inc. in October 2023 and is registered and active.

This structure explains why WiQ feels like a startup team while having access to deep industrial-waste knowledge, facilities, customers, and corporate backing.

### Parent-company context

SECURE reports more than 1,800 employees and over 80 facilities and landfills across Western Canada and North Dakota. It describes WiQ as a digital-solutions venture for logistics, regulatory compliance, and operations.

SECURE is currently the subject of an announced acquisition by GFL Environmental. Shareholders approved the transaction, and closing was expected in the second half of 2026 subject to remaining regulatory conditions. This is relevant company context, but there is no public evidence that the open developer role is specifically an acquisition-integration role.

### Credibility signals

- Live opening on WiQ's own careers domain and a direct application form.
- Active iOS and Android applications with 2026 releases.
- Named customer testimonial from Archer Exploration Corp.
- WiQ claims 183,000 annual loads managed, 1,550 reports delivered, and 154 successful AER audits through its waste-tracking service.
- The company says it has SOC 2 Type I and Type II compliance and conducts annual third-party penetration tests.
- WiQ says it holds Transport Canada Equivalency Certificate SU 14806 for electronic shipping documents. Transport Canada confirms that an equivalency certificate is required to replace the paper document that normally accompanies dangerous goods.
- WiQ is listed as an associate member of the Canadian Association of Petroleum Producers.

## 2. What WiQ actually builds

WiQ is a B2B, multi-party compliance and logistics SaaS platform for waste, hazardous materials, commodities, spill/remediation material, and related industrial shipments.

It replaces paper manifests, truck tickets, bills of lading, and disconnected spreadsheets with web and mobile workflows. The software is designed for regulated, low-connectivity field operations rather than ordinary office-only form entry.

### Primary users

1. **Generator / consignor** - identifies the material, source, intended receiver, classification, quantity, and shipment details.
2. **Carrier / transporter / driver** - accepts the load, records equipment and pickup information, carries the shipping document, and confirms movement.
3. **Receiver / consignee** - records offload details, verifies actual quantities, accepts or disputes the load, and confirms final receipt.
4. **Dispatch and operations** - monitor movement, route work, intervene in stalled loads, and manage exceptions.
5. **Compliance and waste specialists** - validate classifications, reconcile documents, produce regulatory reports, and prepare audit evidence.
6. **Finance and external systems** - receive completed job data for invoicing, reporting, or ERP workflows.

### Core product capabilities

- Digital waste manifests and shipping documents.
- TDG-compliant electronic documentation under the company's equivalency certificate.
- Online and offline mobile ticket creation and synchronization.
- Templates and waste profiles that prefill classification data.
- Multi-line loads with separate classifications and quantities on one document.
- Role- and group-based access to locations, templates, and movements.
- Driver participation through low-touch or no-login workflows.
- Digital signatures and text-message workflows.
- Real-time status and notifications.
- Structured discrepancy and dispute resolution.
- Complete history and audit trails.
- Search, reporting, CSV exports, and jurisdiction-ready documents.
- APIs, webhooks, API-key authentication, third-party integrations, and invoicing handoff.
- Customer onboarding, support, waste tracking, reconciliation, advisory, and audit support.

### Regulatory problem the product solves

Waste shipping is not governed by one universal form. The correct data and document depend on material, jurisdiction, route, and regulator. Public WiQ materials refer to AER, AEPA/EPEA, ECCC, TDG, and multiple provincial authorities.

For Alberta oilfield waste, AER Directive 058 governs handling, classification, documentation, reporting, and reconciliation. The 2026 update increased expectations around defensible characterization, documentation, traceability, reporting, and unresolved discrepancies.

For Alberta hazardous waste, the manifest tracks a shipment from generation to receipt and involves generator, carrier, and receiver responsibilities. TDG shipping documents require ordered dangerous-goods information such as UN number, shipping name, class, packing group, and quantity. Electronic replacement of the accompanying paper document normally requires an equivalency certificate.

The engineering consequence is important: the application is a configurable, jurisdiction-aware state machine with strict validation and an audit trail, not merely a PDF form generator.

## 3. Product maturity and current engineering pressure

### Evidence from public release history

WiQ's 2025-2026 mobile releases show rapid product development around:

- Offline ticket and template creation, cached reference data, and synchronization.
- Driver authentication and mobile stability.
- Custom source locations and jurisdiction-specific location formats.
- Waste profiles, waste codes, UN numbers, and material approvals.
- Template permissions, ownership, visibility, and performance.
- Discrepancy/dispute workflows and revalidation after changes.
- Multi-line and multi-page manifests.
- Document previews and attachments.
- Search, filtering, exports, and report performance.
- API-key authentication and backend performance.
- QR-code entry into a template-based ticket.

The July 2026 Android release still mentioned fixes for custom-source locations, waste-code loading, template ticket creation, and multi-page manifest viewing. The August 2026 release added QR template scanning, offline UN-number availability, and crash/data-entry fixes.

### User-feedback signal

The iOS listing includes one positive review praising offline manifest creation and one negative review describing loads that did not appear for acceptance, causing calls and delay. A single review is not statistically representative, but it supports what the release notes already show: reliable synchronization and visibility across parties are central product risks.

### Likely hard engineering problems

These are evidence-based inferences, not claims about WiQ's private backlog:

- Offline writes must be replayed without duplicating regulated records.
- Multiple parties can update one shipment at different stages and under poor connectivity.
- Reference data and validation rules change by jurisdiction and release.
- Template, location, material, and tenant permissions must remain consistent across web and mobile.
- Discrepancies need transparent resolution without destroying the original record.
- External systems require reliable, observable API/webhook delivery.
- Customer Success needs enough operational visibility to diagnose stalled work quickly.

## 4. Market position

WiQ competes with or overlaps products such as IronSight, EnviroApps, and Galatea in digital manifesting and oilfield-waste workflows. Broad EHS and logistics products can also compete for part of the budget.

WiQ's visible differentiation is:

- A product created with direct waste-industry and SECURE operational knowledge.
- A specific Western Canadian regulatory focus with expansion across jurisdictions.
- A three-party generator/carrier/receiver workflow.
- Offline field operation.
- A Transport Canada electronic-documentation certificate.
- Hands-on waste tracking, reconciliation, regulatory expertise, and audit support alongside the SaaS product.
- Flexible integrations that do not require a customer to replace its operational systems.

The company sells certainty and reduced compliance friction, not merely form digitization.

## 5. The open developer role

### Stated stack

- TypeScript
- React
- React Native
- Node.js
- PostgreSQL
- AWS
- GitHub
- Datadog
- Linear and Notion
- AI-assisted development tools

### Stated working style

The developer owns loosely defined problems from discovery through release and production support. The role emphasizes business rules, edge cases, product judgment, customer context, code review, testing, monitoring, troubleshooting, and collaboration with Product, QA, and Customer Success.

### Honest candidate fit

Strong matches in Yazan's Canadian resume:

- React, Angular, TypeScript, JavaScript, and reusable UI components.
- Node.js, Express, REST APIs, OData, SQL, Socket.IO, and WebRTC.
- SAPUI5 and SAP backend integration through OData/REST.
- AWS SQS/SNS, CI/CD, Git, Jira, Postman, and Chrome DevTools.
- Production diagnosis, integration support, and 99% uptime work.
- Offline-capable PWA and real-time collaboration experience in SakinahTime.
- A history of shipping user-facing software, including a VS Code extension with 74,000+ downloads.
- Six years of technical support, which is valuable in a team where developers partner with Customer Success and stand behind production features.

Gaps:

- The posting requests 3-5 years of professional full-stack experience; the resume presents about two years under the Software Developer title.
- React Native is not shown on the resume, although it is a nice-to-have rather than a stated core requirement.
- PostgreSQL is not named explicitly; the resume says SQL.
- The resume has a software-development diploma rather than a bachelor's degree, but the posting allows equivalent experience.

The experience-length gap is real. A demo must therefore prove ownership, product judgment, and production thinking rather than just visual coding ability.

## 6. Demo options considered

### A. Generic digital-manifest CRUD clone - reject

It repeats what WiQ already has and mainly proves form-building. It does not demonstrate the difficult offline, integration, state, or audit problems.

### B. AI waste classifier - reject

Automatic classification could be unsafe and hard to defend in a regulated domain. Without authoritative training data and qualified human review, it risks appearing naive.

### C. Analytics dashboard - weak as a standalone demo

WiQ already has dashboards, reports, exports, and waste-tracking services. Analytics can be included, but should not be the core idea.

### D. Scope 3 shipment-emissions estimator - interesting but secondary

SECURE's earlier roadmap mentioned Scope 3 shipment data, so this is strategically relevant. However, a credible calculation requires methodology, vehicle, distance, fuel, payload, and emissions-factor decisions that could distract from software quality.

### E. Offline synchronization, exception recovery, and ERP handoff - best

This connects a visible product pressure to Yazan's exact stack and SAP integration experience. It demonstrates reliable state transitions, customer-facing diagnostics, APIs, background processing, auditability, and production ownership.

## 7. Recommended demo: FieldRelay

### Product statement

**FieldRelay is a small, independent proof of concept for moving a regulated shipment from an offline field device through receiver reconciliation and into an ERP system without losing, duplicating, or hiding events.**

It must be described as a portfolio prototype based on public workflows, not as a compliant production system and not as a copy of WiQ.

### The scenario

1. A generator creates a shipment from a saved waste profile while the device is offline.
2. The manifest is stored locally with a client-generated idempotency key and visible sync status.
3. Connectivity returns; queued operations synchronize safely.
4. A driver accepts through a one-time link and records pickup quantity.
5. A receiver enters the offloaded quantity.
6. A mismatch triggers a discrepancy rather than silently overwriting the original value.
7. Operations resolves the discrepancy with a reason and supporting note.
8. The completed shipment is sent to a mocked SAP OData endpoint.
9. A simulated ERP failure places the message in a retry/dead-letter flow.
10. An operations user diagnoses and replays the failed integration while the audit trail remains intact.

### Five screens

1. **Operations board** - active, offline-pending, stalled, discrepant, ERP-failed, and completed loads.
2. **Field ticket** - fast three-step mobile flow with an offline toggle and obvious sync indicator.
3. **Receiver handoff** - one-time link to confirm received quantity and disposition.
4. **Exception workbench** - compare offered, picked-up, and received data; resolve with reason and evidence.
5. **Integration monitor** - OData payload, delivery attempts, error, retry, and final status.

### Data and rules

Use fictional companies and synthetic materials. Model only a small public subset of fields:

- Generator, carrier, receiver, source, and destination.
- Document number and dates.
- UN number, shipping name, class, packing group, quantity, and unit.
- Pickup and received quantities.
- Status and state-transition timestamps.
- Sign-off names for demo personas.
- Discrepancy type, reason, resolution, and audit events.

Include a clear disclaimer that validation rules are illustrative and not a substitute for regulatory or qualified-professional review.

### State model

`DRAFT -> OFFERED -> ACCEPTED -> PICKED_UP -> IN_TRANSIT -> RECEIVED -> COMPLETED`

Exception branches:

- `SYNC_PENDING`
- `STALLED`
- `DISCREPANCY_OPEN -> DISCREPANCY_RESOLVED`
- `ERP_EXPORT_PENDING -> ERP_EXPORT_FAILED -> ERP_EXPORT_COMPLETE`

Every transition should append an immutable event. Corrections should create new events rather than rewriting history.

### Technical architecture

Frontend:

- React + TypeScript
- Responsive PWA
- IndexedDB via Dexie for the offline queue
- TanStack Query for server state
- WebSocket/Socket.IO updates
- Accessible, high-contrast field UI

Backend:

- Node.js + TypeScript + Express
- PostgreSQL
- Transactional outbox pattern
- REST API plus a mocked SAP OData v4 endpoint
- OpenAPI documentation
- Structured logs and correlation ids

AWS/deployment:

- S3 + CloudFront for the frontend
- Node service on App Runner or ECS
- RDS PostgreSQL
- SQS with a dead-letter queue for ERP export
- SNS notification for a failed handoff
- CloudWatch logs/metrics
- GitHub Actions CI/CD

Quality:

- Unit tests for the state machine and discrepancy rules
- Integration tests for idempotent sync and OData retry
- One Playwright end-to-end scenario
- Seeded demo data and a one-command local Docker setup

### What makes it impressive

- Airplane-mode simulation visibly proves offline behavior.
- Replaying the same sync request twice creates one server record, not two.
- Conflicting quantities create an exception with preserved history.
- The ERP failure is observable and recoverable rather than silently lost.
- The audit timeline shows who did what and when.
- The README explains tradeoffs, assumptions, failure modes, and what would change for production.

### What not to build

- Do not use WiQ's logo, brand styling, screenshots, or proprietary copy.
- Do not claim regulatory approval or compliance.
- Do not reproduce every form or every jurisdiction.
- Do not put real customer or shipment data in the demo.
- Do not spend most of the time on maps, charts, authentication, or visual polish.
- Do not make AI the headline. If included at all, use it only to summarize an exception for a human reviewer.

## 8. Build order and time box

### Day 1: domain and happy path

- Write the one-page problem statement and assumptions.
- Create the database and state machine.
- Build generator, driver, and receiver flows.
- Add synthetic demo data.

### Day 2: reliability

- Add IndexedDB offline queue.
- Add idempotency keys and transactional outbox.
- Add discrepancy creation and resolution.
- Add the audit timeline.

### Day 3: integration and presentation

- Add the mocked OData handoff, SQS retry, and dead-letter flow.
- Add tests, OpenAPI, seed script, and CI.
- Deploy and record a 90-second walkthrough.
- Write a concise architecture and decision README.

If time is tight, omit native React Native and use a strong installable PWA. A shallow mobile app is less valuable than a reliable end-to-end system.

## 9. Application positioning

Suggested portfolio headline:

> FieldRelay - an offline-first, auditable manifest handoff and SAP integration prototype built with React, TypeScript, Node.js, PostgreSQL, Socket.IO, and AWS queues.

Suggested message angle:

> I built this prototype after studying WiQ's public field workflow and recent mobile release history. I focused on the reliability boundary between offline field work, discrepancy resolution, and downstream ERP delivery because it combines the product problems I enjoy with my React/Node and SAP OData integration experience. It is an independent demo using synthetic data and illustrative rules, not a clone or compliance claim.

The application form has both a portfolio URL field and a cover-letter/message field, so the live demo, GitHub repository, and walkthrough can be included directly.

## 10. Sources

Company and role:

- [WiQ developer opening](https://www.wiqtech.com/careers/intermediate-software-developer)
- [WiQ careers](https://www.wiqtech.com/careers)
- [WiQ LinkedIn company page](https://ca.linkedin.com/company/wiqtech)
- [WiQ about/team](https://www.wiqtech.com/about)
- [Canadian WASTE IQ trademark record](https://ised-isde.canada.ca/cipo/trademark-search/pdf/2269985?lang=eng)
- [SECURE 2023 sustainability report](https://www.secure-energy.com/hubfs/pdfs/secure-2023-sustainability-report.pdf)
- [SECURE company overview](https://secure.ca/)
- [SECURE/GFL transaction status](https://secure.ca/gfl-transaction)

Product and evidence:

- [WiQ product overview](https://www.wiqtech.com/product)
- [Energy/oil-and-gas workflow](https://www.wiqtech.com/energy-oil-and-gas)
- [Electronic bill of lading and TDG workflow](https://www.wiqtech.com/electronic-bill-of-lading)
- [Digital manifesting](https://www.wiqtech.com/digital-waste-manifesting)
- [Containerized and multi-line waste](https://www.wiqtech.com/containerized-waste)
- [Waste tracking and public operating metrics](https://www.wiqtech.com/waste-tracking)
- [WiQ iOS application and release history](https://apps.apple.com/ca/app/wiq/id6478510527)
- [WiQ Android application](https://play.google.com/store/apps/details?id=ca.wiqtech.wiq)
- [WiQ Directive 058 analysis](https://www.wiqtech.com/report/blog/directive-058-update-what-it-means-for-oilfield-waste-compliance-in-alberta)

Regulatory context:

- [AER Directive 058](https://www.aer.ca/regulations-and-compliance-enforcement/rules-and-regulations/directives/directive-058)
- [Alberta hazardous-waste transportation](https://www.alberta.ca/hazardous-waste-transportation)
- [Transport Canada shipping-document requirements](https://tc.canada.ca/en/dangerous-goods/publications/shipping-document)
- [Transport Canada electronic shipping documents](https://tc.canada.ca/en/dangerous-goods/electronic-shipping-documents)

Market references:

- [IronSight waste manifests](https://www.ironsight.app/waste-manifests)
- [EnviroApps waste manifesting](https://enviroapps.ca/waste-manifesting.html)
- [Galatea compliance automation](https://galateatech.com/compliance-automation-software)

