import { Link } from 'react-router-dom'
import { HelpCircle } from 'lucide-react'

// Which muscles a planned day works, as a share of its weighted sets.
//
// Bars are scaled to the biggest row, not to 100 — a day's top muscle is rarely
// above 30%, and at true scale every bar would be a stub. Scaling divides every
// row by the same number, so the bars still compare honestly against each other
// and the printed % stays the real share.
//
// Label and number sit ABOVE the bar rather than beside it: a side label wide
// enough for "Neck and Traps" leaves nothing for the bar at 320px, and one
// narrow enough for the bar clips the label — the same squeeze that made the
// old split editor unreadable on a phone.
export default function MuscleShareBars({ rows, showSets = false }) {
  if (!rows.length) return null
  const max = Math.max(...rows.map((r) => r.pct)) || 100
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] text-text-muted">
              {r.label}
              {r.href && (
                <Link
                  to={r.href}
                  aria-label={`What is ${r.label}?`}
                  title={`What is ${r.label}?`}
                  className="inline-flex align-[-2px] ml-1 text-text-light hover:text-text-primary no-underline"
                >
                  <HelpCircle className="w-3 h-3" />
                </Link>
              )}
            </span>
            <span className="shrink-0 text-[11px] tabular-nums text-text-primary">
              {r.pct}%{showSets ? ` · ${r.sets} sets` : ''}
            </span>
          </div>
          <div className="mt-1 h-1.5 bg-cream border border-border overflow-hidden">
            <div className="h-full bg-text-primary" style={{ width: `${Math.max(2, (100 * r.pct) / max)}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}
