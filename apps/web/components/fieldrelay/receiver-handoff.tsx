'use client';

import { useState } from 'react';

export function ReceiverHandoff() {
  const [confirmed, setConfirmed] = useState(false);

  if (confirmed) {
    return <section className="handoff-confirmation"><span>04</span><p>Receipt recorded</p><h1>7,940 L</h1><strong>−240 L / −2.93%</strong><div><b>Discrepancy open</b><p>Your original entry is preserved. The shipment remains under Operations review and has not been delivered externally.</p></div><a href="/demo">Continue guided scenario →</a></section>;
  }

  return (
    <form className="handoff-form" onSubmit={(event) => { event.preventDefault(); setConfirmed(true); }}>
      <header><div><p>Receiver handoff / one-time demo link</p><h1>Confirm what arrived.</h1></div><code>FR / 2026 / 0842</code></header>
      <section className="handoff-route"><div><span>From</span><strong>Alder Creek Site 14</strong><p>Northstar Field Services</p></div><i>→</i><div><span>To</span><strong>Copper Ridge Facility 02</strong><p>Copper Ridge Recovery</p></div></section>
      <section className="handoff-material"><span>Material · synthetic training data</span><h2>Demo Solvent Mixture</h2><p>UN1993 · Class 3 · Packing Group III</p></section>
      <section className="handoff-quantity"><div><span>Offered</span><strong>8,200 L</strong></div><div><span>Picked up</span><strong>8,180 L</strong></div><label><span>Received quantity</span><div><input type="number" min="0" step="1" defaultValue="7940" required /><b>L</b></div></label></section>
      <label className="handoff-notes"><span>Receiver note</span><textarea rows={3} defaultValue="Quantity recorded from receiver scale ticket." /></label>
      <aside><strong>Before you confirm</strong><p>Your report becomes an immutable shipment event. A difference greater than both 100 L and 1% opens an Operations review; it does not reject your receipt.</p></aside>
      <label className="handoff-declaration"><input type="checkbox" defaultChecked required /><span>I confirm this is the quantity received at Copper Ridge Facility 02.</span></label>
      <button type="submit">Confirm receipt</button>
      <footer>First-time handoff access requires a connection. A previously loaded handoff may continue offline.</footer>
    </form>
  );
}
