// A small ring with the % inside. Stroke colours are theme tokens (no /opacity —
// iOS 15.8 floor), so it reads in every theme.
export default function ProgressRing({ pct, size = 38, stroke = 3.5, label }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} className="-rotate-90 block">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-border" />
        {clamped > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped / 100)}
          className="stroke-text-primary"
          style={{ transition: 'stroke-dashoffset 200ms ease-out' }}
        />
        )}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-text-primary tabular-nums">
        {clamped}%
      </span>
    </div>
  )
}
