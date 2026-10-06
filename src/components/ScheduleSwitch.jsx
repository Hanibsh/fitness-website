import { useState } from 'react'
import Modal from './Modal'
import { scheduleMode, brokenFixedWeek, toFixedWeek, toRotation } from '../lib/program'
import { DEFAULT_WEEKDAYS } from '../lib/generatorConfig'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const LINE = {
  weekly: 'Same weekdays every week. A missed day never shifts it.',
  rotating: 'Runs in order. Missed workouts wait for you.',
}

const primaryBtn =
  'flex-1 bg-text-primary text-cream font-medium py-3 border-none cursor-pointer text-[14px] hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
const cancelBtn =
  'px-5 text-text-muted hover:text-text-primary bg-white border border-border hover:border-border-hover cursor-pointer text-[13px] transition-colors'

// Rotation → fixed week: which weekdays the training days land on.
function FixedWeekDialog({ program, onSwitch, onClose }) {
  const training = program.days.filter((d) => d.kind !== 'rest')
  const n = training.length
  const [picked, setPicked] = useState(() => [...(DEFAULT_WEEKDAYS[n] || (n === 7 ? [0, 1, 2, 3, 4, 5, 6] : n === 1 ? [0] : []))])
  const result = picked.length === n ? toFixedWeek(program, picked) : null
  const toggle = (i) => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i].sort((a, b) => a - b)))

  return (
    <Modal onClose={onClose} maxWidth="max-w-sm">
      <div className="p-6 sm:p-7">
        <h3 className="font-heading text-xl font-medium text-text-primary mb-1 pr-8">Which days do you train?</h3>
        {n > 7 ? (
          <p className="text-[13px] text-text-muted mt-3 mb-6">A week fits 7 days — this split has {n} training days.</p>
        ) : (
          <>
            <p className="text-[13px] text-text-muted mb-5">
              {n} training day{n === 1 ? '' : 's'}, in order. Rest fills the gaps.
            </p>
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggle(i)}
                  aria-pressed={picked.includes(i)}
                  className={`py-2.5 text-[12px] font-medium border cursor-pointer transition-colors ${
                    picked.includes(i) ? 'bg-text-primary text-cream border-text-primary' : 'bg-white text-text-muted border-border hover:border-border-hover'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            {result ? (
              <ul className="list-none p-0 mt-4 mb-0 space-y-1">
                {result.program.days.map((d, i) =>
                  d.kind === 'rest' ? null : (
                    <li key={d.id} className="text-[12px] text-text-secondary">
                      <span className="text-text-light">{WEEKDAY_NAMES[i]}</span> · {d.name}
                    </li>
                  )
                )}
              </ul>
            ) : (
              <p className="text-[12px] text-amber-600 mt-3">
                Pick {n} day{n === 1 ? '' : 's'}.
              </p>
            )}
            {result?.droppedCardio > 0 && (
              <p className="text-[12px] text-text-muted mt-3">
                {result.droppedCardio} rest day{result.droppedCardio === 1 ? '' : 's'} with cardio won’t fit.
              </p>
            )}
          </>
        )}
        <div className="flex gap-3 mt-6">
          {n <= 7 && (
            <button type="button" disabled={!result} onClick={() => { onSwitch(result.program); onClose() }} className={primaryBtn}>
              Make it a fixed week
            </button>
          )}
          <button type="button" onClick={onClose} className={cancelBtn}>
            {n > 7 ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// Fixed week → rotation: the days keep their order, starting from today's.
function RotationDialog({ program, onSwitch, onClose }) {
  const index = (new Date().getDay() + 6) % 7
  const today = program.days[index]
  return (
    <Modal onClose={onClose} maxWidth="max-w-sm">
      <div className="p-6 sm:p-7">
        <h3 className="font-heading text-xl font-medium text-text-primary mb-2 pr-8">Switch to a rotation?</h3>
        <p className="text-[13px] text-text-muted leading-relaxed">
          Your 7 days run in order, starting with today’s
          {today ? ` (${WEEKDAY_NAMES[index]}: ${today.kind === 'rest' ? 'Rest' : today.name})` : ''}. Missed workouts wait.
        </p>
        <div className="flex gap-3 mt-6">
          <button type="button" onClick={() => { onSwitch(toRotation(program)); onClose() }} className={primaryBtn}>
            Make it a rotation
          </button>
          <button type="button" onClick={onClose} className={cancelBtn}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  )
}

// Fixed week | Rotation, in the split editor (SplitOverview — yours, or the
// coach's view of a client's). `onSwitch(program)` saves the converted split
// (lib/program.js toFixedWeek / toRotation). A split from your coach is
// `locked`: it says which it is, without the switch.
export default function ScheduleSwitch({ program, onSwitch, locked = false }) {
  const mode = scheduleMode(program)
  const [dialog, setDialog] = useState(null) // 'weekly' | 'rotating'
  const broken = brokenFixedWeek(program)

  const option = (id, label) => (
    <button
      type="button"
      onClick={() => id !== mode && setDialog(id)}
      aria-pressed={mode === id}
      className={`flex-1 px-3 py-2 text-[13px] font-medium border-none cursor-pointer transition-colors ${
        mode === id ? 'bg-text-primary text-cream' : 'bg-white text-text-muted hover:text-text-primary'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="mt-3">
      {locked ? (
        <p className="text-[12px] text-text-muted">
          {mode === 'weekly' ? 'Fixed week' : 'Rotation'} · {LINE[mode]}
        </p>
      ) : (
        <>
          <div className="flex border border-border max-w-xs" role="group" aria-label="Schedule">
            {option('weekly', 'Fixed week')}
            {option('rotating', 'Rotation')}
          </div>
          <p className="text-[12px] text-text-muted mt-2">
            {broken ? 'A fixed week needs 7 days — this runs as a rotation until it has 7.' : LINE[mode]}
          </p>
        </>
      )}
      {dialog === 'weekly' && <FixedWeekDialog program={program} onSwitch={onSwitch} onClose={() => setDialog(null)} />}
      {dialog === 'rotating' && <RotationDialog program={program} onSwitch={onSwitch} onClose={() => setDialog(null)} />}
    </div>
  )
}
