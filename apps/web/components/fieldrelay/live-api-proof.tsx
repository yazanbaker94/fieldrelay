'use client';

import { useEffect, useState } from 'react';

type Snapshot = { shipment: { id: string; lifecycleStatus: string; syncStatus: string; exceptionStatus: string; version: number }; timeline: unknown[] };

function apiBase() {
  if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) return 'http://127.0.0.1:4100';
  return '';
}

export function LiveApiProof() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [state, setState] = useState<'connecting' | 'live' | 'unavailable'>('connecting');

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiBase()}/api/v1/demo`, { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error('API unavailable'); return response.json() as Promise<Snapshot>; })
      .then((data) => { setSnapshot(data); setState('live'); })
      .catch((error: unknown) => { if ((error as Error).name !== 'AbortError') setState('unavailable'); });
    return () => controller.abort();
  }, []);

  return (
    <div className="live-api-proof" title={state === 'unavailable' ? 'Static synthetic preview remains available while the local API is stopped.' : undefined}>
      <span>Domain API</span>
      <b className={`api-${state}`}><i />{state === 'live' ? 'Live' : state === 'connecting' ? 'Connecting' : 'Preview mode'}</b>
      <code>{snapshot ? `${snapshot.shipment.id} · v${snapshot.shipment.version} · ${snapshot.timeline.length} events` : state === 'unavailable' ? 'Start API on :4100' : 'Reading seed…'}</code>
    </div>
  );
}
