// Checks for the weekly food log (lib/weeklyLog.js): what the three fields
// save, the averages and the body fat trend over a range, the calorie-floor
// line, and the one-line summary.
//
//   node scripts/test-weekly.mjs
//
// Loaded through Vite's SSR loader like the audits; reads only, writes nothing.
// Exits 1 on the first failed check.

import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const server = await createServer({ root: ROOT, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const w = await server.ssrLoadModule('/src/lib/weeklyLog.js')

let passed = 0
function check(name, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL  ${name}${detail ? `\n      ${detail}` : ''}`)
    server.close()
    process.exit(1)
  }
  passed++
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// ---- The fields ----------------------------------------------------------------------
check('blanks save as null', same(w.parseIntake({}).entry, { calories: null, protein: null, bodyFat: null }))
check('numbers round', same(w.parseIntake({ calories: '2199.6', protein: '150.4', bodyFat: '18,25' }).entry, { calories: 2200, protein: 150, bodyFat: 18.3 }))
check('out of bounds names the field', w.parseIntake({ calories: '2200', bodyFat: '80' }).error === 'bodyFat')
check('a typo is not a number', w.parseIntake({ protein: 'abc' }).error === 'protein')
check('round trip through the form', same(w.parseIntake(w.foodForm({ calories: 2100, protein: null, bodyFat: 17.5 })).entry, { calories: 2100, protein: null, bodyFat: 17.5 }))
check('hasIntake', w.hasIntake({ calories: null, protein: 0, bodyFat: null }) && !w.hasIntake({ calories: null, protein: null, bodyFat: null }) && !w.hasIntake(null))

// ---- Weeks ---------------------------------------------------------------------------
check('last week', w.previousWeek('2026-10-05') === '2026-09-28')
check('last week across a month', w.previousWeek('2026-03-02') === '2026-02-23')

// ---- Averages and trends ---------------------------------------------------------------
const log = [
  { weekStart: '2026-09-14', calories: 2000, protein: 140, bodyFat: 20 },
  { weekStart: '2026-09-21', calories: null, protein: null, bodyFat: null },
  { weekStart: '2026-09-28', calories: 2400, protein: 160, bodyFat: null },
  { weekStart: '2026-10-05', calories: 2300, protein: null, bodyFat: 18.5 },
]
check('a blank week is not a week of zero', same(w.intakeAverages(log), { calories: 2233, protein: 150 }), JSON.stringify(w.intakeAverages(log)))
const cutoff = w.weekTime('2026-09-28') - 3 * 86400000 // Fri 25 Sep: the week of 21 Sep reaches into it
check('a week that reaches into the range counts', same(w.intakeAverages(log, cutoff), { calories: 2350, protein: 160 }))
check('nothing logged', same(w.intakeAverages([]), { calories: null, protein: null }))
check('body fat trend', same(w.bodyFatTrend(log), { latest: 18.5, change: -1.5 }))
check('one body fat, no change', same(w.bodyFatTrend(log, cutoff), { latest: 18.5, change: null }))

// ---- The calorie floor ------------------------------------------------------------------
check('under the floor (male)', w.underFloor({ calories: 1450 }, 'male'))
check('fine for female at 1450', !w.underFloor({ calories: 1450 }, 'female'))
check('no sex on file uses the lower floor', w.underFloor({ calories: 1350 }, null) && !w.underFloor({ calories: 1450 }, null))
check('no calories, no line', !w.underFloor({ calories: null }, 'male') && !w.underFloor(null, 'male'))

// ---- The line ---------------------------------------------------------------------------
check('full line', w.intakeLine({ calories: 2200, protein: 150, bodyFat: 18 }) === '2,200 cal · 150 g protein a day · 18% bf')
check('body fat only', w.intakeLine({ calories: null, protein: null, bodyFat: 18 }) === '18% bf')
check('empty', w.intakeLine(null) === '' && w.intakeLine({ calories: null, protein: null, bodyFat: null }) === '')

console.log(`weekly log checks: ${passed} passed`)
server.close()
