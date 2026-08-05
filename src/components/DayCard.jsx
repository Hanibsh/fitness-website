import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import MuscleShareBars from './MuscleShareBars'

// One day of training, summarised: how much work, how taxing, which muscles, and
// what's in it. Used for a day as planned in a split and for a day as actually
// logged — `stats` comes from dayStats or sessionStats, which return the same
// shape, so this component never needs to know which.
//
// `header` is a slot rather than props because every surface puts something
// different up there — reorder and remove buttons on the split page, a status
// chip and Edit/Delete in the calendar — and none of it can live inside the
// body's anchor, since a button nested in a link is neither valid nor tappable.
//
// Names are never truncated anywhere in here. Long movement names are the whole
// reason this card exists; they wrap.
// `compact` strips the muscle bars and the exercise chips, leaving the one-line
// count. A day you've ALREADY trained uses it: the calendar panel is a place to
// recognise the workout and get into it, not to study it — the full breakdown
// lives one tap away in the summary card, and repeating it here just made the
// panel long enough to scroll past.
//
// `onOpen` is the button-shaped twin of `to`, for when opening means a dialog
// rather than a route.
export default function DayCard({ header, stats, chips = [], to, linkState, linkLabel, onOpen, note, cta = 'Open day', highlight = false, compact = false, footer }) {
  const openable = !!to || !!onOpen
  const body = (
    <>
      {note && <p className="text-[12px] text-text-light">{note}</p>}

      {stats && stats.exercises > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-text-muted">
            <span className="tabular-nums">
              {stats.exercises} exercise{stats.exercises !== 1 ? 's' : ''} · {stats.sets} set{stats.sets !== 1 ? 's' : ''}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted bg-cream border border-border px-1.5 py-0.5">
              {stats.load.label}
            </span>
          </div>

          {!compact && stats.groups.length > 0 && (
            <div className="mt-3">
              <MuscleShareBars rows={stats.groups.slice(0, 3).map((g) => ({ label: g.group, sets: g.sets, pct: g.pct }))} />
            </div>
          )}

          {!compact && chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {chips.map((c) => (
                <span key={c.key} className="text-[11px] text-text-muted bg-cream border border-border px-2 py-0.5">
                  {c.label}
                  {c.suffix && <span className="text-text-light"> · {c.suffix}</span>}
                </span>
              ))}
            </div>
          )}

          {openable && (
            <span className="inline-flex items-center gap-1 text-[11px] text-text-light mt-3">
              {cta} <ChevronRight className="w-3 h-3" />
            </span>
          )}
        </>
      )}
    </>
  )

  // Named explicitly on both: left to their contents, either would announce
  // itself as the whole stats blob.
  return (
    <div className={`border bg-white ${highlight ? 'border-text-primary' : 'border-border'}`}>
      {header && <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-cream">{header}</div>}
      {onOpen ? (
        <button
          onClick={onOpen}
          aria-label={linkLabel || cta}
          className="block w-full text-left px-4 py-3 bg-transparent border-none cursor-pointer hover:bg-cream transition-colors"
        >
          {body}
        </button>
      ) : to ? (
        <Link to={to} state={linkState} aria-label={linkLabel || cta} className="block px-4 py-3 no-underline">
          {body}
        </Link>
      ) : (
        <div className="px-4 py-3">{body}</div>
      )}
      {footer && <div className="px-4 pb-3 -mt-1">{footer}</div>}
    </div>
  )
}
