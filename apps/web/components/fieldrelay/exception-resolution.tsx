'use client';

import { useState } from 'react';

export function ExceptionResolution() {
  const [resolved, setResolved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [source, setSource] = useState<'api' | 'browser'>('browser');

  const resolve = async () => {
    setSubmitting(true);
    const localHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const base = localHost ? 'http://127.0.0.1:4100' : '';
    try {
      const response = await fetch(`${base}/api/v1/exceptions/EX-0037/resolve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': 'demo_resolve_ex0037_v1' },
        body: JSON.stringify({ category: 'RECEIVER_QUANTITY_VERIFIED', acceptedFinalQuantityLiters: 7940, reason: 'Receiver scale record accepted', note: 'Receiver scale ticket verified against offload record. Original reports remain immutable.', actor: { id: 'jordan', name: 'Jordan Patel', role: 'OPERATIONS' } }),
      });
      if (!response.ok) throw new Error('Resolution API unavailable');
      setSource('api');
    } catch {
      setSource('browser');
    } finally {
      setSubmitting(false);
      setResolved(true);
    }
  };

  if (resolved) {
    return (
      <div className="resolution-complete" role="status">
        <span>05</span>
        <p>Resolution appended</p>
        <strong>Accepted final quantity<br />7,940 L</strong>
        <div><i /> EX-0037 resolved</div>
        <div><i /> Shipment completed</div>
        <div><i /> DL-019 created in outbox</div>
        <small>{source === 'api' ? 'Committed by the live domain API' : 'Browser demo state · start the local API for a persisted run'}</small>
        <button type="button" onClick={() => setResolved(false)}>Review original state</button>
      </div>
    );
  }

  return (
    <form className="resolution-form" onSubmit={(event) => { event.preventDefault(); void resolve(); }}>
      <div className="resolution-heading"><span>Resolution</span><code>NEW / EVENT</code></div>
      <label>
        Resolution category
        <select defaultValue="verified-receiver"><option value="verified-receiver">Receiver quantity verified</option><option value="measurement-adjusted">Measurement adjustment</option><option value="documentation">Documentation correction</option></select>
      </label>
      <label>
        Accepted final quantity
        <span className="unit-input"><input inputMode="decimal" defaultValue="7940" required /><b>L</b></span>
      </label>
      <label>
        Reason
        <select defaultValue="receiver-scale"><option value="receiver-scale">Receiver scale record accepted</option><option value="field-review">Field review completed</option><option value="other">Other documented reason</option></select>
      </label>
      <label>
        Internal note
        <textarea defaultValue="Receiver scale ticket verified against offload record. Accepting the reported final quantity while preserving all source reports." rows={5} required />
      </label>
      <aside><strong>Original reports are immutable.</strong><span>Resolution creates a new accepted quantity.</span></aside>
      <button className="resolve-action" type="submit" disabled={submitting}>{submitting ? 'Committing resolution…' : 'Resolve discrepancy'}</button>
    </form>
  );
}
