import Link from 'next/link';
import { ConsoleShell } from '@/components/fieldrelay/console-shell';
import { StatusLabel } from '@/components/fieldrelay/status-label';
import { exceptions } from '@/lib/demo-data';

export default function ExceptionsPage() {
  return (
    <ConsoleShell active="exceptions" eyebrow="Operational exception queue" title="Exceptions" action={<Link className="secondary-button" href="/app/exceptions/EX-0037">Open priority record</Link>}>
      <section className="queue-summary">
        <div><span>Open</span><strong>03</strong></div><div><span>Needs review</span><strong>01</strong></div><div><span>Resolved today</span><strong>07</strong></div><p>Priority is calculated from age, lifecycle impact, and whether human evidence is required.</p>
      </section>
      <section className="data-sheet">
        <header className="sheet-tools"><label>⌕ <input aria-label="Search exceptions" placeholder="SEARCH EXCEPTION OR SHIPMENT" /></label><div><button>OPEN</button><button>ALL TYPES</button><button>OLDEST FIRST</button></div></header>
        <div className="data-table exception-table">
          <div className="table-head"><span>Severity</span><span>Record</span><span>Exception</span><span>Reported variance</span><span>Owner</span><span>Age</span><span>Status</span></div>
          {exceptions.map((exception) => (
            exception.id === 'EX-0037' ? <Link href={`/app/exceptions/${exception.id}`} className="table-row" key={exception.id}>
              <StatusLabel tone={exception.tone}>{exception.tone === 'danger' ? 'High' : 'Review'}</StatusLabel>
              <span><strong>{exception.id}</strong><small>{exception.shipment}</small></span>
              <span>{exception.type}</span><code>{exception.variance}</code><span>{exception.owner}</span><time>{exception.age}</time><StatusLabel tone={exception.tone}>{exception.state}</StatusLabel>
            </Link> : <div className="table-row is-preview-row" key={exception.id} aria-label={`${exception.id}, illustrative queue preview`}>
              <StatusLabel tone={exception.tone}>{exception.tone === 'danger' ? 'High' : 'Review'}</StatusLabel>
              <span><strong>{exception.id}</strong><small>{exception.shipment}</small></span>
              <span>{exception.type}</span><code>{exception.variance}</code><span>{exception.owner}</span><time>{exception.age}</time><StatusLabel tone={exception.tone}>{exception.state}</StatusLabel>
            </div>
          ))}
        </div>
      </section>
    </ConsoleShell>
  );
}
