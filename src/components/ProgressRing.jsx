import { createPortal } from 'react-dom'

// Floating bubble with how far through the session you are, stacked above the
// QuickCalculator in the bottom-right. Same 48px dark circle as the calculator
// and rest timer. Colours are theme tokens (no /opacity — iOS 15.8 floor).
// Sits one layer under the calculator so its open panel covers it.
// Portalled to body: a transform on an ancestor would trap `fixed`.
export default function ProgressRing({ done, total }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  const size = 48
  const stroke = 3
  const r = (size - stroke) / 2 - 2
  const c = 2 * Math.PI * r
  return createPortal(
    <div
      role="img"
      aria-label={`${done} of ${total} working sets done`}
      title={`${done} of ${total} sets`}
      className="fixed bottom-20 right-4 z-[79] w-12 h-12 rounded-full bg-text-primary shadow-lg"
    >
      <svg width={size} height={size} className="-rotate-90 block">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-cream-30" />
        {pct > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct / 100)}
            className="stroke-cream"
            style={{ transition: 'stroke-dashoffset 200ms ease-out' }}
          />
        )}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-cream tabular-nums">
        {pct}%
      </span>
    </div>,
    document.body
  )
}
