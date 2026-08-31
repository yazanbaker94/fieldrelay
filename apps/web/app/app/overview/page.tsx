import Link from 'next/link';
import { ConsoleShell } from '@/components/fieldrelay/console-shell';
import { LiveApiProof } from '@/components/fieldrelay/live-api-proof';
import { StatusLabel } from '@/components/fieldrelay/status-label';
import { shipments } from '@/lib/demo-data';

export default function OverviewPage() {
  return (
    <ConsoleShell active="overview" eyebrow="Live operations / 31 Aug 2026 / MDT" title="Operations overview">
      <section className="metric-grid" aria-label="Operational summary">
        <article><p>On device</p><strong>02</strong><span>Safe · awaiting connection</span></article>
        <article><p>Needs attention</p><strong>03</strong><span>2 discrepancies · 1 conflict</span></article>
        <article><p>Delivery failures</p><strong>01</strong><span>DL / 019 in dead letter</span></article>
        <article><p>All shipments</p><strong>128</strong><span>12 active today</span></article>
      </section>

      <div className="work-grid">
        <section className="work-panel">
          <header className="panel-head">
            <div><p>Queue / priority ordered</p><h2>Needs attention</h2></div>
            <Link href="/app/exceptions">Open queue →</Link>
          </header>
          <ul className="operational-list">
            <li>
              <div><strong>FR-2026-0842</strong><p>Quantity discrepancy</p></div>
              <StatusLabel tone="warning">−240 L / −2.93%</StatusLabel>
              <time>2 min</time>
            </li>
            <li>
              <div><strong>FR-2026-0834</strong><p>External delivery failed</p></div>
              <StatusLabel tone="danger">HTTP 503 · DLQ</StatusLabel>
              <time>31 min</time>
            </li>
            <li>
              <div><strong>FR-2026-0831</strong><p>Offline version conflict</p></div>
              <StatusLabel tone="danger">Needs review</StatusLabel>
              <time>42 min</time>
            </li>
          </ul>
        </section>

        <section className="work-panel">
          <header className="panel-head"><div><p>Runtime</p><h2>System relay</h2></div><Link href="/app/system">Inspect →</Link></header>
          <div className="system-rows">
            <LiveApiProof />
            <div><span>API</span><StatusLabel tone="success">Healthy</StatusLabel></div>
            <div><span>PostgreSQL</span><code>12 ms</code></div>
            <div><span>Event stream</span><StatusLabel tone="success">Connected</StatusLabel></div>
            <div><span>Outbox pending</span><code>01 record</code></div>
            <div><span>Dead-letter queue</span><StatusLabel tone="danger">01 item</StatusLabel></div>
          </div>
        </section>
      </div>

      <section className="work-panel activity-panel">
        <header className="panel-head"><div><p>Append-only stream</p><h2>Recent shipment activity</h2></div><Link href="/app/audit">Full audit →</Link></header>
        <ul className="activity-ledger">
          {shipments.slice(0, 5).map((shipment, index) => (
            <li key={shipment.id}>
              <span className="activity-no">{String(index + 1).padStart(2, '0')}</span>
              <div><strong>{shipment.id}</strong><p>{shipment.material}</p></div>
              <b>{shipment.lifecycle}</b>
              <StatusLabel tone={shipment.tone}>{shipment.secondary}</StatusLabel>
              <time>{shipment.time}</time>
            </li>
          ))}
        </ul>
      </section>
      <div className="trace-footer"><span>Showing synthetic portfolio data · timezone America/Edmonton</span><code>relay: corr_fr0842_b17e</code></div>
    </ConsoleShell>
  );
}
