import { Link } from 'react-router-dom'

// The training area's switcher: the log, the split that schedules it, the
// calendar that shows what happened, and the injuries that change what you
// should be doing. Rendered at the top of all four pages so they read as one
// place rather than four addresses.
//
// `active` is the current tab's path.
//
// "Split" rather than "Training split" on purpose. Measured at 320px, the four
// full labels come to ~340px — which pushes the last tab off the right edge, and
// the last tab is Injuries, the one this bar exists to surface. Shortening the
// second label brings the row to ~293px and everything fits unscrolled. Nothing
// is lost: /log/split still titles itself "Training split", and by the time you
// can see this bar you are already inside the training area.
const TABS = [
  { to: '/log', label: 'Log' },
  { to: '/log/split', label: 'Split' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/injuries', label: 'Injuries' },
]

export default function LogTabs({ active }) {
  return (
    // The scroller is a floor for large-text accessibility settings, not the
    // plan: at every normal size the labels fit without it. A tab you have to
    // find by swiping is no fix for a tab you couldn't find at all.
    //
    // No negative-margin bleed, because the four pages that render this don't
    // share a horizontal padding (px-4 sm:px-6 on the log, px-6 on the calendar)
    // and a hardcoded bleed would be wrong on half of them.
    <div className="mb-10 overflow-x-auto">
      <div className="inline-flex border border-border">
        {TABS.map((t) => {
          const isActive = t.to === active
          return (
            <Link
              key={t.to}
              to={t.to}
              aria-current={isActive ? 'page' : undefined}
              // px-3, not px-4: the four pages that render this don't share a
              // horizontal padding (px-4 sm:px-6 on the log and injuries, px-6
              // on the calendar and split), and at px-4 the row overflowed on
              // the tighter two at 320px — clipping the Injuries tab, which is
              // the one this bar exists to surface. Measured: 248px, fits the
              // narrowest of them with room to spare.
              className={`shrink-0 px-3 py-1.5 text-[13px] font-medium no-underline transition-colors ${
                isActive ? 'bg-text-primary text-cream' : 'bg-white text-text-muted hover:text-text-primary'
              }`}
            >
              {t.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
