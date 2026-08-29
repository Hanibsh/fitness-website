// What one day of training does — the numbers behind every day card.
//
// Two entry points over one accumulator: `dayStats(day)` for a day as PLANNED in
// a split, `sessionStats(session)` for a day as actually LOGGED. Same output
// shape, same muscle maths; the only difference is whether a movement's set
// count comes from the target or from the sets you finished. That's deliberate —
// a done card and its plan card have to be comparable at a glance.
//
// This is the day-sized sibling of engine.js. The engine grades a training
// history (it has RIR, decay, within-session diminishing returns); one day is
// too small a window for any of that, so the maths here is just sets weighted by
// the DB's muscle contributions. Folding the engine's terms in would make a day
// card disagree with the dashboard about what the same work is worth.
//
// What IS shared with the engine: the muscle taxonomy (ATOM_TO_GROUP), the
// max-not-sum rule for crediting a set to a muscle, and the systemic-load
// coefficients. Same vocabulary, different question.

import { getFullExercise } from './exerciseBank'
import { exerciseIdForName } from './exerciseLibrary'
import {
  ATOM_TO_GROUP, fallbackMuscle,
  FATIGUE_SCORE_COEF, DEFAULT_FATIGUE_SCORE,
  AXIAL_MULT, FREE_WEIGHT_MULT, SYSTEMIC_CAPACITY, systemicLevel,
} from './engineConfig'

// The engine's 20 muscles rolled up into the exercise bank's 7 home categories
// (CATEGORY_ORDER in exerciseBank.js). A phone-width day card fits three bars
// before they stop being scannable, so the card speaks in these; the day page
// shows the fine-grained breakdown underneath.
export const ENGINE_MUSCLE_TO_COARSE = {
  Chest: 'Chest',
  Lats: 'Back', 'Upper Back': 'Back', 'Lower Back': 'Back',
  'Neck & Traps': 'Neck and Traps',
  'Front Delts': 'Shoulders', 'Side Delts': 'Shoulders', 'Rear Delts': 'Shoulders',
  Biceps: 'Arms', Triceps: 'Arms', Forearms: 'Arms',
  Abs: 'Core', Obliques: 'Core',
  Quads: 'Legs', Hamstrings: 'Legs', Glutes: 'Legs', Adductors: 'Legs', Abductors: 'Legs',
  Calves: 'Legs', Tibialis: 'Legs',
}

// ---- The donut vocabulary --------------------------------------------------
//
// A third rollup, for the pie charts, and it exists because neither of the other
// two can draw one. The 7 coarse categories are too blunt — a leg day comes out
// as a single slice reading "100% Legs", which tells you nothing about whether it
// was quad-dominant or a posterior-chain day. The 20 engine muscles are too many
// slices to read, and would need 20 distinguishable colours.
//
// These 12 are the dashboard donut's existing 11 (src/components/MuscleDonut.jsx
// owns the palette) plus Adductors. Squats and lunges put real volume through the
// adductors, and folding them into Quads — the only other plausible home — would
// overstate quads on every single leg day.
export const DONUT_GROUP_ORDER = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms',
  'Quads', 'Hamstrings', 'Glutes', 'Adductors', 'Calves', 'Abs',
]

// Two mappings worth defending: Abductors roll into GLUTES because that is
// anatomically what they are (glute medius and minimus), not a separate muscle
// that happens to sit nearby; and Tibialis rolls into CALVES as the other half
// of the same shank, since a lone tibialis sliver would be unreadable and it has
// no other home.
export const ENGINE_MUSCLE_TO_DONUT = {
  Chest: 'Chest',
  Lats: 'Back', 'Upper Back': 'Back', 'Lower Back': 'Back', 'Neck & Traps': 'Back',
  'Front Delts': 'Shoulders', 'Side Delts': 'Shoulders', 'Rear Delts': 'Shoulders',
  Biceps: 'Biceps', Triceps: 'Triceps', Forearms: 'Forearms',
  Abs: 'Abs', Obliques: 'Abs',
  Quads: 'Quads', Hamstrings: 'Hamstrings',
  Glutes: 'Glutes', Abductors: 'Glutes',
  Adductors: 'Adductors',
  Calves: 'Calves', Tibialis: 'Calves',
}

// Roll `muscles` rows (from dayStats/sessionStats, or summarize's weekly volume)
// into slices for MuscleDonut, biggest first.
//
// Takes the ALREADY-WEIGHTED rows rather than recomputing from the database, so
// a donut and the bars beside it are the same numbers drawn twice — the max-not-
// sum rule, the contribution weighting and any per-week normalisation the caller
// applied are all already baked in.
export function donutRows(rows, { key = 'muscle', valueKey = 'sets' } = {}) {
  const totals = {}
  for (const row of rows || []) {
    const group = ENGINE_MUSCLE_TO_DONUT[row[key]]
    if (!group) continue
    totals[group] = (totals[group] || 0) + (Number(row[valueKey]) || 0)
  }
  return DONUT_GROUP_ORDER.filter((g) => round1(totals[g]) > 0)
    .map((g) => ({ muscle: g, label: g === 'Abs' ? 'Core' : g, value: round1(totals[g]) }))
    .sort((a, b) => b.value - a.value)
}

// The exercise bank id a planned row points at, or null when it has none (custom
// movements, and the cardio / Olympic / full-body entries that have no DB row).
// The stored id wins; falling back to the name catches rows planned before the
// picker started stamping ids. Aliases resolve renamed ids, so an old split
// still links to the right page.
export function bankIdFor(planned) {
  if (!planned) return null
  const id = plannedExerciseDbId(planned)
  return id && getFullExercise(id) ? id : null
}

// The database row a PLANNED row should be costed against.
//
// Three terms, in order: what the row says it is; what its movement slot would
// pick if you left the choice open; then its name, for rows planned before the
// picker started stamping ids.
//
// The middle term is what makes an open slot free. A row reading "Any vertical
// pull" still carries the generator's own pick in `slot.suggestedId`, so it
// costs exactly what it will cost once you choose — the day card, the volume
// bars and the generator's own budgeting all resolve through here and none of
// them has to estimate from a pattern average.
//
// Only ever called on PLANNED rows. A logged exercise always names a real
// movement, because the logger will not let a slot be logged until it's filled.
export function plannedExerciseDbId(planned) {
  if (!planned) return null
  return planned.exerciseId || planned.slot?.suggestedId || exerciseIdForName(planned.name) || null
}

function round1(n) {
  return Math.round(n * 10) / 10
}

// Turn a muscle -> weighted-sets map into sorted rows with their share of the
// day. Percentages are rounded independently, so a column can sum to 99 or 101 —
// that's honest for a share readout and not worth fudging.
function toRows(map, key) {
  const total = Object.values(map).reduce((a, b) => a + b, 0)
  return Object.entries(map)
    .map(([name, sets]) => ({ [key]: name, sets: round1(sets), pct: total ? Math.round((100 * sets) / total) : 0 }))
    .sort((a, b) => b.sets - a.sets)
}

const LOAD_LABELS = { fresh: 'Light day', moderate: 'Moderate day', high: 'Heavy day' }

function newAccumulator() {
  return {
    muscleSets: {}, // engine muscle -> sets, weighted by contribution
    coarseSets: {}, // ...and the same, rolled up to the bank's 7 categories
    sets: 0,
    cardio: 0,
    load: 0,
  }
}

// Credit `n` sets of one movement to the accumulator. `ex` is anything carrying
// {exerciseId, name, kind} — a planned row or a logged one; the only difference
// between a plan and a session at this level is where `n` came from.
function creditExercise(acc, ex, n) {
  acc.sets += n
  if (ex.kind === 'cardio') {
    acc.cardio++
    return // no muscle split and no systemic load we can honestly claim
  }
  const db = getFullExercise(bankIdFor(ex))

  if (db && db.muscles && Object.keys(db.muscles).length) {
    // Bucket the atoms and credit the BEST-trained one per bucket, never their
    // sum — incline bench listing Upper 1.0 / Middle 0.5 / Lower 0.25 says which
    // region it biases toward, not that it's 1.75 chest sets. Same rule (and
    // same reasoning) as effectiveWeeklyVolume in engine.js.
    //
    // The coarse bucket is filled from the atoms too, NOT by adding up the
    // engine muscles afterwards — that would make the same mistake one level up,
    // summing the three delt heads so a bench press reads as three quarters of a
    // shoulder set on top of its chest set.
    const byMuscle = {}
    const byCoarse = {}
    for (const [atom, w] of Object.entries(db.muscles)) {
      const g = ATOM_TO_GROUP[atom]
      if (!g) continue
      byMuscle[g] = Math.max(byMuscle[g] || 0, w)
      const c = ENGINE_MUSCLE_TO_COARSE[g]
      if (c) byCoarse[c] = Math.max(byCoarse[c] || 0, w)
    }
    for (const [g, w] of Object.entries(byMuscle)) acc.muscleSets[g] = (acc.muscleSets[g] || 0) + n * w
    for (const [c, w] of Object.entries(byCoarse)) acc.coarseSets[c] = (acc.coarseSets[c] || 0) + n * w
  } else {
    // Custom movement: guess the muscle from the name, credit it in full.
    const g = fallbackMuscle(ex.name)
    if (g) {
      acc.muscleSets[g] = (acc.muscleSets[g] || 0) + n
      const c = ENGINE_MUSCLE_TO_COARSE[g]
      if (c) acc.coarseSets[c] = (acc.coarseSets[c] || 0) + n
    }
  }

  // Systemic load, mirroring the per-set deposit in engine.js with the RIR term
  // left at 1. A plan doesn't know how hard you'll take a set; a session does,
  // but reading it here would make a done card and its plan card grade the same
  // work differently for reasons the card has no room to explain.
  const coef = FATIGUE_SCORE_COEF[db?.fatigueScore ?? DEFAULT_FATIGUE_SCORE] || 1
  acc.load += n * coef * (db?.axialLoading ? AXIAL_MULT : 1) * (db?.equipment === 'free weight' ? FREE_WEIGHT_MULT : 1)
}

function summarise(acc, exercises) {
  // Graded against the same capacity the dashboard's strain meter uses, so
  // "Heavy day" here and a high strain reading there mean the same thing.
  const pct = Math.round(100 * Math.min(1, acc.load / SYSTEMIC_CAPACITY))
  const level = systemicLevel(pct)
  return {
    exercises,
    sets: acc.sets,
    cardio: acc.cardio,
    muscles: toRows(acc.muscleSets, 'muscle'),
    groups: toRows(acc.coarseSets, 'group'),
    load: { pct, level, label: LOAD_LABELS[level] },
  }
}

// Everything a day card and a day page need to say about one PLANNED day —
// target sets, as written in the split. Rest days (and empty ones) come back as
// all-zero with empty breakdowns.
export function dayStats(day) {
  const rows = day?.exercises || []
  const acc = newAccumulator()
  for (const ex of rows) creditExercise(acc, ex, Math.max(0, Number(ex.sets) || 0))
  return summarise(acc, rows.length)
}

// Whether a logged set counts as work. Warm-ups are logged but never count, and
// a unilateral set is ONE set of the movement (not two), so either limb having
// reps is enough — the same rule sessionStats in workoutStore.js applies.
function isWorkingSet(set, cardio) {
  if (set.type === 'warmup') return false
  if (cardio) return Number(set.duration) > 0
  if (set.left) return Number(set.left.reps) > 0 || Number(set.right?.reps) > 0
  return Number(set.reps) > 0
}

// The same summary for a day you actually TRAINED, built from the session rather
// than the plan — real movements, real working sets. Identical shape to
// dayStats, so a card can render either without knowing which it got.
export function sessionStats(session) {
  const rows = session?.exercises || []
  const acc = newAccumulator()
  for (const ex of rows) {
    const cardio = ex.kind === 'cardio'
    creditExercise(acc, ex, (ex.sets || []).filter((s) => isWorkingSet(s, cardio)).length)
  }
  return { ...summarise(acc, rows.length), durationMs: session?.durationMs || null }
}

// Working sets per logged exercise, for the chips on a done card ("Bench · 4×").
export function workingSetCount(ex) {
  const cardio = ex?.kind === 'cardio'
  return (ex?.sets || []).filter((s) => isWorkingSet(s, cardio)).length
}
