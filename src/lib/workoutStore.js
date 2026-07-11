// Workout data layer.
//
// Every read/write to storage lives in this file. The UI never touches
// localStorage directly — it only calls these functions. That's deliberate:
// if we later add accounts + a backend (e.g. Supabase), we swap the bodies of
// these functions for API calls and the tracker UI keeps working unchanged.

const DRAFT_KEY = 'leon_workout_draft'
const HISTORY_KEY = 'leon_workout_history'
const UNIT_KEY = 'leon_workout_unit'
const BODYWEIGHT_KEY = 'leon_bodyweight_log'

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

// Convert a set between the flat (bilateral) and left/right (unilateral)
// shapes, preserving whatever was already typed.
export function convertSet(s, unilateral) {
  // Carry the set's type (warm-up/back-off) and rest timestamp across a shape
  // change so nothing is lost when toggling laterality.
  const keep = { ...(s.type ? { type: s.type } : {}), ...(s.completedAt ? { completedAt: s.completedAt } : {}) }
  if (unilateral) {
    if (s.left) return s
    const side = { weight: s.weight ?? '', reps: s.reps ?? '', rir: s.rir ?? '' }
    return { id: s.id, left: side, right: { ...side }, ...keep }
  }
  if (!s.left) return s
  return { id: s.id, weight: s.left.weight ?? '', reps: s.left.reps ?? '', rir: s.left.rir ?? '', duration: '', distance: '', ...keep }
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
// for unilateral work — so stats/graph code can treat everything uniformly.
// Warm-up sets are dropped: they don't count toward working volume.
export function effectiveSets(ex) {
  const working = ex.sets.filter((s) => s.type !== 'warmup')
  if (ex.kind !== 'cardio' && ex.unilateral) {
    return working.flatMap((s) => [s.left, s.right].filter(Boolean))
  }
  return working
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
  return {
    id: newId(),
    date: draft.date || Date.now(),
    name: draft.name || '',
    unit,
    // How long the session took, if it looks plausible (started today, under
    // 6h). Used by the dashboard. Persisted locally; remote sync ignores it
    // for now (no DB column), so synced sessions simply won't show a duration.
    durationMs: plausibleDuration(draft.startedAt),
    exercises: draft.exercises,
  }
}

function plausibleDuration(startedAt) {
  if (!startedAt) return null
  const ms = Date.now() - startedAt
  return ms >= 60000 && ms <= 6 * 3600000 ? ms : null
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
      } else if (ex.unilateral) {
        // A unilateral set counts once (one set of the exercise), but volume
        // sums both limbs.
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
