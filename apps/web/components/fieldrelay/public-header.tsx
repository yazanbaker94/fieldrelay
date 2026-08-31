import { RelayMark } from './relay-mark';

export function PublicHeader() {
  return (
    <header className="public-subnav">
      <a href="/" className="public-wordmark"><RelayMark /><strong>FIELDRELAY</strong></a>
      <nav aria-label="Public pages"><a href="/#product">Product</a><a href="/architecture">Architecture</a><a href="/docs">Technical decisions</a><a href="/download/android">Android APK</a><a href="https://github.com/yazanbaker94" target="_blank" rel="noreferrer">GitHub</a></nav>
      <a className="nav-demo" href="/app/overview">Operations ↗</a>
    </header>
  );
}

export function PrototypeDisclaimer() {
  return <p className="full-disclaimer">FieldRelay is an independent portfolio prototype using fictional organizations, synthetic shipment data, and illustrative validation rules. It is not affiliated with WiQ Technologies and is not intended for production or regulatory use.</p>;
}
