import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { ArrowLeft, Plus, X, Dumbbell, Moon, Trash2, Locate, FileOutput, Copy } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'
import ExportModal from '../components/ExportModal'
import DayCard from '../components/DayCard'
import ScheduleSwitch from '../components/ScheduleSwitch'
import { SortableList, SortableItem, DragHandle } from '../components/Sortable'
import { createDay, appendDay, removeDay, moveDayTo, setProgramName, setPointerToDay, splitSetCap, hasPlannedWork } from '../lib/program'
import { cardioOf, cardioTargetText } from '../lib/cardio'
import { dayStats } from '../lib/planStats'

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Level 2 of the split: the split's name and its days, one card each.
//
// The days used to be edited inline here, all of them at once, which is what
// squeezed exercise names down to "Barbell Bench Pre…" on a phone. Now a card
// SUMMARISES its day — how much work, how taxing, which muscles — and tapping it
// opens that day on its own page with room to edit. This page edits the split;
// the day page edits the day.
//
// The same page edits a coach's CLIENT split (ClientSplitLayout): `mode` is
// 'client' there, and everything about running a split yourself — Active, Set
// as today, Up next — is left out, since a client's split is never yours to
// follow. `basePath`/`listPath` say where this split and its list live.
//
// `locked` is a split your coach sent (lib/coachSync.js): you follow it, but its
// days are theirs to change — no editing here, just a way to a copy of your own.
export default function SplitOverview() {
  const {
    program, update, isActive, setActiveRoutine, deleteRoutine, isWeekly, todayWeekdayIndex, pointerIndex, highlightIndex,
    mode = 'own', client = null, basePath = `/split/${program.id}`, listPath = '/programs', listLabel = 'Back to programs',
    locked = false, duplicateRoutine = null, liveOnAccount = false,
  } = useOutletContext()
  const own = mode !== 'client'
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [exporting, setExporting] = useState(false)

  const trainingDays = program.days.filter((d) => d.kind === 'train').length

  // A fresh day is empty and the next thing you want is the exercise picker, so
  // go straight into it rather than back to a card with nothing on it.
  function addDay(kind) {
    const day = createDay(kind)
    update((p) => appendDay(p, day))
    if (kind === 'train') navigate(`${basePath}/day/${day.id}`)
  }

  function handleDelete() {
    deleteRoutine(program.id)
    navigate(listPath)
  }

  function makeOwnCopy() {
    const copy = duplicateRoutine(program)
    navigate(`/split/${copy.id}`)
  }

  return (
    <>
      <Link to={listPath} className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary no-underline text-[13px] mb-10 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> {listLabel}
      </Link>

      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        {/* Split header */}
        <div className="bg-white border border-border p-5 sm:p-6 mb-6">
          <div className="flex items-center justify-between gap-3 mb-2">
            <label className="text-[11px] uppercase tracking-wider text-text-light">Split name</label>
            {!own ? (
              client && (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted border border-border px-1.5 py-0.5 truncate max-w-[50%]">
                  For {client.name}{liveOnAccount ? ' · live' : ''}
                </span>
              )
            ) : isActive ? (
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
          {locked ? (
            <p className="font-heading text-[18px] font-medium text-text-primary break-words">{program.name}</p>
          ) : (
            <input
              value={program.name}
              onChange={(e) => update((p) => setProgramName(p, e.target.value))}
              className="w-full bg-cream border border-border px-3 py-2.5 text-text-primary text-[15px] font-heading font-medium outline-none focus:border-text-primary transition-colors"
            />
          )}
          {locked && (
            <div className="flex items-center justify-between gap-3 flex-wrap bg-cream border border-border px-3 py-2.5 mt-3">
              <p className="text-[12px] text-text-secondary">From Leon. He keeps it up to date.</p>
              <button
                onClick={makeOwnCopy}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-text-muted hover:text-text-primary bg-white border border-border hover:border-border-hover px-3 py-1.5 cursor-pointer transition-colors"
              >
                <Copy className="w-3.5 h-3.5" /> Make my own copy
              </button>
            </div>
          )}
          <p className="text-[12px] text-text-muted mt-3">
            {trainingDays} training day{trainingDays !== 1 ? 's' : ''}
            {isWeekly ? ' · day 1 is Monday, day 7 is Sunday' : ''}
          </p>
          {program.days.length > 0 && <ScheduleSwitch program={program} locked={locked} onSwitch={(next) => update(() => next)} />}
          {trainingDays > 0 && (
            <button
              onClick={() => setExporting(true)}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-text-muted hover:text-text-primary bg-white border border-border hover:border-border-hover px-3 py-1.5 mt-4 cursor-pointer transition-colors"
            >
              <FileOutput className="w-3.5 h-3.5" /> Export as text or Excel
            </button>
          )}
        </div>

        {/* Day cards — drag the ⋮⋮ grip to reorder (components/Sortable.jsx). */}
        <SortableList ids={program.days.map((d) => d.id)} onMove={(from, to) => update((p) => moveDayTo(p, from, to))}>
          {program.days.map((day, dayIndex) => {
            const rest = day.kind === 'rest'
            const stats = hasPlannedWork(day) ? dayStats(day) : null
            const dayHref = `${basePath}/day/${day.id}`
            return (
              <SortableItem key={day.id} id={day.id} className="mb-3">
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <DayCard
                  highlight={dayIndex === highlightIndex}
                  to={dayHref}
                  linkLabel={`Open ${day.name || 'this day'}`}
                  stats={stats}
                  setCap={rest ? null : splitSetCap(program)}
                  chips={day.exercises.map((ex) => {
                    const cardio = ex.kind === 'cardio' ? cardioOf(ex) : null
                    return { key: ex.id, label: ex.name, suffix: cardio ? cardioTargetText(cardio.target) : ex.kind === 'cardio' ? null : `${ex.sets}×` }
                  })}
                  cta={rest ? 'Open rest day' : undefined}
                  note={
                    rest
                      ? day.exercises.length
                        ? `${isWeekly ? 'A rest day' : 'A rest slot'} with optional cardio.`
                        : locked
                          ? `${isWeekly ? 'A rest day' : 'A rest slot in the rotation'}.`
                          : `${isWeekly ? 'A rest day' : 'A rest slot in the rotation'} — tap to add optional cardio.`
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
                      ) : !own ? null : (
                        <button
                          onClick={() => update((p) => setPointerToDay(p, day.id))}
                          aria-label={`Set ${day.name || 'this day'} as today`}
                          title="Not right? Set this as today's day."
                          className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer px-1 py-0.5 transition-colors"
                        >
                          <Locate className="w-3 h-3" /> Set as today
                        </button>
                      )}
                      {!locked && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          <DragHandle label={`Reorder ${day.name || 'this day'}`} />
                          <button onClick={() => update((p) => removeDay(p, day.id))} aria-label="Remove day" className="text-text-light hover:text-red-600 bg-transparent border-none cursor-pointer p-1">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </>
                  }
                />
              </motion.div>
              </SortableItem>
            )
          })}
        </SortableList>

        {/* Add day / delete split */}
        {!locked && (
          <>
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
          </>
        )}
      </motion.div>

      {exporting && <ExportModal program={program} client={client} onClose={() => setExporting(false)} />}

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
