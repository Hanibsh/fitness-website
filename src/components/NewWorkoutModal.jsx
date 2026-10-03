import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarRange, Plus, ChevronRight, Sparkles } from 'lucide-react'
import Modal from './Modal'
import { hasPlannedWork } from '../lib/program'

// "New workout" from the dashboard: the ways to start one, side by side, like
// the three ways to start a split on Programs.
//
//   Generate a session — one workout built by the split generator's own
//                        machinery, around your week (pages/SessionGenerator.jsx)
//   A day from my split — any training day of the active split, pre-filled the
//                        same way "Start <today's day>" is; the rotation moves on
//                        from whichever day you actually did
//   Empty workout      — the blank log
//
// `program` is the active split (or null), `todayId` the day it plans today.
export default function NewWorkoutModal({ program, todayId = null, onClose }) {
  const navigate = useNavigate()
  const days = (program?.days || []).filter((d) => d.kind !== 'rest' && hasPlannedWork(d))
  const [pickingDay, setPickingDay] = useState(false)

  const go = (to, state) => {
    onClose()
    navigate(to, state ? { state } : undefined)
  }

  const card = (key, Icon, title, text, onClick, extra = null) => (
    <div key={key} className="border border-border">
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-start gap-3 text-left p-4 bg-white border-none cursor-pointer hover:bg-cream transition-colors"
      >
        <Icon className="w-5 h-5 shrink-0 mt-0.5 text-text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-medium text-text-primary">{title}</span>
          <span className="block text-[12px] mt-0.5 leading-relaxed text-text-muted">{text}</span>
        </span>
        <ChevronRight className={`w-4 h-4 shrink-0 mt-1 text-text-light transition-transform ${extra ? 'rotate-90' : ''}`} />
      </button>
      {extra}
    </div>
  )

  return (
    <Modal onClose={onClose}>
      <div className="p-6 sm:p-7">
        <h3 className="font-heading text-xl font-medium text-text-primary mb-1 pr-8">New workout</h3>
        <p className="text-[13px] text-text-muted mb-5">How do you want to start?</p>
        <div className="space-y-2.5">
          {card('generate', Sparkles, 'Generate a session', 'Upper, push, arms… or let your week pick. Built around what’s recovered.', () => go('/session/new'))}
          {days.length > 0 &&
            card(
              'split',
              CalendarRange,
              'A day from my split',
              `Any day of ${program.name || 'your split'}, ready to log.`,
              () => setPickingDay((v) => !v),
              pickingDay && (
                <ul className="list-none m-0 p-0 border-t border-border divide-y divide-border">
                  {days.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => go('/log', { startPlannedDay: d.id })}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left bg-cream border-none cursor-pointer hover:bg-cream-dark transition-colors"
                      >
                        <span className="min-w-0 text-[13px] font-medium text-text-primary break-words">{d.name}</span>
                        <span className="shrink-0 flex items-center gap-2">
                          {d.id === todayId && (
                            <span className="text-[9px] font-semibold uppercase tracking-wider text-cream bg-text-primary px-1.5 py-0.5">Today</span>
                          )}
                          <span className="text-[11px] text-text-light">
                            {d.exercises.length} exercise{d.exercises.length === 1 ? '' : 's'}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )
            )}
          {card('empty', Plus, 'Empty workout', 'Start blank and add exercises as you go.', () => go('/log'))}
        </div>
      </div>
    </Modal>
  )
}
