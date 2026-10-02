import { Link } from 'react-router-dom'

// The log's switcher: the sessions you train, and the injuries that change
// what you should be doing. Rendered at the top of both pages so they read as
// one place rather than two addresses. The split and the calendar used to sit
// here too; they have their own places in the top bar now (Programs and
// Calendar), so this area is only about what you did and what hurts.
//
// `active` is the current tab's path.
const TABS = [
  { to: '/log', label: 'Log' },
  { to: '/injuries', label: 'Injuries' },
]

export default function LogTabs({ active }) {
  return (
    // The scroller is a floor for large-text accessibility settings, not the
    // plan: at every normal size both labels fit without it.
    <div className="mb-10 overflow-x-auto">
      <div className="inline-flex border border-border">
        {TABS.map((t) => {
          const isActive = t.to === active
          return (
            <Link
              key={t.to}
              to={t.to}
              aria-current={isActive ? 'page' : undefined}
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
