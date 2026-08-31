import type { Tone } from '@/lib/demo-data';

export function StatusLabel({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={`status-label status-${tone}`}><i aria-hidden="true" />{children}</span>;
}
