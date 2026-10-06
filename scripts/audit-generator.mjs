// Invariant harness for the split generator.
//
//   node scripts/audit-generator.mjs            # summary, fails on any violation
//   node scripts/audit-generator.mjs --verbose  # + the volume table per scenario
//   node scripts/audit-generator.mjs --volume=lower  # one volume preference only
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
const { generateProgram, failureSafe, primaryMuscleOf, movementFamily, supersetPartnerOk, pickTemplate, jobOf, muscleWeights } = await server.ssrLoadModule('/src/lib/generator.js')
const { ENGINE_MUSCLES, ATOM_TO_GROUP, mevFor, ceilingFor, ADVISOR_BLOCK_SLACK, SYSTEMIC_CAPACITY, SYSTEMIC_LEVELS } =
  await server.ssrLoadModule('/src/lib/engineConfig.js')
const { PROGRAMMED_MUSCLES, SKILL_RANK, EXPERIENCE_POSTURE, DAY_LOAD_MAX, VOLUME_PREFERENCES, volumePreference, MIN_WORKING_RIR, shapesFor, DIRECT_WORK, HEAVY_FATIGUE_SCORE, FOCUS_TARGET_FREQUENCY, MIN_SETS_PER_EXERCISE, FOCUS_EXTRA_SESSION_SETS, FOCUS_PORTABLE_MUSCLES, MUSCLE_REGION, CORE_CATEGORY, CORE_PLACEMENTS, DEFAULT_CORE_PLACEMENT, MAX_REPS, JOB_COVERED_MIN } =
  await server.ssrLoadModule('/src/lib/generatorConfig.js')
const { getFullExercise } = await server.ssrLoadModule('/src/lib/exerciseBank.js')
const { AT_HOME_EQUIPMENT } = await server.ssrLoadModule('/src/data/equipmentGroups.js')
const EXERCISES = (await server.ssrLoadModule('/src/data/exercises.json')).default.exercises

const FOCUS_CASES = [[], ['Side Delts'], ['Chest', 'Lats', 'Glutes']]
const EQUIPMENT_CASES = ['gym', 'bodyweight']
const EXPERIENCE_CASES = ['beginner', 'intermediate', 'advanced']
const SCHEDULE_CASES = ['weekly', 'rotation']
const TIGHT_WEEK_SETS = 48
// In a tight week these can live on indirect work from the big lifts (Hani).
const INDIRECT_OK_IN_TIGHT_WEEK = ['Rear Delts', 'Upper Back']
const VOLUME_ONLY =process.argv.find((a) => a.startsWith('--volume='))?.slice('--volume='.length)
const VOLUME_CASES = VOLUME_PREFERENCES.map((p) => p.value).filter((v) => !VOLUME_ONLY || v === VOLUME_ONLY)
const DAYS_CASES = [2, 3, 4, 5, 6]

const round = (n) => Math.round(n * 10) / 10
// Does the library hold ANY movement for this muscle at this equipment level?
const trainableCache = new Map()
const failures = []
let scenarios = 0

function check(label, ok, detail) {
  if (!ok) failures.push(`${label}: ${detail}`)
}

// Every shape on offer at each day count, not just the recommended one — a
// bro split or an Arnold week is a split someone will run. The recommended
// shape (the first, what "Pick for me" takes) is held to everything below; the
// others to everything except frequency and minimum volume, because training a
// muscle once a week is what a bro split IS, and its picker note says so.
//
// Every week is built with the abs supersetted (the default); the recommended
// shapes are built a second time with the abs at the end.
for (const daysPerWeek of DAYS_CASES) {
  shapesFor(daysPerWeek).forEach(({ id: shape }, rank) => {
    const coreCases = rank === 0 ? CORE_PLACEMENTS.map((p) => p.value) : [DEFAULT_CORE_PLACEMENT]
    for (const focus of FOCUS_CASES) {
      for (const equipment of EQUIPMENT_CASES) {
        for (const experience of EXPERIENCE_CASES) {
          for (const schedule of SCHEDULE_CASES) {
            for (const volume of VOLUME_CASES) {
              for (const core of coreCases) {
                scenarios++
                const answers = { daysPerWeek, shape, focus, equipment, experience, schedule, volume, core }
                const label = `${daysPerWeek}d/${shape}/${schedule}/${equipment}/${experience}/${volume}/[${focus.join(',') || 'no focus'}]${core === DEFAULT_CORE_PLACEMENT ? '' : `/abs-${core}`}`
                const { program, summary, inputs } = generateProgram({ answers })
                audit(label, program, summary, inputs, { focus, equipment, experience, daysPerWeek, schedule, volume, core, shape, recommended: rank === 0 })
              }
            }
          }
        }
      }
    }
  })
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
      // Failure is avoided: no working-set range under MIN_WORKING_RIR, and a
      // last-set-to-failure finisher only on a movement where that's safe.
      const t = e.rirTarget
      check(label, !!t && t.low >= MIN_WORKING_RIR && t.high >= t.low && t.high <= 5, `"${e.name}" RIR target ${t ? `${t.low}–${t.high}` : 'missing'}`)
      if (t?.lastSetFailure) check(label, failureSafe(db), `"${e.name}" takes its last set to failure but isn't failure-safe`)
      if (opts.equipment === 'gym') {
        // A full gym has no reason to program a band, or a movement that can't
        // be loaded — see GYM_EXCLUDED_* in generatorConfig.js.
        check(label, db.equipment !== 'resistance band', `"${e.name}" is band work in a full-gym split`)
        check(label, db.progressiveOverload !== 'low', `"${e.name}" can't be loaded (${db.progressiveOverload}) in a full-gym split`)
        // An advanced lifter's set ends on the muscle, never on their grip, their
        // balance or the equipment running out — see LIMITER_EXCLUDED.
        if (opts.experience === 'advanced') check(label, db.limiter === 'target', `"${e.name}" is limited by ${db.limiter}, not the muscle, in an advanced gym split`)
      }
      // "Don't Program" rows stay in the bank, never in a generated split.
      check(label, db.programmable !== false, `"${e.name}" is marked Don't Program`)
    }
  }

  // ---- complementary days (Hani, 2026-10-02)
  // One heavy movement per main muscle per day, everywhere. And at a full gym,
  // where the pool never runs out, no movement or movement family twice in a
  // week — at home it may, and the generator then repeats rather than leave a
  // muscle untrained.
  const weekIds = new Map()
  const weekFamilies = new Map()
  for (const day of training) {
    const heavy = new Map()
    for (const e of day.exercises) {
      const db = getFullExercise(e.exerciseId)
      if (!db) continue
      if ((db.fatigueScore ?? 0) >= HEAVY_FATIGUE_SCORE) {
        const m = primaryMuscleOf(db)
        check(label, !heavy.has(m), `"${day.name}" has two heavy ${m} movements: ${heavy.get(m)} and ${e.name}`)
        heavy.set(m, e.name)
      }
      if (opts.equipment === 'gym') {
        const fam = movementFamily(db)
        check(label, !weekIds.has(db.id) && !weekFamilies.has(fam), `"${e.name}" repeats ${weekFamilies.get(fam) || e.name} in the same week`)
        weekIds.set(db.id, e.name)
        weekFamilies.set(fam, e.name)
      }
      check(label, (SKILL_RANK[db.skill] ?? 1) <= skillCap + 1, `"${e.name}" skill ${db.skill} over the ${opts.experience} cap`)
    }
  }

  // ---- one movement per job a day (Hani, 2026-10-03): a squat and a lunge, a
  // shoulder press and an upright row, two rows — the same work twice (SAME_JOB).
  // A day built around one muscle may repeat the jobs it lists (`repeatJobs`:
  // curls on an arm day), a muscle the day emphasises may take a second
  // isolation, and a muscle nothing earlier in the day trains properly
  // (JOB_COVERED_MIN) may take a second movement for the job rather than go
  // without. Gym only, like the week rule above: at home the pool runs out.
  const templates = pickTemplate(opts.daysPerWeek, opts.focus, opts.shape)
  training.forEach((day, i) => {
    const t = templates[i]
    if (!t || t.name !== day.name) return check(label, false, `"${day.name}" doesn't line up with its template day "${t?.name}"`)
    if (opts.equipment === 'gym') {
      const seen = []
      for (const e of day.exercises) {
        const db = getFullExercise(e.exerciseId)
        const job = jobOf(db)
        const earlier = seen.filter((x) => jobOf(x) === job)
        seen.push(db)
        if (!db || !earlier.length || t.repeatJobs?.includes(job)) continue
        const muscle = e.slot?.muscle
        if (db.type === 'isolation' && t.emphasis?.includes(muscle)) continue
        const covered = Math.max(0, ...seen.slice(0, -1).map((x) => muscleWeights(x)[muscle] || 0))
        check(label, covered < JOB_COVERED_MIN, `"${day.name}" has ${earlier[0].name} and ${e.name} — the same job (${job}) twice`)
      }
    }
    // ---- A/B emphasis: an emphasis day opens on a muscle it emphasises, unless
    // a focus muscle has taken the lead.
    const lead = day.exercises.find((e) => !isCoreRow(e))
    if (t.emphasis && !opts.focus.length && lead) {
      check(label, t.emphasis.includes(lead.slot?.muscle), `"${day.name}" opens on ${lead.name} for ${lead.slot?.muscle}, not on what it emphasises (${t.emphasis.join(', ')})`)
    }
  })

  // ---- abs (Hani, 2026-10-02): one ab movement a day at most, outside the set
  // cap and the movement count (checked below), and where the user asked for
  // it — supersetted with a light movement doing the SAME number of sets, or
  // last. A day with nothing light to pair with puts it last either way. An ab
  // movement that is itself a focus leads instead, like any focus.
  for (const day of training) {
    const core = day.exercises.filter(isCoreRow)
    check(label, core.length <= 1, `"${day.name}" has ${core.length} ab movements`)
    const row = core[0]
    if (!row || opts.focus.includes(row.slot?.muscle)) continue
    const at = day.exercises.indexOf(row)
    const canPair = day.exercises.some((e) => e !== row && supersetPartnerOk(getFullExercise(e.exerciseId)))
    if (opts.core === 'end' || !canPair) {
      check(label, at === day.exercises.length - 1 && !row.supersetId, `"${day.name}" has its ab movement at ${at + 1} of ${day.exercises.length}, not last`)
      continue
    }
    const partner = day.exercises[at - 1]
    const pair = day.exercises.filter((e) => row.supersetId && e.supersetId === row.supersetId)
    check(label, !!partner && pair.length === 2 && partner.supersetId === row.supersetId, `"${day.name}" ab movement isn't supersetted with the movement before it`)
    if (!partner) continue
    check(label, supersetPartnerOk(getFullExercise(partner.exerciseId)), `"${day.name}" pairs its abs with ${partner.name}, which is too heavy to superset`)
    check(label, partner.sets === row.sets, `"${day.name}" supersets ${partner.sets} sets of ${partner.name} with ${row.sets} of ${row.name}`)
  }

  // ---- reps (Hani, 2026-10-02): never above 12. With no history to borrow a
  // range from, nothing below 6 either.
  for (const day of training) {
    for (const e of day.exercises) {
      check(label, e.repRange.high <= MAX_REPS && e.repRange.low >= 6, `"${e.name}" rep range ${e.repRange.low}–${e.repRange.high}`)
    }
  }

  // ---- what limits a day: fatigue and the movement count, never the clock
  for (const day of summary.days.filter((d) => d.kind !== 'rest')) {
    // The ab movement counts toward neither the movement cap nor the set cap.
    const planned = program.days.find((d) => d.id === day.id)
    const counted = planned.exercises.filter((e) => !isCoreRow(e))
    // DAY_LOAD_MAX governs DISCRETIONARY work — second movements and top-up
    // sets. The coverage pass is deliberately exempt from it (a muscle the day
    // is supposed to train getting nothing is worse than a day that reads
    // heavy), so a day whose mandatory slots alone are expensive can sit above
    // the cap. Hence the margin; what this is really guarding against is a day
    // pinned near 100%.
    check(label, day.load.pct <= 100 * DAY_LOAD_MAX + 10, `"${day.name}" load ${day.load.pct}% (${day.load.label})`)
    check(
      label,
      counted.length <= EXPERIENCE_POSTURE[opts.experience].exerciseCap,
      `"${day.name}" has ${counted.length} exercises, cap is ${EXPERIENCE_POSTURE[opts.experience].exerciseCap}`
    )
    // The volume preference's hard-set cap is never waived, coverage included.
    const finishers = day.exercises.filter((e) => e.rirTarget?.lastSetFailure).length
    const maxFinishers = volumePreference(opts.volume).failureSetsPerDay
    check(label, finishers <= maxFinishers, `"${day.name}" has ${finishers} failure finishers, the ${opts.volume} limit is ${maxFinishers}`)
    const cap = volumePreference(opts.volume).setCap
    const sets = counted.reduce((n, e) => n + (Number(e.sets) || 0), 0)
    check(label, sets <= cap, `"${day.name}" has ${sets} sets, the ${opts.volume} cap is ${cap}`)
    // ...and the preview says the same number the cap was held to.
    check(label, day.sets === sets, `"${day.name}" preview reads ${day.sets} sets, the day holds ${sets} under the cap`)
  }
  // There used to be a check here that at least one training day came out under
  // the 'heavy' band. It was written when a day was capped by a session length,
  // and it doesn't survive the move to sizing days by effectiveness: a day is
  // now as big as its muscle slots and their weekly targets make it, and an
  // upper/lower split has two comparable upper days and two comparable lower
  // ones — there is no reason for one of them to be light, and demanding it
  // would mean under-dosing a muscle to hit a number in a test. What still
  // guards against a generator that crams is above (per-day load and exercise
  // count) and below (no muscle over its weekly ceiling).

  // ---- frequency and volume
  for (const row of summary.volume) {
    // A muscle the library can't train with this equipment is a gap in the
    // exercise DB, not a bug in the generator. No current instance — every
    // programmed muscle has at-home coverage as of the 2026-08 calf rows.
    // A TIGHT week — the day cap times the training days comes to 48 sets or
    // fewer (Lower up to 4 days, Standard up to 3, Higher on 2) — can't put all
    // thirteen muscles on two sessions each at their minimum: that takes more
    // sets than the user asked for. Hani's call (2026-10-01): accept it. There
    // the bar is that every muscle still gets real work every week; the
    // preview's amber bars say which ones landed short.
    const tight = volumePreference(opts.volume).setCap * opts.daysPerWeek <= TIGHT_WEEK_SETS
    if (!opts.recommended) {
      // Frequency and minimum volume are the shape's own trade-off (see the loop).
    } else if (PROGRAMMED_MUSCLES.includes(row.muscle) && trainable(row.muscle, opts.equipment) && tight) {
      check(label, row.sessions >= 1, `${row.muscle} not trained at all in a tight week`)
      // Focus muscles take the lion's share of a tight week by design, so the
      // "real work" bar only applies when nothing was asked to be brought up.
      // Rear delts and upper back may ride on indirect work there — Hani tunes
      // them himself (2026-10-06). Abs sit outside the set cap, so they're never
      // squeezed.
      if (!opts.focus.length && !INDIRECT_OK_IN_TIGHT_WEEK.includes(row.muscle)) {
        check(label, row.sets >= 2, `${row.muscle} at ${row.sets} sets in a tight week — nothing to speak of`)
      }
    } else if (PROGRAMMED_MUSCLES.includes(row.muscle) && trainable(row.muscle, opts.equipment)) {
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
        // A rotation longer than a week is graded on its AVERAGE week, and sets
        // come in whole chunks: a muscle given exactly its minimum per 8-day
        // cycle averages 3.5 a week against a 4. That's the cycle length, not
        // a shortfall — so a rotation is held to its minimum per cycle.
        const floor = mevFor(row.muscle) * (opts.schedule === 'rotation' ? summary.perWeek : 1)
        check(label, row.sets >= floor - 0.25, `${row.muscle} at ${row.sets} sets (${row.tier.label})`)
      } else {
        check(label, row.sets > 2, `${row.muscle} at ${row.sets} sets — nothing to speak of`)
      }
    }
    const ceiling = ceilingFor(row.muscle) * ADVISOR_BLOCK_SLACK
    check(label, row.sets <= ceiling + 0.5, `${row.muscle} at ${row.sets} sets, over the ${round(ceiling)} ceiling`)
  }

  // ---- direct work: the main muscles the compounds can't stand in for get a
  // movement of their own every week (DIRECT_WORK in generatorConfig.js) — a
  // curl, a triceps extension, a raise, a calf raise — wherever the equipment
  // has one. A close-grip press does not count as the triceps exercise.
  for (const [muscle, paths] of Object.entries(DIRECT_WORK)) {
    if (!directTrainable(muscle, paths, opts.equipment)) continue
    const hit = training.some((day) => day.exercises.some((e) => paths.includes(getFullExercise(e.exerciseId)?.pattern)))
    check(label, hit, `${muscle} has no direct movement (${paths.join(' / ')}) all week`)
  }

  // ---- focus: earlier, more often, never more per session, and paid for
  // (Hani, 2026-10-02). Measured against the same week built without the focus,
  // which generateProgram reports as summary.focusTrade.
  for (const muscle of opts.focus) {
    const row = summary.volume.find((v) => v.muscle === muscle)
    check(label, !!row && row.sets > 0, `focus ${muscle} got no work`)
    if (!row) continue
    if (opts.daysPerWeek >= 4 && opts.recommended) {
      // Three sessions where the shape has a day for a third. The big muscles
      // stay on their own half of the body (FOCUS_PORTABLE_MUSCLES, 483b717), so
      // chest on a 4-day upper/lower has two upper days and glutes two lower days
      // in every recommended shape — Hani's call (2026-10-02): that's the shape,
      // not a bug, and the preview says so. What still fails is a day the
      // muscle could have used and didn't, or a shortfall the user isn't told.
      const want = Math.min(FOCUS_TARGET_FREQUENCY, homeDays(muscle, opts.daysPerWeek))
      check(label, row.sessions >= want, `focus ${muscle} only ${row.sessions}×/wk, the shape has ${want} days for it`)
      if (row.sessions < FOCUS_TARGET_FREQUENCY) {
        const told = summary.focusShortfall?.find((f) => f.muscle === muscle)
        check(label, told?.reason === 'shape', `focus ${muscle} at ${row.sessions}×/wk and the preview doesn't say why`)
      }
    }
  }
  const trade = summary.focusTrade
  if (opts.focus.length) {
    check(label, !!trade, 'focus week has no focusTrade report')
    let sessionsGained = 0
    for (const r of trade?.raised || []) {
      // Never fewer sets than the same week without the focus. The one known
      // exception is at home with three focus muscles at once: every at-home lat
      // movement is a pull-up or chin-up variant, and with chest and glutes also
      // claiming room the week can come up to about a set short.
      const slack = opts.equipment === 'bodyweight' && opts.focus.length > 1 ? 1.2 : 0.05
      check(label, r.sets >= r.setsBefore - slack, `focus ${r.muscle} lost sets: ${r.setsBefore} → ${r.sets}`)
      // More often up to FOCUS_TARGET_FREQUENCY; a muscle the week already hit
      // more often than that (through other movements) keeps at least that many.
      check(label, r.sessions >= Math.min(r.sessionsBefore, FOCUS_TARGET_FREQUENCY), `focus ${r.muscle} lost sessions: ${r.sessionsBefore} → ${r.sessions}`)
      sessionsGained += Math.max(0, r.sessions - r.sessionsBefore)
      if (r.sessionCap == null) continue
      for (const day of training) {
        const own = day.exercises.filter((e) => e.slot?.muscle === r.muscle).reduce((n, e) => n + e.sets, 0)
        check(label, own <= r.sessionCap, `"${day.name}" gives focus ${r.muscle} ${own} sets, its per-session cap is ${r.sessionCap}`)
      }
    }
    // The week's total doesn't grow — except by what the focus itself was given
    // (the two-set minimum of each session it added, plus its extra sets) when
    // every other muscle is already at its minimum and can't give a set back:
    // once-a-week splits, mostly on the Lower setting. The preview says so.
    if (trade) {
      const allowed = trade.totalSetsBefore + MIN_SETS_PER_EXERCISE * sessionsGained + FOCUS_EXTRA_SESSION_SETS * opts.focus.length
      check(label, trade.totalSets <= allowed, `focus grew the week: ${trade.totalSetsBefore} → ${trade.totalSets} sets`)
    }
  }
  // "Earlier" can only be checked once, for the set: with three focus muscles
  // only one of them can literally open the day. The claim that has to hold is
  // that whatever opens a day is focus work whenever the day has a slot for a
  // focus muscle — measured against a real contribution, not the trace a squat
  // leaves on the chest. A day with no focus slot (an arm day in a week focused
  // on chest) opens on its own lead, even if an overhead press there happens to
  // touch the chest too.
  if (opts.focus.length) {
    for (const day of training) {
      if (!day.exercises.some((e) => opts.focus.includes(e.slot?.muscle))) continue
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

// Does the library hold a movement down these paths that this equipment level
// allows — at the gym, minus the bands and un-loadable rows a full gym drops?
function directTrainable(muscle, paths, equipment) {
  return EXERCISES.some(
    (db) =>
      db.type !== 'isometric' &&
      paths.includes(db.pattern) &&
      (equipment === 'bodyweight'
        ? AT_HOME_EQUIPMENT.includes(db.equipment)
        : db.equipment !== 'resistance band' && db.progressiveOverload !== 'low')
  )
}

// How many of the recommended shape's days could host this focus muscle: any
// day for one that travels (FOCUS_PORTABLE_MUSCLES), otherwise the days that
// already train it or that train its half of the body. Restated here from the
// rule in generatorConfig.js rather than borrowed from pickTemplate, so a bug
// in the generator's version can't vouch for itself.
function homeDays(muscle, daysPerWeek) {
  const days = shapesFor(daysPerWeek)[0].days
  if (FOCUS_PORTABLE_MUSCLES.has(muscle)) return days.length
  return days.filter((d) => {
    if (d.muscles.includes(muscle)) return true
    const lower = d.muscles.filter((m) => MUSCLE_REGION[m] === 'lower').length
    return (lower * 2 > d.muscles.length ? 'lower' : 'upper') === MUSCLE_REGION[muscle]
  }).length
}

// An ab movement, by the database's own category (CORE_CATEGORY) — restated
// here rather than asked of the generator.
function isCoreRow(planned) {
  return getFullExercise(planned.exerciseId || planned.slot?.suggestedId)?.category === CORE_CATEGORY
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
