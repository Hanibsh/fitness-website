// What a PLANNED day does — the numbers behind the split's day cards.
//
// This is the plan-side sibling of engine.js. The engine grades what you
// actually did (it has RIR, real set counts, timestamps); a split day is only
// an intention, so the maths here is deliberately simpler: target sets weighted
// by the DB's muscle contributions, and nothing else. No RIR effectiveness, no
// within-session diminishing returns, no decay. Those need a logged session to
// mean anything, and folding them in here would make a day card disagree with
// the dashboard about what the same work is worth.
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

// The exercise bank id a planned row points at, or null when it has none (custom
// movements, and the cardio / Olympic / full-body entries that have no DB row).
// The stored id wins; falling back to the name catches rows planned before the
// picker started stamping ids. Aliases resolve renamed ids, so an old split
// still links to the right page.
export function bankIdFor(planned) {
  if (!planned) return null
  const id = planned.exerciseId || exerciseIdForName(planned.name)
  return id && getFullExercise(id) ? id : null
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

// Everything a day card and a day page need to say about one training day.
// Rest days (and empty ones) come back as all-zero with empty breakdowns.
export function dayStats(day) {
  const rows = day?.exercises || []
  const muscleSets = {} // engine muscle -> target sets, weighted by contribution
  const coarseSets = {} // ...and the same, rolled up to the bank's 7 categories
  let sets = 0
  let cardio = 0
  let load = 0

  for (const ex of rows) {
    const n = Math.max(0, Number(ex.sets) || 0)
    sets += n
    if (ex.kind === 'cardio') {
      cardio++
      continue // no muscle split and no systemic load we can honestly claim
    }
    const db = getFullExercise(bankIdFor(ex))

    if (db && db.muscles && Object.keys(db.muscles).length) {
      // Bucket the atoms and credit the BEST-trained one per bucket, never their
      // sum — incline bench listing Upper 1.0 / Middle 0.5 / Lower 0.25 says
      // which region it biases toward, not that it's 1.75 chest sets. Same rule
      // (and same reasoning) as effectiveWeeklyVolume in engine.js.
      //
      // The coarse bucket is filled from the atoms too, NOT by adding up the
      // engine muscles afterwards — that would make the same mistake one level
      // up, summing the three delt heads so a bench press reads as three quarters
      // of a shoulder set on top of its chest set.
      const byMuscle = {}
      const byCoarse = {}
      for (const [atom, w] of Object.entries(db.muscles)) {
        const g = ATOM_TO_GROUP[atom]
        if (!g) continue
        byMuscle[g] = Math.max(byMuscle[g] || 0, w)
        const c = ENGINE_MUSCLE_TO_COARSE[g]
        if (c) byCoarse[c] = Math.max(byCoarse[c] || 0, w)
      }
      for (const [g, w] of Object.entries(byMuscle)) muscleSets[g] = (muscleSets[g] || 0) + n * w
      for (const [c, w] of Object.entries(byCoarse)) coarseSets[c] = (coarseSets[c] || 0) + n * w
    } else {
      // Custom movement: guess the muscle from the name, credit it in full.
      const g = fallbackMuscle(ex.name)
      if (g) {
        muscleSets[g] = (muscleSets[g] || 0) + n
        const c = ENGINE_MUSCLE_TO_COARSE[g]
        if (c) coarseSets[c] = (coarseSets[c] || 0) + n
      }
    }

    // Planned systemic load, mirroring the per-set deposit in engine.js with the
    // RIR term left at 1 (a plan doesn't know how hard you'll take a set).
    const coef = FATIGUE_SCORE_COEF[db?.fatigueScore ?? DEFAULT_FATIGUE_SCORE] || 1
    load += n * coef * (db?.axialLoading ? AXIAL_MULT : 1) * (db?.equipment === 'free weight' ? FREE_WEIGHT_MULT : 1)
  }

  // Graded against the same capacity the dashboard's strain meter uses, so
  // "Heavy day" here and a high strain reading there mean the same thing.
  const pct = Math.round(100 * Math.min(1, load / SYSTEMIC_CAPACITY))
  const level = systemicLevel(pct)

  return {
    exercises: rows.length,
    sets,
    cardio,
    muscles: toRows(muscleSets, 'muscle'),
    groups: toRows(coarseSets, 'group'),
    load: { pct, level, label: LOAD_LABELS[level] },
  }
}
