// Checks for what gets shared into the coach ↔ client chat (lib/chatCards.js):
// the snapshots stay snapshots, PRs travel with a workout, a kept split is a
// new split of the reader's own.
//
//   node scripts/test-chat.mjs
//
// Loaded through Vite's SSR loader like the audits; reads only, writes nothing.
// Exits 1 on the first failed check.

import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const server = await createServer({ root: ROOT, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const cards = await server.ssrLoadModule('/src/lib/chatCards.js')

let passed = 0
function check(name, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL  ${name}${detail ? `\n      ${detail}` : ''}`)
    server.close()
    process.exit(1)
  }
  passed++
}

const DAY = 86400000
const now = Date.now()

// ---- Exercise -------------------------------------------------------------------
const ex = cards.exerciseCard({ id: 'incline-dumbbell-press', name: 'Incline Dumbbell Press', category: 'Chest' })
check('exercise card shape', ex.type === 'exercise' && ex.id === 'incline-dumbbell-press' && ex.name === 'Incline Dumbbell Press')
check('exercise label', cards.cardLabel(ex) === 'Exercise: Incline Dumbbell Press')
check('exercise name capped', cards.exerciseCard({ name: 'x'.repeat(200) }).name.length === 80)

// ---- Split ------------------------------------------------------------------------
const program = {
  id: 'p1', name: 'Upper / Lower', pointer: 2, createdAt: now, updatedAt: now, coach: { id: 'c' },
  days: [
    { id: 'd1', kind: 'train', name: 'Upper', exercises: [{ id: 'e1', name: 'Bench Press', sets: 3 }] },
    { id: 'd2', kind: 'rest', name: 'Rest', exercises: [] },
  ],
}
const split = cards.splitCard(program, { sent: true })
check('split keeps its days', split.program.days.length === 2 && split.sent === true)
check('split drops the pointer and the coach stamp', !('pointer' in split.program) && !('coach' in split.program))
program.days[0].name = 'Changed later'
check('split is a snapshot', split.program.days[0].name === 'Upper')
check('split shape', JSON.stringify(cards.splitShape(split.program)) === JSON.stringify({ train: 1, total: 2 }))

const copy = cards.copyOfSharedSplit(split.program)
check('a kept split is a new split', copy.id !== 'p1' && copy.name === 'Upper / Lower' && copy.days.length === 2)
copy.days[0].name = 'Mine now'
check('a kept split doesn’t touch the card', split.program.days[0].name === 'Upper')

// ---- Workout ----------------------------------------------------------------------
const session = (id, date, weight) => ({
  id, date, name: 'Upper', unit: 'kg',
  exercises: [{ id: `x${id}`, exerciseId: 'barbell-bench-press', name: 'Bench Press', kind: 'strength', sets: [{ id: `s${id}`, reps: 8, weight, type: 'working' }] }],
})
const older = session('a', now - 7 * DAY, 80)
const latest = session('b', now - DAY, 85)
const workout = cards.workoutCard(latest, [latest, older])
check('workout PRs worked out against the log', workout.prs.some((p) => p.kind === 'weight' && p.value === 85 && p.previous === 80), JSON.stringify(workout.prs))
check('first time is no PR', cards.workoutCard(older, [older]).prs.length === 0)
check('workout label', cards.cardLabel(workout) === 'Workout: Upper')

// ---- Check-in ----------------------------------------------------------------------
const ci = cards.checkinCard({ week_start: '2026-10-05', answers: { sleep: 4 } }, { updated: true })
check('check-in card', ci.type === 'checkin' && ci.answers.sleep === 4 && cards.cardLabel(ci) === 'Check-in updated')

// ---- Unknown -----------------------------------------------------------------------
check('unknown card is not a card', !cards.isCard({ type: 'poll' }) && !cards.isCard(null))
check('unknown card still labels', cards.cardLabel({ type: 'poll' }) === 'Shared item')

console.log(`${passed} checks passed`)
server.close()
