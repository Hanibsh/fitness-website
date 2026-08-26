import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link, useLocation, useOutletContext, useParams } from 'react-router-dom'
import { ArrowLeft, X, ChevronUp, ChevronDown, StickyNote, Repeat, Link2, ArrowLeftRight, BookOpen, Play } from 'lucide-react'
import ExercisePicker from '../components/ExercisePicker'
import SwapSuggestions from '../components/SwapSuggestions'
import MuscleShareBars from '../components/MuscleShareBars'
import { supersetLabels, exerciseBlocks } from '../lib/workoutStats'
import { getExerciseNote, getExerciseNotesMap, getHistory } from '../lib/workoutStore'
import { upsertRemoteExerciseNotes, fetchRemoteHistory } from '../lib/workoutRemote'
import { muscleHref } from '../data/muscleInfo'
import { dayStats, bankIdFor } from '../lib/planStats'
import NumberField from '../components/NumberField'
import {
  canChooseLaterality,
  setDayName,
  addExercise,
  removeExercise,
  moveExercise,
  setExerciseSets,
  setExerciseRep,
  toggleExerciseUnilateral,
  setExerciseNote,
  substituteExercise,
  pairSuperset,
  unpairSuperset,
} from '../lib/program'

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Level 3 of the split: ONE day, with room to breathe.
//
// The point of this page is the layout. In the old all-in-one editor every
// exercise lived in a 4-column grid, so on a phone the name column was ~130px
// shared with a chevron stack — long names truncated to "Barbell Bench Pre…" and
// the rows became impossible to tell apart. Here each exercise owns a full-width
// block and its name wraps over as many lines as it needs; the sets/reps inputs
// and the action icons sit on their own rows underneath instead of competing
// with it for horizontal space.
export default function SplitDay() {
  const { dayId } = useParams()
  const { pathname, state } = useLocation()
  const { user, program, update, isActive, isWeekly, todayWeekdayIndex, pointerIndex } = useOutletContext()
  const [noteOpenFor, setNoteOpenFor] = useState(() => new Set())
  const [swapOpenFor, setSwapOpenFor] = useState(null)
  const [supersetMenuFor, setSupersetMenuFor] = useState(null)
  // Logged sessions, loaded the first time a swap panel opens rather than on
  // mount: the suggestions read it to favour movements you already train and to
  // spot ones you've drifted away from, and everyone who never opens a swap
  // shouldn't pay for the fetch.
  const [history, setHistory] = useState(null)

  useEffect(() => {
    if (swapOpenFor === null || history !== null) return
    let cancelled = false
    async function load() {
      if (user) {
        try {
          const remote = await fetchRemoteHistory(user.id)
          if (!cancelled) return setHistory(remote)
        } catch {
          // fall through to this device's copy
        }
      }
      if (!cancelled) setHistory(getHistory())
    }
    load()
    return () => { cancelled = true }
  }, [swapOpenFor, history, user])

  const dayIndex = program.days.findIndex((d) => d.id === dayId)
  const day = dayIndex === -1 ? null : program.days[dayIndex]

  // Back goes wherever you actually came FROM. Arriving through the split you
  // came from its overview, and that's the fallback; arriving from the dashboard
  // or the calendar, that page hands over its own address, because otherwise the
  // one tap in cost four taps back out through Splits → Log → Tools. A URL
  // opened cold carries no state — hence the fallback.
  const backTo = state?.backTo || `/split/${program.id}`
  const backLabel = state?.backLabel || program.name
  const backLink = (
    <Link to={backTo} className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary no-underline text-[13px] mb-8 transition-colors">
      <ArrowLeft className="w-3.5 h-3.5" /> {backLabel}
    </Link>
  )

  if (!day) {
    return (
      <>
        {backLink}
        <p className="text-[13px] text-text-muted">That day couldn’t be found — it may have been removed from this split.</p>
      </>
    )
  }

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

  // Per-day superset context: A1/A2 labels, and the block index of each exercise
  // (a contiguous group is one block) for the move-up/down disabled states.
  const groups = supersetLabels(day.exercises)
  const blocks = exerciseBlocks(day.exercises)
  const blockIdxOf = new Map()
  blocks.forEach((b, i) => b.forEach((e) => blockIdxOf.set(e.id, i)))
  const strengthCount = day.exercises.filter((e) => e.kind !== 'cardio').length
  const stats = dayStats(day)
  const isToday = isWeekly ? dayIndex === todayWeekdayIndex : dayIndex === pointerIndex
  // The day the badge above calls Today (or Up next) is the one you can start
  // from here, and the logger resolves it against your ACTIVE split — so a day
  // belonging to a split you aren't running gets no button rather than a dead
  // one. Rest days have nothing to log.
  const canStart = isToday && isActive && day.kind !== 'rest'

  return (
    <>
      {backLink}

      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        {/* Day header */}
        <div className="bg-white border border-border p-5 sm:p-6 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <label className="text-[11px] uppercase tracking-wider text-text-light">
              {day.kind === 'rest' ? 'Rest day' : 'Training day'}
            </label>
            {isWeekly && (
              <span className="text-[9px] font-medium uppercase tracking-wider text-text-muted border border-border bg-cream px-1.5 py-0.5">
                {WEEKDAY_NAMES[dayIndex]}
              </span>
            )}
            {isToday && (
              <span className="text-[9px] font-semibold uppercase tracking-wider text-cream bg-text-primary px-1.5 py-0.5">
                {isWeekly ? 'Today' : 'Up next'}
              </span>
            )}
          </div>
          <input
            value={day.name}
            onChange={(e) => update((p) => setDayName(p, day.id, e.target.value))}
            aria-label="Day name"
            className="w-full bg-cream border border-border px-3 py-2.5 text-text-primary text-[15px] font-heading font-medium outline-none focus:border-text-primary"
          />

          {day.kind === 'rest' ? (
            <p className="text-[12px] text-text-light mt-3">
              {isWeekly ? 'A rest day — no exercises.' : 'A rest slot in the rotation — no exercises.'}
            </p>
          ) : stats.exercises === 0 ? (
            <p className="text-[12px] text-text-light mt-3">Nothing planned yet — add your first exercise below.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-3 text-[12px] text-text-muted">
                <span className="tabular-nums">
                  {stats.exercises} exercise{stats.exercises !== 1 ? 's' : ''} · {stats.sets} set{stats.sets !== 1 ? 's' : ''}
                </span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted bg-cream border border-border px-1.5 py-0.5">
                  {stats.load.label}
                </span>
              </div>
              {stats.muscles.length > 0 && (
                <div className="mt-4">
                  <p className="text-[11px] uppercase tracking-wider text-text-light mb-2.5">What this day works</p>
                  <MuscleShareBars
                    showSets
                    rows={stats.muscles
                      .filter((m) => m.pct >= 1)
                      .map((m) => ({ label: m.muscle, sets: m.sets, pct: m.pct, href: muscleHref(m.muscle) }))}
                  />
                  <p className="text-[11px] text-text-light mt-2.5">Share of this day’s planned sets, weighted by how much each movement loads the muscle.</p>
                </div>
              )}
            </>
          )}

          {/* Straight into the logger with this day already loaded. The badge
              above says this is the day that's up — without this the only way
              to act on that was to leave and find the Start button elsewhere. */}
          {canStart && (
            <Link
              to="/log"
              state={{ startPlannedDay: day.id }}
              className="inline-flex items-center gap-1.5 bg-text-primary text-cream font-medium px-4 py-2.5 mt-4 text-[13px] no-underline hover:bg-accent-hover transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              {isWeekly ? 'Start today’s session' : 'Start this session'}
            </Link>
          )}
        </div>

        {/* Exercises */}
        {day.kind !== 'rest' && (
          <>
            <div className="space-y-2 mb-3">
              {day.exercises.map((ex) => {
                // The shared store wins over this row's copy, so a note written
                // against this movement in another split (or in the logger)
                // shows up here too.
                const note = getExerciseNote(ex) || ex.note || ''
                const noteOpen = noteOpenFor.has(ex.id) || !!note
                const bankId = bankIdFor(ex)
                return (
                  <div key={ex.id} className="bg-white border border-border px-3 py-3">
                    {/* The name gets the whole width — nothing else shares its
                        line but the remove button. */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex items-start gap-1.5">
                        {groups.get(ex.id) && (
                          <span className="shrink-0 mt-0.5 text-[9px] font-semibold text-cream bg-text-primary px-1 py-0.5">{groups.get(ex.id).label}</span>
                        )}
                        <span className="text-[14px] text-text-primary break-words">{ex.name}</span>
                      </div>
                      <button onClick={() => update((p) => removeExercise(p, day.id, ex.id))} aria-label={`Remove ${ex.name}`} className="shrink-0 text-text-light hover:text-red-600 bg-transparent border-none cursor-pointer p-0.5">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-text-light">Sets</span>
                        <NumberField
                          decimal={false}
                          value={ex.sets}
                          onValueChange={(v) => update((p) => setExerciseSets(p, day.id, ex.id, v))}
                          aria-label={`${ex.name} target sets`}
                          className="w-12 bg-cream border border-border px-1 py-1.5 text-center text-text-primary text-[13px] outline-none focus:border-text-primary"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-text-light">Reps</span>
                        <NumberField
                          decimal={false}
                          value={ex.repRange?.low ?? ''}
                          onValueChange={(v) => update((p) => setExerciseRep(p, day.id, ex.id, 'low', v))}
                          aria-label={`${ex.name} rep low`}
                          className="w-12 bg-cream border border-border px-1 py-1.5 text-center text-text-primary text-[13px] outline-none focus:border-text-primary"
                        />
                        <span className="text-text-light text-[12px]">–</span>
                        <NumberField
                          decimal={false}
                          value={ex.repRange?.high ?? ''}
                          onValueChange={(v) => update((p) => setExerciseRep(p, day.id, ex.id, 'high', v))}
                          aria-label={`${ex.name} rep high`}
                          className="w-12 bg-cream border border-border px-1 py-1.5 text-center text-text-primary text-[13px] outline-none focus:border-text-primary"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1 mt-3 pt-2.5 border-t border-border">
                      <button
                        onClick={() => update((p) => moveExercise(p, day.id, ex.id, -1))}
                        disabled={blockIdxOf.get(ex.id) === 0}
                        aria-label={`Move ${ex.name} up`}
                        title="Move up"
                        className="text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer p-1 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => update((p) => moveExercise(p, day.id, ex.id, 1))}
                        disabled={blockIdxOf.get(ex.id) === blocks.length - 1}
                        aria-label={`Move ${ex.name} down`}
                        title="Move down"
                        className="text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer p-1 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <span className="w-px h-4 bg-border mx-1" />
                      <button
                        onClick={() => toggleNote(ex.id)}
                        aria-label={note ? `Edit note for ${ex.name}` : `Add note for ${ex.name}`}
                        title="Note"
                        className={`bg-transparent border-none cursor-pointer p-1 ${note ? 'text-text-primary' : 'text-text-light hover:text-text-primary'}`}
                      >
                        <StickyNote className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setSwapOpenFor(swapOpenFor === ex.id ? null : ex.id)}
                        aria-label={`Substitute ${ex.name}`}
                        aria-pressed={swapOpenFor === ex.id}
                        title="Substitute exercise"
                        className={`bg-transparent border-none cursor-pointer p-1 ${swapOpenFor === ex.id ? 'text-text-primary' : 'text-text-light hover:text-text-primary'}`}
                      >
                        <Repeat className="w-4 h-4" />
                      </button>
                      {ex.kind !== 'cardio' && strengthCount > 1 && (
                        <button
                          onClick={() => setSupersetMenuFor(supersetMenuFor === ex.id ? null : ex.id)}
                          aria-label={`Superset options for ${ex.name}`}
                          aria-expanded={supersetMenuFor === ex.id}
                          title={groups.get(ex.id) ? `In superset ${groups.get(ex.id).letter}` : 'Superset with another exercise'}
                          className={`bg-transparent border-none cursor-pointer p-1 ${groups.get(ex.id) ? 'text-text-primary' : 'text-text-light hover:text-text-primary'}`}
                        >
                          <Link2 className="w-4 h-4" />
                        </button>
                      )}
                      {canChooseLaterality(ex) && (
                        <button
                          onClick={() => update((p) => toggleExerciseUnilateral(p, day.id, ex.id))}
                          aria-pressed={!!ex.unilateral}
                          aria-label={`${ex.name} — ${ex.unilateral ? 'logged one limb at a time' : 'logged both limbs together'}`}
                          title={ex.unilateral ? 'Logged one limb at a time' : 'Logged both limbs together'}
                          className={`bg-transparent border-none cursor-pointer p-1 ${ex.unilateral ? 'text-text-primary' : 'text-text-light hover:text-text-primary'}`}
                        >
                          <ArrowLeftRight className="w-4 h-4" />
                        </button>
                      )}
                      {/* Straight into the bank entry for this movement. `state`
                          tells that page to come back HERE rather than to the
                          bank's index — and carries THIS page's own back target
                          along for the return trip, so a detour through the bank
                          doesn't strand you in the split. Omitted for custom
                          movements and cardio, which have no entry to open. */}
                      {bankId && (
                        <Link
                          to={`/exercises/${bankId}`}
                          state={{ backTo: pathname, backLabel: day.name || 'this day', backState: state }}
                          className="ml-auto inline-flex items-center gap-1 text-[11px] text-text-muted hover:text-text-primary no-underline px-1 py-1 transition-colors"
                        >
                          <BookOpen className="w-3.5 h-3.5" /> Learn more
                        </Link>
                      )}
                    </div>

                    {noteOpen && (
                      <textarea
                        value={note}
                        onChange={(e) => update((p) => setExerciseNote(p, day.id, ex.id, e.target.value))}
                        onBlur={syncNotesToRemote}
                        placeholder="Note — form cue, machine setting, anything worth remembering…"
                        aria-label={`Note for ${ex.name}`}
                        rows={2}
                        className="w-full mt-2 bg-cream border border-border px-2 py-1.5 text-text-primary text-[12px] outline-none focus:border-text-primary resize-none"
                      />
                    )}
                    {swapOpenFor === ex.id && (
                      <div className="mt-2">
                        {ex.kind !== 'cardio' && (
                          <SwapSuggestions
                            planned={ex}
                            program={program}
                            dayId={day.id}
                            sessions={history || []}
                            onPick={(o) => {
                              update((p) => substituteExercise(p, day.id, ex.id, { name: o.name, category: o.category, exerciseId: o.id }))
                              setSwapOpenFor(null)
                            }}
                          />
                        )}
                        <ExercisePicker
                          onSelect={(name, category, id) => { update((p) => substituteExercise(p, day.id, ex.id, { name, category, exerciseId: id })); setSwapOpenFor(null) }}
                          onlyCategory={ex.kind === 'cardio' ? 'Cardio' : undefined}
                          excludeCategory={ex.kind === 'cardio' ? undefined : 'Cardio'}
                          placeholder="Replace with…"
                        />
                      </div>
                    )}
                    {supersetMenuFor === ex.id && (
                      <div className="mt-2 border border-border bg-white">
                        <p className="px-3 py-2 text-[10px] uppercase tracking-wider text-text-light border-b border-border">Superset with</p>
                        {day.exercises.filter((o) => o.id !== ex.id && o.kind !== 'cardio').map((o) => {
                          const og = groups.get(o.id)
                          const together = !!ex.supersetId && o.supersetId === ex.supersetId
                          return (
                            <button
                              key={o.id}
                              onClick={() => { update((p) => pairSuperset(p, day.id, ex.id, o.id)); setSupersetMenuFor(null) }}
                              className="w-full flex items-start justify-between gap-2 px-3 py-2 text-left bg-transparent border-none cursor-pointer hover:bg-cream transition-colors"
                            >
                              <span className="text-[12px] text-text-primary break-words">{o.name}</span>
                              {(og || together) && (
                                <span className="shrink-0 text-[9px] font-semibold text-cream bg-text-primary px-1 py-0.5">{together ? 'paired' : og.label}</span>
                              )}
                            </button>
                          )
                        })}
                        {!!ex.supersetId && (
                          <button
                            onClick={() => { update((p) => unpairSuperset(p, day.id, ex.id)); setSupersetMenuFor(null) }}
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

            <ExercisePicker
              onSelect={(name, category, id) => update((p) => addExercise(p, day.id, { name, category, exerciseId: id }))}
              placeholder="Add an exercise…"
            />
          </>
        )}
      </motion.div>
    </>
  )
}
