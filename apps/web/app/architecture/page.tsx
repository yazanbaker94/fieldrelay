import Image from 'next/image';
import Link from 'next/link';
import { PrototypeDisclaimer, PublicHeader } from '@/components/fieldrelay/public-header';
import { TechnologyRail } from '@/components/fieldrelay/technology-rail';

const decisions = [
  ['01', 'Separate state dimensions', 'Lifecycle, device synchronization, business exception, and destination delivery never collapse into one ambiguous status.'],
  ['02', 'Local operation queue', 'Every offline write carries an idempotency key, base entity version, and device timestamp.'],
  ['03', 'Append-only evidence', 'Source reports remain immutable. Corrections and resolutions create new events linked by correlation ID.'],
  ['04', 'Transactional outbox', 'Completion and delivery creation commit together, removing the gap between database state and message publication.'],
  ['05', 'Recoverable delivery', 'Visible retries, dead-lettering, and manual replay retain one destination idempotency key.'],
  ['06', 'Adapter boundary', 'The core emits a generic completion event; webhook and illustrative OData adapters translate at the edge.'],
];

export default function ArchitecturePage() {
  return (
    <main className="public-inner">
      <PublicHeader />
      <section className="architecture-hero">
        <aside>AR<br />/<br />01</aside><div><p>Technical architecture / evidence-led</p><h1>Reliability lives<br />between the screens.</h1><p>FieldRelay treats offline writes, conflicting reports, and destination failures as domain records that can be inspected and recovered—not incidental errors.</p></div>
      </section>
      <section className="architecture-map" aria-label="FieldRelay system architecture">
        <div className="arch-lane"><span>Field boundary</span><article><b>React Native Android</b><small>SQLite / operation queue</small><code>op_01J6FR84</code></article><i>sync + same key →</i><article><b>Node TypeScript API</b><small>Rules / idempotency / SSE</small><code>corr_fr0842_b17e</code></article></div>
        <div className="arch-lane"><span>Persistence boundary</span><article><b>PostgreSQL transaction</b><small>Domain mutation + audit + outbox</small><code>shipment.version = 08</code></article><i>commit once →</i><article><b>Outbox relay</b><small>Publish / retry / observe</small><code>OB / 0019</code></article></div>
        <div className="arch-lane"><span>Delivery boundary</span><article><b>Queue + dead letter</b><small>Backoff / DLQ / manual replay</small><code>DL / 019</code></article><i>stable key →</i><article><b>Destination adapter</b><small>Generic webhook / OData example</small><code>dest_fr0842_completed_v1</code></article></div>
      </section>
      <figure className="architecture-image"><Image src="/assets/editorial/industrial-refinery-secondary.png" alt="Industrial refinery pipework" width={2172} height={724} /></figure>
      <section className="decision-ledger" id="decisions"><header><p>Six implementation decisions</p><h2>Failure paths are part of the product.</h2></header>{decisions.map(([no,title,copy]) => <article key={no}><span>{no}</span><h3>{title}</h3><p>{copy}</p></article>)}</section>
      <section className="production-deltas"><div><p>Prototype boundary</p><h2>What changes before production.</h2></div><ul><li>Managed PostgreSQL, secrets manager, and environment-isolated keys.</li><li>Authenticated tenancy and short-lived signed handoff tokens.</li><li>Real SQS/DLQ metrics, alarms, and incident ownership.</li><li>Jurisdiction-approved rules owned by qualified domain specialists.</li><li>Encrypted device database, remote revocation, and mobile threat review.</li><li>Load, chaos, accessibility, and recovery-time testing.</li></ul></section>
      <TechnologyRail />
      <section className="architecture-cta"><p>FR / TECHNICAL / TRACE</p><h2>See the architecture fail safely.</h2><div><Link href="/demo">Run guided demo</Link><Link href="/docs">Read technical decisions →</Link></div></section>
      <PrototypeDisclaimer />
    </main>
  );
}
