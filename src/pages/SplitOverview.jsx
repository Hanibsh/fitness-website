import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { ArrowLeft, Plus, X, ChevronUp, ChevronDown, Dumbbell, Moon, Trash2, Locate } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'
import DayCard from '../components/DayCard'
import { createDay, appendDay, removeDay, moveDay, setProgramName, setPointerToDay } from '../lib/program'
import { dayStats } from '../lib/planStats'

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Level 2 of the split: the split's name and its days, one card each.
//
// The days used to be edited inline here, all of them at once, which is what
// squeezed exercise names down to "Barbell Bench Pre…" on a phone. Now a card
// SUMMARISES its day — how much work, how taxing, which muscles — and tapping it
// opens that day on its own page with room to edit. This page edits the split;
// the day page edits the day.
export default function SplitOverview() {
  const { program, update, isActive, setActiveRoutine, deleteRoutine, isWeekly, todayWeekdayIndex, pointerIndex, highlightIndex } = useOutletContext()
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const trainingDays = program.days.filter((d) => d.kind === 'train').length

  // A fresh day is empty and the next thing you want is the exercise picker, so
  // go straight into it rather than back to a card with nothing on it.
  function addDay(kind) {
    const day = createDay(kind)
    update((p) => appendDay(p, day))
    if (kind === 'train') navigate(`/split/${program.id}/day/${day.id}`)
  }

  function handleDelete() {
    deleteRoutine(program.id)
    navigate('/log/split')
  }

  return (
    <>
      <Link to="/log/split" className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary no-underline text-[13px] mb-10 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to your splits
      </Link>

      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        {/* Split header */}
        <div className="bg-white border border-border p-5 sm:p-6 mb-6">
          <div className="flex items-center justify-between gap-3 mb-2">
            <label className="text-[11px] uppercase tracking-wider text-text-light">Split name</label>
            {isActive ? (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-cream bg-text-primary px-1.5 py-0.5">Active split</span>
            ) : (
              <button
                onClick={() => setActiveRoutine(program.id)}
                className="text-[11px] font-medium text-text-muted hover:text-text-primary bg-white border border-border hover:border-border-hover px-2 py-1 cursor-pointer transition-colors"
              >
                Set as active
              </button>
            )}
          </div>
          <input
            value={program.name}
            onChange={(e) => update((p) => setProgramName(p, e.target.value))}
            className="w-full bg-cream border border-border px-3 py-2.5 text-text-primary text-[15px] font-heading font-medium outline-none focus:border-text-primary transition-colors"
          />
          <p className="text-[12px] text-text-muted mt-3">
            {trainingDays} training day{trainingDays !== 1 ? 's' : ''}
            {isWeekly
              ? ' · fixed weekly schedule — day 1 is Monday, day 7 is Sunday. Missing a day never shifts it.'
              : ' · rotates in order, advancing as you log.'}
          </p>
          {!isWeekly && program.days.length > 0 && (
            <p className="text-[11px] text-text-light mt-1.5">
              Tip: make it exactly 7 days (rest days included) and it becomes a fixed weekly schedule instead.
            </p>
          )}
        </div>

        {/* Day cards */}
        <AnimatePresence initial={false}>
          {program.days.map((day, dayIndex) => {
            const stats = day.kind === 'rest' ? null : dayStats(day)
            const dayHref = `/split/${program.id}/day/${day.id}`
            return (
              <motion.div
                key={day.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-3"
              >
                <DayCard
                  highlight={dayIndex === highlightIndex}
                  to={day.kind === 'rest' ? undefined : dayHref}
                  linkLabel={`Open ${day.name || 'this day'}`}
                  stats={stats}
                  chips={day.exercises.map((ex) => ({ key: ex.id, label: ex.name, suffix: `${ex.sets}×` }))}
                  note={
                    day.kind === 'rest'
                      ? isWeekly
                        ? 'A rest day — no exercises.'
                        : 'A rest slot in the rotation — no exercises.'
                      : stats.exercises === 0
                        ? 'No exercises yet — tap to add some.'
                        : null
                  }
                  header={
                    <>
                      {/* The name is a link rather than the whole header being
                          one: the reorder/remove buttons sit in this row. */}
                      <Link to={dayHref} className="flex-1 min-w-0 flex items-center gap-2 no-underline group">
                        {day.kind === 'rest' ? <Moon className="w-4 h-4 text-text-light shrink-0" /> : <Dumbbell className="w-4 h-4 text-text-primary shrink-0" />}
                        {isWeekly && (
                          <span className="shrink-0 text-[9px] font-medium uppercase tracking-wider text-text-muted border border-border bg-white px-1.5 py-0.5">
                            {WEEKDAY_NAMES[dayIndex]}
                          </span>
                        )}
                        <span className="min-w-0 text-[14px] font-medium text-text-primary break-words group-hover:text-accent-hover transition-colors">
                          {day.name}
                        </span>
                      </Link>
                      {isWeekly ? (
                        dayIndex === todayWeekdayIndex && (
                          <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wider text-cream bg-text-primary px-1.5 py-0.5">Today</span>
                        )
                      ) : dayIndex === pointerIndex ? (
                        <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wider text-cream bg-text-primary px-1.5 py-0.5">Up next</span>
                      ) : (
                        <button
                          onClick={() => update((p) => setPointerToDay(p, day.id))}
                          aria-label={`Set ${day.name || 'this day'} as today`}
                          title="Not right? Set this as today's day."
                          className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer px-1 py-0.5 transition-colors"
                        >
                          <Locate className="w-3 h-3" /> Set as today
                        </button>
                      )}
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button onClick={() => update((p) => moveDay(p, dayIndex, -1))} disabled={dayIndex === 0} aria-label="Move day up" className="text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer p-1 disabled:opacity-30 disabled:cursor-not-allowed">
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button onClick={() => update((p) => moveDay(p, dayIndex, 1))} disabled={dayIndex === program.days.length - 1} aria-label="Move day down" className="text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer p-1 disabled:opacity-30 disabled:cursor-not-allowed">
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        <button onClick={() => update((p) => removeDay(p, day.id))} aria-label="Remove day" className="text-text-light hover:text-red-600 bg-transparent border-none cursor-pointer p-1">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  }
                />
              </motion.div>
            )
          })}
        </AnimatePresence>

        {/* Add day / delete split */}
        <div className="flex flex-wrap gap-3 mt-5">
          <button onClick={() => addDay('train')} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-cream bg-text-primary px-4 py-2.5 border-none cursor-pointer hover:bg-accent-hover transition-colors">
            <Plus className="w-4 h-4" /> Training day
          </button>
          <button onClick={() => addDay('rest')} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-muted hover:text-text-primary bg-white border border-border hover:border-border-hover px-4 py-2.5 cursor-pointer transition-colors">
            <Plus className="w-4 h-4" /> Rest day
          </button>
        </div>

        <button onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 text-[12px] text-text-light hover:text-red-600 bg-transparent border-none cursor-pointer mt-8 transition-colors">
          <Trash2 className="w-3.5 h-3.5" /> Delete this split
        </button>
      </motion.div>

      {confirmDelete && (
        <ConfirmModal
          title={`Delete "${program.name}"?`}
          message="This removes all its days and exercises. This can't be undone."
          onConfirm={handleDelete}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </>
  )
}
