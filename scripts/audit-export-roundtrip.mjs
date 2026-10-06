// Round-trip harness for the text export: every split the generator can write
// is exported (programExport.js) and read back in (programImport.js), and what
// comes back must be the same split.
//
//   node scripts/audit-export-roundtrip.mjs
//
// Same scenarios as audit-generator.mjs (every frequency × shape × focus ×
// equipment × experience × schedule × volume), each with movements named and
// with open slots. Every export carries a full profile, last-used weights, rest
// times, a note on some rows (with brackets, " - " and " + " inside it, the
// characters the format itself uses) and coach notes — the hardest text the
// format produces. Every one also carries cardio, cycling through every
// activity, both kinds of target, and lifting days / rest days / both.
//
// Fixed weeks must come back exactly. A rotation comes back as its training
// days in order: the text leaves rest days out (as Hani's own notes do), so
// where they sat isn't recoverable — except a rest day holding cardio, which is
// written and comes back in its place. Loaded through Vite's SSR loader like the
// other audits; reads only, writes nothing.

import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const server = await createServer({ root: ROOT, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { generateProgram } = await server.ssrLoadModule('/src/lib/generator.js')
const { shapesFor, VOLUME_PREFERENCES } = await server.ssrLoadModule('/src/lib/generatorConfig.js')
const { buildExportModel, exportText, DEFAULT_EXPORT_PREFS } = await server.ssrLoadModule('/src/lib/programExport.js')
const { parseExportText } = await server.ssrLoadModule('/src/lib/programImport.js')
const { canonicalExerciseId } = await server.ssrLoadModule('/src/lib/workoutStats.js')
const { applyCardioPlan } = await server.ssrLoadModule('/src/lib/cardioPlan.js')

const PROFILE = {
  sex: 'female', birth_year: 1998, unit: 'kg', height: 168, bodyweight: 62.5, body_fat: 24, wrist: 15.5, ankle: 21,
  goal: 'gain_muscle', experience_level: 'intermediate', training_start_year: 2021, equipment: 'gym', daily_steps: 8000, diet: 'vegan',
}
const EXTRA = [{ label: 'Sleep', value: '6 hours' }, { label: '', value: 'Works night shifts' }]
const INJURIES = 'Left knee - no deep flexion'
const COACH = 'Add a rep each week.\n\nDeload never: manage fatigue with volume.'
const NOTE = 'record yourself (side view) - slow + controlled'
const PREFS = { ...DEFAULT_EXPORT_PREFS, rest: true }

// The cardio each scenario carries, in turn: every activity, minutes and
// calories, a subset of days and all of them, lifting days, rest days, both.
const half = (activity, params, by, value, days = null) => ({ on: true, activity, params, target: { by, value }, days })
const OFF = { on: false, activity: 'walk', params: { speedKmh: 5.5, gradePct: 0 }, target: { by: 'minutes', value: 20 }, days: null }
const CARDIO_PLANS = [
  { lifting: half('walk', { speedKmh: 5, gradePct: 10 }, 'minutes', 20), rest: OFF },
  { lifting: OFF, rest: half('stairs', { level: 8 }, 'kcal', 250, 1) },
  { lifting: half('run', { speedKmh: 10, gradePct: 0, outdoors: true }, 'minutes', 25, 2), rest: half('swim', { stroke: 'breast', level: 1 }, 'kcal', 300) },
  { lifting: half('bike', { watts: 120 }, 'minutes', 15), rest: half('elliptical', { level: 1 }, 'minutes', 40) },
  { lifting: half('rope', { level: 2 }, 'minutes', 10, 1), rest: half('row', { watts: 150 }, 'kcal', 400) },
  { lifting: half('walk', { speedKmh: 6.5, gradePct: 0 }, 'minutes', 30), rest: half('swim', { stroke: 'fly', level: 0 }, 'minutes', 20) },
  { lifting: OFF, rest: half('walk', { speedKmh: 5.5, gradePct: 0 }, 'minutes', 45) },
]

const failures = []
let scenarios = 0
const check = (label, ok, detail) => { if (!ok) failures.push(`${label}: ${detail}`) }
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// What a row SAYS, the part the text carries.
function rowKey(e) {
  if (e.kind === 'cardio') {
    return { name: e.name, activity: e.cardio?.activity, params: e.cardio?.params, target: e.cardio?.target, note: e.note || '' }
  }
  const open = !e.exerciseId && !!e.slot?.pattern
  return {
    id: open ? null : canonicalExerciseId(e.exerciseId),
    open,
    pattern: open ? e.slot.pattern : null,
    suggested: open ? e.slot.suggestedId || null : null,
    sets: Number(e.sets),
    reps: [Number(e.repRange?.low), Number(e.repRange?.high)],
    rir: e.rirTarget ? [e.rirTarget.low === '' ? null : Number(e.rirTarget.low), e.rirTarget.high === '' ? null : Number(e.rirTarget.high), !!e.rirTarget.lastSetFailure] : null,
    note: e.note || '',
  }
}

// Superset structure as "which rows share a group", by position.
function pairing(exercises) {
  const groups = new Map()
  exercises.forEach((e, i) => { if (e.supersetId) groups.set(e.supersetId, [...(groups.get(e.supersetId) || []), i]) })
  return [...groups.values()].filter((g) => g.length > 1).map((g) => g.join('+')).sort()
}

for (const daysPerWeek of [2, 3, 4, 5, 6]) {
  for (const { id: shape } of shapesFor(daysPerWeek)) {
    for (const focus of [[], ['Side Delts'], ['Chest', 'Lats', 'Glutes']]) {
      for (const equipment of ['gym', 'bodyweight']) {
        for (const experience of ['beginner', 'intermediate', 'advanced']) {
          for (const [schedule, versions] of [['weekly'], ['rotation'], ...(shape === 'upper-lower' ? [['rotation', 3]] : [])]) {
            for (const volume of VOLUME_PREFERENCES.map((p) => p.value)) {
              for (const openSlots of [false, true]) {
                scenarios++
                const label = `${daysPerWeek}d/${shape}/${schedule}${versions ? `-${versions}v` : ''}/${equipment}/${experience}/${volume}/[${focus.join(',')}]${openSlots ? '/open' : ''}`
                const { program } = generateProgram({ answers: { daysPerWeek, shape, focus, equipment, experience, schedule, volume, openSlots, versions } })
                program.name = `Gym ${scenarios}`
                Object.assign(program, applyCardioPlan(program, CARDIO_PLANS[scenarios % CARDIO_PLANS.length]))
                // Cardio plan rows carry the planner's mark; the text doesn't, and
                // shouldn't — read back in, they're plain cardio rows.
                program.days.forEach((d) => d.exercises.forEach((e) => {
                  if (e.cardio?.plan) { const { plan: _plan, ...rest } = e.cardio; e.cardio = rest }
                  if (e.kind === 'cardio' && scenarios % 2) e.note = NOTE
                }))
                // A note on every other day's first row.
                program.days.filter((d) => d.kind !== 'rest').forEach((d, i) => { if (i % 2 === 0 && d.exercises[0]) d.exercises[0].note = NOTE })
                // A logged session holding every movement, so weights are written.
                const session = {
                  unit: 'kg',
                  exercises: program.days.flatMap((d) => d.exercises).filter((e) => e.exerciseId).map((e) => ({ exerciseId: e.exerciseId, name: e.name, kind: 'strength', bodyweight: false, sets: [{ weight: 42.5, reps: 8 }] })),
                }
                const model = buildExportModel({ program, profile: PROFILE, forName: 'Sara', sessions: [session], unit: 'kg', extra: EXTRA, injuries: INJURIES, coachNotes: COACH })
                const text = exportText(model, PREFS)
                const back = parseExportText(text)

                check(label, back.title === program.name, `title "${back.title}"`)
                check(label, back.forName === 'Sara', `forName "${back.forName}"`)
                check(label, back.unmatched.length === 0, `unmatched: ${back.unmatched.map((u) => u.raw).join(' | ')}`)
                const wantProfile = { ...PROFILE, ...(program.settings.focus.length ? { focus_muscles: program.settings.focus } : {}) }
                for (const [k, v] of Object.entries(wantProfile)) check(label, eq(back.profile[k], v), `profile.${k} ${JSON.stringify(back.profile[k])} ≠ ${JSON.stringify(v)}`)
                check(label, eq(back.extra, EXTRA), `extra ${JSON.stringify(back.extra)}`)
                check(label, back.injuries === INJURIES, `injuries "${back.injuries}"`)
                check(label, back.coachNotes === COACH, `coach notes ${JSON.stringify(back.coachNotes)}`)
                check(label, back.program?.settings?.volume === volume, `volume ${back.program?.settings?.volume}`)
                check(label, back.program?.settings?.shape === program.settings.shape, `shape ${back.program?.settings?.shape} ≠ ${program.settings.shape}`)

                // A day that comes round twice (3-version rotation) is written once.
                const twinSeen = new Set()
                const once = (d) => !d.twin || d.kind === 'rest' || (!twinSeen.has(d.twin) && twinSeen.add(d.twin))
                const want = schedule === 'weekly' ? program.days : program.days.filter((d) => d.kind !== 'rest' || d.exercises.length).filter(once)
                const got = back.program?.days || []
                check(label, got.length === want.length, `${got.length} days ≠ ${want.length}`)
                want.forEach((d, i) => {
                  const g = got[i]
                  if (!g) return
                  check(label, g.kind === d.kind, `day ${i + 1} kind ${g.kind} ≠ ${d.kind}`)
                  if (d.kind !== 'rest') check(label, g.name === d.name, `day ${i + 1} name "${g.name}" ≠ "${d.name}"`)
                  check(label, g.exercises.length === d.exercises.length, `day ${i + 1}: ${g.exercises.length} rows ≠ ${d.exercises.length}`)
                  d.exercises.forEach((e, j) => {
                    const a = rowKey(e)
                    const b = g.exercises[j] ? rowKey(g.exercises[j]) : null
                    check(label, eq(a, b), `day ${i + 1} row ${j + 1} ${e.name}: ${JSON.stringify(b)} ≠ ${JSON.stringify(a)}`)
                  })
                  check(label, eq(pairing(g.exercises), pairing(d.exercises)), `day ${i + 1} supersets ${pairing(g.exercises)} ≠ ${pairing(d.exercises)}`)
                })
              }
            }
          }
        }
      }
    }
  }
}

await server.close()
console.log(`${scenarios} programs exported and read back`)
if (failures.length) {
  console.error(`${failures.length} mismatches:`)
  for (const f of failures.slice(0, 25)) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log('✓ every one came back the same')
