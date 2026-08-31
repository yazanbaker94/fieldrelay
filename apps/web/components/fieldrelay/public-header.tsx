import Link from 'next/link';
import { RelayMark } from './relay-mark';

export function PublicHeader() {
  return (
    <header className="public-subnav">
      <Link href="/" className="public-wordmark"><RelayMark /><strong>FIELDRELAY</strong></Link>
      <nav aria-label="Public pages"><Link href="/#product">Product</Link><Link href="/architecture">Architecture</Link><Link href="/docs">Technical decisions</Link><Link href="/download/android">Android APK</Link><a href="https://github.com/yazanbaker94/fieldrelay" target="_blank" rel="noreferrer">GitHub</a></nav>
      <Link className="nav-demo" href="/app/overview">Operations ↗</Link>
    </header>
  );
}

export function PrototypeDisclaimer() {
  return <p className="full-disclaimer">FieldRelay is an independent portfolio prototype using fictional organizations, synthetic shipment data, and illustrative validation rules. It is not affiliated with WiQ Technologies and is not intended for production or regulatory use.</p>;
}
