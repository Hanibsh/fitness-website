import { ChevronUp, ChevronDown, RotateCcw } from 'lucide-react'
import { dashboardCard, isDefaultLayout, moveCard, toggleCard } from '../lib/dashboardLayout'
import { useDashboardLayout } from '../lib/useDashboardLayout'

// The profile page's "Dashboard" section: every card, a box to show it, and
// arrows to move it. Saves on every tap. The coaching banner and the session
// row aren't listed — they're fixed (lib/dashboardLayout.js).
export default function DashboardSettings() {
  const { layout, save, reset } = useDashboardLayout()
  const hidden = new Set(layout.hidden)
  const last = layout.order.length - 1
  const arrowCls =
    'w-8 h-8 inline-flex items-center justify-center text-text-muted hover:text-text-primary bg-white border border-border hover:border-border-hover cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed'

  return (
    <div className="bg-white border border-border p-4 sm:p-6">
      <ul className="list-none m-0 p-0 divide-y divide-border">
        {layout.order.map((id, i) => {
          const card = dashboardCard(id)
          const on = !hidden.has(id)
          return (
            <li key={id} className="flex items-center gap-3 py-2.5">
              <label className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) => save(toggleCard(layout, id, e.target.checked))}
                  className="mt-0.5 w-4 h-4 shrink-0 accent-text-primary cursor-pointer"
                />
                <span className="min-w-0">
                  <span className={`block text-[13px] font-medium break-words ${on ? 'text-text-primary' : 'text-text-light'}`}>
                    {card.label}
                  </span>
                  <span className="block text-[11px] text-text-light break-words">{card.sub}</span>
                </span>
              </label>
              <div className="flex gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => save(moveCard(layout, id, -1))}
                  disabled={i === 0}
                  aria-label={`Move ${card.label} up`}
                  className={arrowCls}
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => save(moveCard(layout, id, 1))}
                  disabled={i === last}
                  aria-label={`Move ${card.label} down`}
                  className={arrowCls}
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </li>
          )
        })}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-border">
        <p className="text-[12px] text-text-light">Saved straight away.</p>
        <button
          type="button"
          onClick={reset}
          disabled={isDefaultLayout(layout)}
          className="inline-flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text-primary bg-transparent border-none cursor-pointer p-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset to default
        </button>
      </div>
    </div>
  )
}
