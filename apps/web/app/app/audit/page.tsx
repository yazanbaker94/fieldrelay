import { ConsoleShell } from '@/components/fieldrelay/console-shell';
import { auditEvents } from '@/lib/demo-data';

export default function AuditPage() {
  return (
    <ConsoleShell active="audit" eyebrow="Immutable operational history" title="Audit history" recordId="EV / TRACE">
      <section className="filter-ledger audit-filters"><label>⌕ <input aria-label="Search audit history" defaultValue="corr_fr0842_b17e" /></label><button>Actor: all</button><button>Event: all</button><button>Source: all</button><button>31 Aug 2026</button></section>
      <section className="audit-chain">
        <header><span>Time / MDT</span><span>Actor</span><span>Event / entity</span><span>Source</span><span>Result</span><span>Correlation</span></header>
        {auditEvents.map((event, index) => <article key={`${event.time}-${event.event}`}><time>{event.time}</time><span>{event.actor}</span><div><strong>{event.event}</strong><code>{event.entity}</code></div><span>{event.source}</span><b>{event.result}</b><code>{event.correlation}</code><i aria-hidden="true">{String(auditEvents.length - index).padStart(2, '0')}</i></article>)}
        <footer><span>Chain integrity</span><strong>08 / 08 event hashes verified</strong><code>sha256:a414…b17e</code></footer>
      </section>
    </ConsoleShell>
  );
}
