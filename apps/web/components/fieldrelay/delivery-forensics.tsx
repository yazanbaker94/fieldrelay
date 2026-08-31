'use client';

import { useState } from 'react';
import { deliveryAttempts, sanitizedPayload } from '@/lib/demo-data';

const panelCopy = {
  Request: sanitizedPayload,
  Response: `HTTP/1.1 503 Service Unavailable\ncontent-type: application/json\nretry-after: 60\n\n{\n  "error": "demo_destination_unavailable",\n  "retryable": true\n}`,
  Event: `shipment.completed\nFR-2026-0842\nacceptedFinalQuantity: 7,940 L\nsourceEvent: EV-0378\noutboxRecord: OB-0019`,
  'Technical details': `queue: integration-delivery\ndeadLetterQueue: integration-delivery-dlq\ndestinationIdempotencyKey: dest_fr0842_completed_v1\ncorrelationId: corr_fr0842_b17e\nbackoff: 60s / 120s / DLQ`,
};

export function DeliveryForensics() {
  const [activeTab, setActiveTab] = useState<keyof typeof panelCopy>('Request');
  const [replayed, setReplayed] = useState(false);
  const visibleAttempts = replayed ? deliveryAttempts : deliveryAttempts.slice(0, 4);

  return (
    <div className="delivery-layout">
      <section className="delivery-record">
        <header className={replayed ? 'delivery-success' : 'delivery-failed'}>
          <span>{replayed ? 'Delivery recovered' : 'Delivery failed'}</span>
          <strong>{replayed ? 'HTTP 200 OK' : 'HTTP 503 Service Unavailable'}</strong>
          <p>ERP Demo / OData Adapter</p>
        </header>
        <dl className="delivery-facts">
          <div><dt>Shipment</dt><dd>FR-2026-0842</dd></div>
          <div><dt>Event</dt><dd>shipment.completed</dd></div>
          <div><dt>Idempotency</dt><dd>dest_fr0842_completed_v1</dd></div>
          <div><dt>Correlation</dt><dd>corr_fr0842_b17e</dd></div>
        </dl>
        <button className="replay-action" type="button" onClick={() => setReplayed(true)} disabled={replayed}>{replayed ? 'Delivered exactly once' : 'Replay delivery'}</button>
        <p className="replay-assurance">Replay preserves the destination idempotency key. A successful prior write cannot be duplicated.</p>
      </section>

      <section className="attempt-forensics">
        <header><p>Attempt history</p><strong>DL / 019 / TRACE</strong></header>
        <ol>
          {visibleAttempts.map((attempt, index) => (
            <li key={`${attempt.time}-${attempt.label}`} className={`attempt-${attempt.tone}`}>
              <span className="attempt-node">{String(index + 1).padStart(2, '0')}</span><time>{attempt.time}</time><strong>{attempt.label}</strong><p>{attempt.detail}</p><code>{attempt.result}</code>
            </li>
          ))}
        </ol>
        {!replayed && <div className="pending-replay"><i /> Manual recovery available</div>}
      </section>

      <section className="payload-forensics">
        <div className="forensic-tabs" role="tablist" aria-label="Delivery evidence">
          {(Object.keys(panelCopy) as (keyof typeof panelCopy)[]).map((tab) => <button type="button" role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? 'is-active' : undefined} key={tab} onClick={() => setActiveTab(tab)}>{tab}</button>)}
        </div>
        <div className="payload-meta"><span>Sanitized demo evidence</span><code>application/json</code></div>
        <pre>{panelCopy[activeTab]}</pre>
        <footer><span>Secrets and personal data removed</span><span>UTF-8 · {panelCopy[activeTab].length} B</span></footer>
      </section>
    </div>
  );
}
