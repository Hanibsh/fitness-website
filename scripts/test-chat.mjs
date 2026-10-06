// Checks for what gets shared into the coach ↔ client chat (lib/chatCards.js)
// and the progress numbers beside it (lib/progress.js):
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
const progress = await server.ssrLoadModule('/src/lib/progress.js')

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
check('check-in card without food', ci.food === null)
const ciFood = cards.checkinCard({ week_start: '2026-10-05', answers: {} }, { food: { calories: 2200, protein: null, bodyFat: 18 } })
check('check-in card carries the week’s food', JSON.stringify(ciFood.food) === JSON.stringify({ calories: 2200, protein: null, bodyFat: 18 }))
check('an empty food entry rides as null', cards.checkinCard({ week_start: '2026-10-05' }, { food: { calories: null, protein: null, bodyFat: null } }).food === null)

// ---- Lifts by use ------------------------------------------------------------------
const withRow = (id, date, names) => ({ id, date, exercises: names.map((n) => ({ name: n, kind: n === 'Incline Walk' ? 'cardio' : 'strength', sets: [] })) })
const lifts = progress.liftsByUse([
  withRow('1', now - 3 * DAY, ['Squat', 'Bench Press']),
  withRow('2', now - 2 * DAY, ['bench press', 'Incline Walk']),
  withRow('3', now - DAY, ['Row', 'Row']),
])
check('most-trained lift first, cardio out, a repeat counts once', JSON.stringify(lifts) === JSON.stringify(['bench press', 'Row', 'Squat']), JSON.stringify(lifts))

// ---- Top lift change ------------------------------------------------------------------
const benchDay = (id, date, weight) => ({ id, date, unit: 'kg', exercises: [{ id: `b${id}`, exerciseId: 'barbell-bench-press', name: 'Bench Press', kind: 'strength', sets: [{ id: `s${id}`, reps: 5, weight, type: 'working' }] }] })
const top = progress.topLiftChange([benchDay('1', now - 60 * DAY, 100), benchDay('2', now - 30 * DAY, 105), benchDay('3', now - DAY, 110)])
check('top lift change', top.name === 'Bench Press' && top.pct === 10, JSON.stringify(top))
check('one session is no change', progress.topLiftChange([benchDay('1', now - DAY, 100)]).pct === null)
check('nothing logged', progress.topLiftChange([]) === null)

// ---- Compare lines -----------------------------------------------------------------
const pts = (...vals) => vals.map((value, i) => ({ date: now - (vals.length - i) * DAY, value }))
const sameUnit = progress.compareLines([
  { id: 'lift', unit: 'kg', points: pts(100, 105, 110) },
  { id: 'bw', unit: 'kg', points: pts(80, 81) },
])
check('same unit keeps real values', sameUnit.mode === 'value' && sameUnit.unit === 'kg' && sameUnit.lines[0].plot[2].y === 110)
check('same unit change in the unit', sameUnit.lines[0].change === 10 && sameUnit.lines[1].change === 1)
const mixed = progress.compareLines([
  { id: 'bw', unit: 'kg', points: pts(80, 84) },
  { id: 'cal', unit: 'cal', points: pts(2500, 2000) },
  { id: 'fat', unit: '%', points: [] },
])
check('mixed units go to % change', mixed.mode === 'pct' && mixed.unit === '%')
check('each line starts at 0%', mixed.lines.every((l) => l.plot[0].y === 0))
check('% change keeps the real value', mixed.lines[0].plot[1].value === 84 && mixed.lines[0].change === 5 && mixed.lines[1].change === -20, JSON.stringify(mixed.lines.map((l) => l.change)))
check('a line with no points is left out', mixed.lines.length === 2)
const zeroStart = progress.compareLines([
  { id: 'cal', unit: 'cal', points: pts(0, 2000, 2200) },
  { id: 'bw', unit: 'kg', points: pts(80) },
])
check('a zero first value is skipped as the base', zeroStart.lines[0].plot.length === 2 && zeroStart.lines[0].change === 10)
check('a single point has no change', zeroStart.lines[1].change === null)
check('all zeros draws nothing', progress.compareLines([{ id: 'a', unit: 'g', points: pts(0, 0) }, { id: 'b', unit: 'kg', points: pts(1) }]).lines.length === 1)
check('nothing to compare', progress.compareLines([]).lines.length === 0)

const series = pts(1, 2, 3)
check('valueAt: before the first point', progress.valueAt(series, series[0].date - 1) === null)
check('valueAt: on a point', progress.valueAt(series, series[1].date).value === 2)
check('valueAt: between points holds the last', progress.valueAt(series, series[1].date + 1000).value === 2)
check('valueAt: after the last', progress.valueAt(series, now + DAY).value === 3)

// ---- Unknown -----------------------------------------------------------------------
check('unknown card is not a card', !cards.isCard({ type: 'poll' }) && !cards.isCard(null))
check('unknown card still labels', cards.cardLabel({ type: 'poll' }) === 'Shared item')

console.log(`${passed} checks passed`)
server.close()
