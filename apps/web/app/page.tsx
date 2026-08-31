import Image from 'next/image';
import Link from 'next/link';
import { TechnologyRail } from '@/components/fieldrelay/technology-rail';

const lifecycle = [
  { number: '01', label: 'Created offline', meta: '09:12 · EV / 0347' },
  { number: '02', label: 'Offered', value: '8,200 L', meta: 'Generator record' },
  { number: '03', label: 'Picked up', value: '8,180 L', meta: '−20 L / −0.24%' },
  {
    number: '04',
    label: 'Received',
    value: '7,940 L',
    meta: '−240 L / −2.93%',
    status: 'Discrepancy open',
    tone: 'warning',
  },
  { number: '05', label: 'Resolved', meta: 'Accepted final · 7,940 L', tone: 'success' },
  { number: '06', label: 'Delivered', value: '200 OK', meta: 'Replay · attempt 04', tone: 'success' },
];

const chapters = [
  { number: '01', title: 'Field', copy: 'Capture the first record without a signal.' },
  { number: '02', title: 'Handoff', copy: 'Carry identity and evidence across teams.' },
  { number: '03', title: 'Exception', copy: 'Keep every report; resolve the difference.' },
  { number: '04', title: 'Recovery', copy: 'Replay with one stable destination key.' },
];

function RelayMark() {
  return (
    <svg aria-hidden="true" className="relay-mark" viewBox="0 0 52 24" fill="none">
      <path d="M2 12h48" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="4" cy="12" r="3" fill="currentColor" />
      <circle cx="18" cy="12" r="3" fill="#07121B" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="34" cy="12" r="3" fill="#07121B" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="48" cy="12" r="3" fill="currentColor" />
    </svg>
  );
}

export default function Home() {
  return (
    <main className="site-shell">
      <header className="utility-nav">
        <Link className="wordmark" href="#top" aria-label="FieldRelay home">
          <RelayMark />
          <span>FIELDRELAY</span>
        </Link>

        <nav className="desktop-nav" aria-label="Primary navigation">
          <Link href="#product">Product</Link>
          <Link href="#how-it-works">How it works</Link>
          <Link href="#architecture">Architecture</Link>
          <Link href="#decisions">Technical decisions</Link>
          <a href="https://github.com/yazanbaker94/fieldrelay" target="_blank" rel="noreferrer">GitHub</a>
        </nav>

        <Link className="nav-demo" href="/demo">
          Run demo <span aria-hidden="true">↗</span>
        </Link>
      </header>

      <section className="hero" id="top">
        <aside className="record-gutter" aria-label="Shipment record FR 2026 0842">
          <span>FR</span><i>/</i><span>2026</span><i>/</i><span>0842</span>
        </aside>

        <div className="hero-copy">
          <p className="eyebrow"><span>Independent technical prototype</span><b>01 — 06</b></p>
          <h1>
            <span>One shipment.</span>
            <span>Every handoff.</span>
            <span className="blue-line">Nothing disappears.</span>
          </h1>
          <p className="hero-summary">
            Created offline. Passed across teams.<br />
            Exceptions resolved. Integrations recovered.<br />
            The full story is always here.
          </p>
          <div className="hero-actions">
            <Link className="primary-action" href="/demo">Run the 90-second demo</Link>
            <Link className="text-action" href="#walkthrough">Watch walkthrough <span aria-hidden="true">→</span></Link>
          </div>
          <dl className="proof-row" aria-label="System guarantees">
            <div><dt>Capture</dt><dd>Offline-first</dd></div>
            <div><dt>Evidence</dt><dd>Append-only</dd></div>
            <div><dt>Delivery</dt><dd>Idempotent</dd></div>
          </dl>
        </div>

        <div className="shipment-ledger" aria-label="Shipment FR-2026-0842 lifecycle">
          <div className="ledger-heading">
            <div>
              <p>Shipment lifecycle</p>
              <strong>FR-2026-0842</strong>
            </div>
            <span className="trace-state"><i /> Trace complete</span>
          </div>
          <ol className="event-rail">
            {lifecycle.map((event) => (
              <li key={event.number} className={event.tone ? `event-${event.tone}` : undefined}>
                <span className="event-node">{event.number}</span>
                <div className="event-copy">
                  <div className="event-topline">
                    <strong>{event.label}</strong>
                    {event.value && <b>{event.value}</b>}
                  </div>
                  <p>{event.meta}</p>
                  {event.status && <mark>{event.status}</mark>}
                </div>
              </li>
            ))}
          </ol>
          <div className="ledger-foot">
            <span>Correlation</span>
            <code>corr_fr0842_b17e</code>
          </div>
        </div>
      </section>

      <figure className="industrial-strip" aria-label="A tanker moving through an industrial route">
        <Image src="/assets/editorial/industrial-tanker-route-primary.png" alt="Tanker truck travelling past a refinery at dusk" width={2172} height={724} priority />
      </figure>

      <section className="chapter-rail" id="product" aria-label="FieldRelay shipment story">
        <p className="chapter-kicker">One record, four operating conditions</p>
        <div className="chapter-grid">
          {chapters.map((chapter) => (
            <article key={chapter.number}>
              <span>{chapter.number} /</span>
              <h2>{chapter.title}</h2>
              <p>{chapter.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="failure-register" id="how-it-works">
        <header>
          <p>Failure-first engineering / operating register</p>
          <h2>Designed around what happens<br />when the happy path breaks.</h2>
        </header>
        <div className="failure-rows">
          <article><span>F-01</span><h3>Connectivity disappears</h3><p>Persist the operation, explain what happens next, and synchronize after restart.</p><code>SAVED_ON_DEVICE → WAITING</code></article>
          <article><span>F-02</span><h3>The response is lost</h3><p>Check with the same idempotency key and return the original server result.</p><code>01 MUTATION / 02 ATTEMPTS</code></article>
          <article><span>F-03</span><h3>Quantities disagree</h3><p>Accept every reported event, preserve the evidence, and open a reviewable exception.</p><code>−240 L / −2.93%</code></article>
          <article><span>F-04</span><h3>The destination fails</h3><p>Expose attempts, backoff, dead-letter state, and safe manual replay.</p><code>503 → DLQ → 200 OK</code></article>
          <article><span>F-05</span><h3>Support reconstructs it</h3><p>Link device, API, database, queue, and destination events by one correlation ID.</p><code>corr_fr0842_b17e</code></article>
        </div>
      </section>

      <section className="mobile-proof-section">
        <div className="proof-copy"><p>01 / Field</p><h2>Field work that remains trustworthy offline.</h2><p>The Android client makes local safety visible. Every pending action has a human description, a saved time, and a clear next step; technical identifiers stay available without becoming the interface.</p><Link href="/download/android">Get the Android APK →</Link></div>
        <div className="mobile-ledger-preview" aria-label="FieldRelay Android offline home preview">
          <header><span>FIELDRELAY</span><code>09:14</code></header>
          <div className="mobile-preview-title"><div><p>Maya Chen / Generator</p><h3>Offline</h3></div><span>2</span></div>
          <aside><strong>2 actions saved on this device</strong><p>Will sync automatically when connectivity returns.</p></aside>
          <button>+ Create shipment</button>
          <p className="preview-label">Needs your action</p>
          <article><div><strong>FR-2026-0842</strong><small>Demo Solvent Mixture</small></div><span>Offered</span><b>Saved on device</b></article>
          <article><div><strong>FR-2026-0837</strong><small>Separator Sludge</small></div><span>Draft</span><b>Waiting</b></article>
          <footer><b>Home</b><span>Create</span><span>Shipments</span><span>Sync · 2</span></footer>
        </div>
      </section>

      <section className="operations-proof-section">
        <header><p>03 / Exception</p><h2>Exceptions become workflows,<br />not phone calls.</h2><Link href="/app/exceptions/EX-0037">Open workbench ↗</Link></header>
        <div className="immutable-preview">
          <div className="immutable-heading"><span>EX / 0037</span><strong>Immutable quantity evidence</strong><b>Discrepancy open</b></div>
          <ol><li><span>01</span><p>Generator offer<small>Maya Chen · 09:12 · EV-0347</small></p><strong>8,200 L</strong></li><li><span>02</span><p>Driver pickup<small>Marcus Lee · 10:03</small></p><strong>8,180 L</strong></li><li className="is-warning"><span>03</span><p>Receiver<small>Priya Shah · 14:08</small></p><strong>7,940 L<small>−240 / −2.93%</small></strong></li></ol>
          <footer><strong>Threshold exceeded</strong><span>Difference exceeds both 100 L and 1%.</span><code>Original reports remain unchanged.</code></footer>
        </div>
      </section>

      <section className="integration-story" id="walkthrough">
        <div className="proof-copy"><p>04 / Recovery</p><h2>External delivery you can observe and recover.</h2><p>Completion creates a transactional outbox record. Delivery attempts remain inspectable through backoff, dead-lettering, and manual replay with one stable destination idempotency key.</p><Link href="/app/integrations/DL-019">Inspect DL / 019 →</Link></div>
        <ol className="homepage-attempts"><li><time>14:33:02</time><span>Attempt 1</span><b>503</b></li><li><time>14:34:05</time><span>Attempt 2</span><b>503</b></li><li><time>14:36:11</time><span>Attempt 3</span><b>503</b></li><li className="is-dlq"><time>14:37:12</time><span>Moved to DLQ</span><b>Review</b></li><li className="is-replay"><time>14:41:28</time><span>Manual replay</span><b>04</b></li><li className="is-success"><time>14:41:29</time><span>Attempt 4</span><b>200 OK</b></li></ol>
      </section>

      <section className="homepage-architecture" id="architecture">
        <div><p>One domain model / every boundary</p><h2>Mobile, web, database, and delivery speak in events.</h2></div>
        <ol><li><span>01</span><strong>Android</strong><small>Offline operations</small></li><li><i>→</i></li><li><span>02</span><strong>Node API</strong><small>Rules + idempotency</small></li><li><i>→</i></li><li><span>03</span><strong>PostgreSQL</strong><small>Audit + outbox</small></li><li><i>→</i></li><li><span>04</span><strong>Delivery</strong><small>Retry + DLQ</small></li></ol>
        <Link href="/architecture">Read the architecture →</Link>
      </section>
      <TechnologyRail />

      <section className="ownership-section" id="decisions">
        <aside><span>WHY / BUILT / 01</span></aside>
        <div><p>Built for one real Calgary software role</p><h2>Product ownership,<br />not just UI implementation.</h2><p>I built FieldRelay after studying public industrial field workflows and the reliability risks around low-connectivity, multi-party records. It combines my React and Node.js work with offline synchronization, production troubleshooting, AWS queue concepts, and enterprise API integration.</p><div><Link href="/docs">Technical decisions</Link><a href="https://github.com/yazanbaker94/fieldrelay" target="_blank" rel="noreferrer">View source ↗</a></div></div>
      </section>

      <section className="final-demo-cta">
        <p>FR / GUIDED / 90 SEC</p><h2>See the complete failure-and-recovery flow.</h2><div><Link href="/demo">Start guided demo</Link><Link href="/app/overview">Explore operations →</Link></div>
      </section>

      <footer className="prototype-note">
        <span>FR / PROTOTYPE / 2026</span>
        <p>Independent portfolio prototype using synthetic data and illustrative rules. Not affiliated with WiQ and not intended for production or regulatory use.</p>
      </footer>
    </main>
  );
}
