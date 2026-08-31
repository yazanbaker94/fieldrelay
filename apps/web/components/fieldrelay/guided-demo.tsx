'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  attemptDemoDelivery,
  createDemoRun,
  newActionKey,
  proveOfflineRecovery,
  replayDemoDelivery,
  resolveDemoException,
  type DemoRunSnapshot,
} from '@/lib/fieldrelay-api';

const steps = [
  { no: '01', label: 'Offline record', note: 'Inspect work saved safely on Maya’s device.' },
  { no: '02', label: 'Idempotent sync', note: 'Recover a lost response without a second mutation.' },
  { no: '03', label: 'Discrepancy', note: 'Record receipt and expose the quantity variance.' },
  { no: '04', label: 'Resolution', note: 'Append an accepted quantity without rewriting evidence.' },
  { no: '05', label: 'Delivery recovery', note: 'Replay with the same destination idempotency key.' },
];

type RuntimePhase = 'idle' | 'creating' | 'checking' | 'resolving' | 'failing' | 'replaying';

export function GuidedDemo() {
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<RuntimePhase>('idle');
  const [snapshot, setSnapshot] = useState<DemoRunSnapshot | null>(null);
  const [recoveryVerified, setRecoveryVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const complete = step >= steps.length;
  const automaticAttempts = snapshot?.deliveryAttempts.filter((attempt) => attempt.kind === 'AUTOMATIC') ?? [];
  const readyToReplay = snapshot?.delivery?.status === 'DLQ';

  const explainError = (cause: unknown) => {
    setError(cause instanceof Error ? cause.message : 'The live demo API could not complete this action.');
  };

  const start = async () => {
    setPhase('creating');
    setError(null);
    const actionKey = newActionKey('guided-run');
    try {
      const run = await createDemoRun(actionKey);
      setSnapshot(run);
      setStarted(true);
    } catch (cause) {
      explainError(cause);
    } finally {
      setPhase('idle');
    }
  };

  const reset = () => {
    setStarted(false);
    setStep(0);
    setPhase('idle');
    setSnapshot(null);
    setRecoveryVerified(false);
    setError(null);
  };

  const recoverOriginalResult = async () => {
    if (!snapshot) return;
    setPhase('checking');
    setError(null);
    try {
      const recovered = await proveOfflineRecovery(snapshot);
      if (!recovered.replayed || recovered.recovery !== 'ORIGINAL_RESULT_RETURNED') {
        throw new Error('The idempotency probe did not return the original run result.');
      }
      setRecoveryVerified(true);
      setStep(2);
    } catch (cause) {
      explainError(cause);
    } finally {
      setPhase('idle');
    }
  };

  const resolve = async () => {
    if (!snapshot) return;
    setPhase('resolving');
    setError(null);
    try {
      setSnapshot(await resolveDemoException(snapshot));
      setStep(4);
    } catch (cause) {
      explainError(cause);
    } finally {
      setPhase('idle');
    }
  };

  const runFailureSequence = async () => {
    if (!snapshot) return;
    setPhase('failing');
    setError(null);
    try {
      let current = snapshot;
      for (let attempt = current.deliveryAttempts.length + 1; attempt <= 3; attempt += 1) {
        current = await attemptDemoDelivery(current, attempt);
        setSnapshot(current);
        await new Promise((resolveDelay) => window.setTimeout(resolveDelay, 220));
      }
    } catch (cause) {
      explainError(cause);
    } finally {
      setPhase('idle');
    }
  };

  const replay = async () => {
    if (!snapshot) return;
    setPhase('replaying');
    setError(null);
    try {
      setSnapshot(await replayDemoDelivery(snapshot));
      setStep(5);
    } catch (cause) {
      explainError(cause);
    } finally {
      setPhase('idle');
    }
  };

  if (!started) {
    return (
      <section className="demo-entry">
        <div className="demo-entry-copy">
          <p>Guided system trace / about 90 seconds</p>
          <h1>Run the complete<br />FieldRelay scenario.</h1>
          <p className="demo-intro">Follow one isolated synthetic shipment from an offline phone through preserved discrepancy evidence and recoverable destination failure. Every action below reaches the live API.</p>
          <div><button type="button" onClick={() => void start()} disabled={phase === 'creating'}>{phase === 'creating' ? 'Creating isolated run…' : 'Start guided demo'}</button><Link href="/app/overview">Explore freely →</Link></div>
          {error && <output className="demo-error">API unavailable: {error}</output>}
        </div>
        <ol className="demo-preview">
          {steps.map((item) => <li key={item.no}><span>{item.no}</span><div><strong>{item.label}</strong><p>{item.note}</p></div></li>)}
        </ol>
      </section>
    );
  }

  return (
    <section className="guided-runtime">
      <aside className="guided-steps">
        <header><p>Isolated API run</p><code>{snapshot?.runId ?? 'creating'}</code></header>
        <ol>{steps.map((item, index) => <li className={index === step ? 'is-current' : index < step ? 'is-complete' : undefined} key={item.no}><span>{item.no}</span><div><strong>{item.label}</strong><p>{item.note}</p></div></li>)}</ol>
        <button type="button" onClick={reset}>Start a fresh run</button>
      </aside>

      <div className="guided-stage">
        <div className="guided-stagebar"><span>FIELDRELAY / LIVE DOMAIN TRACE</span><strong>{complete ? 'Complete' : `Step ${step + 1} of ${steps.length}`}</strong><Link href="/app/overview">Exit demo</Link></div>
        {error && <output className="demo-error runtime-error">Action failed: {error}</output>}

        {step === 0 && <article className="demo-scene offline-scene">
          <div className="scene-copy"><span>01 / Field</span><h2>Saved before the network returned.</h2><p>Maya created and signed the shipment offline. The operation, idempotency key, and base version survived an app restart. This isolated run now exists in the API store.</p></div>
          <div className="device-ledger"><header><span>Offline</span><code>09:12 MDT</code></header><strong>Saved on this device</strong><p>Operation {snapshot?.offlineRecovery?.operation.operationId} is safe on this phone.</p><dl><div><dt>Operation</dt><dd>CREATE SHIPMENT</dd></div><div><dt>Idempotency</dt><dd>{snapshot?.offlineRecovery?.operation.idempotencyKey.slice(0, 24)}…</dd></div><div><dt>Base version</dt><dd>NEW / 00</dd></div></dl><footer>Waiting for connection</footer></div>
          <button className="scene-action" type="button" onClick={() => setStep(1)}>Restore connectivity</button>
        </article>}

        {step === 1 && <article className="demo-scene sync-scene">
          <div className="scene-copy"><span>02 / Idempotent sync</span><h2>{phase === 'checking' ? 'Checking the original result.' : 'A lost response is not a failed save.'}</h2><p>The live API applies a run-scoped offline operation once and the client intentionally ignores that first response. Sending the identical operation again returns the stored result without a second mutation.</p></div>
          <div className="idempotency-proof"><div><span>Attempt 01</span><strong>Server mutation applied</strong><code>201 · response intentionally ignored</code></div><i /><div className={phase === 'checking' ? 'is-live' : ''}><span>Result check</span><strong>{phase === 'checking' ? 'Checking sync result…' : 'Same operation ready'}</strong><code>{snapshot?.offlineRecovery?.operation.idempotencyKey.slice(0, 24)}…</code></div><i /><div><span>Server mutations</span><strong>{recoveryVerified ? '01 total' : 'Awaiting check'}</strong><code>{recoveryVerified ? 'ORIGINAL_RESULT_RETURNED' : 'no duplicate mutation'}</code></div></div>
          <button className="scene-action" type="button" onClick={() => void recoverOriginalResult()} disabled={phase === 'checking'}>{phase === 'checking' ? 'Checking…' : 'Check with same key'}</button>
        </article>}

        {step === 2 && <article className="demo-scene discrepancy-scene">
          <div className="scene-copy"><span>03 / Exception</span><h2>The difference stays visible.</h2><p>Priya’s receipt is accepted as a new immutable report. It does not overwrite Maya or Marcus. The API reports four independent status dimensions.</p></div>
          <div className="demo-quantities"><div><span>01 / Offer</span><strong>{snapshot?.shipment.offeredQuantityLiters?.toLocaleString()} L</strong><small>Maya · immutable report</small></div><div><span>03 / Pickup</span><strong>{snapshot?.shipment.pickupQuantityLiters?.toLocaleString()} L</strong><small>Marcus · −0.24%</small></div><div className="warning-quantity"><span>04 / Received</span><strong>{snapshot?.shipment.receivedQuantityLiters?.toLocaleString()} L</strong><small>Priya · −240 L / −2.93%</small></div></div>
          <div className="demo-threshold"><strong>{snapshot?.exception?.status.replaceAll('_', ' ')}</strong><span>Difference exceeds both 100 L and 1%.</span><code>shipment: {snapshot?.shipment.lifecycleStatus} / delivery: {snapshot?.shipment.deliveryStatus}</code></div>
          <button className="scene-action" type="button" onClick={() => setStep(3)}>Open resolution</button>
        </article>}

        {step === 3 && <article className="demo-scene resolution-scene">
          <div className="scene-copy"><span>04 / Resolution</span><h2>Resolve by appending, never erasing.</h2><p>The three reports remain immutable. Jordan records a separate accepted final quantity, reason, actor, and time.</p></div>
          <div className="resolution-transaction"><div><span>Evidence</span><strong>8,200 / 8,180 / 7,940 L</strong><small>preserved</small></div><i>+</i><div><span>New resolution</span><strong>Accepted · 7,940 L</strong><small>Jordan Patel · live action</small></div><i>→</i><div><span>Atomic result</span><strong>Completed + outbox</strong><small>{snapshot?.resources.deliveryId} reserved</small></div></div>
          <button className="scene-action" type="button" onClick={() => void resolve()} disabled={phase === 'resolving'}>{phase === 'resolving' ? 'Committing transaction…' : 'Resolve and create delivery'}</button>
        </article>}

        {step === 4 && <article className="demo-scene recovery-scene">
          <div className="scene-copy"><span>05 / Recovery</span><h2>Failure is evidence, not disappearance.</h2><p>Three real simulator calls return HTTP 503 and move {snapshot?.resources.deliveryId} to the dead-letter state. Manual replay keeps the destination idempotency key stable.</p></div>
          <ol className="mini-attempts">
            {automaticAttempts.length === 0 && <li><time>READY</time><strong>Delivery pending</strong><b>{snapshot?.delivery?.status}</b></li>}
            {automaticAttempts.map((attempt) => <li key={attempt.id}><time>ATTEMPT {String(attempt.attemptNumber).padStart(2, '0')}</time><strong>Automatic delivery</strong><b>{attempt.httpStatus}</b></li>)}
            {readyToReplay && <li className="dlq"><time>AFTER 03</time><strong>Moved to DLQ</strong><b>Review</b></li>}
          </ol>
          {!readyToReplay && <button className="scene-action" type="button" onClick={() => void runFailureSequence()} disabled={phase === 'failing'}>{phase === 'failing' ? `Recording attempt ${Math.min(automaticAttempts.length + 1, 3)}…` : 'Run three failed attempts'}</button>}
          {readyToReplay && <button className="scene-action" type="button" onClick={() => void replay()} disabled={phase === 'replaying'}>{phase === 'replaying' ? 'Replaying…' : 'Replay with same destination key'}</button>}
        </article>}

        {complete && <article className="demo-scene complete-scene">
          <div className="completion-mark"><span>06</span><i /></div><div className="scene-copy"><span>Trace complete / {snapshot?.delivery?.lastHttpStatus} OK</span><h2>Nothing disappeared.<br />No duplicate mutation.</h2><p>The isolated shipment was created once, every report remains visible, the exception was resolved with a new event, and the idempotency-aware simulator accepted one completed record after a controlled replay.</p></div>
          <div className="completion-proof"><div><span>Shipment records</span><strong>01</strong></div><div><span>Immutable reports</span><strong>03</strong></div><div><span>Audit events</span><strong>{snapshot?.timeline.length ?? 0}</strong></div><div><span>Destination writes</span><strong>{snapshot?.delivery?.status === 'DELIVERED' ? '01' : '00'}</strong></div></div>
          <div className="complete-actions"><Link href={`/app/integrations/${snapshot?.resources.deliveryId ?? 'DL-019'}`}>Open delivery record</Link><Link href="/architecture">Read architecture →</Link><button type="button" onClick={reset}>Run again</button></div>
        </article>}
      </div>
    </section>
  );
}
