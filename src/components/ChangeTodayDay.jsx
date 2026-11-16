import { Moon, Dumbbell, Check, ArrowLeftRight } from 'lucide-react'
import Modal from './Modal'

// "Missed a day? Pick today's." — the quick version of the split page's Set as
// today, opened from the today cards on the log and the dashboard. Rotation
// splits only (the caller decides): a fixed week is the weekday's, nothing to
// change. The caller applies the pick (setPointerToDay) so each page keeps its
// own write path. Numbered because a 3-version rotation holds each day twice by
// name.
export default function ChangeTodayDay({ program, currentDayId, onPick, onClose }) {
  if (!program?.days?.length) return null
  return (
    <Modal onClose={onClose} maxWidth="max-w-sm">
      <div className="p-6">
        <h3 className="font-heading text-xl font-medium text-text-primary mb-1 pr-8">Which day is today?</h3>
        <p className="text-[12px] text-text-light mb-4">Your split carries on from the day you pick.</p>
        <div className="flex flex-col gap-1.5">
          {program.days.map((day, i) => {
            const current = day.id === currentDayId
            const Icon = day.kind === 'rest' ? Moon : Dumbbell
            return (
              <button
                key={day.id}
                type="button"
                aria-current={current ? 'true' : undefined}
                onClick={() => {
                  if (!current) onPick(day.id)
                  onClose()
                }}
                className={`w-full flex items-center gap-2.5 text-left text-[13px] px-3 py-2.5 border cursor-pointer transition-colors ${
                  current
                    ? 'bg-text-primary text-cream border-text-primary'
                    : 'bg-white text-text-primary border-border hover:border-border-hover'
                }`}
              >
                <span className={`w-5 shrink-0 tabular-nums text-[11px] ${current ? 'text-cream-60' : 'text-text-light'}`}>{i + 1}.</span>
                <Icon className={`w-3.5 h-3.5 shrink-0 ${current ? '' : 'text-text-light'}`} />
                <span className="flex-1 min-w-0 break-words">{day.kind === 'rest' ? 'Rest' : day.name || 'Untitled'}</span>
                {current && (
                  <span className="shrink-0 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-cream-70">
                    <Check className="w-3 h-3" /> Today
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}

// The small ⇄ box that sits joined onto a Start button. `tone` matches the
// button it's attached to: 'dark' (bg-text-primary) or 'cream' (the log card).
export function SwapDayButton({ onClick, tone = 'dark' }) {
  const look =
    tone === 'cream'
      ? 'bg-cream text-text-primary border-l border-border hover:bg-white'
      : 'bg-text-primary text-cream border-l border-cream-20 hover:bg-accent-hover'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Change today's day"
      title="Change today's day"
      className={`inline-flex items-center justify-center px-3 border-y-0 border-r-0 cursor-pointer transition-colors ${look}`}
    >
      <ArrowLeftRight className="w-3.5 h-3.5" />
    </button>
  )
}
