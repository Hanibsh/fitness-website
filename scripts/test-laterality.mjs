// Checks that bilateral and unilateral sets of a lift never compete: records,
// charts, the stalled-lifts card, strength levels and the recovery engine each
// compare a set only with its own type, while volume still adds the two together.
//
//   node scripts/test-laterality.mjs
//
// Loaded through Vite's SSR loader like the audits; reads only, writes nothing.
// Exits 1 on the first failed check.

import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const server = await createServer({ root: ROOT, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const stats = await server.ssrLoadModule('/src/lib/workoutStats.js')
const dash = await server.ssrLoadModule('/src/lib/dashboard.js')
const insights = await server.ssrLoadModule('/src/lib/dashboardInsights.js')
const progress = await server.ssrLoadModule('/src/lib/progress.js')
const engine = await server.ssrLoadModule('/src/lib/engine.js')
const advisor = await server.ssrLoadModule('/src/lib/advisor.js')

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
const NAME = 'Leg Extension'
const bi = (weight, reps = 10, extra = {}) => ({ id: `b${weight}${reps}`, weight, reps, rir: '', ...extra })
const uni = (weight, reps = 10, extra = {}) => ({
  id: `u${weight}${reps}`,
  left: { weight, reps, rir: '' },
  right: { weight, reps, rir: '' },
  ...extra,
})
let nextId = 0
const day = (daysAgo, sets, name = NAME) => ({
  id: `s${++nextId}`,
  date: now - daysAgo * DAY,
  unit: 'kg',
  exercises: [{ name, kind: 'strength', sets }],
})
const kinds = (prs) => prs.map((p) => p.kind).sort().join(',')

// ---- The reported case ----------------------------------------------------------
{
  const u = day(2, [uni(90)])
  const b = day(1, [bi(100)])
  check('100 kg bilateral after 90 kg unilateral is no best', stats.sessionPRs(b, [u, b]).length === 0, JSON.stringify(stats.sessionPRs(b, [u, b])))
  check('...nor on the dashboard timeline', dash.recentPRs([u, b], 'kg', Infinity).length === 0)
}

// ---- The other way round --------------------------------------------------------
{
  const b = day(4, [bi(100)])
  const u1 = day(3, [uni(80)])
  const u2 = day(2, [uni(90)])
  const prs = stats.sessionPRs(u2, [b, u1, u2])
  check('a unilateral best counts even below the bilateral best', kinds(prs) === 'e1rm,weight', JSON.stringify(prs))
  check('...and says it is unilateral', prs.every((p) => p.laterality === 'unilateral'))
  check('...and compares with its own type', prs.find((p) => p.kind === 'weight').previous === 80)
  const timeline = dash.recentPRs([b, u1, u2], 'kg', Infinity)
  check('...on the timeline too', timeline.length === 1 && timeline[0].laterality === 'unilateral', JSON.stringify(timeline))
  check('the first time a type is done is no best', stats.sessionPRs(u1, [b, u1]).length === 0)
}

// ---- Same type still works ------------------------------------------------------
{
  const a = day(2, [bi(100)])
  const b = day(1, [bi(105)])
  const prs = stats.sessionPRs(b, [a, b])
  check('a real bilateral best still counts', kinds(prs) === 'e1rm,weight', JSON.stringify(prs))
  check('one type only: no label', prs.every((p) => !p.laterality))
  check('one type only: no label on the timeline', dash.recentPRs([a, b], 'kg', Infinity)[0].laterality === null)
}

// ---- One session with both ------------------------------------------------------
{
  const a = day(2, [bi(100), uni(50)])
  const b = day(1, [bi(105), uni(55)])
  const prs = stats.sessionPRs(b, [a, b])
  check('a session can set one best of each type', prs.filter((p) => p.kind === 'weight').length === 2, JSON.stringify(prs))
  check('...each labelled', prs.every((p) => p.laterality))
  check('...two on the timeline', dash.recentPRs([a, b], 'kg', Infinity).length === 2)
}

// ---- Warm-ups -------------------------------------------------------------------
{
  const a = day(2, [bi(100, 10)])
  const b = day(1, [bi(100, 10), bi(120, 5, { type: 'warmup' })])
  check('a warm-up sets no timeline PR', dash.recentPRs([a, b], 'kg', Infinity).length === 0)
  const best = dash.exerciseBests([day(1, [bi(20, 30, { type: 'warmup' }), bi(100, 8)])])[0]
  check('a warm-up sets no best', best.reps === 8 && best.weight === 100, JSON.stringify(best))
  check('...but is still lifetime volume', best.volume === 20 * 30 + 100 * 8)
}

// ---- Charts ---------------------------------------------------------------------
{
  const log = [day(3, [bi(100)]), day(2, [uni(90)]), day(1, [bi(102)])]
  const e1rm = stats.metricById('e1rm')
  const top = stats.metricById('top')
  const line = (metric, laterality) => stats.buildSeries(log, NAME, metric, 'all', 'kg', false, laterality).map((p) => p.value)
  check('bilateral line', line(top, 'bilateral').join() === '100,102')
  check('unilateral line', line(top, 'unilateral').join() === '90')
  check('no type asked for: both', line(top, null).join() === '100,90,102')
  check('volume adds both', line(stats.metricById('volume'), null).join() === `${100 * 10},${90 * 20},${102 * 10}`)

  const history = stats.lateralityHistory(log, NAME)
  check('both logged, bilateral last', history.logged.length === 2 && history.latest === 'bilateral', JSON.stringify(history))
  const after = [...log, day(0.5, [uni(95)])]
  check('the switchless line follows the type done last', stats.liftE1rmSeries(after, NAME, 'all').length === 2)
  check('...which is unilateral now', stats.lateralityHistory(after, NAME).latest === 'unilateral')
  check('...and stays one type', stats.liftE1rmSeries(log, NAME, 'all').every((p) => p.value >= e1rm.compute([{ weight: 100, reps: 10 }])))
  check('empty rows and warm-ups are no history', stats.lateralityHistory([day(1, [uni('', ''), uni(90, 10, { type: 'warmup' }), bi(100)])], NAME).logged.join() === 'bilateral')
  // 100→110 kg bilateral is about 11% (est. 1RMs are rounded); starting from the
  // 90 kg unilateral set instead would read about 22%.
  const change = progress.topLiftChange([day(3, [uni(90)]), day(2, [bi(100)]), day(1, [bi(110)])]).pct
  check('top lift change stays within a type', change >= 10 && change <= 11, String(change))
}

// ---- Exercise page --------------------------------------------------------------
{
  const log = [day(2, [uni(90, 8)]), day(1, [bi(100, 12)])]
  check('bilateral bests', stats.exerciseSummary(log, NAME, 'kg', 'bilateral').bestWeight === 100)
  check('unilateral bests', stats.exerciseSummary(log, NAME, 'kg', 'unilateral').bestReps === 8)
  check('type never done: nothing', stats.exerciseSummary([log[0]], NAME, 'kg', 'bilateral') === null)
  check('no type asked for: lifetime totals of both', stats.exerciseSummary(log, NAME, 'kg').lifetimeVolume === 90 * 16 + 100 * 12)
}

// ---- Stalled lifts --------------------------------------------------------------
{
  const log = [day(20, [uni(90)]), day(3, [bi(100)])]
  const p = insights.liftProgress(log, 'kg', now)
  check('switching type is no jump', p.up.length + p.flat.length + p.down.length === 0, JSON.stringify(p))
  const both = [day(20, [uni(90), bi(100)]), day(3, [uni(90), bi(110)])]
  const q = insights.liftProgress(both, 'kg', now)
  check('each type gets its own row', q.flat.length === 1 && q.up.length === 1, JSON.stringify(q))
  check('...labelled', q.flat[0].laterality === 'unilateral' && q.up[0].laterality === 'bilateral')
  const solo = insights.liftProgress([day(20, [bi(100)]), day(3, [bi(110)])], 'kg', now)
  check('one type only: no label', solo.up[0].laterality === null, JSON.stringify(solo))
}

// ---- Strength level -------------------------------------------------------------
{
  const profile = { sex: 'male', bodyweightKg: 80, now }
  const row = (log) => insights.strengthLevels(log, profile)
  check('unilateral machine sets are not graded as two-sided', row([day(1, [uni(90)])]).length === 0)
  check('bilateral sets are', row([day(1, [bi(100)])]).length === 1)
  const curl = row([day(1, [uni(20, 10)], 'Dumbbell Curl')])
  check('a one-arm dumbbell curl still counts', curl.length === 1 && curl[0].key === 'bicepCurl', JSON.stringify(curl))
}

// ---- Recovery engine ------------------------------------------------------------
{
  const BI = 'leg-extension|bilateral'
  const UNI = 'leg-extension|unilateral'
  const flat = (r) => r.every((x) => Math.abs(x) < 1e-9)

  // Steady numbers, swapping type every session: nothing has changed, so there's
  // nothing to learn. One shared trend would read each swap as a big day or a bad one.
  const swapping = Array.from({ length: 10 }, (_, i) => day(40 - i * 4, [i % 2 ? uni(90) : bi(100)]))
  const a = engine.personalizedModel(swapping)
  check('swapping type: a trend each', !!a.perf[BI] && !!a.perf[UNI], JSON.stringify(Object.keys(a.perf)))
  check('swapping type is no change', flat(a.perf[BI].residuals) && flat(a.perf[UNI].residuals), JSON.stringify(a.perf))
  check('...teaches no recovery speed', Object.values(a.tauMult).every((m) => Math.abs(m - 1) < 1e-9), JSON.stringify(a.tauMult))
  check('...and names its type', a.perf[UNI].laterality === 'unilateral' && a.perf[BI].key === 'leg-extension')

  // A new type needs its own warm-up, however often the lift was done the other way.
  const bis = Array.from({ length: 5 }, (_, i) => day(60 - i * 3, [bi(100)]))
  const unis = Array.from({ length: 4 }, (_, i) => day(40 - i * 3, [uni(90)]))
  check('a new type has no trend for 3 sessions', !engine.personalizedModel([...bis, ...unis.slice(0, 3)]).perf[UNI])
  check('...then learns', engine.personalizedModel([...bis, ...unis]).perf[UNI].residuals.length === 1)

  // Still catches a real change within a type.
  const drop = engine.personalizedModel([...bis, day(40, [bi(90)])])
  check('a real drop still counts', drop.perf[BI].residuals.at(-1) < 0, JSON.stringify(drop.perf))
  check('one type only: no label', drop.perf[BI].laterality === null)

  // Novelty is per movement: switching type doesn't make the lift new again.
  const onlyUni = engine.personalizedModel([...bis, unis[0]])
  check('exposure stays per movement', onlyUni.exposures['leg-extension'] === 6, JSON.stringify(onlyUni.exposures))

  // The advisor's warning names the type that slipped.
  const hard = (w, n = 14) => Array.from({ length: n }, () => w)
  const biSets = hard(100).map((w) => bi(w, 10, { rir: 0 }))
  const uniSets = (w) => hard(w).map((x) => uni(x, 10))
  const slipping = [
    ...[90, 90, 90, 90].map((w, i) => day(16 - i, [...biSets, ...uniSets(w)])),
    ...[85, 80, 75].map((w, i) => day(3 - i, [...biSets, ...uniSets(w)])),
  ]
  const recs = advisor.adviseTraining(slipping, { blocks: [], annotations: [], injuries: [] })
  const warning = recs.find((r) => r.title.includes('trending down'))
  check('the advisor names the type', warning?.title === 'Leg Extension (unilateral) is trending down', JSON.stringify(recs.map((r) => r.title)))
  check('...and leaves the steady type alone', recs.filter((r) => r.title.includes('trending down')).length === 1)
}

console.log(`OK  ${passed} checks passed`)
server.close()
process.exit(0)
