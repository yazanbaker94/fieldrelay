import { shipmentEvents } from '@/lib/demo-data';

export function QuantityTrace({ compact = false }: { compact?: boolean }) {
  return (
    <ol className={compact ? 'quantity-trace is-compact' : 'quantity-trace'}>
      {shipmentEvents.filter((event) => ['01', '03', '04'].includes(event.no)).map((event) => (
        <li key={event.id} className={`trace-${event.tone}`}>
          <span className="trace-node">{event.no}</span>
          <div className="trace-main">
            <p>{event.title}</p>
            <strong>{event.quantity}</strong>
            <span>{event.actor} · {event.time}</span>
          </div>
          <div className="trace-meta">
            <code>{event.id}</code>
            <b>{event.meta}</b>
          </div>
        </li>
      ))}
    </ol>
  );
}
