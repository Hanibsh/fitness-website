// Do the app's movement rankings agree with how Leon actually programs?
//
//   node scripts/audit-preferences.mjs
//
// When Leon writes a program for a client he states preferences outright:
//
//   "Any kind of squat movement: pendulum squat > hack squat >
//    smith machine squats > free bar squat"
//
// Every one of those chains is a free test case, and this is where they live.
// The app derives its own order for each movement path from the database
// columns (see scoreExercise in src/lib/generator.js); a chain says what the
// order SHOULD be. Where the two disagree, something is wrong — usually a bad
// row, occasionally a weight — and the point of this script is to say which
// movements are out of place and which columns put them there, rather than
// leaving it to be discovered by eye months later.
//
// It writes nothing and it is not a pass/fail gate. Some inversions are real
// disagreements about a movement that only Leon can settle; the job here is to
// keep them visible and attributed.
//
// Unlike the other audit scripts, this one needs the REAL scorer rather than a
// reimplementation of it — a copy would drift, then agree with itself while the
// app did something else.
//
// src/lib is written for Vite: extensionless imports and a bare JSON import,
// neither of which plain node resolves. jiti (already a dependency) applies
// Vite's resolution rules at runtime, so the script can load the app's own
// modules with no build step and nothing to keep in sync.
import { createJiti } from 'jiti'
import { getPattern } from '../data/movement-patterns.mjs'

const jiti = createJiti(import.meta.url)
const { patternOptions } = await jiti.import('../src/lib/generator.js')
const exercisesDb = await jiti.import('../src/data/exercises.json', { default: true })

const BY_ID = new Map(exercisesDb.exercises.map((e) => [e.id, e]))

// ---- the chains ------------------------------------------------------------
//
// `order` is best-first, by exercise id. Ids are slugs of the exercise name —
// look one up in src/data/exercises.json if you are adding a chain. `muscle` is
// the engine muscle the slot exists to train, because a path is ranked FOR
// something: the best horizontal push for triceps is not the best one for chest.

const CHAINS = [
  {
    source: 'Pouriq Zarrin — Lower 1/2, "any kind of squat movement"',
    pattern: 'squat',
    muscle: 'Quads',
    order: ['pendulum-squat', 'hack-squats-machine', 'smith-machine-squat', 'barbell-squat'],
  },
  {
    source: 'Pouriq Zarrin — Lower 1/2, "stiff leg calf raises"',
    pattern: 'calf-straight-leg',
    muscle: 'Calves',
    order: ['leg-press-calf-raise', 'calf-raise-machine', 'smith-machine-standing-calf-raise'],
  },
]

// The columns worth naming when two movements come out in the wrong order.
// Deliberately the ones Leon named as his criteria — stable, loadable, low
// skill — plus the two that most often outweigh them.
const COLUMNS = ['stability', 'progressiveOverload', 'skill', 'sfr', 'hypertrophyPotential', 'fatigueScore', 'axialLoading', 'equipment']

function describe(db) {
  return COLUMNS.map((c) => `${c}=${db[c]}`).join('  ')
}

// Where each chain member actually lands, ranked on its own merits: an empty
// day, so no fatigue is already spent, nothing else is competing for the slot
// and no week-variety penalty applies. That isolates the question this script
// asks — "which of these is the better movement" — from the different question
// the generator asks when it is filling a real day.
function ranked(chain) {
  const seed = chain.order[0]
  const planned = {
    id: 'slot',
    kind: 'strength',
    sets: 3,
    exerciseId: null,
    name: BY_ID.get(seed)?.name || seed,
    slot: { pattern: chain.pattern, muscle: chain.muscle, pinned: false, suggestedId: seed },
  }
  const program = { id: 'p', name: 'audit', pointer: 0, days: [{ id: 'd', kind: 'train', name: 'Day', exercises: [planned] }] }
  return patternOptions(planned, { program, dayId: 'd', pattern: chain.pattern, limit: 999 })
}

let inversions = 0
let missing = 0

for (const chain of CHAINS) {
  const info = getPattern(chain.pattern)
  console.log(`\n${'='.repeat(78)}`)
  console.log(`${info?.label || chain.pattern}  ·  ranked for ${chain.muscle}`)
  console.log(chain.source)
  console.log('='.repeat(78))

  const list = ranked(chain)
  const posOf = new Map(list.map((o, i) => [o.id, i + 1]))

  console.log('\n  stated order            actual   movement')
  console.log('  ' + '-'.repeat(74))
  for (const [i, id] of chain.order.entries()) {
    const db = BY_ID.get(id)
    if (!db) {
      console.log(`  ${String(i + 1).padStart(2)}.  ${id.padEnd(20)}  —      NOT IN DATABASE`)
      missing++
      continue
    }
    const at = posOf.get(id)
    console.log(`  ${String(i + 1).padStart(2)}.  ${''.padEnd(20)}  ${at ? `#${String(at).padEnd(5)}` : 'absent'} ${db.name}`)
  }

  // Every pair the app disagrees with, and what decided it.
  console.log('\n  inversions:')
  let found = 0
  for (let i = 0; i < chain.order.length; i++) {
    for (let j = i + 1; j < chain.order.length; j++) {
      const a = chain.order[i]
      const b = chain.order[j]
      const pa = posOf.get(a)
      const pb = posOf.get(b)
      if (pa == null || pb == null || pa <= pb) continue
      found++
      inversions++
      const dbA = BY_ID.get(a)
      const dbB = BY_ID.get(b)
      console.log(`\n    ✗ ${dbB.name} (#${pb}) is ranked above ${dbA.name} (#${pa})`)
      console.log(`        wanted above:  ${describe(dbA)}`)
      console.log(`        actually above: ${describe(dbB)}`)
      const differs = COLUMNS.filter((c) => dbA[c] !== dbB[c])
      console.log(`        differs on: ${differs.join(', ') || '(nothing — identical rows)'}`)
    }
  }
  if (!found) console.log('    none — the app agrees with the chain')

  // The top of the computed list, for context on what beat the chain.
  console.log('\n  app order (top 6):')
  for (const [i, o] of list.slice(0, 6).entries()) {
    const mark = chain.order.includes(o.id) ? '*' : ' '
    console.log(`   ${mark}${String(i + 1).padStart(2)}. ${o.score.toFixed(1).padStart(5)}  ${o.name.padEnd(42)} ${describe(BY_ID.get(o.id))}`)
  }
}

console.log(`\n${'='.repeat(78)}`)
console.log(`${CHAINS.length} chain(s) · ${inversions} inversion(s)${missing ? ` · ${missing} movement(s) not in the database` : ''}`)
console.log('An inversion is a disagreement to explain, not automatically a bug to fix.')
