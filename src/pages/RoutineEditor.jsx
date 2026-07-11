import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, X, ChevronUp, ChevronDown, Dumbbell, Moon, Trash2, Locate, StickyNote } from 'lucide-react'
import { useProgramsState } from '../lib/useProgramsState'
import ConfirmModal from '../components/ConfirmModal'
import {
  emptyProgram,
  createDay,
  createPlannedExercise,
  programFromTemplate,
  setPointerToDay,
  scheduleMode,
  moveInArray,
  STARTER_PROGRAMS,
} from '../lib/program'
import ExercisePicker from '../components/ExercisePicker'

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Full-page editor for ONE routine — reached from the routines list at
// /routine/:id, or /routine/new for the template/blank picker (which swaps
// the URL to the routine's real id once one is picked). Day/exercise editing
// itself is unchanged from the single-page version; only the surrounding
// routing changed.
export default function RoutineEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === 'new'
  const { programsState, loading, saveProgram, addRoutine, setActiveRoutine, deleteRoutine } = useProgramsState()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [noteOpenFor, setNoteOpenFor] = useState(() => new Set())

  const editingProgram = !isNew ? programsState.programs.find((p) => p.id === id) || null : null
  const isEditingActive = !!editingProgram && editingProgram.id === programsState.activeId

  // Every day/exercise mutator below calls this — it's the only thing that
  // changed from the single-program version (routes back into the full list).
  function update(mutator) {
    if (!editingProgram) return
    saveProgram({ ...mutator(editingProgram), updatedAt: Date.now() })
  }

  // Keep the "up next" pointer within the (possibly changed) day list.
  function clampPointer(p) {
    const pointer = p.days.length ? p.pointer % p.days.length : 0
    return pointer === p.pointer ? p : { ...p, pointer }
  }

  function startTemplate(key) {
    const program = programFromTemplate(key)
    addRoutine(program)
    navigate(`/routine/${program.id}`, { replace: true })
  }
  function startBlank() {
    const program = emptyProgram()
    addRoutine(program)
    navigate(`/routine/${program.id}`, { replace: true })
  }

  function handleDelete() {
    if (!editingProgram) return
    deleteRoutine(editingProgram.id)
    navigate('/routine')
  }

  // ---- day + exercise mutators (unchanged from the single-page version) ----
  const setName = (name) => update((p) => ({ ...p, name: name.slice(0, 60) }))
  const addDay = (kind) => update((p) => ({ ...p, days: [...p.days, createDay(kind)] }))
  const removeDay = (dayId) => update((p) => clampPointer({ ...p, days: p.days.filter((d) => d.id !== dayId) }))
  const moveDay = (index, delta) => update((p) => clampPointer({ ...p, days: moveInArray(p.days, index, delta) }))
  const setDayName = (dayId, name) =>
    update((p) => ({ ...p, days: p.days.map((d) => (d.id === dayId ? { ...d, name: name.slice(0, 40) } : d)) }))
  const setDayKind = (dayId, kind) =>
    update((p) => ({ ...p, days: p.days.map((d) => (d.id === dayId ? { ...d, kind } : d)) }))
  const jumpToDay = (dayId) => update((p) => setPointerToDay(p, dayId))

  const addExercise = (dayId, name, category, exerciseId) =>
    update((p) => ({
      ...p,
      days: p.days.map((d) =>
        d.id === dayId
          ? { ...d, exercises: [...d.exercises, createPlannedExercise(name, { exerciseId, kind: category === 'Cardio' ? 'cardio' : 'strength' })] }
          : d
      ),
    }))
  const removeExercise = (dayId, exId) =>
    update((p) => ({ ...p, days: p.days.map((d) => (d.id === dayId ? { ...d, exercises: d.exercises.filter((e) => e.id !== exId) } : d)) }))
  const moveExercise = (dayId, index, delta) =>
    update((p) => ({ ...p, days: p.days.map((d) => (d.id === dayId ? { ...d, exercises: moveInArray(d.exercises, index, delta) } : d)) }))
  const setExerciseSets = (dayId, exId, value) => {
    const sets = value === '' ? '' : Math.max(1, Math.min(20, parseInt(value, 10) || 1))
    update((p) => ({ ...p, days: p.days.map((d) => (d.id === dayId ? { ...d, exercises: d.exercises.map((e) => (e.id === exId ? { ...e, sets } : e)) } : d)) }))
  }
  const setExerciseRep = (dayId, exId, field, value) => {
    const n = value === '' ? '' : Math.max(1, Math.min(50, parseInt(value, 10) || 0))
    update((p) => ({
      ...p,
      days: p.days.map((d) =>
        d.id === dayId
          ? { ...d, exercises: d.exercises.map((e) => (e.id === exId ? { ...e, repRange: { ...(e.repRange || { low: 6, high: 10 }), [field]: n } } : e)) }
          : d
      ),
    }))
  }
  const setExerciseNote = (dayId, exId, note) =>
    update((p) => ({
      ...p,
      days: p.days.map((d) => (d.id === dayId ? { ...d, exercises: d.exercises.map((e) => (e.id === exId ? { ...e, note: note.slice(0, 300) } : e)) } : d)),
    }))
  const toggleNote = (exId) =>
    setNoteOpenFor((prev) => {
      const next = new Set(prev)
      if (next.has(exId)) next.delete(exId)
      else next.add(exId)
      return next
    })

  // Weekly (exactly 7 days): the date decides the day, so the pointer and its
  // affordances (Up next badge, Set as today) disappear — instead the card for
  // today's weekday is highlighted.
  const isWeekly = !!editingProgram && scheduleMode(editingProgram) === 'weekly'
  const todayWeekdayIndex = (new Date().getDay() + 6) % 7 // Mon=0 … Sun=6
  const pointerIndex = editingProgram && editingProgram.days.length ? editingProgram.pointer % editingProgram.days.length : -1
  const highlightIndex = isWeekly ? todayWeekdayIndex : pointerIndex

  const backLink = (
    <Link to="/routine" className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary no-underline text-[13px] mb-10 transition-colors">
      <ArrowLeft className="w-3.5 h-3.5" /> Back to routines
    </Link>
  )

  if (loading) {
    return (
      <div className="pt-28 pb-24 px-6">
        <div className="max-w-2xl mx-auto">
          {backLink}
          <p className="text-[13px] text-text-muted">Loading…</p>
        </div>
      </div>
    )
  }

  if (isNew) {
    return (
      <div className="pt-28 pb-24 px-6">
        <div className="max-w-2xl mx-auto">
          {backLink}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
            <div className="bg-white border border-border p-7">
              <h2 className="font-heading text-xl font-medium text-text-primary mb-1">New routine</h2>
              <p className="text-[13px] text-text-muted mb-6">Pick a template to tweak, or start from scratch.</p>
              <div className="space-y-3">
                {STARTER_PROGRAMS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => startTemplate(t.key)}
                    className="w-full text-left bg-cream border border-border hover:border-border-hover p-4 cursor-pointer transition-colors"
                  >
                    <p className="text-[14px] font-medium text-text-primary">{t.name}</p>
                    <p className="text-[12px] text-text-muted mt-0.5">{t.description}</p>
                  </button>
                ))}
                <button
                  onClick={startBlank}
                  className="w-full inline-flex items-center gap-2 text-[13px] font-medium text-text-muted hover:text-text-primary bg-white border border-border hover:border-border-hover p-4 cursor-pointer transition-colors"
                >
                  <Plus className="w-4 h-4" /> Blank program
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  if (!editingProgram) {
    return (
      <div className="pt-28 pb-24 px-6">
        <div className="max-w-2xl mx-auto">
          {backLink}
          <p className="text-[13px] text-text-muted">That routine couldn’t be found — it may have been deleted.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-28 pb-24 px-6">
      <div className="max-w-2xl mx-auto">
        {backLink}

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          {/* Program header */}
          <div className="bg-white border border-border p-5 sm:p-6 mb-6">
            <div className="flex items-center justify-between gap-3 mb-2">
              <label className="text-[11px] uppercase tracking-wider text-text-light">Routine name</label>
              {isEditingActive ? (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-cream bg-text-primary px-1.5 py-0.5">Active routine</span>
              ) : (
                <button
                  onClick={() => setActiveRoutine(editingProgram.id)}
                  className="text-[11px] font-medium text-text-muted hover:text-text-primary bg-white border border-border hover:border-border-hover px-2 py-1 cursor-pointer transition-colors"
                >
                  Set as active
                </button>
              )}
            </div>
            <input
              value={editingProgram.name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-cream border border-border px-3 py-2.5 text-text-primary text-[15px] font-heading font-medium outline-none focus:border-text-primary transition-colors"
            />
            <p className="text-[12px] text-text-muted mt-3">
              {editingProgram.days.filter((d) => d.kind === 'train').length} training day{editingProgram.days.filter((d) => d.kind === 'train').length !== 1 ? 's' : ''}
              {isWeekly
                ? ' · fixed weekly schedule — day 1 is Monday, day 7 is Sunday. Missing a day never shifts it.'
                : ' · rotates in order, advancing as you log.'}
            </p>
            {!isWeekly && editingProgram.days.length > 0 && (
              <p className="text-[11px] text-text-light mt-1.5">
                Tip: make it exactly 7 days (rest days included) and it becomes a fixed weekly schedule instead.
              </p>
            )}
          </div>

          {/* Days */}
          <AnimatePresence initial={false}>
            {editingProgram.days.map((day, dayIndex) => (
              <motion.div
                key={day.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className={`mb-4 border bg-white ${dayIndex === highlightIndex ? 'border-text-primary' : 'border-border'}`}
              >
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-cream">
                  {day.kind === 'rest' ? <Moon className="w-4 h-4 text-text-light shrink-0" /> : <Dumbbell className="w-4 h-4 text-text-primary shrink-0" />}
                  {isWeekly && (
                    <span className="shrink-0 text-[9px] font-medium uppercase tracking-wider text-text-muted border border-border bg-white px-1.5 py-0.5">
                      {WEEKDAY_NAMES[dayIndex]}
                    </span>
                  )}
                  <input
                    value={day.name}
                    onChange={(e) => setDayName(day.id, e.target.value)}
                    aria-label="Day name"
                    className="flex-1 min-w-0 bg-transparent text-[14px] font-medium text-text-primary outline-none border-b border-transparent focus:border-border"
                  />
                  {isWeekly ? (
                    dayIndex === todayWeekdayIndex && (
                      <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wider text-cream bg-text-primary px-1.5 py-0.5">Today</span>
                    )
                  ) : dayIndex === pointerIndex ? (
                    <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wider text-cream bg-text-primary px-1.5 py-0.5">Up next</span>
                  ) : (
                    <button
                      onClick={() => jumpToDay(day.id)}
                      aria-label={`Set ${day.name || 'this day'} as today`}
                      title="Not right? Set this as today's day."
                      className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer px-1 py-0.5 transition-colors"
                    >
                      <Locate className="w-3 h-3" /> Set as today
                    </button>
                  )}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => moveDay(dayIndex, -1)} disabled={dayIndex === 0} aria-label="Move day up" className="text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer p-1 disabled:opacity-30 disabled:cursor-not-allowed">
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button onClick={() => moveDay(dayIndex, 1)} disabled={dayIndex === editingProgram.days.length - 1} aria-label="Move day down" className="text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer p-1 disabled:opacity-30 disabled:cursor-not-allowed">
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button onClick={() => removeDay(day.id)} aria-label="Remove day" className="text-text-light hover:text-red-600 bg-transparent border-none cursor-pointer p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="px-4 py-3">
                  {/* train / rest toggle */}
                  <div className="flex border border-border w-max mb-3">
                    {[['train', 'Training'], ['rest', 'Rest']].map(([k, label]) => (
                      <button
                        key={k}
                        onClick={() => setDayKind(day.id, k)}
                        className={`px-3 py-1 text-[12px] font-medium cursor-pointer transition-colors ${day.kind === k ? 'bg-text-primary text-cream' : 'bg-white text-text-muted hover:text-text-primary'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {day.kind === 'rest' ? (
                    <p className="text-[12px] text-text-light">{isWeekly ? 'A rest day — no exercises.' : 'A rest slot in the rotation — no exercises.'}</p>
                  ) : (
                    <>
                      {day.exercises.length > 0 && (
                        <div className="mb-3 space-y-2">
                          {/* header row */}
                          <div className="grid grid-cols-[1fr_44px_92px_28px] gap-2 items-center text-[10px] uppercase tracking-wider text-text-light">
                            <span>Exercise</span>
                            <span className="text-center">Sets</span>
                            <span className="text-center">Reps</span>
                            <span />
                          </div>
                          {day.exercises.map((ex, exIndex) => {
                            const noteOpen = noteOpenFor.has(ex.id) || !!ex.note
                            return (
                              <div key={ex.id}>
                                <div className="grid grid-cols-[1fr_44px_92px_28px] gap-2 items-center">
                                  <div className="min-w-0 flex items-center gap-1">
                                    <div className="flex flex-col shrink-0">
                                      <button onClick={() => moveExercise(day.id, exIndex, -1)} disabled={exIndex === 0} aria-label="Move exercise up" className="text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer p-0 leading-none disabled:opacity-30 disabled:cursor-not-allowed">
                                        <ChevronUp className="w-3 h-3" />
                                      </button>
                                      <button onClick={() => moveExercise(day.id, exIndex, 1)} disabled={exIndex === day.exercises.length - 1} aria-label="Move exercise down" className="text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer p-0 leading-none disabled:opacity-30 disabled:cursor-not-allowed">
                                        <ChevronDown className="w-3 h-3" />
                                      </button>
                                    </div>
                                    <span className="text-[13px] text-text-primary truncate">{ex.name}</span>
                                    <button
                                      onClick={() => toggleNote(ex.id)}
                                      aria-label={ex.note ? `Edit note for ${ex.name}` : `Add note for ${ex.name}`}
                                      title="Note"
                                      className={`shrink-0 bg-transparent border-none cursor-pointer p-0.5 leading-none ${ex.note ? 'text-text-primary' : 'text-text-light hover:text-text-primary'}`}
                                    >
                                      <StickyNote className="w-3 h-3" />
                                    </button>
                                  </div>
                                  <input
                                    type="number" inputMode="numeric" min="1" max="20"
                                    value={ex.sets}
                                    onChange={(e) => setExerciseSets(day.id, ex.id, e.target.value)}
                                    aria-label={`${ex.name} target sets`}
                                    className="w-full bg-cream border border-border px-1 py-1.5 text-center text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors"
                                  />
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number" inputMode="numeric" min="1" max="50"
                                      value={ex.repRange?.low ?? ''}
                                      onChange={(e) => setExerciseRep(day.id, ex.id, 'low', e.target.value)}
                                      aria-label={`${ex.name} rep low`}
                                      className="w-full bg-cream border border-border px-1 py-1.5 text-center text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors"
                                    />
                                    <span className="text-text-light text-[12px]">–</span>
                                    <input
                                      type="number" inputMode="numeric" min="1" max="50"
                                      value={ex.repRange?.high ?? ''}
                                      onChange={(e) => setExerciseRep(day.id, ex.id, 'high', e.target.value)}
                                      aria-label={`${ex.name} rep high`}
                                      className="w-full bg-cream border border-border px-1 py-1.5 text-center text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors"
                                    />
                                  </div>
                                  <button onClick={() => removeExercise(day.id, ex.id)} aria-label={`Remove ${ex.name}`} className="flex justify-center text-text-light hover:text-red-600 bg-transparent border-none cursor-pointer">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                {noteOpen && (
                                  <textarea
                                    value={ex.note || ''}
                                    onChange={(e) => setExerciseNote(day.id, ex.id, e.target.value)}
                                    placeholder="Note — form cue, machine setting, anything worth remembering…"
                                    aria-label={`Note for ${ex.name}`}
                                    rows={2}
                                    className="w-full mt-1.5 bg-cream border border-border px-2 py-1.5 text-text-primary text-[12px] outline-none focus:border-text-primary transition-colors resize-none"
                                  />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                      <ExercisePicker
                        onSelect={(name, category, id) => addExercise(day.id, name, category, id)}
                        placeholder="Add an exercise…"
                      />
                    </>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Add day / delete routine */}
          <div className="flex flex-wrap gap-3 mt-2">
            <button onClick={() => addDay('train')} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-cream bg-text-primary px-4 py-2.5 border-none cursor-pointer hover:bg-accent-hover transition-colors">
              <Plus className="w-4 h-4" /> Training day
            </button>
            <button onClick={() => addDay('rest')} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-muted hover:text-text-primary bg-white border border-border hover:border-border-hover px-4 py-2.5 cursor-pointer transition-colors">
              <Moon className="w-4 h-4" /> Rest day
            </button>
          </div>

          <button onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 text-[12px] text-text-light hover:text-red-600 bg-transparent border-none cursor-pointer mt-8 transition-colors">
            <Trash2 className="w-3.5 h-3.5" /> Delete this routine
          </button>
        </motion.div>
      </div>

      {confirmDelete && (
        <ConfirmModal
          title={`Delete "${editingProgram.name}"?`}
          message="This removes all its days and exercises. This can't be undone."
          onConfirm={handleDelete}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </div>
  )
}
