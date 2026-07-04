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
  // the same weight/reps (or duration/distance) — one tap and you're logging.
  return {
    id: newId(),
    reps: prev ? prev.reps : '',
    weight: prev ? prev.weight : '',
    rir: prev ? prev.rir : '',
    duration: prev ? prev.duration ?? '' : '', // cardio: minutes
    distance: prev ? prev.distance ?? '' : '', // cardio: km/mi
  }
}

// `kind` is 'strength' (weight/reps/RIR) or 'cardio' (duration/distance). It's
// set from the picked movement's category and stored on the exercise so the
// log, history, and progress graphs all render the right fields. Older saved
// exercises have no `kind` and are treated as strength.
export function createExercise(name, kind = 'strength') {
  return { id: newId(), name, kind, sets: [createSet()] }
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

// Turn the in-progress draft into a finished session object (no persistence —
// the caller decides whether it goes to localStorage or Supabase).
export function makeSession(draft, unit = 'kg') {
  return {
    id: newId(),
    date: draft.date || Date.now(),
    name: draft.name || '',
    unit,
    exercises: draft.exercises,
  }
}

// Add a finished session to the local (anonymous) history, newest-first by date
// so a backdated session lands in the right chronological spot.
export function addLocalSession(session) {
  const history = [session, ...getHistory()].sort((a, b) => b.date - a.date)
  write(HISTORY_KEY, history)
  return history
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

// ---- Stats -----------------------------------------------------------------

export function sessionStats(session) {
  let sets = 0
  let volume = 0
  for (const ex of session.exercises) {
    const cardio = ex.kind === 'cardio'
    for (const set of ex.sets) {
      if (cardio) {
        // A cardio entry "counts" once it has time on it; it adds no volume.
        if (Number(set.duration) > 0) sets += 1
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
