'use client';

import { useState } from 'react';

const steps = [
  { no: '01', label: 'Offline record', note: 'Inspect work saved safely on Maya’s device.' },
  { no: '02', label: 'Exact sync', note: 'Recover a lost response without duplicating it.' },
  { no: '03', label: 'Discrepancy', note: 'Record receipt and expose the quantity variance.' },
  { no: '04', label: 'Resolution', note: 'Append an accepted quantity without rewriting evidence.' },
  { no: '05', label: 'Delivery recovery', note: 'Replay the failed destination delivery exactly once.' },
];

export function GuidedDemo() {
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [checking, setChecking] = useState(false);

  const reset = () => { setStarted(false); setStep(0); setChecking(false); };
  const advance = () => setStep((value) => Math.min(value + 1, steps.length));
  const sync = () => {
    setChecking(true);
    window.setTimeout(() => { setChecking(false); advance(); }, 650);
  };

  if (!started) {
    return (
      <section className="demo-entry">
        <div className="demo-entry-copy">
          <p>Guided system trace / about 90 seconds</p>
          <h1>Run the complete<br />FieldRelay scenario.</h1>
          <p className="demo-intro">Follow one synthetic shipment from an offline phone through a preserved discrepancy and a recoverable destination failure.</p>
          <div><button type="button" onClick={() => setStarted(true)}>Start guided demo</button><a href="/app/overview">Explore freely →</a></div>
        </div>
        <ol className="demo-preview">
          {steps.map((item) => <li key={item.no}><span>{item.no}</span><div><strong>{item.label}</strong><p>{item.note}</p></div></li>)}
        </ol>
      </section>
    );
  }

  const complete = step >= steps.length;

  return (
    <section className="guided-runtime">
      <aside className="guided-steps">
        <header><p>Demo run</p><code>corr_demo_b17e</code></header>
        <ol>{steps.map((item, index) => <li className={index === step ? 'is-current' : index < step ? 'is-complete' : undefined} key={item.no}><span>{item.no}</span><div><strong>{item.label}</strong><p>{item.note}</p></div></li>)}</ol>
        <button type="button" onClick={reset}>Reset scenario</button>
      </aside>

      <div className="guided-stage">
        <div className="guided-stagebar"><span>FIELDRELAY / GUIDED TRACE</span><strong>{complete ? 'Complete' : `Step ${step + 1} of ${steps.length}`}</strong><a href="/app/overview">Exit demo</a></div>

        {step === 0 && <article className="demo-scene offline-scene">
          <div className="scene-copy"><span>01 / Field</span><h2>Saved before the network returned.</h2><p>Maya created and signed the shipment offline. The operation, idempotency key, and base version survived an app restart.</p></div>
          <div className="device-ledger"><header><span>Offline</span><code>09:12 MDT</code></header><strong>Saved on this device</strong><p>Shipment FR-2026-0842 is safe on this phone.</p><dl><div><dt>Operation</dt><dd>CREATE SHIPMENT</dd></div><div><dt>Idempotency</dt><dd>op_01J6FR84</dd></div><div><dt>Base version</dt><dd>NEW / 00</dd></div></dl><footer>Waiting for connection</footer></div>
          <button className="scene-action" type="button" onClick={advance}>Restore connectivity</button>
        </article>}

        {step === 1 && <article className="demo-scene sync-scene">
          <div className="scene-copy"><span>02 / Exact sync</span><h2>{checking ? 'Checking the original result.' : 'A lost response is not a failed save.'}</h2><p>{checking ? 'FieldRelay is querying with the same idempotency key.' : 'The server applied the operation, but the phone never received the response. Retrying with the same key must return the original result.'}</p></div>
          <div className="idempotency-proof"><div><span>Attempt 01</span><strong>Server mutation applied</strong><code>201 · response lost</code></div><i /><div className={checking ? 'is-live' : ''}><span>Result check</span><strong>{checking ? 'Checking sync result…' : 'Same key ready'}</strong><code>op_01J6FR84</code></div><i /><div><span>Server records</span><strong>01 shipment</strong><code>no duplicate mutation</code></div></div>
          <button className="scene-action" type="button" onClick={sync} disabled={checking}>{checking ? 'Checking…' : 'Check with same key'}</button>
        </article>}

        {step === 2 && <article className="demo-scene discrepancy-scene">
          <div className="scene-copy"><span>03 / Exception</span><h2>The difference stays visible.</h2><p>Priya’s receipt is accepted as a new immutable report. It does not overwrite Maya or Marcus.</p></div>
          <div className="demo-quantities"><div><span>01 / Offer</span><strong>8,200 L</strong><small>Maya · EV-0347</small></div><div><span>03 / Pickup</span><strong>8,180 L</strong><small>Marcus · −0.24%</small></div><div className="warning-quantity"><span>04 / Received</span><strong>7,940 L</strong><small>Priya · −240 L / −2.93%</small></div></div>
          <div className="demo-threshold"><strong>Discrepancy open</strong><span>Difference exceeds both 100 L and 1%.</span><code>shipment: RECEIVED / delivery: NOT_STARTED</code></div>
          <button className="scene-action" type="button" onClick={advance}>Open resolution</button>
        </article>}

        {step === 3 && <article className="demo-scene resolution-scene">
          <div className="scene-copy"><span>04 / Resolution</span><h2>Resolve by appending, never erasing.</h2><p>The three reports remain immutable. Jordan records a separate accepted final quantity, reason, actor, and time.</p></div>
          <div className="resolution-transaction"><div><span>Evidence</span><strong>8,200 / 8,180 / 7,940 L</strong><small>preserved</small></div><i>+</i><div><span>New resolution</span><strong>Accepted · 7,940 L</strong><small>Jordan Patel · 14:22</small></div><i>→</i><div><span>Atomic result</span><strong>Completed + outbox</strong><small>DL-019 created</small></div></div>
          <button className="scene-action" type="button" onClick={advance}>Resolve and create delivery</button>
        </article>}

        {step === 4 && <article className="demo-scene recovery-scene">
          <div className="scene-copy"><span>05 / Recovery</span><h2>Failure is evidence, not disappearance.</h2><p>Three HTTP 503 responses move DL-019 to the dead-letter queue. Manual replay keeps the same destination idempotency key.</p></div>
          <ol className="mini-attempts"><li><time>14:33:02</time><strong>Attempt 1</strong><b>503</b></li><li><time>14:34:05</time><strong>Attempt 2</strong><b>503</b></li><li><time>14:36:11</time><strong>Attempt 3</strong><b>503</b></li><li className="dlq"><time>14:37:12</time><strong>Moved to DLQ</strong><b>Review</b></li></ol>
          <button className="scene-action" type="button" onClick={advance}>Replay with same key</button>
        </article>}

        {complete && <article className="demo-scene complete-scene">
          <div className="completion-mark"><span>06</span><i /></div><div className="scene-copy"><span>Trace complete / 200 OK</span><h2>Nothing disappeared.<br />Nothing duplicated.</h2><p>The shipment was created once, every report remains visible, the exception was resolved with a new event, and the destination received one completed record.</p></div>
          <div className="completion-proof"><div><span>Shipment records</span><strong>01</strong></div><div><span>Immutable reports</span><strong>03</strong></div><div><span>Audit events</span><strong>12</strong></div><div><span>Destination writes</span><strong>01</strong></div></div>
          <div className="complete-actions"><a href="/app/overview">Open operations console</a><a href="/architecture">Read architecture →</a><button type="button" onClick={reset}>Run again</button></div>
        </article>}
      </div>
    </section>
  );
}
