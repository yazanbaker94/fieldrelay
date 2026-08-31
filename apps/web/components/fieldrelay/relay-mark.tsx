export function RelayMark({ compact = false }: { compact?: boolean }) {
  return (
    <svg aria-hidden="true" className={compact ? 'fr-mark fr-mark-compact' : 'fr-mark'} viewBox="0 0 64 30" fill="none">
      <path d="M4 15h56" stroke="currentColor" strokeWidth="1.5" />
      {[5, 23, 41, 59].map((cx, index) => (
        <circle key={cx} cx={cx} cy="15" r={index === 0 || index === 3 ? 4 : 3.5} fill={index === 0 || index === 3 ? 'currentColor' : '#07121B'} stroke="currentColor" strokeWidth="1.5" />
      ))}
    </svg>
  );
}
