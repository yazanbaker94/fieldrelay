import Link from 'next/link';
import { ConsoleShell } from '@/components/fieldrelay/console-shell';
import { StatusLabel } from '@/components/fieldrelay/status-label';

const services = [ ['API gateway','Ready','/ready'], ['PostgreSQL','Ready','migration 001'], ['SSE event stream','Ready','live updates'], ['In-process outbox relay','Ready','bounded retries'], ['Delivery simulator','Demo','local only'], ['Demo seed','Ready','append-only runs'] ];

export default function SystemPage() {
  return (
    <ConsoleShell active="system" eyebrow="Runtime evidence / portfolio environment" title="Systems" recordId="BUILD / 0.1.0">
      <div className="system-layout">
        <section className="service-board"><header><p>Demo architecture</p><time>Live availability: /ready</time></header>{services.map(([name,state,detail]) => <div key={name}><strong>{name}</strong><StatusLabel tone={state === 'Demo' ? 'violet' : 'success'}>{state}</StatusLabel><code>{detail}</code></div>)}</section>
        <section className="runtime-evidence"><p>Deployment record</p><dl><div><dt>Version</dt><dd>fieldrelay@0.1.0</dd></div><div><dt>Source</dt><dd>GitHub release provenance</dd></div><div><dt>Target</dt><dd>Shared VPS / isolated Compose</dd></div><div><dt>API schema</dt><dd>OpenAPI 3.1</dd></div><div><dt>Data</dt><dd>Synthetic / append-only runs</dd></div></dl></section>
      </div>
      <section className="relay-architecture"><header><p>Operational path</p><strong>One correlation ID across every boundary</strong></header><div className="architecture-nodes"><article><span>01</span><b>Android</b><small>Offline queue</small></article><i>→</i><article><span>02</span><b>Node API</b><small>Idempotency</small></article><i>→</i><article><span>03</span><b>PostgreSQL</b><small>Mutation + outbox</small></article><i>→</i><article><span>04</span><b>Delivery relay</b><small>API-hosted demo path</small></article><i>→</i><article><span>05</span><b>Destination</b><small>Simulator / adapter</small></article></div></section>
      <section className="recent-errors"><header className="panel-head"><div><p>Structured logs</p><h2>Recent errors</h2></div><Link href="/app/integrations/DL-019">Open delivery →</Link></header><pre>2026-08-31T14:36:11.128-06:00  ERROR  delivery_failed  delivery=DL-019 status=503 attempt=3 correlation=corr_fr0842_b17e{`\n`}2026-08-31T14:37:12.201-06:00  WARN   dead_lettered   delivery=DL-019 queue=integration-delivery-dlq</pre></section>
    </ConsoleShell>
  );
}
