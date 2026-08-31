'use client';

import { useEffect, useState } from 'react';
import { apiBase, getCanonicalDemo, type DemoRunSnapshot } from '@/lib/fieldrelay-api';

export function LiveApiProof() {
  const [snapshot, setSnapshot] = useState<DemoRunSnapshot | null>(null);
  const [state, setState] = useState<'connecting' | 'live' | 'unavailable'>('connecting');
  const [stream, setStream] = useState<'opening' | 'connected' | 'offline'>('opening');

  useEffect(() => {
    const controller = new AbortController();
    getCanonicalDemo(controller.signal)
      .then((data) => { setSnapshot(data); setState('live'); })
      .catch((error: unknown) => { if ((error as Error).name !== 'AbortError') setState('unavailable'); });

    const events = new EventSource(`${apiBase()}/api/v1/events`);
    events.addEventListener('connected', () => setStream('connected'));
    events.onerror = () => setStream('offline');

    return () => {
      controller.abort();
      events.close();
    };
  }, []);

  return (
    <div className="live-api-proof" title={state === 'unavailable' ? 'Static synthetic preview remains available while the local API is stopped.' : undefined}>
      <span>Domain API</span>
      <b className={`api-${state}`}><i />{state === 'live' ? 'Live' : state === 'connecting' ? 'Connecting' : 'Preview mode'}</b>
      <code>{snapshot ? `${snapshot.shipment.id} · v${snapshot.shipment.version} · ${snapshot.timeline.length} events · stream ${stream}` : state === 'unavailable' ? 'Start API on :4100' : 'Reading seed…'}</code>
    </div>
  );
}
