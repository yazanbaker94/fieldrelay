import Link from 'next/link';
import { ConsoleShell } from '@/components/fieldrelay/console-shell';
import { StatusLabel } from '@/components/fieldrelay/status-label';

const rows = [
  { id: 'DL-019', shipment: 'FR-2026-0842', destination: 'ERP Demo / OData Adapter', event: 'shipment.completed', attempts: '03', result: 'HTTP 503', state: 'Dead letter', tone: 'danger' as const },
  { id: 'DL-018', shipment: 'FR-2026-0828', destination: 'Generic accounting webhook', event: 'shipment.completed', attempts: '01', result: 'HTTP 200', state: 'Delivered', tone: 'success' as const },
  { id: 'DL-017', shipment: 'FR-2026-0824', destination: 'Generic accounting webhook', event: 'shipment.completed', attempts: '02', result: 'HTTP 429', state: 'Retrying', tone: 'warning' as const },
  { id: 'DL-016', shipment: 'FR-2026-0816', destination: 'ERP Demo / OData Adapter', event: 'shipment.completed', attempts: '01', result: 'HTTP 201', state: 'Delivered', tone: 'success' as const },
];

export default function IntegrationsPage() {
  return (
    <ConsoleShell active="integrations" eyebrow="Outbox / queue / destination" title="Integration delivery" action={<Link className="secondary-button" href="/app/integrations/DL-019">Inspect DL / 019</Link>}>
      <section className="metric-grid delivery-metrics"><article><p>Delivered today</p><strong>47</strong><span>99.2% first attempt</span></article><article><p>Pending</p><strong>02</strong><span>Outbox + queue</span></article><article><p>Retrying</p><strong>01</strong><span>Next attempt in 42 s</span></article><article><p>Dead letter</p><strong>01</strong><span>Manual review required</span></article></section>
      <section className="data-sheet">
        <header className="sheet-tools"><label>⌕ <input aria-label="Search deliveries" placeholder="SEARCH DELIVERY OR SHIPMENT" /></label><div><button>ALL STATES</button><button>ALL DESTINATIONS</button><button>NEWEST FIRST</button></div></header>
        <div className="data-table delivery-table">
          <div className="table-head"><span>Delivery</span><span>Shipment</span><span>Destination</span><span>Event</span><span>Attempts</span><span>Last result</span><span>State</span></div>
          {rows.map((row) => row.id === 'DL-019' ? <Link href={`/app/integrations/${row.id}`} className="table-row" key={row.id}><strong>{row.id}</strong><code>{row.shipment}</code><span>{row.destination}</span><code>{row.event}</code><code>{row.attempts}</code><code>{row.result}</code><StatusLabel tone={row.tone}>{row.state}</StatusLabel></Link> : <div className="table-row is-preview-row" key={row.id} aria-label={`${row.id}, illustrative delivery preview`}><strong>{row.id}</strong><code>{row.shipment}</code><span>{row.destination}</span><code>{row.event}</code><code>{row.attempts}</code><code>{row.result}</code><StatusLabel tone={row.tone}>{row.state}</StatusLabel></div>)}
        </div>
      </section>
      <p className="adapter-note"><strong>Adapter boundary:</strong> generic webhook is the primary delivery model. The OData screen is an illustrative enterprise adapter and does not imply that WiQ uses SAP or OData.</p>
    </ConsoleShell>
  );
}
