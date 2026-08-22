// Workout data layer.
//
// Every read/write to storage lives in this file. The UI never touches
// localStorage directly — it only calls these functions. That's deliberate:
// if we later add accounts + a backend (e.g. Supabase), we swap the bodies of
// these functions for API calls and the tracker UI keeps working unchanged.

import { convertWeight, canonicalExerciseId, REST_STALE_SEC } from './workoutStats'
import { getExercise, exerciseIdForName } from './exerciseLibrary'
import { lateralityFor, usesBodyweight } from './movements'

const DRAFT_KEY = 'leon_workout_draft'
const HISTORY_KEY = 'leon_workout_history'
const UNIT_KEY = 'leon_workout_unit'
const BODYWEIGHT_KEY = 'leon_bodyweight_log'
const REST_TIMER_KEY = 'leon_rest_timer'

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    // Storage full or unavailable — fail silently so the UI never crashes.
    return false
  }
}

// We aim to keep at least a year of workout history on the device. If storage
// is full we don't just drop the newest save — we trim the oldest sessions
// (first anything past the retention window, then oldest-first) and retry, so a
// packed log degrades gracefully instead of failing to save.
const HISTORY_RETENTION_MS = 366 * 24 * 60 * 60 * 1000

function writeHistory(history) {
  if (write(HISTORY_KEY, history)) return history
  const cutoff = Date.now() - HISTORY_RETENTION_MS
  let trimmed = history.filter((s) => s.date >= cutoff).sort((a, b) => b.date - a.date)
  if (write(HISTORY_KEY, trimmed)) return trimmed
  // Still too large even within a year — drop oldest until it fits.
  while (trimmed.length > 1) {
    trimmed = trimmed.slice(0, -1)
    if (write(HISTORY_KEY, trimmed)) break
  }
  return trimmed
}

// ---- Factories -------------------------------------------------------------

// One limb's numbers, for unilateral (left/right) logging.
function blankSide(prev) {
  return { weight: prev ? prev.weight : '', reps: prev ? prev.reps : '', rir: prev ? prev.rir : '' }
}

export function createSet(prev, opts = false) {
  // `opts` accepts a boolean (legacy: unilateral) or { unilateral, bodyweight, bw }.
  const { unilateral = false, bodyweight = false, bw = 0 } =
    typeof opts === 'boolean' ? { unilateral: opts } : opts
  // A new set copies the previous set's numbers, since you usually repeat
  // the same weight/reps (or duration/distance) — one tap and you're logging.
  if (unilateral) {
    return { id: newId(), left: blankSide(prev?.left), right: blankSide(prev?.right) }
  }
  if (bodyweight) {
    // `added` is external/assist weight; `weight` (the field all stats read) is
    // the effective load = bodyweight + added; `bw` snapshots the bodyweight.
    const added = prev ? prev.added ?? '' : ''
    return { id: newId(), added, reps: prev ? prev.reps : '', rir: prev ? prev.rir : '', bw, weight: (Number(bw) || 0) + (Number(added) || 0) }
  }
  return {
    id: newId(),
    reps: prev ? prev.reps : '',
    weight: prev ? prev.weight : '',
    rir: prev ? prev.rir : '',
    duration: prev ? prev.duration ?? '' : '', // cardio: minutes
    distance: prev ? prev.distance ?? '' : '', // cardio: km/mi
  }
}

// ---- Suggestions ("hints") --------------------------------------------------
//
// What you lifted last time shows as a GREY SUGGESTION rather than a typed-in
// value: the numbers are there to aim at, but the set stays empty until you
// actually enter something. That's what lets "I didn't write reps" mean "I
// didn't do that exercise" — which is how a finished session tells the split
// what it skipped. A set carries its suggestion in `hint`, mirroring the shape
// of the set itself, and every reader of a set's real fields ignores it.

// Move a fully-valued set's numbers into `hint`, leaving the set blank.
function asHintSet(s, bw = 0) {
  if (s.left) {
    return { id: s.id, ...(s.type ? { type: s.type } : {}), left: blankSide(), right: blankSide(), hint: { left: s.left, right: s.right } }
  }
  if (s.bw != null) {
    return { id: s.id, ...(s.type ? { type: s.type } : {}), added: '', reps: '', rir: '', bw, weight: Number(bw) || 0, hint: { added: s.added, reps: s.reps, rir: s.rir } }
  }
  return {
    id: s.id, ...(s.type ? { type: s.type } : {}),
    reps: '', weight: '', rir: '', duration: '', distance: '',
    hint: { reps: s.reps, weight: s.weight, rir: s.rir, duration: s.duration, distance: s.distance },
  }
}

// Copy a set's suggestion into its real fields — the "fill from last time" tap.
// Only fills what's still empty, so it can't overwrite something you typed.
//
// `side` narrows a unilateral set to ONE limb: you train left, write left down,
// then train right — so the tap that follows the left arm must not also fill in
// an arm you haven't done yet, which would leave last week's numbers sitting
// there looking logged. Without a side (the exercise-wide "same as last time",
// where the whole thing is already behind you) both limbs are taken up at once.
export function promoteHint(s, onlySide = null) {
  if (!s.hint) return s
  const take = (cur, sug) => (cur === '' || cur == null ? sug ?? '' : cur)
  if (s.left) {
    const side = (k) => ({
      weight: take(s[k]?.weight, s.hint[k]?.weight),
      reps: take(s[k]?.reps, s.hint[k]?.reps),
      rir: take(s[k]?.rir, s.hint[k]?.rir),
    })
    const sides = onlySide === 'left' || onlySide === 'right' ? [onlySide] : ['left', 'right']
    return { ...s, ...Object.fromEntries(sides.map((k) => [k, side(k)])) }
  }
  if (s.bw != null) {
    const added = take(s.added, s.hint.added)
    return { ...s, added, reps: take(s.reps, s.hint.reps), rir: take(s.rir, s.hint.rir), weight: (Number(s.bw) || 0) + (Number(added) || 0) }
  }
  return {
    ...s,
    reps: take(s.reps, s.hint.reps),
    weight: take(s.weight, s.hint.weight),
    rir: take(s.rir, s.hint.rir),
    duration: take(s.duration, s.hint.duration),
    distance: take(s.distance, s.hint.distance),
  }
}

// Drop suggestions before a session is stored. They're scaffolding for logging,
// not part of the record — and leaving them in would make the NEXT session's
// suggestions come from the last one's suggestions.
export function stripHints(exercises) {
  return exercises.map((ex) => ({
    ...ex,
    sets: ex.sets.map((s) => {
      if (!s.hint) return s
      const { hint: _hint, ...rest } = s
      return rest
    }),
  }))
}

// Convert a set between the flat (bilateral) and left/right (unilateral)
// shapes, preserving whatever was already typed.
export function convertSet(s, unilateral) {
  // Carry the set's type (warm-up/back-off), rest timestamp and suggestion
  // across a shape change so nothing is lost when toggling laterality.
  const keep = { ...(s.type ? { type: s.type } : {}), ...(s.completedAt ? { completedAt: s.completedAt } : {}) }
  if (unilateral) {
    if (s.left) return s
    const side = { weight: s.weight ?? '', reps: s.reps ?? '', rir: s.rir ?? '' }
    const hint = s.hint ? { hint: { left: { ...s.hint }, right: { ...s.hint } } } : {}
    return { id: s.id, left: side, right: { ...side }, ...keep, ...hint }
  }
  if (!s.left) return s
  const hint = s.hint?.left ? { hint: { ...s.hint.left } } : {}
  return { id: s.id, weight: s.left.weight ?? '', reps: s.left.reps ?? '', rir: s.left.rir ?? '', duration: '', distance: '', ...keep, ...hint }
}

// Build a fresh sets array for an exercise from the last time it was logged —
// same weight/reps/rir/type (including warm-ups), converted to the current
// unit, with new ids and no completion timestamps (this is a new session).
// Returns null if bodyweight-loaded doesn't match (that's a different logging
// mechanism entirely) — the caller falls back to its own default set.
//
// Laterality is mirrored PER SET from what was actually logged last time,
// not forced to a single exercise-wide shape — this is the per-day memory: a
// "both" exercise done unilateral on Push day and bilateral on a Full-Body day
// recreates that exact mix next time, with no flag to keep in sync. Only a
// FIXED-laterality exercise (`opts.laterality` is 'unilateral' or 'bilateral')
// coerces every set to that shape, since its rows can never legitimately differ.
// `asHint` returns the same set-for-set structure with the numbers moved into
// `hint` and the fields left blank — the shape and the ramp carry over, the
// values are only a suggestion until you log them.
export function setsFromPrevious(prevEx, fromUnit, toUnit, opts = {}) {
  const { bodyweight = false, bw = 0, laterality, asHint = false } = opts
  if (!prevEx || !Array.isArray(prevEx.sets) || !prevEx.sets.length) return null
  if (bodyweight !== !!prevEx.bodyweight) return null
  const conv = (w) => (w === '' || w == null ? (w ?? '') : Math.round(convertWeight(Number(w), fromUnit, toUnit) * 100) / 100)
  const keep = (s) => (s.type ? { type: s.type } : {})
  const out = (s) => (asHint ? asHintSet(s, bw) : s)
  if (bodyweight) {
    return prevEx.sets.map((s) => {
      const added = conv(s.added)
      return out({ id: newId(), ...keep(s), added, reps: s.reps ?? '', rir: s.rir ?? '', bw, weight: (Number(bw) || 0) + (Number(added) || 0) })
    })
  }
  const forceUnilateral = laterality === 'unilateral' ? true : laterality === 'bilateral' ? false : null
  return prevEx.sets.map((s) => {
    const mirrored = s.left
      ? {
          id: newId(),
          ...keep(s),
          left: { weight: conv(s.left?.weight), reps: s.left?.reps ?? '', rir: s.left?.rir ?? '' },
          right: { weight: conv(s.right?.weight), reps: s.right?.reps ?? '', rir: s.right?.rir ?? '' },
        }
      : { id: newId(), ...keep(s), reps: s.reps ?? '', weight: conv(s.weight), rir: s.rir ?? '', duration: s.duration ?? '', distance: s.distance ?? '' }
    const shaped = forceUnilateral === null || forceUnilateral === !!mirrored.left ? mirrored : convertSet(mirrored, forceUnilateral)
    return out(shaped)
  })
}

// `kind` is 'strength' (weight/reps/RIR) or 'cardio' (duration/distance) — it
// decides which section of the log an exercise lives in and which fields
// render. `laterality` ('bilateral' | 'unilateral' | 'both') comes from the
// exercise DB and controls the L/R logging: bilateral exercises never offer it,
// unilateral ones are fixed to it, and "both" exposes a toggle. `repRange` is
// the double-progression target. Older saved exercises lack these and are
// treated as bilateral strength ("both") with no target.
export function createExercise(name, kind = 'strength', opts = {}) {
  const laterality = kind === 'cardio' ? undefined : opts.laterality || 'both'
  const unilateral = laterality === 'unilateral'
  const bodyweight = kind !== 'cardio' && !!opts.bodyweight
  const firstSet = createSet(undefined, bodyweight ? { bodyweight: true, bw: opts.bw || 0 } : { unilateral })
  const ex = { id: newId(), name, kind, sets: [firstSet] }
  // Stable pointer into the exercise DB (`src/data/exercises.json`) when the
  // movement was picked from the library — null for custom/typed entries.
  // Downstream analytics look movements up by this instead of guessing by name.
  ex.exerciseId = opts.exerciseId || null
  if (kind !== 'cardio') {
    ex.laterality = laterality
    // Bodyweight-loaded moves (pull-ups, dips…) log added weight against your
    // bodyweight; they aren't offered the unilateral toggle.
    ex.bodyweight = bodyweight
    ex.unilateral = bodyweight ? false : unilateral
    // Opt-in: only carry a rep-range target if one was passed (e.g. remembered
    // from a previous session). Otherwise the user adds it per exercise.
    ex.repRange = opts.repRange || null
  }
  // Free-text note (form cues, machine settings, anything worth remembering).
  // Seeded from the routine's planned note when starting a session; editable
  // per-session without writing back to the routine template.
  ex.note = opts.note || ''
  return ex
}

// Flatten an exercise's sets to plain {weight,reps,rir} entries — one per limb
// for unilateral sets — so stats/graph code can treat everything uniformly.
// Warm-up sets are dropped: they don't count toward working volume. Checked
// PER SET (not the exercise-wide flag) so a "both" exercise with a mix of
// bilateral and unilateral sets flattens correctly.
export function effectiveSets(ex) {
  const working = ex.sets.filter((s) => s.type !== 'warmup')
  if (ex.kind === 'cardio') return working
  return working.flatMap((s) => (s.left ? [s.left, s.right].filter(Boolean) : [s]))
}

export function emptyDraft() {
  // `date` is the session's logged date — defaults to now but can be set to a
  // past day to backfill a missed workout. `name` is an optional label for the
  // session (e.g. Push, Pull, Legs).
  return { startedAt: Date.now(), date: Date.now(), name: '', exercises: [] }
}

// ---- Guest data-sharing preference (for non-logged-in users) --------------

const GUEST_SHARE_KEY = 'leon_guest_share'

export function getGuestShare() {
  return read(GUEST_SHARE_KEY, { share: false, sex: '', bodyweight: '' })
}

export function saveGuestShare(value) {
  write(GUEST_SHARE_KEY, value)
}

// ---- Training goals --------------------------------------------------------
// Stored on the device (not synced to the account yet). `monthlyWorkouts` is a
// target count; `lifts` is a list of { id, exercise, metric, target } goals —
// `metric` ('weight' | 'e1rm' | 'reps', defaulting to 'weight' for goals saved
// before metric existed) picks which stat of the exercise is being chased;
// `target` is in the user's chosen unit for weight/e1rm, or a rep count.
const GOALS_KEY = 'leon_goals'

export function getGoals() {
  const g = read(GOALS_KEY, null)
  if (!g) return { monthlyWorkouts: 12, lifts: [] }
  return {
    monthlyWorkouts: Number(g.monthlyWorkouts) > 0 ? Number(g.monthlyWorkouts) : 12,
    lifts: Array.isArray(g.lifts) ? g.lifts : [],
  }
}

export function saveGoals(goals) {
  write(GOALS_KEY, goals)
}

export function newGoalId() {
  return newId()
}

// ---- Training programs (routines) ------------------------------------------
// A list of saved routines + which one is active. The rotating-schedule logic
// lives in program.js. `getProgram()`/`saveProgram()` resolve/persist against
// the ACTIVE routine specifically (same signatures as the old single-program
// version), so any consumer that only cares about "today's program"
// (Dashboard, WorkoutTracker) needed zero changes when this became a list —
// only the Routine builder deals with the full list.
const PROGRAMS_KEY = 'leon_programs'
const LEGACY_PROGRAM_KEY = 'leon_program' // pre-multi-routine single-program blob

// One-time migration: a user who already built a routine before multi-routine
// support has it under the old single-blob key. Wrap it into the new shape so
// it survives as their first (active) routine. The old key is left in place
// untouched — harmless, and a safety net.
function migrateLegacyProgram() {
  const legacy = read(LEGACY_PROGRAM_KEY, null)
  if (!legacy) return { programs: [], activeId: null }
  return { programs: [legacy], activeId: legacy.id }
}

export function getProgramsState() {
  const state = read(PROGRAMS_KEY, null)
  if (state && Array.isArray(state.programs)) return state
  return migrateLegacyProgram()
}

export function saveProgramsState(state) {
  write(PROGRAMS_KEY, state)
  return state
}

// The active routine, or null if none exists yet.
export function getProgram() {
  const { programs, activeId } = getProgramsState()
  return programs.find((p) => p.id === activeId) || null
}

// Upsert a routine into the list IN PLACE (stable order — updating a routine,
// e.g. advancing its pointer, shouldn't reshuffle the list). Preserves
// whichever routine is currently active unless there isn't one yet (the
// first-ever routine auto-activates, matching the original behavior).
export function saveProgram(program) {
  const state = getProgramsState()
  const idx = state.programs.findIndex((p) => p.id === program.id)
  const programs = idx === -1 ? [...state.programs, program] : state.programs.map((p, i) => (i === idx ? program : p))
  const activeId = state.activeId || program.id
  saveProgramsState({ programs, activeId })
  return program
}

export function setActiveProgram(id) {
  const state = getProgramsState()
  return saveProgramsState({ ...state, activeId: id })
}

export function deleteProgramById(id) {
  const state = getProgramsState()
  const programs = state.programs.filter((p) => p.id !== id)
  const activeId = state.activeId === id ? (programs[0]?.id || null) : state.activeId
  return saveProgramsState({ programs, activeId })
}

// ---- Specialization blocks -------------------------------------------------
// A list of muscle-group specialization phases, stored as one JSON array (the
// block logic lives in blocks.js; the per-muscle summary in dashboard.js).
const BLOCKS_KEY = 'leon_blocks'

export function getBlocks() {
  const b = read(BLOCKS_KEY, [])
  return Array.isArray(b) ? b : []
}

export function saveBlocks(blocks) {
  write(BLOCKS_KEY, blocks)
  return blocks
}

// ---- Unit preference (kg / lbs) -------------------------------------------

export function getUnit() {
  return read(UNIT_KEY, 'kg')
}

export function saveUnit(unit) {
  write(UNIT_KEY, unit)
}

// ---- Rest timer (preference + live anchor) ---------------------------------
// Device-local, like the unit picker and the theme: whether you time your rests
// is a property of how you train, not of your account, and plenty of people
// never measure them at all.
//
// `anchor` is a manual "rest starts now" tap and `dismissedAt` a "hide it until
// my next set" tap. Both live here rather than in React state so a reload
// mid-rest doesn't silently discard them. An anchor older than the stale
// window is ignored on read, so yesterday's never resurfaces.
const REST_TIMER_DEFAULT = { enabled: true, anchor: null, dismissedAt: null }

export function getRestTimer() {
  const stored = read(REST_TIMER_KEY, null)
  if (!stored || typeof stored !== 'object') return { ...REST_TIMER_DEFAULT }
  const fresh = (ts) => (ts && Date.now() - ts <= REST_STALE_SEC * 1000 ? ts : null)
  return {
    enabled: stored.enabled !== false, // default on for anyone who's never touched it
    anchor: fresh(stored.anchor),
    dismissedAt: fresh(stored.dismissedAt),
  }
}

export function saveRestTimer(state) {
  write(REST_TIMER_KEY, state)
  return state
}

// ---- Draft (the in-progress session) --------------------------------------

export function getDraft() {
  return read(DRAFT_KEY, null)
}

export function saveDraft(draft) {
  write(DRAFT_KEY, draft)
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    // ignore
  }
}

// A backup slot for the in-progress draft. When you jump into editing a past
// workout, any unfinished session is stashed here and the editor is reused;
// finishing or cancelling the edit restores it so nothing in progress is lost.
const DRAFT_STASH_KEY = 'leon_workout_draft_stash'

export function getStashedDraft() {
  return read(DRAFT_STASH_KEY, null)
}

export function stashDraft(draft) {
  write(DRAFT_STASH_KEY, draft)
}

export function clearStashedDraft() {
  try {
    localStorage.removeItem(DRAFT_STASH_KEY)
  } catch {
    // ignore
  }
}

// ---- History (completed sessions) -----------------------------------------

export function getHistory() {
  return read(HISTORY_KEY, [])
}

// Turn the in-progress draft into a finished session object (no persistence —
// the caller decides whether it goes to localStorage or Supabase).
export function makeSession(draft, unit = 'kg') {
  // NOTE: `draft.startedAt` and `session.startedAt` are NOT the same thing.
  // The draft's is wall-clock "when this draft/edit was opened" — it exists the
  // moment the log page has no draft to restore, and doubles as the
  // double-submit key in WorkoutTracker. The session's is "when you started
  // training", which is `draft.sessionStartedAt`. This object is built field by
  // field and never spreads the draft, so the two can't mix.
  const { startedAt, endedAt, durationMs } = sessionTimes(draft)
  return {
    id: newId(),
    date: draft.date || Date.now(),
    name: draft.name || '',
    unit,
    startedAt,
    endedAt,
    durationMs,
    exercises: stripHints(draft.exercises),
  }
}

// How long the workout took: from the moment you START it — the "Start session"
// tap, or adding your first exercise if you went straight in — to the moment you
// finish it. That's the wall clock a person means by "how long was I training",
// and it's what the summary card reports.
//
// It deliberately counts the time either side of the sets: your setup, the walk
// between machines, the queue for the rack. The cost is that a session you
// started and then wandered away from reads long — which is why the window is
// editable on the saved session, and why the ceiling below is generous rather
// than tight. Recording something correctable beats recording nothing.
//
// `sessionWindow` (first stamped set → last) stays as the fallback for drafts
// that were already in flight when this shipped, and for anything backfilled.
//
// (`durationMs` does sync — sessions.duration_ms has existed since the duration
// column was added. workoutRemote.js degrades gracefully when a database hasn't
// run the migration, which is a different thing.)
const MIN_SESSION_MS = 60 * 1000
const MAX_SESSION_MS = 12 * 60 * 60 * 1000

export function sessionTimes(draft, now = Date.now()) {
  const started = draft?.sessionStartedAt
  if (started) {
    const ms = now - started
    if (ms >= MIN_SESSION_MS && ms <= MAX_SESSION_MS) {
      return { startedAt: started, endedAt: now, durationMs: ms }
    }
  }
  return sessionWindow(draft?.exercises)
}

// When the first set of a session was stamped, or null before anything's been
// logged. Deliberately ungated: the live "session so far" clock in the logger
// runs from the moment you log your first set, whereas sessionWindow below is
// about what's worth SAVING and throws away anything implausible.
export function firstSetAt(exercises) {
  let first = Infinity
  for (const ex of exercises || []) {
    for (const s of ex.sets || []) {
      if (s.completedAt && s.completedAt < first) first = s.completedAt
    }
  }
  return first === Infinity ? null : first
}

export function sessionWindow(exercises) {
  const none = { startedAt: null, endedAt: null, durationMs: null }
  const first = firstSetAt(exercises)
  if (!first) return none
  let last = 0
  for (const ex of exercises || []) {
    for (const s of ex.sets || []) {
      if (s.completedAt > last) last = s.completedAt
    }
  }
  // A single stamp leaves nothing to measure between.
  if (last <= first) return none
  const ms = last - first
  if (ms < MIN_SESSION_MS || ms > MAX_SESSION_MS) return none
  return { startedAt: first, endedAt: last, durationMs: ms }
}

// Add a finished session to the local (anonymous) history, newest-first by date
// so a backdated session lands in the right chronological spot.
export function addLocalSession(session) {
  const history = [session, ...getHistory()].sort((a, b) => b.date - a.date)
  return writeHistory(history)
}

// Replace a session in local history (e.g. after moving it to another day) and
// re-sort so it lands in the right chronological spot.
export function updateLocalSession(session) {
  const history = [session, ...getHistory().filter((s) => s.id !== session.id)].sort((a, b) => b.date - a.date)
  return writeHistory(history)
}

export function clearLocalHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY)
  } catch {
    // ignore
  }
}

export function deleteSession(id) {
  const history = getHistory().filter((s) => s.id !== id)
  write(HISTORY_KEY, history)
  return history
}

// ---- Bodyweight log --------------------------------------------------------
//
// A separate time series from the single `bodyweight` profile field (which is
// "current weight" for the strength tools). Each entry keeps the unit it was
// logged in so the chart can normalise to the display unit. Newest-first.

export function getBodyweightLog() {
  return read(BODYWEIGHT_KEY, [])
}

// Build an entry. `date` defaults to noon today so there's one weigh-in per
// calendar day and the timestamp never lands on a day boundary (tz-safe).
export function makeBodyweightEntry(weight, unit = 'kg', date) {
  let when = date
  if (when == null) {
    const d = new Date()
    d.setHours(12, 0, 0, 0)
    when = d.getTime()
  }
  return { id: newId(), date: when, weight: Number(weight), unit }
}

// Upsert by id, keeping the log sorted newest-first.
export function saveBodyweightEntry(entry) {
  const log = [entry, ...getBodyweightLog().filter((e) => e.id !== entry.id)].sort((a, b) => b.date - a.date)
  write(BODYWEIGHT_KEY, log)
  return log
}

export function deleteBodyweightEntry(id) {
  const log = getBodyweightLog().filter((e) => e.id !== id)
  write(BODYWEIGHT_KEY, log)
  return log
}

// ---- Day annotations (sick / injury / travel / rest / other) --------------
//
// Independent of workouts — a day can have BOTH a logged session and an
// annotation (e.g. "trained anyway, still recovering"). One annotation per
// calendar day; noon-anchored like the bodyweight log so it never lands on a
// day boundary. Reason list + summary math live in dayLog.js (pure, no
// storage), same split as workoutStats.js for sessions.
const DAY_LOG_KEY = 'leon_day_annotations'

export function getDayAnnotations() {
  return read(DAY_LOG_KEY, [])
}

export function makeDayAnnotation(reason, note, date) {
  let when = date
  if (when == null) {
    const d = new Date()
    d.setHours(12, 0, 0, 0)
    when = d.getTime()
  }
  return { id: newId(), date: when, reason, note: (note || '').trim().slice(0, 300) }
}

// Upsert by id, keeping the log sorted newest-first.
export function saveDayAnnotation(entry) {
  const log = [entry, ...getDayAnnotations().filter((e) => e.id !== entry.id)].sort((a, b) => b.date - a.date)
  write(DAY_LOG_KEY, log)
  return log
}

export function deleteDayAnnotation(id) {
  const log = getDayAnnotations().filter((e) => e.id !== id)
  write(DAY_LOG_KEY, log)
  return log
}

// ---- Stats -----------------------------------------------------------------

export function sessionStats(session) {
  let sets = 0
  let volume = 0
  for (const ex of session.exercises) {
    const cardio = ex.kind === 'cardio'
    for (const set of ex.sets) {
      // Warm-ups are logged but never count toward working volume or set totals.
      if (set.type === 'warmup') continue
      if (cardio) {
        // A cardio entry "counts" once it has time on it; it adds no volume.
        if (Number(set.duration) > 0) sets += 1
      } else if (set.left) {
        // A unilateral set counts once (one set of the exercise), but volume
        // sums both limbs. Checked per set, not the exercise flag, so a
        // "both" exercise can mix bilateral and unilateral sets correctly.
        const l = set.left || {}, r = set.right || {}
        const lr = Number(l.reps) || 0, rr = Number(r.reps) || 0
        if (lr > 0 || rr > 0) sets += 1
        volume += (Number(l.weight) || 0) * lr + (Number(r.weight) || 0) * rr
      } else {
        const reps = Number(set.reps) || 0
        const weight = Number(set.weight) || 0
        if (reps > 0) sets += 1
        volume += reps * weight
      }
    }
  }
  return { exercises: session.exercises.length, sets, volume }
}

// ---- Per-exercise rep-range targets (double progression) -------------------
// Remembered on the device, keyed by exercise name, so re-adding an exercise
// prefills the range you last trained it in.
const EX_TARGETS_KEY = 'leon_exercise_targets'

export function getExerciseTarget(name) {
  const map = read(EX_TARGETS_KEY, {})
  return map[name.trim().toLowerCase()] || null
}

export function saveExerciseTarget(name, repRange) {
  if (!name || !repRange || !(repRange.low > 0) || !(repRange.high >= repRange.low)) return
  const map = read(EX_TARGETS_KEY, {})
  map[name.trim().toLowerCase()] = { low: repRange.low, high: repRange.high }
  write(EX_TARGETS_KEY, map)
}

// ---- Per-MOVEMENT notes -----------------------------------------------------
//
// A note belongs to the movement, not to the slot it happens to sit in: "pin 7,
// elbows tucked" is the same cue whether Lat Pulldown shows up on Pull day, on
// Upper day, or in a different split entirely. So notes live in one map keyed by
// the movement rather than being copied per planned row and per session.
//
// Keyed by canonical exercise id (survives library renames), falling back to the
// lowercased name only for movements the library has never heard of. A row with
// no id but a name the DB knows is resolved back to that id first: older logs
// and hand-typed rows predate the id link, and without that step "Dumbbell
// Curl" typed by hand would keep a note of its own, separate from the one the
// same movement carries everywhere it was picked from the bank.
const EX_NOTES_KEY = 'leon_exercise_notes'

// Can this movement be logged either way? Only one the DB leaves open ("both"),
// which is exactly the set of movements that get the L/R toggle in the builder
// and the logger. Read from the DB rather than from the row, so a planned row
// and the session it becomes always agree about which movements have two forms.
function lateralityIsOpen(ex, id) {
  if (!ex || ex.kind === 'cardio') return false
  const name = ex.name || ''
  const lib = id ? getExercise(id) : null
  if (lib ? lib.bodyweight : usesBodyweight(name)) return false
  return (lib ? lib.laterality : lateralityFor(name)) === 'both'
}

// The `::unilateral` half of a key, split out so the migration below can take a
// key apart and put it back together around a rewritten base.
const UNI_SUFFIX = '::unilateral'

// Laterality is part of the key. A curl done one arm at a time is a different
// setup from the same curl done with both — different bench, different bracing,
// different cue — so "elbow into the pad" written against one has no business
// showing up on the other. Only a movement that can appear in two forms gets
// two notes; a fixed one keeps the bare key, which is also the key whatever it
// already says was written under.
export function exerciseNoteKey(ex) {
  const id = canonicalExerciseId(ex?.exerciseId || exerciseIdForName(ex?.name))
  const base = id || (ex?.name || '').trim().toLowerCase()
  if (!base) return ''
  return ex?.unilateral && lateralityIsOpen(ex, id) ? `${base}${UNI_SUFFIX}` : base
}

// The whole map, for the caller that needs to sync it as a unit (login merge,
// push-to-remote) rather than one movement at a time.
export function getExerciseNotesMap() {
  return read(EX_NOTES_KEY, {})
}

export function saveExerciseNotesMap(map) {
  write(EX_NOTES_KEY, map || {})
}

export function getExerciseNote(ex) {
  const key = exerciseNoteKey(ex)
  if (!key) return ''
  return getExerciseNotesMap()[key] || ''
}

export function saveExerciseNote(ex, note) {
  const key = exerciseNoteKey(ex)
  if (!key) return
  const map = getExerciseNotesMap()
  const trimmed = (note || '').slice(0, 300)
  if (trimmed) map[key] = trimmed
  else delete map[key]
  saveExerciseNotesMap(map)
}

// One-time lift of the notes that already exist, so nothing written before this
// was shared disappears: planned rows first (deliberate, template-level cues),
// then session notes, newest first. Never overwrites a key already present, and
// runs at most once — after that the map is the source of truth and an empty
// note is a real answer.
const EX_NOTES_MIGRATED_KEY = 'leon_exercise_notes_migrated'

// Notes written under a bare NAME by a row that had no id, for a movement the
// library does know — fold them onto that movement's id key, which is where
// every reader now looks. Left alone they'd simply go quiet, and the note would
// read as never written. An id key that already says something wins: it was
// written against the movement itself rather than against one row's spelling.
//
// Separately flagged from the seed below, because it has to run for everyone —
// including the accounts that passed the seed long ago.
const EX_NOTES_FOLDED_KEY = 'leon_exercise_notes_folded'

function foldNameKeyedNotes() {
  if (read(EX_NOTES_FOLDED_KEY, false)) return
  const map = read(EX_NOTES_KEY, {})
  let changed = false
  for (const [key, note] of Object.entries(map)) {
    const uni = key.endsWith(UNI_SUFFIX)
    const base = uni ? key.slice(0, -UNI_SUFFIX.length) : key
    const id = canonicalExerciseId(exerciseIdForName(base))
    if (!id || id === base) continue
    // Re-derived rather than reassembled, so a name that turns out to belong to
    // a FIXED-laterality movement loses a `::unilateral` it should never have
    // carried — the DB is only consultable now that the name has an id.
    const target = exerciseNoteKey({ exerciseId: id, name: base, unilateral: uni })
    if (!map[target]) map[target] = note
    delete map[key]
    changed = true
  }
  if (changed) write(EX_NOTES_KEY, map)
  write(EX_NOTES_FOLDED_KEY, true)
}

export function migrateExerciseNotes(programs = [], sessions = []) {
  foldNameKeyedNotes()
  if (read(EX_NOTES_MIGRATED_KEY, false)) return
  const map = read(EX_NOTES_KEY, {})
  const seed = (ex) => {
    const key = exerciseNoteKey(ex)
    if (!key || !ex.note || map[key]) return
    map[key] = ex.note.slice(0, 300)
  }
  for (const p of programs) for (const d of p.days || []) for (const pe of d.exercises || []) seed(pe)
  for (const s of sessions) for (const ex of s.exercises || []) seed(ex)
  write(EX_NOTES_KEY, map)
  write(EX_NOTES_MIGRATED_KEY, true)
}
