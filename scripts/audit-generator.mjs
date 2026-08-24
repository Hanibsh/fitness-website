// Invariant harness for the split generator.
//
//   node scripts/audit-generator.mjs            # summary, fails on any violation
//   node scripts/audit-generator.mjs --verbose  # + the volume table per scenario
//
// The generator is a pure function, so it can be checked exhaustively: run it
// across every combination of frequency, focus, equipment and experience the
// wizard can produce and assert the things a generated split must never get
// wrong. That's cheaper and far more honest than clicking through the UI once
// and calling it good.
//
// Loaded through Vite's SSR loader rather than plain node, because the modules
// under test import src/data/exercises.json and each other exactly as the app
// does. Same idea as the other audit scripts: reads only, writes nothing.

import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const VERBOSE = process.argv.includes('--verbose')

const server = await createServer({ root: ROOT, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { generateProgram } = await server.ssrLoadModule('/src/lib/generator.js')
const { ENGINE_MUSCLES, ATOM_TO_GROUP, mevFor, ceilingFor, ADVISOR_BLOCK_SLACK, SYSTEMIC_CAPACITY, SYSTEMIC_LEVELS } =
  await server.ssrLoadModule('/src/lib/engineConfig.js')
const { PROGRAMMED_MUSCLES, SKILL_RANK, EXPERIENCE_POSTURE, DAY_LOAD_MAX } =
  await server.ssrLoadModule('/src/lib/generatorConfig.js')
const { getFullExercise } = await server.ssrLoadModule('/src/lib/exerciseBank.js')
const { AT_HOME_EQUIPMENT } = await server.ssrLoadModule('/src/data/equipmentGroups.js')
const EXERCISES = (await server.ssrLoadModule('/src/data/exercises.json')).default.exercises

const FOCUS_CASES = [[], ['Side Delts'], ['Chest', 'Lats', 'Glutes']]
const EQUIPMENT_CASES = ['gym', 'bodyweight']
const EXPERIENCE_CASES = ['beginner', 'intermediate', 'advanced']
const SCHEDULE_CASES = ['weekly', 'rotation']
const DAYS_CASES = [2, 3, 4, 5, 6]

const round = (n) => Math.round(n * 10) / 10
// Does the library hold ANY movement for this muscle at this equipment level?
const trainableCache = new Map()
const failures = []
let scenarios = 0

function check(label, ok, detail) {
  if (!ok) failures.push(`${label}: ${detail}`)
}

for (const daysPerWeek of DAYS_CASES) {
  for (const focus of FOCUS_CASES) {
    for (const equipment of EQUIPMENT_CASES) {
      for (const experience of EXPERIENCE_CASES) {
        for (const schedule of SCHEDULE_CASES) {
          scenarios++
          const answers = { daysPerWeek, focus, equipment, experience, schedule, sessionMinutes: 60 }
          const label = `${daysPerWeek}d/${schedule}/${equipment}/${experience}/[${focus.join(',') || 'no focus'}]`
          const { program, summary, inputs } = generateProgram({ answers })
          audit(label, program, summary, inputs, { focus, equipment, experience, daysPerWeek, schedule })
        }
      }
    }
  }
}

function audit(label, program, summary, inputs, opts) {
  const training = program.days.filter((d) => d.kind !== 'rest')

  // ---- shape
  check(label, training.length === opts.daysPerWeek, `${training.length} training days, wanted ${opts.daysPerWeek}`)
  if (opts.schedule === 'weekly') {
    check(label, program.days.length === 7, `weekly split has ${program.days.length} days, must be 7`)
  } else {
    check(label, program.days.length !== 7, 'rotation is 7 days long — program.js would read it as a fixed week')
  }

  // ---- every day is a real workout
  for (const day of training) {
    check(label, day.exercises.length > 0, `"${day.name}" came out empty`)
    const ids = day.exercises.map((e) => e.exerciseId)
    check(label, new Set(ids).size === ids.length, `"${day.name}" repeats an exercise within the day`)
    for (const e of day.exercises) {
      check(label, e.sets >= 1 && e.sets <= 5, `"${e.name}" has ${e.sets} sets`)
      check(label, e.repRange.low < e.repRange.high, `"${e.name}" rep range ${e.repRange.low}–${e.repRange.high}`)
    }
  }

  // ---- hard filters actually held
  const allowed = opts.equipment === 'bodyweight' ? new Set(AT_HOME_EQUIPMENT) : null
  const skillCap = SKILL_RANK[EXPERIENCE_POSTURE[opts.experience].maxSkill]
  for (const day of training) {
    for (const e of day.exercises) {
      const db = getFullExercise(e.exerciseId)
      check(label, !!db, `"${e.name}" is not in the exercise DB`)
      if (!db) continue
      if (allowed) check(label, allowed.has(db.equipment), `"${e.name}" needs ${db.equipment}`)
      check(label, (SKILL_RANK[db.skill] ?? 1) <= skillCap + 1, `"${e.name}" skill ${db.skill} over the ${opts.experience} cap`)
    }
  }

  // ---- session budget
  for (const day of summary.days.filter((d) => d.kind !== 'rest')) {
    check(label, day.sets <= inputs.setsPerSession, `"${day.name}" plans ${day.sets} sets, budget is ${inputs.setsPerSession}`)
    check(label, day.load.pct <= 100 * DAY_LOAD_MAX + 5, `"${day.name}" load ${day.load.pct}% (${day.load.label})`)
  }
  // Not asked of a 2-day split: both of its days ARE the whole body, so both
  // being heavy is the shape working, not the shape failing.
  if (opts.daysPerWeek >= 3) {
    check(
      label,
      summary.days.some((d) => d.kind !== 'rest' && d.load.pct < SYSTEMIC_LEVELS.moderate),
      'every training day is a heavy day'
    )
  }

  // ---- frequency and volume
  for (const row of summary.volume) {
    // A muscle the library can't train with this equipment is a gap in the
    // exercise DB, not a bug in the generator. No current instance — every
    // programmed muscle has at-home coverage as of the 2026-08 calf rows.
    if (PROGRAMMED_MUSCLES.includes(row.muscle) && trainable(row.muscle, opts.equipment)) {
      check(label, row.sessions >= 2, `${row.muscle} trained ${row.sessions}×/wk`)
      // Clearing the minimum effective dose on all thirteen muscles is only
      // asked of splits that train three days or more. Two sessions a week is
      // ~40 working sets in total against thirteen muscles: something has to
      // come in under, and the generator's job there is to put the shortfall
      // where the compounds already cover most of the work, not to pretend the
      // arithmetic isn't happening. The preview reports every muscle's tier, so
      // the user sees exactly which ones landed short.
      if (opts.daysPerWeek >= 3) {
        // Quarter-set tolerance: these are one-decimal sums of contribution-
        // weighted credit, not whole sets, so "3.9 against a 4.0 minimum" is
        // rounding, not a shortfall worth failing a build over.
        check(label, row.sets >= mevFor(row.muscle) - 0.25, `${row.muscle} at ${row.sets} sets (${row.tier.label})`)
      } else {
        check(label, row.sets > 2, `${row.muscle} at ${row.sets} sets — nothing to speak of`)
      }
    }
    const ceiling = ceilingFor(row.muscle) * ADVISOR_BLOCK_SLACK
    check(label, row.sets <= ceiling + 0.5, `${row.muscle} at ${row.sets} sets, over the ${round(ceiling)} ceiling`)
  }

  // ---- focus: more often, more volume, and earlier in the day
  for (const muscle of opts.focus) {
    const row = summary.volume.find((v) => v.muscle === muscle)
    check(label, !!row && row.sets > 0, `focus ${muscle} got no work`)
    if (!row) continue
    if (opts.daysPerWeek >= 4) {
      check(label, row.sessions >= 3, `focus ${muscle} only ${row.sessions}×/wk`)
    }
  }
  // "Earlier" can only be checked once, for the set: with three focus muscles
  // only one of them can literally open the day. The claim that has to hold is
  // that whatever opens a day is focus work whenever the day has any — measured
  // against a real contribution, not the trace a squat leaves on the chest.
  if (opts.focus.length) {
    for (const day of training) {
      const targets = day.exercises.map((e) => opts.focus.filter((m) => hitsMuscle(e, m, 0.5)))
      if (!targets.some((t) => t.length)) continue
      check(label, targets[0].length > 0, `"${day.name}" opens on non-focus work (${day.exercises[0].name})`)
    }
  }

  if (VERBOSE) {
    console.log(`\n── ${label} — ${summary.shapeLabel}`)
    for (const d of summary.days.filter((x) => x.kind !== 'rest')) {
      console.log(`   ${d.name.padEnd(12)} ${String(d.sets).padStart(2)} sets · ${String(d.load.pct).padStart(3)}% · ${d.exercises.map((e) => `${e.name} ${e.sets}×${e.repRange.low}-${e.repRange.high}`).join(', ')}`)
    }
    console.log(
      '   ' +
        summary.volume
          .filter((v) => v.sets > 0)
          .map((v) => `${v.muscle} ${v.sets}${v.focus ? '*' : ''}(${v.sessions}×)`)
          .join('  ')
    )
  }
}

function trainable(muscle, equipment) {
  const key = `${muscle}|${equipment}`
  if (!trainableCache.has(key)) {
    const allowed = equipment === 'bodyweight' ? new Set(AT_HOME_EQUIPMENT) : null
    trainableCache.set(
      key,
      EXERCISES.some(
        (db) =>
          db.type !== 'isometric' &&
          (!allowed || allowed.has(db.equipment)) &&
          Object.entries(db.muscles || {}).some(([atom, w]) => ATOM_TO_GROUP[atom] === muscle && w > 0)
      )
    )
  }
  return trainableCache.get(key)
}

function hitsMuscle(planned, muscle, min = 0) {
  const db = getFullExercise(planned.exerciseId)
  if (!db) return false
  let best = 0
  for (const [atom, w] of Object.entries(db.muscles || {})) {
    if (ATOM_TO_GROUP[atom] === muscle) best = Math.max(best, w)
  }
  return best > min
}

await server.close()

console.log(`\n${scenarios} scenarios · ${ENGINE_MUSCLES.length} muscles · capacity ${SYSTEMIC_CAPACITY}`)
if (failures.length) {
  // Grouped by the shape of the complaint, not by scenario: 500 rows of "Calves
  // at 0 sets" is one bug, and a flat list buries that under its own volume.
  const kinds = new Map()
  for (const f of failures) {
    const key = f.split(': ').slice(1).join(': ').replace(/\d+(\.\d+)?/g, '#').replace(/"[^"]*"/g, '"…"')
    if (!kinds.has(key)) kinds.set(key, [])
    kinds.get(key).push(f)
  }
  console.error(`\n${failures.length} violation${failures.length !== 1 ? 's' : ''} in ${kinds.size} kind${kinds.size !== 1 ? 's' : ''}:`)
  for (const [kind, list] of [...kinds].sort((a, b) => b[1].length - a[1].length)) {
    console.error(`\n  ✗ ${kind}  ×${list.length}`)
    for (const f of list.slice(0, 3)) console.error(`      ${f}`)
    if (list.length > 3) console.error(`      … ${list.length - 3} more`)
  }
  process.exit(1)
}
console.log('✓ every generated split held every invariant')
