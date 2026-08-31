import Link from 'next/link';
import { ConsoleShell } from '@/components/fieldrelay/console-shell';
import { StatusLabel } from '@/components/fieldrelay/status-label';
import { demoShipment, shipmentEvents } from '@/lib/demo-data';
import { notFound } from 'next/navigation';

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ shipmentId: string }>;
}) {
  const { shipmentId } = await params;
  if (shipmentId !== demoShipment.id) notFound();
  return (
    <ConsoleShell active="shipments" eyebrow="Shipment record" title={shipmentId} recordId={shipmentId.replaceAll('-', ' / ')}>
      <section className="state-dimensions" aria-label="Independent shipment statuses">
        <div><span>Lifecycle</span><StatusLabel tone="blue">Received</StatusLabel></div><div><span>Device sync</span><StatusLabel tone="success">Synced</StatusLabel></div><div><span>Exception</span><StatusLabel tone="warning">Discrepancy open</StatusLabel></div><div><span>Delivery</span><StatusLabel>Not started</StatusLabel></div>
      </section>
      <div className="shipment-detail-grid">
        <section className="record-sheet">
          <header><p>Manifest summary</p><code>VERSION / 08</code></header>
          <div className="route-line"><div><span>Generator / source</span><strong>{demoShipment.generator}</strong><p>{demoShipment.source}</p></div><i>→</i><div><span>Receiver / destination</span><strong>{demoShipment.receiver}</strong><p>{demoShipment.destination}</p></div></div>
          <div className="material-record"><span>Material profile · synthetic training data</span><h2>{demoShipment.material}</h2><dl><div><dt>UN number</dt><dd>{demoShipment.unNumber}</dd></div><div><dt>Classification</dt><dd>{demoShipment.classification}</dd></div><div><dt>Carrier</dt><dd>{demoShipment.carrier}</dd></div><div><dt>Driver</dt><dd>{demoShipment.driver}</dd></div></dl></div>
          <div className="quantity-comparison"><div><span>Offered</span><strong>8,200 L</strong></div><div><span>Pickup</span><strong>8,180 L</strong><small>−20 / −0.24%</small></div><div className="is-warning"><span>Received</span><strong>7,940 L</strong><small>−240 / −2.93%</small></div></div>
        </section>
        <aside className="blocker-sheet"><p>Current blocker</p><StatusLabel tone="warning">EX / 0037 open</StatusLabel><h2>Completion waits for an accepted final quantity.</h2><Link href="/app/exceptions/EX-0037">Open exception workbench →</Link><dl><div><dt>Correlation</dt><dd>{demoShipment.correlationId}</dd></div><div><dt>Current responsibility</dt><dd>Operations</dd></div><div><dt>Last report</dt><dd>Priya Shah · 14:08 MDT</dd></div></dl></aside>
      </div>
      <section className="timeline-sheet">
        <header className="panel-head"><div><p>Append-only evidence</p><h2>Shipment timeline</h2></div><span>Every correction is another event</span></header>
        <ol>{shipmentEvents.map((event) => <li key={event.id}><span>{event.no}</span><time>{event.time}</time><div><strong>{event.title}</strong><p>{event.actor} · {event.meta}</p></div><b>{event.quantity}</b><code>{event.id}</code></li>)}</ol>
      </section>
      <section className="sync-proof"><div><span>Client operation</span><code>op_01J6FR84</code></div><div><span>First attempt</span><strong>Response lost</strong></div><div><span>Result check</span><strong>Original result returned</strong></div><div><span>Server mutations</span><strong>01 · no duplicate</strong></div></section>
    </ConsoleShell>
  );
}
