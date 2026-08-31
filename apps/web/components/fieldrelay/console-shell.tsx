import type { ReactNode } from 'react';
import { RelayMark } from './relay-mark';

const sections = [
  { no: '01', label: 'Overview', href: '/app/overview', key: 'overview' },
  { no: '02', label: 'Shipments', href: '/app/shipments', key: 'shipments' },
  { no: '03', label: 'Exceptions', href: '/app/exceptions', key: 'exceptions', count: '3' },
  { no: '04', label: 'Delivery', href: '/app/integrations', key: 'integrations', count: '1' },
  { no: '05', label: 'Audit', href: '/app/audit', key: 'audit' },
  { no: '06', label: 'Systems', href: '/app/system', key: 'system' },
];

export function ConsoleShell({
  active,
  eyebrow,
  title,
  recordId,
  children,
  action,
}: {
  active: string;
  eyebrow: string;
  title: string;
  recordId?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <main className="console-frame">
      <aside className="console-sidebar">
        <a className="console-brand" href="/" aria-label="FieldRelay public site">
          <RelayMark compact />
          <strong>F/R</strong>
        </a>
        <nav aria-label="Operations console">
          {sections.map((section) => (
            <a key={section.key} href={section.href} className={active === section.key ? 'is-active' : undefined}>
              <span>{section.no}</span>
              <b>{section.label}</b>
              {section.count && <i>{section.count}</i>}
            </a>
          ))}
        </nav>
        <div className="demo-console-block">
          <p><i /> Demo mode</p>
          <strong>Jordan Patel</strong>
          <span>Operations</span>
          <a href="/demo">Relay trace ↗</a>
        </div>
      </aside>

      <section className="console-workspace">
        <header className="console-topbar">
          <div className="connection-state"><i /> Connected <span>·</span> API 42 ms</div>
          <label className="console-search">
            <span>⌕</span>
            <input aria-label="Search shipments, events, and people" placeholder="SEARCH SHIPMENTS, EVENTS, PEOPLE" />
            <kbd>⌘ K</kbd>
          </label>
          <a className="guided-control" href="/demo">Run guided demo</a>
        </header>

        <div className="console-titlebar">
          <div>
            <p>{eyebrow}</p>
            <h1>{title}</h1>
          </div>
          {recordId && <code>{recordId}</code>}
          {action && <div className="title-action">{action}</div>}
        </div>
        <div className="console-content">{children}</div>
      </section>
    </main>
  );
}
