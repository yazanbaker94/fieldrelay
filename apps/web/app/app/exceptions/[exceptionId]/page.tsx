import { ConsoleShell } from '@/components/fieldrelay/console-shell';
import { ExceptionResolution } from '@/components/fieldrelay/exception-resolution';
import { QuantityTrace } from '@/components/fieldrelay/quantity-trace';
import { StatusLabel } from '@/components/fieldrelay/status-label';
import { notFound } from 'next/navigation';

export default async function ExceptionWorkbenchPage({
  params,
}: {
  params: Promise<{ exceptionId: string }>;
}) {
  const { exceptionId } = await params;
  if (!/^EX-0037(?:-[A-Za-z0-9-]+)?$/.test(exceptionId)) notFound();
  const recordLabel = exceptionId.replaceAll('-', ' / ');
  return (
    <ConsoleShell active="exceptions" eyebrow="Exception workbench" title={exceptionId === 'EX-0037' ? 'FR-2026-0842' : 'Isolated demo run'} recordId={recordLabel}>
      <div className="exception-statebar"><StatusLabel tone="warning">Discrepancy open</StatusLabel><span>Opened 14:08 MDT · 2 minutes ago</span><span>Owner · Operations</span><code>corr_fr0842_b17e</code></div>
      <div className="workbench-layout">
        <section className="evidence-workbench">
          <header><div><p>Immutable evidence</p><h2>Three reports. One visible difference.</h2></div><span>Quantity · Litres</span></header>
          <QuantityTrace />
          <aside className="threshold-note">
            <span>!</span><div><strong>Threshold exceeded</strong><p>Difference exceeds both 100 L and 1%.</p></div><code>abs(7,940 − 8,180) = 240<br />240 / 8,180 = 2.93%</code>
          </aside>
          <div className="evidence-context"><div><span>Route</span><strong>Alder Creek 14 → Copper Ridge 02</strong></div><div><span>Material</span><strong>Demo Solvent Mixture · training data</strong></div><div><span>Lifecycle</span><strong>Received · completion blocked</strong></div></div>
        </section>
        <ExceptionResolution exceptionId={exceptionId} />
      </div>
    </ConsoleShell>
  );
}
