import type { Metadata } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import './globals.css';

const plexSans = IBM_Plex_Sans({
  variable: '--font-plex-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const plexMono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://fieldrelay.swoop.video'),
  title: {
    default: 'FieldRelay — Instrumented Chain of Custody',
    template: '%s · FieldRelay',
  },
  description: 'An offline-first chain-of-custody prototype for field handoffs, discrepancy resolution, and recoverable integration delivery.',
  openGraph: {
    type: 'website',
    title: 'FieldRelay — Instrumented Chain of Custody',
    description: 'One synthetic shipment, every handoff: offline capture, immutable discrepancy evidence, and idempotent delivery recovery.',
    images: [{
      url: '/assets/editorial/industrial-tanker-route-primary.png',
      width: 2172,
      height: 724,
      alt: 'FieldRelay industrial tanker route editorial artwork',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FieldRelay — Instrumented Chain of Custody',
    description: 'An offline-first, failure-recoverable field handoff prototype.',
    images: ['/assets/editorial/industrial-tanker-route-primary.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${plexSans.variable} ${plexMono.variable}`}>{children}</body>
    </html>
  );
}
