import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, X, ChevronUp, ChevronDown, Dumbbell, Moon, Trash2, Locate, StickyNote, Repeat, Link2, ArrowLeftRight } from 'lucide-react'
import { useProgramsState } from '../lib/useProgramsState'
import ConfirmModal from '../components/ConfirmModal'
import {
  emptyProgram,
  createDay,
  createPlannedExercise,
  setPointerToDay,
  scheduleMode,
  effectiveRotation,
  moveInArray,
  canChooseLaterality,
  matchesPlanned,
} from '../lib/program'
import { supersetLabels, newSupersetId, pruneSupersets, regroupSupersets, exerciseBlocks } from '../lib/workoutStats'
import { getDayAnnotations, getExerciseNote, saveExerciseNote, getExerciseNotesMap } from '../lib/workoutStore'
import { upsertRemoteExerciseNotes } from '../lib/workoutRemote'
import { useAuth } from '../lib/auth'
import ExercisePicker from '../components/ExercisePicker'

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Full-page editor for ONE training split — reached from the split list at
// /split/:id. Splits are always built from scratch (the old starter-template
// picker is gone — ready-made programs are the upcoming Programs feature).
// (Internals still say "program"/"routine" — only the user-facing wording was
// renamed to "split".)
export default function RoutineEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { programsState, loading, saveProgram, addRoutine, setActiveRoutine, deleteRoutine } = useProgramsState()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [noteOpenFor, setNoteOpenFor] = useState(() => new Set())
  const [swapOpenFor, setSwapOpenFor] = useState(null)
  const [supersetMenuFor, setSupersetMenuFor] = useState(null)
  const isNew = id === 'new'
  const creatingRef = useRef(false)

  // Landing on /split/new creates a blank split, then swaps the URL to its id.
  // Creation happens HERE (not on the list page) on purpose: /split/new and
  // /split/:id are the same route element, so the component stays mounted across
  // the swap and the just-created split is already in this hook's in-memory
  // state — no reload, no race. Doing it on the list page navigated to a fresh
  // editor that reloaded storage before the write landed and 404'd.
  useEffect(() => {
    if (isNew && !loading && !creatingRef.current) {
      creatingRef.current = true
      const program = emptyProgram()
      addRoutine(program)
      navigate(`/split/${program.id}`, { replace: true })
    }
  }, [isNew, loading, addRoutine, navigate])

  const editingProgram = programsState.programs.find((p) => p.id === id) || null
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

  function handleDelete() {
    if (!editingProgram) return
    deleteRoutine(editingProgram.id)
    navigate('/log/split')
  }

  // ---- day + exercise mutators (unchanged from the single-page version) ----
  const setName = (name) => update((p) => ({ ...p, name: name.slice(0, 60) }))
  const addDay = (kind) => update((p) => ({ ...p, days: [...p.days, createDay(kind)] }))
  const removeDay = (dayId) => update((p) => clampPointer({ ...p, days: p.days.filter((d) => d.id !== dayId) }))
  const moveDay = (index, delta) => update((p) => clampPointer({ ...p, days: moveInArray(p.days, index, delta) }))
  const setDayName = (dayId, name) =>
    update((p) => ({ ...p, days: p.days.map((d) => (d.id === dayId ? { ...d, name: name.slice(0, 40) } : d)) }))
  const jumpToDay = (dayId) => update((p) => setPointerToDay(p, dayId))

  const addExercise = (dayId, name, category, exerciseId) =>
    update((p) => ({
      ...p,
      days: p.days.map((d) =>
        d.id === dayId
          ? {
              ...d,
              exercises: [
                ...d.exercises,
                createPlannedExercise(name, {
                  exerciseId,
                  kind: category === 'Cardio' ? 'cardio' : 'strength',
                  // Whatever this movement's note already says, wherever it was
                  // written — notes belong to the movement, not to the slot.
                  note: getExerciseNote({ exerciseId, name }),
                }),
              ],
            }
          : d
      ),
    }))
  const removeExercise = (dayId, exId) =>
    update((p) => ({ ...p, days: p.days.map((d) => (d.id === dayId ? { ...d, exercises: pruneSupersets(d.exercises.filter((e) => e.id !== exId)) } : d)) }))

  // Same superset model as the logger: partners share a supersetId, groups are
  // pulled contiguous on pairing, lone leftovers are pruned back to standalone.
  const pairSuperset = (dayId, exId, targetId) =>
    update((p) => ({
      ...p,
      days: p.days.map((d) => {
        if (d.id !== dayId) return d
        const a = d.exercises.find((e) => e.id === exId)
        const b = d.exercises.find((e) => e.id === targetId)
        if (!a || !b || a.kind === 'cardio' || b.kind === 'cardio') return d
        const groupId = b.supersetId || a.supersetId || newSupersetId()
        const exercises = d.exercises.map((e) => (e.id === exId || e.id === targetId ? { ...e, supersetId: groupId } : e))
        return { ...d, exercises: regroupSupersets(pruneSupersets(exercises)) }
      }),
    }))
  const unpairSuperset = (dayId, exId) =>
    update((p) => ({
      ...p,
      days: p.days.map((d) =>
        d.id === dayId
          ? { ...d, exercises: pruneSupersets(d.exercises.map((e) => (e.id === exId ? { ...e, supersetId: null } : e))) }
          : d
      ),
    }))
  // Reorder by BLOCK: a contiguous superset group moves as one unit, exactly
  // like the logger — nudging any member moves the whole pair.
  const moveExercise = (dayId, exId, delta) =>
    update((p) => ({
      ...p,
      days: p.days.map((d) => {
        if (d.id !== dayId) return d
        const blocks = exerciseBlocks(d.exercises)
        const from = blocks.findIndex((b) => b.some((e) => e.id === exId))
        if (from === -1 || from + delta < 0 || from + delta >= blocks.length) return d
        return { ...d, exercises: moveInArray(blocks, from, delta).flat() }
      }),
    }))
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
  // Whether this movement is logged one limb at a time. Two-state, not tri-:
  // for a movement the DB leaves open, "no opinion" and "bilateral" look the
  // same in the logger, so a third state would have nothing to say. Toggling
  // just makes the row explicit — which is what a session syncing back writes
  // anyway.
  const toggleExerciseUnilateral = (dayId, exId) =>
    update((p) => ({
      ...p,
      days: p.days.map((d) =>
        d.id === dayId ? { ...d, exercises: d.exercises.map((e) => (e.id === exId ? { ...e, unilateral: !e.unilateral } : e)) } : d
      ),
    }))
  // A note belongs to the MOVEMENT, not to this slot: writing one here writes it
  // everywhere that movement appears. The shared store is the source of truth
  // (that's what other splits and the logger read); the copy on each planned row
  // is kept in step so this split renders right away without a reload.
  const setExerciseNote = (dayId, exId, note) =>
    update((p) => {
      const target = p.days.find((d) => d.id === dayId)?.exercises.find((e) => e.id === exId)
      if (!target) return p
      saveExerciseNote(target, note)
      const trimmed = note.slice(0, 300)
      return {
        ...p,
        days: p.days.map((d) => ({
          ...d,
          exercises: d.exercises.map((e) => (matchesPlanned(target, e) ? { ...e, note: trimmed } : e)),
        })),
      }
    })

  // Push the notes map up once typing stops (blur), not per keystroke — a
  // network call per character would be wasteful and racy. Best-effort: a
  // failed push just leaves the account slightly behind until the next one.
  function syncNotesToRemote() {
    if (!user) return
    upsertRemoteExerciseNotes(user.id, getExerciseNotesMap()).catch(() => {})
  }
  const toggleNote = (exId) =>
    setNoteOpenFor((prev) => {
      const next = new Set(prev)
      if (next.has(exId)) next.delete(exId)
      else next.add(exId)
      return next
    })

  // Swap a planned exercise's identity (name/DB link/kind) in place — sets,
  // rep target and note all stay as planned, only WHAT you're doing changes.
  const substituteExercise = (dayId, exId, name, category, exerciseId) =>
    update((p) => ({
      ...p,
      days: p.days.map((d) =>
        d.id === dayId
          ? { ...d, exercises: d.exercises.map((e) => (e.id === exId ? { ...e, name: name.trim().slice(0, 60), exerciseId, kind: category === 'Cardio' ? 'cardio' : 'strength' } : e)) }
          : d
      ),
    }))

  // Weekly (exactly 7 days): the date decides the day, so the pointer and its
  // affordances (Up next badge, Set as today) disappear — instead the card for
  // today's weekday is highlighted.
  const isWeekly = !!editingProgram && scheduleMode(editingProgram) === 'weekly'
  const todayWeekdayIndex = (new Date().getDay() + 6) % 7 // Mon=0 … Sun=6
  // Effective (rest-days-auto-passed) position, not the raw stored pointer, so
  // the badge matches what the logger and calendar say is up. A one-time local
  // annotations snapshot is fine for a display-only badge.
  const [dayAnnotations] = useState(() => getDayAnnotations())
  const pointerIndex = editingProgram && editingProgram.days.length ? effectiveRotation(editingProgram, { annotations: dayAnnotations }).index : -1
  const highlightIndex = isWeekly ? todayWeekdayIndex : pointerIndex

  const backLink = (
    <Link to="/log/split" className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary no-underline text-[13px] mb-10 transition-colors">
      <ArrowLeft className="w-3.5 h-3.5" /> Back to your splits
    </Link>
  )

  // Still loading, or on /split/new mid-create (the effect above is swapping the
  // URL to the real split) — show a spinner rather than a false "not found".
  if (loading || isNew) {
    return (
      <div className="pt-28 pb-24 px-6">
        <div className="max-w-2xl mx-auto">
          {backLink}
          <p className="text-[13px] text-text-muted">Loading…</p>
        </div>
      </div>
    )
  }

  if (!editingProgram) {
    return (
      <div className="pt-28 pb-24 px-6">
        <div className="max-w-2xl mx-auto">
          {backLink}
          <p className="text-[13px] text-text-muted">That split couldn’t be found — it may have been deleted.</p>
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
              <label className="text-[11px] uppercase tracking-wider text-text-light">Split name</label>
              {isEditingActive ? (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-cream bg-text-primary px-1.5 py-0.5">Active split</span>
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
            {editingProgram.days.map((day, dayIndex) => {
              // Per-day superset context: A1/A2 labels, and the block index of
              // each exercise (a contiguous group is one block) for the
              // move-up/down disabled states.
              const groups = supersetLabels(day.exercises)
              const blocks = exerciseBlocks(day.exercises)
              const blockIdxOf = new Map()
              blocks.forEach((b, i) => b.forEach((e) => blockIdxOf.set(e.id, i)))
              const strengthCount = day.exercises.filter((e) => e.kind !== 'cardio').length
              return (
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
                          {day.exercises.map((ex) => {
                            // The shared store wins over this row's copy, so a
                            // note written against this movement in another
                            // split (or in the logger) shows up here too.
                            const note = getExerciseNote(ex) || ex.note || ''
                            const noteOpen = noteOpenFor.has(ex.id) || !!note
                            return (
                              <div key={ex.id}>
                                <div className="grid grid-cols-[1fr_44px_92px_28px] gap-2 items-center">
                                  <div className="min-w-0 flex items-center gap-1">
                                    <div className="flex flex-col shrink-0">
                                      <button onClick={() => moveExercise(day.id, ex.id, -1)} disabled={blockIdxOf.get(ex.id) === 0} aria-label="Move exercise up" className="text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer p-0 leading-none disabled:opacity-30 disabled:cursor-not-allowed">
                                        <ChevronUp className="w-3 h-3" />
                                      </button>
                                      <button onClick={() => moveExercise(day.id, ex.id, 1)} disabled={blockIdxOf.get(ex.id) === blocks.length - 1} aria-label="Move exercise down" className="text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer p-0 leading-none disabled:opacity-30 disabled:cursor-not-allowed">
                                        <ChevronDown className="w-3 h-3" />
                                      </button>
                                    </div>
                                    {groups.get(ex.id) && (
                                      <span className="shrink-0 text-[9px] font-semibold text-cream bg-text-primary px-1 py-0.5">{groups.get(ex.id).label}</span>
                                    )}
                                    {/* Name on its own line with the controls
                                        beneath it: four icons and an exercise
                                        name can't share one narrow column —
                                        on a phone the name lost, and squeezed
                                        to nothing you can't tell the rows
                                        apart. */}
                                    <div className="min-w-0 flex-1">
                                      <span className="block text-[13px] text-text-primary truncate">{ex.name}</span>
                                      <div className="flex items-center gap-1 mt-0.5">
                                    <button
                                      onClick={() => toggleNote(ex.id)}
                                      aria-label={note ? `Edit note for ${ex.name}` : `Add note for ${ex.name}`}
                                      title="Note"
                                      className={`shrink-0 bg-transparent border-none cursor-pointer p-0.5 leading-none ${note ? 'text-text-primary' : 'text-text-light hover:text-text-primary'}`}
                                    >
                                      <StickyNote className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => setSwapOpenFor(swapOpenFor === ex.id ? null : ex.id)}
                                      aria-label={`Substitute ${ex.name}`}
                                      aria-pressed={swapOpenFor === ex.id}
                                      title="Substitute exercise"
                                      className={`shrink-0 bg-transparent border-none cursor-pointer p-0.5 leading-none ${swapOpenFor === ex.id ? 'text-text-primary' : 'text-text-light hover:text-text-primary'}`}
                                    >
                                      <Repeat className="w-3 h-3" />
                                    </button>
                                    {ex.kind !== 'cardio' && strengthCount > 1 && (
                                      <button
                                        onClick={() => setSupersetMenuFor(supersetMenuFor === ex.id ? null : ex.id)}
                                        aria-label={`Superset options for ${ex.name}`}
                                        aria-expanded={supersetMenuFor === ex.id}
                                        title={groups.get(ex.id) ? `In superset ${groups.get(ex.id).letter}` : 'Superset with another exercise'}
                                        className={`shrink-0 bg-transparent border-none cursor-pointer p-0.5 leading-none ${groups.get(ex.id) ? 'text-text-primary' : 'text-text-light hover:text-text-primary'}`}
                                      >
                                        <Link2 className="w-3 h-3" />
                                      </button>
                                    )}
                                    {canChooseLaterality(ex) && (
                                      <button
                                        onClick={() => toggleExerciseUnilateral(day.id, ex.id)}
                                        aria-pressed={!!ex.unilateral}
                                        aria-label={`${ex.name} — ${ex.unilateral ? 'logged one limb at a time' : 'logged both limbs together'}`}
                                        title={ex.unilateral ? 'Logged one limb at a time' : 'Logged both limbs together'}
                                        className={`shrink-0 bg-transparent border-none cursor-pointer p-0.5 leading-none ${ex.unilateral ? 'text-text-primary' : 'text-text-light hover:text-text-primary'}`}
                                      >
                                        <ArrowLeftRight className="w-3 h-3" />
                                      </button>
                                    )}
                                      </div>
                                    </div>
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
                                    value={note}
                                    onChange={(e) => setExerciseNote(day.id, ex.id, e.target.value)}
                                    onBlur={syncNotesToRemote}
                                    placeholder="Note — form cue, machine setting, anything worth remembering…"
                                    aria-label={`Note for ${ex.name}`}
                                    rows={2}
                                    className="w-full mt-1.5 bg-cream border border-border px-2 py-1.5 text-text-primary text-[12px] outline-none focus:border-text-primary transition-colors resize-none"
                                  />
                                )}
                                {swapOpenFor === ex.id && (
                                  <div className="mt-1.5">
                                    <ExercisePicker
                                      onSelect={(name, category, id) => { substituteExercise(day.id, ex.id, name, category, id); setSwapOpenFor(null) }}
                                      onlyCategory={ex.kind === 'cardio' ? 'Cardio' : undefined}
                                      excludeCategory={ex.kind === 'cardio' ? undefined : 'Cardio'}
                                      placeholder="Replace with…"
                                    />
                                  </div>
                                )}
                                {supersetMenuFor === ex.id && (
                                  <div className="mt-1.5 border border-border bg-white">
                                    <p className="px-3 py-2 text-[10px] uppercase tracking-wider text-text-light border-b border-border">Superset with</p>
                                    {day.exercises.filter((o) => o.id !== ex.id && o.kind !== 'cardio').map((o) => {
                                      const og = groups.get(o.id)
                                      const together = !!ex.supersetId && o.supersetId === ex.supersetId
                                      return (
                                        <button
                                          key={o.id}
                                          onClick={() => { pairSuperset(day.id, ex.id, o.id); setSupersetMenuFor(null) }}
                                          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left bg-transparent border-none cursor-pointer hover:bg-cream transition-colors"
                                        >
                                          <span className="text-[12px] text-text-primary truncate">{o.name}</span>
                                          {(og || together) && (
                                            <span className="shrink-0 text-[9px] font-semibold text-cream bg-text-primary px-1 py-0.5">{together ? 'paired' : og.label}</span>
                                          )}
                                        </button>
                                      )
                                    })}
                                    {!!ex.supersetId && (
                                      <button
                                        onClick={() => { unpairSuperset(day.id, ex.id); setSupersetMenuFor(null) }}
                                        className="w-full text-left px-3 py-2 text-[12px] text-red-600 bg-transparent border-t border-border cursor-pointer hover:bg-cream transition-colors"
                                      >
                                        Remove from superset
                                      </button>
                                    )}
                                  </div>
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
              )
            })}
          </AnimatePresence>

          {/* Add day / delete routine */}
          <div className="flex flex-wrap gap-3 mt-2">
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
