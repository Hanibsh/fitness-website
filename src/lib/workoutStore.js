// Workout data layer.
//
// Every read/write to storage lives in this file. The UI never touches
// localStorage directly — it only calls these functions. That's deliberate:
// if we later add accounts + a backend (e.g. Supabase), we swap the bodies of
// these functions for API calls and the tracker UI keeps working unchanged.

const DRAFT_KEY = 'leon_workout_draft'
const HISTORY_KEY = 'leon_workout_history'
const UNIT_KEY = 'leon_workout_unit'

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
  } catch {
    // Storage full or unavailable — fail silently so the UI never crashes.
  }
}

// ---- Factories -------------------------------------------------------------

export function createSet(prev) {
  // A new set copies the previous set's numbers, since you usually repeat
  // the same weight/reps — one tap and you're logging.
  return {
    id: newId(),
    reps: prev ? prev.reps : '',
    weight: prev ? prev.weight : '',
    rir: prev ? prev.rir : '',
  }
}

export function createExercise(name) {
  return { id: newId(), name, sets: [createSet()] }
}

export function emptyDraft() {
  // `date` is the session's logged date — defaults to now but can be set to a
  // past day to backfill a missed workout.
  return { startedAt: Date.now(), date: Date.now(), exercises: [] }
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

// ---- History (completed sessions) -----------------------------------------

export function getHistory() {
  return read(HISTORY_KEY, [])
}

export function finishSession(draft, unit = 'kg') {
  const session = {
    id: newId(),
    date: draft.date || Date.now(),
    unit,
    exercises: draft.exercises,
  }
  // Keep history newest-first by date, so a backdated session lands in the
  // right chronological spot rather than always on top.
  const history = [session, ...getHistory()].sort((a, b) => b.date - a.date)
  write(HISTORY_KEY, history)
  clearDraft()
  return history
}

export function deleteSession(id) {
  const history = getHistory().filter((s) => s.id !== id)
  write(HISTORY_KEY, history)
  return history
}

// ---- Stats -----------------------------------------------------------------

export function sessionStats(session) {
  let sets = 0
  let volume = 0
  for (const ex of session.exercises) {
    for (const set of ex.sets) {
      const reps = Number(set.reps) || 0
      const weight = Number(set.weight) || 0
      if (reps > 0) sets += 1
      volume += reps * weight
    }
  }
  return { exercises: session.exercises.length, sets, volume }
}
