// Checks for the coaching logic that has no screen of its own to catch it:
// how a sent program merges into the client's splits (lib/coachSync.js) and
// the coach's at-a-glance numbers (lib/coachStats.js).
//
//   node scripts/test-coach.mjs
//
// Loaded through Vite's SSR loader like the audits; reads only, writes nothing.
// Exits 1 on the first failed check.

import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const server = await createServer({ root: ROOT, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { mergeCoachPrograms, isLockedProgram } = await server.ssrLoadModule('/src/lib/coachSync.js')
const stats = await server.ssrLoadModule('/src/lib/coachStats.js')
const checkins = await server.ssrLoadModule('/src/lib/checkins.js').catch(() => null)

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
const day = (id, kind = 'train') => ({ id, kind, name: id, exercises: [] })
const at = (iso) => ({ updated_at: iso })
const NOW = Date.parse('2026-10-04T12:00:00Z')

// ---- mergeCoachPrograms ---------------------------------------------------------

const own = { id: 'mine', name: 'My split', days: [day('a'), day('b')], pointer: 1 }
const sentData = { id: 'p1', name: 'Coach split', days: [day('x'), day('y'), day('z')], pointer: 0, createdAt: 1 }

{
  const state = { programs: [own], activeId: 'mine' }
  const same = mergeCoachPrograms(state, [], NOW)
  check('no rows, nothing locked → same object', same === state)
}

{
  const state = { programs: [own], activeId: 'mine' }
  const next = mergeCoachPrograms(state, [{ id: 'p1', data: sentData, make_active: true, ...at('2026-10-01T00:00:00Z') }], NOW)
  const p = next.programs.find((x) => x.id === 'p1')
  check('new row is added', !!p)
  check('new row is locked', isLockedProgram(p))
  check('new row starts at day 1', p.pointer === 0)
  check('new row starts now', p.createdAt === NOW)
  check('make_active switches the active split', next.activeId === 'p1')
  check('own split untouched', next.programs.find((x) => x.id === 'mine') === own)
}

{
  const state = { programs: [own], activeId: 'mine' }
  const next = mergeCoachPrograms(state, [{ id: 'p1', data: sentData, make_active: false, ...at('2026-10-01T00:00:00Z') }], NOW)
  check('make_active false keeps the active split', next.activeId === 'mine')
}

{
  // The client is on day "y" (index 1); the coach puts a new day in front.
  const mine = { ...sentData, pointer: 1, lastAdvancedAt: 123, advances: [{ date: 1, dayId: 'x' }], coach: { updatedAt: Date.parse('2026-10-01T00:00:00Z') } }
  const state = { programs: [mine], activeId: 'p1' }
  const update = { ...sentData, name: 'Coach split v2', days: [day('w'), day('x'), day('y'), day('z')] }
  const next = mergeCoachPrograms(state, [{ id: 'p1', data: update, make_active: true, ...at('2026-10-02T00:00:00Z') }], NOW)
  const p = next.programs[0]
  check('newer row replaces the days', p.days.length === 4 && p.name === 'Coach split v2')
  check('pointer follows the same day', p.days[p.pointer].id === 'y', `pointer ${p.pointer}`)
  check('rotation history kept', p.lastAdvancedAt === 123 && p.advances.length === 1)
  check('stamp moves to the new version', p.coach.updatedAt === Date.parse('2026-10-02T00:00:00Z'))

  const again = mergeCoachPrograms(next, [{ id: 'p1', data: update, make_active: true, ...at('2026-10-02T00:00:00Z') }], NOW)
  check('same version again → same object', again === next)
}

{
  // The day the client was on is removed: the pointer stays in range.
  const mine = { ...sentData, pointer: 2, coach: { updatedAt: 1 } }
  const update = { ...sentData, days: [day('x'), day('y')] }
  const next = mergeCoachPrograms({ programs: [mine], activeId: 'p1' }, [{ id: 'p1', data: update, ...at('2026-10-02T00:00:00Z') }], NOW)
  check('pointer clamped when its day is gone', next.programs[0].pointer === 0, `pointer ${next.programs[0].pointer}`)
}

{
  const mine = { ...sentData, pointer: 1, coach: { updatedAt: 1 } }
  const next = mergeCoachPrograms({ programs: [mine], activeId: 'p1' }, [], NOW)
  const p = next.programs[0]
  check('row gone → unlocked', !isLockedProgram(p))
  check('row gone → days and place kept', p.days.length === 3 && p.pointer === 1)
}

{
  // A split that was unlocked (link ended) and is sent again after a re-link.
  const unlocked = { ...sentData, pointer: 2 }
  const next = mergeCoachPrograms({ programs: [unlocked], activeId: 'p1' }, [{ id: 'p1', data: sentData, ...at('2026-10-01T00:00:00Z') }], NOW)
  check('same id resent → locked again', isLockedProgram(next.programs[0]))
  check('same id resent → place kept', next.programs[0].pointer === 2)
}

{
  const next = mergeCoachPrograms({ programs: [], activeId: null }, [{ id: 'p1', data: sentData, make_active: false, ...at('2026-10-01T00:00:00Z') }], NOW)
  check('first split ever becomes active even without make_active', next.activeId === 'p1')
}

// ---- coachStats --------------------------------------------------------------------

const now = new Date(2026, 9, 4, 18, 0).getTime()
const sessionOn = (daysAgo) => ({ date: new Date(2026, 9, 4 - daysAgo, 12, 0).getTime() })

check('no sessions → no days since', stats.daysSinceLastWorkout([], now) === null)
check('today → 0', stats.daysSinceLastWorkout([sessionOn(0)], now) === 0)
check('newest session wins', stats.daysSinceLastWorkout([sessionOn(9), sessionOn(3)], now) === 3)
check('label: yesterday', stats.lastWorkoutLabel([sessionOn(1)], now) === 'Yesterday')
check('label: days ago', stats.lastWorkoutLabel([sessionOn(6)], now) === '6 days ago')
check('no flag under the threshold', stats.noTrainingFlag([sessionOn(stats.NO_TRAINING_DAYS - 1)], now) === null)
check('flag at the threshold', stats.noTrainingFlag([sessionOn(stats.NO_TRAINING_DAYS)], now) === stats.NO_TRAINING_DAYS)
check('no flag with no log at all', stats.noTrainingFlag([], now) === null)

{
  // Across the spring DST change, a calendar day is still one day.
  const dstNow = new Date(2026, 2, 30, 9, 0).getTime()
  const before = { date: new Date(2026, 2, 28, 12, 0).getTime() }
  check('DST week still counts whole days', stats.daysSinceLastWorkout([before], dstNow) === 2)
}

const weigh = (daysAgo, weight, unit = 'kg') => ({ date: now - daysAgo * DAY, weight, unit })
{
  const t = stats.weightTrend([weigh(20, 85), weigh(13, 82), weigh(1, 81)], 'kg', { now })
  check('trend uses the 14-day window only', t.change === -1 && t.dir === 'down', JSON.stringify(t))
  check('latest weigh-in reported', t.latest === 81)
}
check('one weigh-in → no direction', stats.weightTrend([weigh(1, 80)], 'kg', { now }).dir === null)
check('tiny change reads flat', stats.weightTrend([weigh(10, 80), weigh(1, 80.2)], 'kg', { now }).dir === 'flat')
{
  const t = stats.weightTrend([weigh(10, 80), weigh(1, 180, 'lbs')], 'kg', { now })
  check('mixed units converted', Math.abs(t.latest - 81.6) < 0.05, JSON.stringify(t))
}

// ---- check-ins (once lib/checkins.js exists) ----------------------------------------

if (checkins) {
  const { weekStart, checkinDue } = checkins
  const sun = new Date(2026, 9, 4, 20, 0).getTime() // a Sunday
  const mon = new Date(2026, 9, 5, 8, 0).getTime()
  check('week starts Monday', weekStart(sun) === '2026-09-28', weekStart(sun))
  check('Monday starts a new week', weekStart(mon) === '2026-10-05', weekStart(mon))
  check('due with none', checkinDue([], sun) === true)
  check('not due once done this week', checkinDue([{ week_start: '2026-09-28' }], sun) === false)
  check('due again next week', checkinDue([{ week_start: '2026-09-28' }], mon) === true)
}

console.log(`coaching checks: ${passed} passed`)
server.close()
