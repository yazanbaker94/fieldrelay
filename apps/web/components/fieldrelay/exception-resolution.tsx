'use client';

import { useRef, useState } from 'react';
import {
  createDemoRun,
  FieldRelayApiError,
  getDemoRun,
  newActionKey,
  resolveDemoException,
  type DemoRunSnapshot,
  type ExceptionResolutionInput,
} from '@/lib/fieldrelay-api';

interface PendingResolution {
  actionKey: string;
  input: ExceptionResolutionInput;
}

function textField(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

function runIdFor(exceptionId: string): string | null {
  const match = /^EX-0037-(.+)$/.exec(exceptionId);
  return match?.[1] ?? null;
}

export function ExceptionResolution({ exceptionId }: { exceptionId: string }) {
  const [resolved, setResolved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [snapshot, setSnapshot] = useState<DemoRunSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runActionKey, setRunActionKey] = useState(() => newActionKey('workbench-run'));
  const pendingResolution = useRef<PendingResolution | null>(null);
  const canonicalPreview = exceptionId === 'EX-0037';

  const targetRun = async () => {
    if (canonicalPreview) return createDemoRun(runActionKey);
    const runId = runIdFor(exceptionId);
    if (!runId) throw new Error(`${exceptionId} is an illustrative queue row, not a live API record.`);
    return getDemoRun(runId);
  };

  const resolve = async (formElement: HTMLFormElement) => {
    setSubmitting(true);
    setError(null);

    if (!pendingResolution.current) {
      const form = new FormData(formElement);
      pendingResolution.current = {
        actionKey: newActionKey('resolve-exception'),
        input: {
          category: textField(form, 'category') as ExceptionResolutionInput['category'],
          acceptedFinalQuantityLiters: Number(form.get('quantity')),
          reason: textField(form, 'reason'),
          note: textField(form, 'note'),
        },
      };
    }

    try {
      const run = await targetRun();
      const pending = pendingResolution.current;
      const next = await resolveDemoException(run, pending.input, pending.actionKey);
      setSnapshot(next);
      setResolved(true);
    } catch (cause) {
      if (cause instanceof FieldRelayApiError && cause.status < 500 && cause.status !== 408) {
        pendingResolution.current = null;
      }
      setError(cause instanceof Error ? cause.message : 'The live demo API could not commit this resolution.');
    } finally {
      setSubmitting(false);
    }
  };

  const restart = () => {
    setResolved(false);
    setSnapshot(null);
    setError(null);
    pendingResolution.current = null;
    setRunActionKey(newActionKey('workbench-run'));
  };

  if (resolved) {
    return (
      <output className="resolution-complete">
        <span>05</span>
        <p>Resolution appended</p>
        <strong>Accepted final quantity<br />{snapshot?.shipment.acceptedFinalQuantityLiters?.toLocaleString('en-CA')} L</strong>
        <div><i /> {snapshot?.resources.exceptionId ?? 'Exception'} resolved</div>
        <div><i /> Shipment completed</div>
        <div><i /> {snapshot?.resources.deliveryId ?? 'Delivery'} created in outbox</div>
        <small>Committed by the live domain API in isolated run {snapshot?.runId}</small>
        <button type="button" onClick={restart}>Create another isolated run</button>
      </output>
    );
  }

  return (
    <form className="resolution-form" onSubmit={(event) => { event.preventDefault(); void resolve(event.currentTarget); }}>
      <div className="resolution-heading"><span>Resolution</span><code>NEW / EVENT</code></div>
      {canonicalPreview && <aside><strong>Read-only baseline.</strong><span>Submitting creates and resolves an isolated copy; the shared record stays unchanged.</span></aside>}
      <label>
        Resolution category
        <select name="category" defaultValue="RECEIVER_QUANTITY_VERIFIED"><option value="RECEIVER_QUANTITY_VERIFIED">Receiver quantity verified</option><option value="MEASUREMENT_ADJUSTED">Measurement adjustment</option><option value="DOCUMENTATION_CORRECTED">Documentation correction</option></select>
      </label>
      <label>
        Accepted final quantity
        <span className="unit-input"><input name="quantity" inputMode="decimal" type="number" min="0" step="0.01" defaultValue="7940" required /><b>L</b></span>
      </label>
      <label>
        Reason
        <select name="reason" defaultValue="Receiver scale record accepted"><option>Receiver scale record accepted</option><option>Field review completed</option><option>Documentation corrected</option></select>
      </label>
      <label>
        Internal note
        <textarea name="note" defaultValue="Receiver scale ticket verified against offload record. Accepting the reported final quantity while preserving all source reports." rows={5} required />
      </label>
      <aside><strong>Original reports are immutable.</strong><span>Resolution creates a new accepted quantity.</span></aside>
      {error && <output className="form-error">Live commit failed: {error}</output>}
      <button className="resolve-action" type="submit" disabled={submitting}>{submitting ? 'Committing resolution…' : canonicalPreview ? 'Create isolated copy and resolve' : 'Resolve discrepancy'}</button>
    </form>
  );
}
