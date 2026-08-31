'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { deliveryAttempts, sanitizedPayload, type Tone } from '@/lib/demo-data';
import {
  getDelivery,
  newActionKey,
  replayDelivery,
  type DeliveryDetail,
} from '@/lib/fieldrelay-api';

type PanelName = 'Request' | 'Response' | 'Event' | 'Technical details';
type ForensicPanel = Record<PanelName, string>;
type LoadState = 'loading' | 'live' | 'preview' | 'unavailable';

const previewPanels: ForensicPanel = {
  Request: sanitizedPayload,
  Response: `HTTP/1.1 503 Service Unavailable
content-type: application/json
retry-after: 60

{
  "error": "demo_destination_unavailable",
  "retryable": true
}`,
  Event: `shipment.completed
FR-2026-0842
acceptedFinalQuantity: 7,940 L
sourceEvent: EV-0378
outboxRecord: OB-0019`,
  'Technical details': `queue: integration-delivery
deadLetterQueue: integration-delivery-dlq
destinationIdempotencyKey: dest_fr0842_completed_v1
correlationId: corr_fr0842_b17e
backoff: 60s / 120s / DLQ`,
};

function panelsFor(detail: DeliveryDetail): ForensicPanel {
  const lastAttempt = detail.attempts.at(-1);
  return {
    Request: JSON.stringify(detail.outbox?.payload ?? {}, null, 2),
    Response: lastAttempt
      ? JSON.stringify({
          httpStatus: lastAttempt.httpStatus,
          outcome: lastAttempt.outcome,
          kind: lastAttempt.kind,
          attemptNumber: lastAttempt.attemptNumber,
        }, null, 2)
      : 'No destination attempt has been recorded.',
    Event: `shipment.completed
${detail.shipment.id}
acceptedFinalQuantity: ${detail.shipment.acceptedFinalQuantityLiters ?? 'pending'} L
outboxRecord: ${detail.outbox?.id ?? 'pending'}`,
    'Technical details': `delivery: ${detail.delivery.id}
destinationType: ${detail.delivery.destinationType}
destinationIdempotencyKey: ${detail.delivery.stableIdempotencyKey}
correlationId: ${detail.delivery.correlationId}
attempts: ${detail.delivery.attemptCount} / ${detail.delivery.maxAttempts}`,
  };
}

export function DeliveryForensics({ deliveryId = 'DL-019' }: { deliveryId?: string }) {
  const [activeTab, setActiveTab] = useState<PanelName>('Request');
  const [detail, setDetail] = useState<DeliveryDetail | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [replaying, setReplaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replayActionKey] = useState(() => newActionKey(`replay-${deliveryId}`));
  const canonicalPreview = deliveryId === 'DL-019';

  useEffect(() => {
    const controller = new AbortController();
    getDelivery(deliveryId, controller.signal)
      .then((record) => {
        setDetail(record);
        setLoadState('live');
      })
      .catch((cause: unknown) => {
        if ((cause as Error).name !== 'AbortError') {
          setLoadState(canonicalPreview ? 'preview' : 'unavailable');
          setError(cause instanceof Error ? cause.message : 'Live delivery record unavailable.');
        }
      });
    return () => controller.abort();
  }, [canonicalPreview, deliveryId]);

  const replay = async () => {
    setReplaying(true);
    setError(null);
    try {
      const next = await replayDelivery(deliveryId, replayActionKey);
      setDetail(next);
      setLoadState('live');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The delivery replay failed.');
    } finally {
      setReplaying(false);
    }
  };

  if (loadState === 'loading') {
    return <section className="delivery-unavailable" aria-live="polite"><span>DL / TRACE</span><h2>Loading delivery evidence…</h2><p>The console is requesting this exact record from the live API.</p></section>;
  }

  if (loadState === 'unavailable') {
    return <output className="delivery-unavailable"><span>{deliveryId.replaceAll('-', ' / ')}</span><h2>That live delivery record is unavailable.</h2><p>{error}</p><Link href="/demo">Create a fresh isolated demo run →</Link></output>;
  }

  const panels = detail ? panelsFor(detail) : previewPanels;
  const delivered = detail?.delivery.status === 'DELIVERED';
  const replayable = !canonicalPreview && ['DLQ', 'FAILED'].includes(detail?.delivery.status ?? '');
  const liveAttempts = detail?.attempts.map((attempt) => {
    const succeeded = attempt.outcome === 'SUCCEEDED';
    return {
      time: new Date(attempt.occurredAt).toLocaleTimeString('en-CA', { hour12: false }),
      label: attempt.kind === 'MANUAL_REPLAY' ? 'Manual replay' : `Attempt ${attempt.attemptNumber}`,
      result: succeeded ? `${attempt.httpStatus} OK` : String(attempt.httpStatus),
      detail: attempt.outcome.replaceAll('_', ' ').toLowerCase(),
      tone: (succeeded ? 'success' : 'danger') as Tone,
    };
  });
  const visibleAttempts = liveAttempts ?? deliveryAttempts.slice(0, 4);

  return (
    <div className="delivery-layout">
      <section className="delivery-record">
        <header className={delivered ? 'delivery-success' : 'delivery-failed'}>
          <span>{delivered ? 'Delivery recovered' : detail ? detail.delivery.status.replaceAll('_', ' ') : 'Recorded failure trace'}</span>
          <strong>{detail?.delivery.lastHttpStatus ? `HTTP ${detail.delivery.lastHttpStatus}${delivered ? ' OK' : ''}` : 'HTTP 503 Service Unavailable'}</strong>
          <p>{detail?.delivery.destinationName ?? 'ERP Demo / OData example'}</p>
        </header>
        <dl className="delivery-facts">
          <div><dt>Shipment</dt><dd>{detail?.shipment.id ?? 'FR-2026-0842'}</dd></div>
          <div><dt>Event</dt><dd>shipment.completed</dd></div>
          <div><dt>Idempotency</dt><dd>{detail?.delivery.stableIdempotencyKey ?? 'dest_fr0842_completed_v1'}</dd></div>
          <div><dt>Correlation</dt><dd>{detail?.delivery.correlationId ?? 'corr_fr0842_b17e'}</dd></div>
        </dl>
        {replayable && <button className="replay-action" type="button" onClick={() => void replay()} disabled={replaying}>{replaying ? 'Replaying…' : 'Replay delivery'}</button>}
        {delivered && <button className="replay-action" type="button" disabled>Delivered · stable key retained</button>}
        {canonicalPreview && !delivered && <Link className="replay-action" href="/demo">Run this recovery in an isolated copy</Link>}
        <p className="replay-assurance">Replay preserves one stable destination key. This supports effectively-once delivery when the receiver enforces that key; the local simulator does.</p>
        {error && <output className="form-error">Replay failed: {error}</output>}
        <small className={loadState === 'live' ? 'record-source is-live' : 'record-source'}>{loadState === 'live' ? canonicalPreview ? 'Live read-only baseline' : 'Live isolated API record' : `Canonical reviewer preview · ${error}`}</small>
      </section>

      <section className="attempt-forensics">
        <header><p>Attempt history</p><strong>{deliveryId.replaceAll('-', ' / ')} / TRACE</strong></header>
        <ol>
          {visibleAttempts.map((attempt, index) => (
            <li key={`${attempt.time}-${attempt.label}`} className={`attempt-${attempt.tone}`}>
              <span className="attempt-node">{String(index + 1).padStart(2, '0')}</span><time>{attempt.time}</time><strong>{attempt.label}</strong><p>{attempt.detail}</p><code>{attempt.result}</code>
            </li>
          ))}
        </ol>
        {replayable && <div className="pending-replay"><i /> Manual recovery available</div>}
      </section>

      <section className="payload-forensics">
        <div className="forensic-tabs" role="tablist" aria-label="Delivery evidence">
          {(Object.keys(panels) as PanelName[]).map((tab) => <button type="button" role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? 'is-active' : undefined} key={tab} onClick={() => setActiveTab(tab)}>{tab}</button>)}
        </div>
        <div className="payload-meta"><span>Sanitized demo evidence</span><code>application/json</code></div>
        <pre>{panels[activeTab]}</pre>
        <footer><span>Secrets and personal data removed</span><span>UTF-8 · {panels[activeTab].length} B</span></footer>
      </section>
    </div>
  );
}
