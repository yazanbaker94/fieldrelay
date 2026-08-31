import Link from 'next/link';
import { ConsoleShell } from '@/components/fieldrelay/console-shell';
import { StatusLabel } from '@/components/fieldrelay/status-label';
import { shipments } from '@/lib/demo-data';

export default function ShipmentsPage() {
  return (
    <ConsoleShell active="shipments" eyebrow="128 records / 12 active" title="Shipments" action={<button className="secondary-button">Export demo CSV</button>}>
      <section className="filter-ledger">
        <label>⌕ <input aria-label="Search shipments" placeholder="SHIPMENT, PARTY, OR LOCATION" /></label>
        <button>Lifecycle: all</button><button>Sync: all</button><button>Exception: all</button><button>Destination: all</button><button className="saved-view">View / needs attention · 04</button>
      </section>
      <section className="data-sheet shipment-sheet">
        <div className="data-table shipment-table">
          <div className="table-head"><span>Shipment / material</span><span>Generator</span><span>Receiver</span><span>Lifecycle</span><span>Priority condition</span><span>Last activity</span></div>
          {shipments.map((shipment) => (
            shipment.id === 'FR-2026-0842' ? <Link className="table-row" href={`/app/shipments/${shipment.id}`} key={shipment.id}>
              <span><strong>{shipment.id}</strong><small>{shipment.material}</small></span><span>{shipment.generator}</span><span>{shipment.receiver}</span><StatusLabel tone="blue">{shipment.lifecycle}</StatusLabel><StatusLabel tone={shipment.tone}>{shipment.secondary}</StatusLabel><time>{shipment.time}</time>
            </Link> : <div className="table-row is-preview-row" key={shipment.id} aria-label={`${shipment.id}, illustrative operations preview`}>
              <span><strong>{shipment.id}</strong><small>{shipment.material}</small></span><span>{shipment.generator}</span><span>{shipment.receiver}</span><StatusLabel tone="blue">{shipment.lifecycle}</StatusLabel><StatusLabel tone={shipment.tone}>{shipment.secondary}</StatusLabel><time>{shipment.time}</time>
            </div>
          ))}
        </div>
      </section>
      <div className="table-footer"><span>1–6 of 128</span><div><button disabled>← Previous</button><button>Next →</button></div></div>
    </ConsoleShell>
  );
}
