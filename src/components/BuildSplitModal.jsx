import { useState, useMemo } from 'react'
import { CalendarRange, Dumbbell, Moon } from 'lucide-react'
import Modal from './Modal'
import { programFromHistory } from '../lib/splitFromHistory'
import { setProgramName } from '../lib/program'

// "Here's the split your logs describe — want it?"
//
// The proposal is computed here and shown in full BEFORE anything is written:
// every day, how many exercises it got, and which sessions it came from. A
// routine created behind the user's back would quietly change what the logger
// pre-fills and what the calendar says is due, so this is always a decision,
// never a side effect. Cancel writes nothing at all.
export default function BuildSplitModal({ sessions, onCreate, onClose }) {
  const built = useMemo(() => programFromHistory(sessions), [sessions])
  const [name, setName] = useState(built?.program.name || 'My split')

  if (!built) {
    return (
      <Modal onClose={onClose} maxWidth="max-w-sm">
        <div className="p-7">
          <h3 className="font-heading text-xl font-medium text-text-primary mb-2">Not enough to go on yet</h3>
          <p className="text-[13px] text-text-muted mb-6 leading-relaxed">
            Log a few more sessions and we can shape them into a split. Repeating the same workouts is what gives it
            something to recognise.
          </p>
          <button
            onClick={onClose}
            className="w-full bg-text-primary text-cream font-medium py-3 border-none cursor-pointer text-[14px] hover:bg-accent-hover transition-colors"
          >
            Got it
          </button>
        </div>
      </Modal>
    )
  }

  const { program, summary } = built

  function create() {
    onCreate(setProgramName(program, name.trim() || 'My split'))
    onClose()
  }

  return (
    <Modal onClose={onClose}>
      <div className="p-7">
        <h3 className="font-heading text-xl font-medium text-text-primary mb-1">Build a split from your workouts</h3>
        <p className="text-[13px] text-text-muted mb-6 leading-relaxed">
          Taken from your last {summary.sourceCount} session{summary.sourceCount !== 1 ? 's' : ''} — the workouts you
          repeat, the exercises you keep, and the sets and reps you've been doing them for.
        </p>

        <label className="block text-[11px] uppercase tracking-wider text-text-light mb-1.5" htmlFor="split-name">
          Name
        </label>
        <input
          id="split-name"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 60))}
          className="w-full bg-cream border border-border px-3 py-2 text-text-primary text-[14px] outline-none focus:border-text-primary transition-colors mb-5"
        />

        <div className="flex items-center gap-2 text-[12px] text-text-muted mb-3">
          <CalendarRange className="w-3.5 h-3.5 shrink-0" />
          <span>{summary.shapeLabel}</span>
        </div>

        {/* The days as they'll be created. Rest days are shown too — they're
            what makes the schedule land on the right calendar days. */}
        <div className="border border-border divide-y divide-border max-h-72 overflow-y-auto mb-6">
          {summary.days.map((d, i) => (
            <div key={d.id} className="flex items-start gap-3 px-3 py-2.5">
              {d.kind === 'rest' ? (
                <Moon className="w-3.5 h-3.5 text-text-light shrink-0 mt-0.5" />
              ) : (
                <Dumbbell className="w-3.5 h-3.5 text-text-light shrink-0 mt-0.5" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-[13px] font-medium text-text-primary break-words">
                    {d.weekday || `Day ${i + 1}`}
                  </span>
                  {d.kind !== 'rest' && (
                    <span className="text-[12px] text-text-secondary break-words">{d.name}</span>
                  )}
                </div>
                <p className="text-[11px] text-text-light mt-0.5 break-words">
                  {d.kind === 'rest'
                    ? 'Rest'
                    : `${d.exerciseCount} exercise${d.exerciseCount !== 1 ? 's' : ''}${
                        d.sample.length ? ` · ${d.sample.join(', ')}${d.exerciseCount > d.sample.length ? '…' : ''}` : ''
                      }`}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={create}
            className="flex-1 bg-text-primary text-cream font-medium py-3 border-none cursor-pointer text-[14px] hover:bg-accent-hover transition-colors"
          >
            Create split
          </button>
          <button
            onClick={onClose}
            className="px-5 text-text-muted hover:text-text-primary bg-white border border-border hover:border-border-hover cursor-pointer text-[13px] transition-colors"
          >
            Cancel
          </button>
        </div>
        <p className="text-[11px] text-text-light mt-3 leading-relaxed">
          Nothing's saved until you tap Create — and everything is editable afterwards.
        </p>
      </div>
    </Modal>
  )
}
