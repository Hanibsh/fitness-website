import { useState } from 'react'
import { Moon, Dumbbell, ArrowLeftRight } from 'lucide-react'

// "Missed a day? Pick today's." — the quick version of the split page's Set as
// today, for the dark today cards on the log and the dashboard. Rotation splits
// only (the caller decides): a fixed week is the weekday's, nothing to change.
// The caller applies the pick (setPointerToDay) so each page keeps its own write
// path. Numbered because a 3-version rotation holds each day twice by name.
export default function ChangeTodayDay({ program, currentDayId, onPick, className = '' }) {
  const [open, setOpen] = useState(false)
  if (!program?.days?.length) return null
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-[11px] text-cream-70 hover:text-cream underline bg-transparent border-none cursor-pointer p-0"
      >
        <ArrowLeftRight className="w-3 h-3" /> {open ? 'Cancel' : 'Change'}
      </button>
      {open && (
        <div className="mt-2">
          <p className="text-[11px] text-cream-60 mb-1.5">Which day is today?</p>
          <div className="flex flex-wrap gap-1.5">
            {program.days.map((day, i) => {
              const current = day.id === currentDayId
              const Icon = day.kind === 'rest' ? Moon : Dumbbell
              return (
                <button
                  key={day.id}
                  type="button"
                  disabled={current}
                  aria-pressed={current}
                  onClick={() => {
                    setOpen(false)
                    onPick(day.id)
                  }}
                  className={`inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1.5 border transition-colors ${
                    current
                      ? 'bg-cream text-text-primary border-cream cursor-default'
                      : 'bg-cream-10 text-cream border-cream-20 hover:border-cream-60 cursor-pointer'
                  }`}
                >
                  <span className={current ? 'text-text-light' : 'text-cream-50'}>{i + 1}.</span>
                  <Icon className="w-3 h-3 shrink-0" />
                  <span className="break-words text-left">{day.kind === 'rest' ? 'Rest' : day.name || 'Untitled'}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
