import { ConsoleShell } from '@/components/fieldrelay/console-shell';
import { StatusLabel } from '@/components/fieldrelay/status-label';

const services = [ ['API gateway','Healthy','42 ms'], ['PostgreSQL','Healthy','12 ms'], ['SSE event stream','Connected','4 clients'], ['Outbox worker','Healthy','1 pending'], ['Delivery adapter','Degraded','1 DLQ'], ['Demo reset','Scheduled','02:00 MDT'] ];

export default function SystemPage() {
  return (
    <ConsoleShell active="system" eyebrow="Runtime evidence / portfolio environment" title="Systems" recordId="BUILD / LOCAL">
      <div className="system-layout">
        <section className="service-board"><header><p>Service health</p><time>Observed 14:42:10 MDT</time></header>{services.map(([name,state,detail]) => <div key={name}><strong>{name}</strong><StatusLabel tone={state === 'Degraded' ? 'warning' : state === 'Scheduled' ? 'violet' : 'success'}>{state}</StatusLabel><code>{detail}</code></div>)}</section>
        <section className="runtime-evidence"><p>Deployment record</p><dl><div><dt>Version</dt><dd>fieldrelay@0.1.0</dd></div><div><dt>Commit</dt><dd>local-development</dd></div><div><dt>Region</dt><dd>VPS / pending deployment</dd></div><div><dt>API schema</dt><dd>OpenAPI 3.1</dd></div><div><dt>Data</dt><dd>Synthetic / resettable</dd></div></dl></section>
      </div>
      <section className="relay-architecture"><header><p>Operational path</p><strong>One correlation ID across every boundary</strong></header><div className="architecture-nodes"><article><span>01</span><b>Android</b><small>Offline queue</small></article><i>→</i><article><span>02</span><b>Node API</b><small>Idempotency</small></article><i>→</i><article><span>03</span><b>PostgreSQL</b><small>Mutation + outbox</small></article><i>→</i><article><span>04</span><b>Worker</b><small>Retry + DLQ</small></article><i>→</i><article><span>05</span><b>Destination</b><small>Webhook / adapter</small></article></div></section>
      <section className="recent-errors"><header className="panel-head"><div><p>Structured logs</p><h2>Recent errors</h2></div><a href="/app/integrations/DL-019">Open delivery →</a></header><pre>2026-08-31T14:36:11.128-06:00  ERROR  delivery_failed  delivery=DL-019 status=503 attempt=3 correlation=corr_fr0842_b17e{`\n`}2026-08-31T14:37:12.201-06:00  WARN   dead_lettered   delivery=DL-019 queue=integration-delivery-dlq</pre></section>
    </ConsoleShell>
  );
}
