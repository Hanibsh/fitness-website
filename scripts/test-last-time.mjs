// Checks where "last time" suggestions come from: the same slot of the split
// first (twin days count as one), then anywhere; skipped entries and renamed
// exercises don't break the chain; and typing only reps keeps the grey weight.
//
//   node scripts/test-last-time.mjs
//
// Loaded through Vite's SSR loader like the audits; reads only, writes nothing.
// Exits 1 on the first failed check.

import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const server = await createServer({ root: ROOT, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const stats = await server.ssrLoadModule('/src/lib/workoutStats.js')
const program = await server.ssrLoadModule('/src/lib/program.js')
const store = await server.ssrLoadModule('/src/lib/workoutStore.js')

let passed = 0
function check(name, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL  ${name}${detail ? `\n      ${detail}` : ''}`)
    server.close()
    process.exit(1)
  }
  passed++
}

const set = (weight, reps) => ({ id: Math.random().toString(36), weight, reps, rir: '' })
const bench = (plannedExerciseId, weight, sets = [set(weight, 8)]) => ({
  id: Math.random().toString(36), exerciseId: 'flat-bench-press', name: 'Flat Bench Press', plannedExerciseId, sets,
})
const session = (date, ...exercises) => ({ id: String(date), date, unit: 'kg', exercises })

// A split with bench 1st on Upper A, 4th on Upper B, and Upper A coming round twice.
const split = {
  id: 'p1',
  days: [
    { id: 'ua', name: 'Upper A', exercises: [{ id: 'ua-bench' }] },
    { id: 'ub', name: 'Upper B', exercises: [{ id: 'x1' }, { id: 'x2' }, { id: 'x3' }, { id: 'ub-bench' }] },
    { id: 'ua2', name: 'Upper A', twin: 'ua', exercises: [{ id: 'ua2-bench', twin: 'ua-bench' }] },
  ],
}

// ---- slotRowIds ----
const slotA = program.slotRowIds(split, 'ua-bench')
check('slot includes its twin row', slotA.has('ua-bench') && slotA.has('ua2-bench') && !slotA.has('ub-bench'))
check('twin row finds its source', program.slotRowIds(split, 'ua2-bench').has('ua-bench'))
check('no plan link → empty slot', program.slotRowIds(split, null).size === 0)

// ---- lastLoggedExercise ----
const history = [
  session(5, bench('ub-bench', 70)), // newest: Upper B, 4th, lighter
  session(4, bench('ua-bench', 100)), // Upper A, 1st
  session(3, bench(null, 90)), // a session outside any split
]
const target = { exerciseId: 'flat-bench-press', name: 'Flat Bench Press' }

let last = stats.lastLoggedExercise(history, { ...target, slotIds: slotA })
check('same slot wins over a newer entry elsewhere', last?.ex.sets[0].weight === 100 && last.fromSlot)

last = stats.lastLoggedExercise(history, { ...target, slotIds: program.slotRowIds(split, 'ua2-bench') })
check('twin day reads the shared history', last?.ex.sets[0].weight === 100 && last.fromSlot)

last = stats.lastLoggedExercise(history, { ...target, slotIds: new Set(['new-split-row']) })
check('new split falls back to the newest anywhere', last?.ex.sets[0].weight === 70 && !last.fromSlot)

last = stats.lastLoggedExercise(history, target)
check('no slot → newest anywhere', last?.ex.sets[0].weight === 70)

const skipped = [session(6, bench('ua-bench', '', [set('', ''), set('', '')])), ...history]
last = stats.lastLoggedExercise(skipped, { ...target, slotIds: slotA })
check('a skipped (blank) entry is passed over', last?.ex.sets[0].weight === 100)

const renamed = [session(1, { ...bench(null, 60), exerciseId: 'bench-press' })]
last = stats.lastLoggedExercise(renamed, target)
check('an old renamed id still matches', last?.ex.sets[0].weight === 60)

// ---- takeHintWeight ----
const hinted = { id: 's', reps: '', weight: '', rir: '', hint: { reps: 8, weight: 100 } }
check('typing reps fills the grey weight', store.takeHintWeight(hinted, { ...hinted, reps: '8' }).weight === 100)
check('a typed weight is never replaced', store.takeHintWeight(hinted, { ...hinted, reps: '8', weight: '90' }).weight === '90')
const logged = { ...hinted, reps: '8', weight: 100 }
check('clearing the weight later stays cleared', store.takeHintWeight(logged, { ...logged, weight: '' }).weight === '')
const uni = { id: 'u', left: { weight: '', reps: '', rir: '' }, right: { weight: '', reps: '', rir: '' }, hint: { left: { weight: 20, reps: 10 }, right: { weight: 22, reps: 10 } } }
const uniOut = store.takeHintWeight(uni, { ...uni, left: { ...uni.left, reps: '10' } })
check('one limb fills only its own weight', uniOut.left.weight === 20 && uniOut.right.weight === '')
const bw = { id: 'b', bw: 80, added: '', reps: '', rir: '', weight: 80, hint: { added: 10, reps: 8 } }
const bwOut = store.takeHintWeight(bw, { ...bw, reps: '8' })
check('bodyweight sets fill the added weight', bwOut.added === 10 && bwOut.weight === 90)

check('saved sessions drop the hint label', !('hintFrom' in store.stripHints([{ ...bench('ua-bench', 1), hintFrom: 'Upper B' }])[0]))

console.log(`OK  ${passed} checks passed`)
server.close()
