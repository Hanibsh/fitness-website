// Checks for the Fixed week | Rotation switch (lib/program.js): which way a
// split schedules, switching either way, and that an exported split comes back
// as the same kind.
//
//   node scripts/test-schedule.mjs
//
// Loaded through Vite's SSR loader like the audits; reads only, writes nothing.
// Exits 1 on the first failed check.

import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const server = await createServer({ root: ROOT, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const p = await server.ssrLoadModule('/src/lib/program.js')
const ex = await server.ssrLoadModule('/src/lib/programExport.js')
const im = await server.ssrLoadModule('/src/lib/programImport.js')

let passed = 0
function check(name, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL  ${name}${detail ? `\n      ${detail}` : ''}`)
    server.close()
    process.exit(1)
  }
  passed++
}

const train = (name) => ({ ...p.createDay('train', name), exercises: [] })
const rest = (cardio = false) => ({ ...p.createDay('rest'), exercises: cardio ? [{ id: `c${Math.random()}`, name: 'Incline Walk', kind: 'cardio', sets: 1 }] : [] })
const prog = (days, extra = {}) => ({ ...p.emptyProgram('Test'), days, ...extra })
const seven = () => [train('A'), rest(), train('B'), rest(), train('C'), rest(), rest()]

// ---- Which way it schedules ---------------------------------------------------------
check('old split, 7 days: weekly', p.scheduleMode(prog(seven())) === 'weekly')
check('old split, 5 days: rotation', p.scheduleMode(prog(seven().slice(0, 5))) === 'rotating')
check('a 7-day rotation stays a rotation', p.scheduleMode(prog(seven(), { schedule: 'rotating' })) === 'rotating')
check('a fixed week', p.scheduleMode(prog(seven(), { schedule: 'weekly' })) === 'weekly')
const eight = prog([...seven(), train('D')], { schedule: 'weekly' })
check('a fixed week with 8 days runs as a rotation', p.scheduleMode(eight) === 'rotating' && p.brokenFixedWeek(eight))
check('not broken at 7', !p.brokenFixedWeek(prog(seven(), { schedule: 'weekly' })))

// ---- Rotation → fixed week -------------------------------------------------------------
const upper = train('Upper')
const lower = train('Lower')
const walk = rest(true)
const r1 = rest()
const rotation = prog([upper, walk, lower, r1], { schedule: 'rotating', pointer: 2 })
const week = p.toFixedWeek(rotation, [3, 0])
check('7 days, training on the picked weekdays in order', week.program.days.length === 7 && week.program.days[0] === upper && week.program.days[3] === lower)
check('the rest day holding cardio keeps its slot in the gaps', week.program.days[1] === walk && week.program.days[2] === r1)
check('gaps beyond the old rest days are new rest days', week.program.days.slice(4).every((d) => d.kind === 'rest' && !d.exercises.length))
check('stamped weekly', week.program.schedule === 'weekly' && p.scheduleMode(week.program) === 'weekly' && week.droppedCardio === 0)
const midWeek = p.toFixedWeek(prog([upper, walk, lower], { schedule: 'rotating' }), [1, 4])
check('a rest day after Upper lands in the first gap after Upper', midWeek.program.days[1] === upper && midWeek.program.days[2] === walk && midWeek.program.days[4] === lower)
check('the days before the first training day are rest', midWeek.program.days[0].kind === 'rest' && !midWeek.program.days[0].exercises.length)
check('wrong number of weekdays', p.toFixedWeek(rotation, [0]) === null && p.toFixedWeek(rotation, [0, 1, 2]) === null)
const six = prog([train('1'), train('2'), train('3'), rest(true), train('4'), train('5'), rest(true), train('6'), rest()], { schedule: 'rotating' })
const tight = p.toFixedWeek(six, [0, 1, 2, 3, 4, 5])
check('one gap: one cardio rest day fits, the other is counted', tight.program.days[6].exercises.length === 1 && tight.droppedCardio === 1)

// ---- Fixed week → rotation ---------------------------------------------------------------
const wed = new Date(2026, 9, 7, 9).getTime() // a Wednesday
const fixed = prog([train('Mon'), rest(), train('Wed'), rest(), train('Fri'), rest(), rest()], { schedule: 'weekly' })
const rot = p.toRotation(fixed, { now: wed })
check('stamped rotation, same 7 days in the same order', rot.schedule === 'rotating' && rot.days.map((d) => d.id).join() === fixed.days.map((d) => d.id).join())
const plan = p.todayPlan(rot, { now: wed })
check('today’s weekday is up next', plan.day?.name === 'Wed' && plan.status === 'train', JSON.stringify({ status: plan.status, day: plan.day?.name }))

// ---- Export → import keeps the kind -------------------------------------------------------
const roundTrip = (program) => im.parseExportText(ex.exportText(ex.buildExportModel({ program }))).program
const weekBack = roundTrip(fixed)
check('a fixed week comes back fixed', weekBack.schedule === 'weekly' && p.scheduleMode(weekBack) === 'weekly')
const bench = (name) => ({ ...train(name), exercises: [{ id: `x${name}`, exerciseId: 'barbell-bench-press', name: 'Bench Press', kind: 'strength', sets: 3, repRange: { low: 6, high: 8 } }] })
const sevenTrain = prog(['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(bench), { schedule: 'rotating' })
const rotBack = roundTrip(sevenTrain)
check('a 7-day rotation comes back a rotation', rotBack.days.length === 7 && rotBack.schedule === 'rotating' && p.scheduleMode(rotBack) === 'rotating')

console.log(`schedule checks: ${passed} passed`)
server.close()
