// Split generator — build a program out of the exercise database.
//
// The sibling of splitFromHistory.js. That module reads a split back out of
// what you already logged; this one proposes one from scratch, for someone who
// has nothing to read yet — or who wants a different shape than the one their
// history describes.
//
// The idea is that every choice a coach makes writing a program is already a
// number in `src/data/exercises.json`. How hard a movement hits its target
// (`muscles`), what it costs to recover from (`fatigueScore`,
// `recoveryWindowHours`, `axialLoading`), how much growth it buys for that cost
// (`sfr`, `hypertrophyPotential`, `stretchMediated`, `resistanceProfile`), how
// loadable it is (`progressiveOverload`, `stability`) and who can actually do
// it (`skill`, `equipment`). The generator spends a weekly volume budget across
// 2–3 sessions per muscle and, within each session, picks whatever buys the
// most growth for the fatigue the day has left.
//
// Pure and portable, same rule as program.js / engine.js / splitFromHistory.js:
// no React, no storage, no navigation, no randomness. The same inputs always
// produce the same split. It builds its output with program.js's own factories,
// so the result is indistinguishable from a hand-built split and every existing
// consumer — logger prefill, calendar projection, finish-time split sync — works
// on it unchanged. Nothing here writes anything: the page previews the proposal
// and the user confirms it.

import exercisesDb from '../data/exercises.json'
import { withAliases } from '../data/exerciseAliases'
import { createDay, createPlannedExercise, emptyProgram, substituteExercise } from './program'
import { dayStats, ENGINE_MUSCLE_TO_COARSE, plannedExerciseDbId, donutRows, isCoreMovement } from './planStats'
import { newSupersetId } from './workoutStats'
import { cardioOf } from './cardio'
import { injuryRiskMap } from './injuries'
import { effectiveWeeklyVolume, muscleRecovery } from './engine'
import { exerciseIdForName } from './exerciseLibrary'
import { repRangeFor } from './splitFromHistory'
import { equipmentValuesFor } from './profileFields'
import { ALL_EQUIPMENT, AT_HOME_EQUIPMENT } from '../data/equipmentGroups'
import { PATTERN_IDS, getPattern, patternPhrase } from '../data/movementPatterns'
import {
  ATOM_TO_GROUP, ENGINE_MUSCLES, mevFor, ceilingFor, volumeTier, volumeScale,
  ADVISOR_BLOCK_SLACK, SYSTEMIC_CAPACITY, DEFAULT_FATIGUE_SCORE, DEFAULT_RECOVERY_WINDOW,
  FATIGUE_SCORE_COEF, AXIAL_MULT, FREE_WEIGHT_MULT,
} from './engineConfig'
import {
  PROGRAMMED_MUSCLES, shapesFor, DAYS_PER_WEEK_OPTIONS, DEFAULT_DAYS_PER_WEEK, DEFAULT_WEEKDAYS,
  MAX_FOCUS_MUSCLES, FOCUS_TARGET_FREQUENCY, FOCUS_EXTRA_SESSION_SETS, FOCUS_NO_ROOM_SETS, FAMILIARITY_FOCUS_DAMP,
  MUSCLE_REGION, FOCUS_PORTABLE_MUSCLES,
  EXPERIENCE_POSTURE, DEFAULT_EXPERIENCE, SKILL_RANK, volumePreference, CAPPED_LEAD_SLOTS, RIR_TARGETS, MIN_WORKING_RIR, FAILURE_MAX_FATIGUE_SCORE,
  MIN_SETS_PER_EXERCISE, MAX_SETS_PER_MUSCLE_PER_SESSION, MIN_SLOT_SETS,
  HISTORY_VOLUME_DAYS, HISTORY_MIN_SESSIONS, FAMILIARITY_DAYS,
  HP_SCORE, SFR_SCORE, STRETCH_SCORE, PROFILE_SCORE, OVERLOAD_SCORE, STABILITY_SCORE, SIMPLICITY_SCORE,
  WEIGHTS, GYM_WEIGHTS, GYM_EXCLUDED_EQUIPMENT, GYM_EXCLUDED_OVERLOAD, LIMITER_PENALTY, LIMITER_EXCLUDED,
  PENALTIES, DAY_LOAD_TARGET, DAY_LOAD_MAX, COMPOUND_LEAD_MIN_CONTRIBUTION,
  REP_RANGES, MAX_REPS, MIN_REP_SPAN, SWAP_MIN_CONTRIBUTION_RATIO,
  PATTERN_OPTION_LIMIT, DIRECT_WORK, DIRECT_WORK_TARGET_SLACK, LEAD_PATHS, COVERAGE_MIN_WEIGHT, HEAVY_FATIGUE_SCORE,
  corePlacement, CORE_MUSCLES, SUPERSET_MAX_COMPOUND_FATIGUE,
  SAME_JOB, JOB_ALTERNATIVE_MIN, JOB_COVERED_MIN, IMPLEMENT_SCORE, EMPHASIS_WEIGHT, EMPHASIS_MIN_SHARE,
  SESSION_TYPES, SESSION_RECOMMENDABLE, SESSION_GAP_HOURS, SESSION_FATIGUED_BELOW,
} from './generatorConfig'

const DAY_MS = 86400000
const HOURS_PER_DAY = 24

const DB_BY_ID = withAliases(new Map((exercisesDb.exercises || []).map((e) => [e.id, e])))

// The pool the generator picks from. Isometrics are excluded: a plan row carries
// a rep range, and "8–12 reps of a plank" is a lie the logger would then have to
// live with. They stay pickable by hand in the split editor. So do the rows the
// DB marks "Don't Program": Hani's call that a movement isn't good enough to
// recommend, which keeps it out of every split, swap and slot this file offers
// without deleting it from the bank or anyone's history.
const POOL = (exercisesDb.exercises || []).filter(
  (e) => e.type !== 'isometric' && e.programmable !== false && e.muscles && Object.keys(e.muscles).length
)

// How the Limiting Factor column applies to this person (see LIMITER_PENALTY).
// Experience falls back to the default for a split with none on record.
export function limiterPolicy(experience, atGym) {
  const level = EXPERIENCE_POSTURE[experience] ? experience : DEFAULT_EXPERIENCE
  return {
    limiterPenalty: atGym ? LIMITER_PENALTY[level] : 0,
    excludeLimited: atGym && LIMITER_EXCLUDED[level],
  }
}

// The top-up pass adds one set at a time and stops as soon as a whole round
// places nothing; this is only the loop's guard rail against a pathological
// case, not a target — what actually ends the pass is running out of muscles
// that still owe volume, or out of fatigue budget.
const MAX_TOP_UP_PASSES = 40

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))
const round1 = (n) => Math.round(n * 10) / 10

// ---- Muscle weights ---------------------------------------------------------

// Engine muscle -> how much of one set of this exercise lands there. The BEST
// atom per muscle, never their sum — incline bench listing Upper 1.0 /
// Middle 0.5 / Lower 0.25 says which region it biases toward, not that it's
// 1.75 chest sets. Same rule (and same reasoning) as effectiveWeeklyVolume in
// engine.js and creditExercise in planStats.js; the three have to agree or a
// generated split would grade differently on the dashboard than it did here.
const WEIGHTS_CACHE = new Map()
export function muscleWeights(db) {
  if (!db) return {}
  const hit = WEIGHTS_CACHE.get(db.id)
  if (hit) return hit
  const out = {}
  for (const [atom, w] of Object.entries(db.muscles || {})) {
    const g = ATOM_TO_GROUP[atom]
    if (!g) continue
    out[g] = Math.max(out[g] || 0, w)
  }
  WEIGHTS_CACHE.set(db.id, out)
  return out
}

// The movement FAMILY a row belongs to. The database names variants
// "Base - Variant" (and "Base, Detail"), so the text before the first dash or
// comma is the movement itself: "Overhead Press - Smith Machine, Behind The
// Neck" and "Overhead Press - Machine, Wide Grip" are both overhead presses,
// and a day that programs one of each has programmed the same exercise twice
// with a straight face. Blocked outright inside a day, and merely discouraged
// across the week — training two grips of a pulldown on different days is a
// choice, doing it in the same session is an accident.
export function movementFamily(db) {
  return db.name.toLowerCase().split(/\s+-\s+|,/)[0].trim()
}

// The main muscle of a movement heavy enough that a day holds only one of them
// per muscle (HEAVY_FATIGUE_SCORE), or null for a lighter movement.
function heavyMuscleOf(db) {
  return (db.fatigueScore ?? 0) >= HEAVY_FATIGUE_SCORE ? primaryMuscleOf(db) : null
}

// Two movements are "the same idea" when they send the same joints down the same
// resistance path with the same hardware. It's what stops a week reading Barbell
// Row / Dumbbell Row / T-Bar Row, none of which share a family name.
//
// This used to be `category|subCategory|type|equipment`, which was a guess at
// the question the `pattern` column now answers outright. The guess was wrong in
// both directions: it couldn't see that a Chest Supported T-Bar Row and a Seated
// Row Machine are the same job, and it merged a Lat Pulldown with a Straight-Arm
// Pulldown, which are not remotely the same job. Equipment stays in the key
// because the same path on a cable and on a barbell really is a different
// session — a different strength curve and a different queue.
function signature(db) {
  return [db.pattern || db.category, db.equipment].join('|')
}

// The job a movement does in a day (SAME_JOB): its pattern, except the pairs
// that do the same job down slightly different paths — a lunge is the quad
// compound a squat already was, an upright row the shoulder press.
export function jobOf(db) {
  const pattern = db?.pattern || null
  return pattern ? SAME_JOB[pattern] || pattern : null
}

// ---- Reading the user's history ---------------------------------------------

// What the last few weeks say about this person: the volume each muscle is
// used to, and which movements are theirs. Null when there isn't enough logged
// to be worth reading — a new user gets the standard posture instead.
export function historyContext(sessions, { now = Date.now() } = {}) {
  const list = (sessions || []).filter((s) => s && s.date <= now + DAY_MS)
  const recent = list.filter((s) => s.date >= now - HISTORY_VOLUME_DAYS * DAY_MS)
  if (recent.length < HISTORY_MIN_SESSIONS) return null

  // The window's totals normalised to a weekly rate (effectiveWeeklyVolume
  // returns the window total, not a per-week figure).
  const scale = HISTORY_VOLUME_DAYS / 7
  const volume = new Map()
  for (const row of effectiveWeeklyVolume(list, { days: HISTORY_VOLUME_DAYS, now })) {
    volume.set(row.muscle, row.sets / scale)
  }

  // Movements they actually train, and the reps they train them for.
  const familiar = new Map() // exercise id -> { count, lastDate, reps: number[][] }
  const cutoff = now - FAMILIARITY_DAYS * DAY_MS
  for (const s of list) {
    if (s.date < cutoff) continue
    for (const ex of s.exercises || []) {
      if (ex.kind === 'cardio') continue
      const id = ex.exerciseId || exerciseIdForName(ex.name)
      const db = id ? DB_BY_ID.get(id) : null
      if (!db) continue
      let rec = familiar.get(db.id)
      if (!rec) familiar.set(db.id, (rec = { count: 0, lastDate: 0, reps: [] }))
      rec.count++
      rec.lastDate = Math.max(rec.lastDate, s.date)
      const reps = []
      for (const set of ex.sets || []) {
        if (set.type === 'warmup') continue
        if (set.left) {
          for (const side of [set.left, set.right]) {
            const r = Number(side?.reps)
            if (r > 0) reps.push(r)
          }
        } else {
          const r = Number(set.reps)
          if (r > 0) reps.push(r)
        }
      }
      if (reps.length) rec.reps.push(reps)
    }
  }

  const mostSeen = Math.max(1, ...[...familiar.values()].map((r) => r.count))
  return { volume, familiar, mostSeen, sessions: recent.length }
}

// 0–1: how much of a staple this movement is for them.
function familiarity(db, history) {
  const rec = history?.familiar.get(db.id)
  if (!rec) return 0
  return clamp(rec.count / history.mostSeen, 0, 1)
}

// ---- Inputs -----------------------------------------------------------------

// Normalise whatever the wizard collected into the shape the rest of the module
// works in, filling gaps from the profile and falling back to safe defaults.
// Every field is validated here so no downstream step has to re-check it.
export function resolveInputs({ answers = {}, profile = null, sessions = [], injuries = [], now = Date.now() } = {}) {
  const daysPerWeek = DAYS_PER_WEEK_OPTIONS.includes(Number(answers.daysPerWeek))
    ? Number(answers.daysPerWeek)
    : DEFAULT_DAYS_PER_WEEK

  const focus = (answers.focus || [])
    .filter((m) => ENGINE_MUSCLES.includes(m))
    .slice(0, MAX_FOCUS_MUSCLES)

  const experienceRaw = answers.experience || profile?.experience_level
  const experience = EXPERIENCE_POSTURE[experienceRaw] ? experienceRaw : DEFAULT_EXPERIENCE

  const preset = answers.equipment || profile?.equipment || 'gym'
  const equipment = equipmentValuesFor(preset)
  const allowedEquipment = new Set(equipment.length ? equipment : ALL_EQUIPMENT)

  // What a full gym changes: loadability and stability start carrying real
  // weight, bands come off the table, and so does anything that can't be loaded.
  const atGym = preset === 'gym'
  const weights = atGym ? { ...WEIGHTS, ...GYM_WEIGHTS } : WEIGHTS
  const excludedEquipment = atGym ? new Set(GYM_EXCLUDED_EQUIPMENT) : new Set()
  const excludedOverload = atGym ? new Set(GYM_EXCLUDED_OVERLOAD) : new Set()
  const limiter = limiterPolicy(experience, atGym)

  // Which named shape of split — Upper/Lower, Arnold, a bro split. Null means
  // "pick for me", which takes the recommended one for this day count.
  const shape = typeof answers.shape === 'string' ? answers.shape : null

  // Leave each slot's movement undecided, to be chosen in the gym? Off by
  // default: a split you can read straight through is a better first impression
  // than a list of questions, and every row can be opened afterwards anyway.
  const openSlots = answers.openSlots === true

  const schedule = answers.schedule === 'rotation' ? 'rotation' : 'weekly'
  const weekdays = normaliseWeekdays(answers.weekdays, daysPerWeek)

  return {
    daysPerWeek,
    focus,
    experience,
    posture: EXPERIENCE_POSTURE[experience],
    volumePref: volumePreference(answers.volume),
    // Where each day's ab movement goes: 'superset' or 'end' (CORE_PLACEMENTS).
    core: corePlacement(answers.core),
    equipmentPreset: preset,
    allowedEquipment,
    excludedEquipment,
    excludedOverload,
    ...limiter,
    weights,
    schedule,
    weekdays,
    shape,
    openSlots,
    history: historyContext(sessions, { now }),
    // Built once here rather than per scored exercise: fillDay ranks the whole
    // pool for every muscle slot of every day, so this would otherwise be
    // recomputed thousands of times per generated split.
    injuryRisk: injuryRiskMap(injuries, POOL),
    now,
  }
}

// Exactly `daysPerWeek` distinct weekdays (Mon=0 … Sun=6), in order. Falls back
// to the spread in DEFAULT_WEEKDAYS when the answer is missing or malformed.
function normaliseWeekdays(picked, daysPerWeek) {
  const clean = [...new Set((picked || []).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))]
    .sort((a, b) => a - b)
  if (clean.length === daysPerWeek) return clean
  return [...(DEFAULT_WEEKDAYS[daysPerWeek] || DEFAULT_WEEKDAYS[DEFAULT_DAYS_PER_WEEK])]
}

// ---- Weekly volume targets ---------------------------------------------------

// Effective weekly sets to aim at, per muscle. A new user gets the posture for
// their experience; someone with history gets THEIR OWN recent volume, so the
// split feels like a version of what they already do rather than a number they
// have never trained at. Either way the result is clamped into the engine's own
// landmarks, so the generator can't write a split the dashboard would
// immediately grade "below minimum" or "low efficiency".
//
// A focus muscle gets its ordinary target here. What bringing it up changes is
// worked out against the week's shape, in focusPlan.
export function weeklyTargets({ posture, focus, history, volumePref = volumePreference() }) {
  const wanted = new Set([...PROGRAMMED_MUSCLES, ...focus])
  const targets = {}

  for (const muscle of ENGINE_MUSCLES) {
    if (!wanted.has(muscle)) continue
    const scale = volumeScale(muscle)
    const seen = history?.volume.get(muscle) || 0
    // A muscle they've been neglecting still gets a real slot — their zero is
    // the reason they're generating a split, not a preference to honour.
    let target = seen > mevFor(muscle) ? seen : posture.baseWeeklySets * scale
    // The preference applies to their own history too: someone asking for
    // "lower" wants less than they've been doing, not a copy of it.
    target = clamp(target * volumePref.targetMult, mevFor(muscle), ceilingFor(muscle))
    targets[muscle] = round1(target)
  }
  return targets
}

// What bringing the focus muscles up costs and pays (see the Focus section of
// generatorConfig.js). Compares the week's shape with and without the focus:
//
//   - a muscle the focus gave another session gets FOCUS_EXTRA_SESSION_SETS more
//     a week, one that already trains as often as the week allows gets
//     FOCUS_NO_ROOM_SETS — spread over its sessions, so each session carries
//     about what it did before rather than double;
//   - `sessionCap` holds every session to that: what the muscle got per session
//     without the focus, plus the one set a week with no room to give it more;
//   - the other programmed muscles give the same sets back, evenly, none below
//     its minimum, so the week's total stays what the volume setting made it.
//
// A focus muscle the split doesn't program at all (forearms, say) is new work,
// not more of it: it gets its ordinary target, and the others pay for all of it.
//
// Planned from what the week WITHOUT the focus actually delivered (`baseVolume`,
// its weekly sets) rather than from its targets: the two differ, and planning
// "+2" on a target the week never reached hands the gap to the focus muscle too.
export function focusPlan(targets, focus, baseDays, focusDays, baseVolume = new Map()) {
  const out = { ...targets }
  const sessionCap = {}
  const extraSets = {}
  const sessions = (days, m) => days.filter((d) => d.muscles.includes(m)).length
  let owed = 0
  for (const m of focus) {
    if (!targets[m]) continue
    const before = sessions(baseDays, m)
    const after = Math.max(1, sessions(focusDays, m))
    const gained = after > before
    const base = before && baseVolume.get(m) > 0 ? baseVolume.get(m) : targets[m]
    const extra = !before ? 0 : gained ? FOCUS_EXTRA_SESSION_SETS : FOCUS_NO_ROOM_SETS
    extraSets[m] = extra
    out[m] = round1(Math.min(base + extra, ceilingFor(m) * ADVISOR_BLOCK_SLACK))
    owed += out[m] - targets[m]
    // Its new weekly sets spread over its new sessions — never above what one
    // session held before, since the extra session takes more than the extra
    // sets add. Where there was no session to add, this is where the one extra
    // set a week lands.
    sessionCap[m] = Math.max(MIN_SETS_PER_EXERCISE, Math.ceil(out[m] / after - 0.05))
  }
  // Paid back evenly by the rest, a share at a time, so a muscle that hits its
  // minimum stops paying and the others cover what it couldn't.
  let payers = PROGRAMMED_MUSCLES.filter((m) => !focus.includes(m) && out[m] > mevFor(m))
  for (let guard = 0; owed > 0.05 && payers.length && guard < 20; guard++) {
    const share = owed / payers.length
    owed = 0
    for (const m of payers) {
      const next = Math.max(mevFor(m), out[m] - share)
      owed += share - (out[m] - next)
      out[m] = next
    }
    payers = payers.filter((m) => out[m] > mevFor(m))
  }
  for (const m of Object.keys(out)) out[m] = round1(out[m])
  return { targets: out, sessionCap, extraSets }
}

// ---- The week's shape --------------------------------------------------------

// Template days for this frequency, with the focus muscles promoted to the front
// of every day they appear in and given an extra weekly session where one of the
// other days has room. "Earlier and more often" is the whole ask of a focus.
export function pickTemplate(daysPerWeek, focus = [], shapeId = null) {
  // An unrecognised shape falls back to the first one rather than erroring: the
  // id can arrive from a saved answer whose day count has since changed, and a
  // sensible split beats a broken one.
  const shapes = shapesFor(daysPerWeek)
  const shape = shapes.find((sh) => sh.id === shapeId) || shapes[0]
  // `sizedAs` (Upper B) is the order the day is measured in for its set budget;
  // it takes the same focus edits as `muscles` so the two always list the same
  // muscles.
  // `emphasis`, `leadPaths` and `repeatJobs` ride along unchanged: a focus
  // reorders the day, it doesn't change what the day is for.
  const days = shape.days.map((d) => ({
    name: d.name,
    muscles: [...d.muscles],
    sizedAs: d.sizedAs ? [...d.sizedAs] : null,
    emphasis: d.emphasis || null,
    leadPaths: d.leadPaths || null,
    repeatJobs: d.repeatJobs || null,
  }))

  // Which half of the body a day is for, read off the day rather than hardcoded
  // per shape, so a shape added later is classified without anyone remembering
  // to update a table. Ties go to upper, which only arises for a day with no
  // muscles at all.
  const regionOf = (day) => {
    let lower = 0
    for (const m of day.muscles) if (MUSCLE_REGION[m] === 'lower') lower++
    return lower * 2 > day.muscles.length ? 'lower' : 'upper'
  }

  // A day can take a focus muscle it wasn't built for only if the muscle is
  // portable or the day trains that half of the body. Without this the loop
  // dropped the muscle on the first day that lacked it, which is how squats
  // ended up leading "Upper A" and lateral raises leading "Lower A".
  const borrowed = new Map(days.map((d) => [d, []]))
  for (const muscle of focus) {
    let freq = days.filter((d) => d.muscles.includes(muscle)).length
    for (const d of days) {
      if (freq >= FOCUS_TARGET_FREQUENCY) break
      if (d.muscles.includes(muscle)) continue
      if (!FOCUS_PORTABLE_MUSCLES.has(muscle) && regionOf(d) !== MUSCLE_REGION[muscle]) continue
      d.muscles.push(muscle)
      d.sizedAs?.push(muscle)
      borrowed.get(d).push(muscle)
      freq++
    }
  }
  // A muscle with no eligible day simply stays at the frequency the shape gives
  // it. Quads on Upper/Lower already has two sessions and there is no honest
  // third home for it — better to leave it at two and say so (summarize reports
  // the shortfall) than to invent a day for it.

  // One ordering pass at the end rather than promoting as we go. The focus
  // muscles lead in the order the user listed them on the first day that holds
  // them, then take turns: only one can literally open a session, and the one
  // that always comes second would always come to it a little tired.
  let turn = 0
  for (const d of days) {
    const listed = focus.filter((m) => d.muscles.includes(m))
    const k = listed.length ? turn++ % listed.length : 0
    const lead = [...listed.slice(k), ...listed.slice(0, k)]
    d.muscles = [...lead, ...d.muscles.filter((m) => !lead.includes(m))]
    if (d.sizedAs) d.sizedAs = [...lead, ...d.sizedAs.filter((m) => !lead.includes(m))]
  }

  // A day that borrowed a muscle says so. The focus muscle still leads — being
  // trained fresh is the whole point of naming one — but a day called "Chest"
  // that opens with lateral raises is lying about itself, and this name follows
  // the split into the editor, the calendar and the logger. Renamed once, after
  // every focus muscle is placed, so a day that borrowed two reads
  // "Legs + Biceps, Forearms" rather than being renamed twice.
  for (const d of days) {
    const extra = borrowed.get(d)
    if (extra.length) d.name = `${d.name} + ${extra.join(', ')}`
  }
  // A muscle another day of the week emphasises gets ONE movement here — topped
  // up with sets like any other — and its second angle on its own day. That is
  // what makes a glute day a glute day: the quads still get their split squat,
  // not a split squat and a leg extension. A focus muscle is exempt, since
  // training it more often is the point of naming it.
  const emphasised = new Set(days.flatMap((d) => d.emphasis || []))
  for (const d of days) {
    d.oneMovement = d.muscles.filter((m) => emphasised.has(m) && !d.emphasis?.includes(m) && !focus.includes(m))
  }
  // The shape rides along on the days so summarize can name it without having to
  // resolve the id a second time.
  days.shape = shape
  return days
}

// Which day of the week guarantees each DIRECT_WORK muscle its own movement.
// Once a week is enough, so each muscle gets ONE day. If the week already trains
// it directly somewhere (`natural`, the week filled without these rules), the
// guarantee goes there and simply keeps it — nothing has to move. Otherwise it
// goes to the day that trains the muscle earliest, where it's freshest: Upper B
// on an upper/lower split, the push day for triceps. Ties go to the day that
// has had to make room for the fewest new movements so far, so a full-body week
// spreads them out instead of stacking them all on day A, then to the earlier
// day. One list per day.
export function assignDirectWork(days, natural = null) {
  const direct = days.map(() => [])
  const added = days.map(() => 0)
  for (const muscle of Object.keys(DIRECT_WORK)) {
    const listing = days.map((_, i) => i).filter((i) => days[i].muscles.includes(muscle))
    const already = natural ? listing.filter((i) => hasDirectMovement(natural[i], muscle)) : []
    let best = -1
    for (const i of already.length ? already : listing) {
      const at = days[i].muscles.indexOf(muscle)
      const bestAt = best === -1 ? Infinity : days[best].muscles.indexOf(muscle)
      if (at < bestAt || (at === bestAt && added[i] < added[best])) best = i
    }
    if (best === -1) continue
    direct[best].push(muscle)
    if (!already.length) added[best]++
  }
  return direct
}

// Where the training days sit inside one cycle, and how long the cycle is.
//
// A fixed week is 7 slots with the chosen weekdays filled in. A rotation picks
// the rest-day count whose resulting weekly rate lands closest to the requested
// frequency — with one hard rule: never a 7-day cycle, because program.js reads
// a 7-day program as a fixed weekly schedule, which is the other thing entirely.
export function cycleShape({ schedule, daysPerWeek, weekdays }) {
  if (schedule === 'weekly') {
    return { length: 7, offsets: [...weekdays] }
  }
  let best = null
  for (let rest = 0; rest <= daysPerWeek * 2; rest++) {
    const length = daysPerWeek + rest
    if (length === 7) continue // reserved for the fixed-week shape
    const err = Math.abs((daysPerWeek * 7) / length - daysPerWeek)
    if (!best || err < best.err) best = { length, rest, err }
  }
  // Spread the rest days as evenly as the counts allow: each training day is
  // followed by its share, remainder first, so no two long gaps sit together.
  const offsets = []
  const per = Math.floor(best.rest / daysPerWeek)
  let extra = best.rest % daysPerWeek
  let at = 0
  for (let i = 0; i < daysPerWeek; i++) {
    offsets.push(at)
    at += 1 + per + (extra > 0 ? 1 : 0)
    if (extra > 0) extra--
  }
  return { length: best.length, offsets }
}

// Hours from each training day to the NEXT session that trains the same muscle,
// wrapping around the cycle. This is what makes exercise choice and frequency
// one decision rather than two: an exercise whose recovery window overruns this
// gap is scored down on that day, which is how a heavy RDL stops landing two
// days before the next hamstring session.
export function recoveryGaps(templateDays, { length, offsets }) {
  return templateDays.map((day, i) => {
    const gaps = {}
    for (const muscle of day.muscles) {
      let found = length // no other day trains it — a full cycle of rest
      for (let step = 1; step <= templateDays.length; step++) {
        const j = (i + step) % templateDays.length
        if (templateDays[j].muscles.includes(muscle)) {
          found = (offsets[j] - offsets[i] + length) % length || length
          break
        }
      }
      gaps[muscle] = found * HOURS_PER_DAY
    }
    return gaps
  })
}

// How much of a muscle's week a day takes, relative to its other days: more on
// the day that emphasises it (EMPHASIS_WEIGHT), an even share otherwise.
//
// Only where the week can afford it: if the skew would leave a day that trains
// the muscle less than EMPHASIS_MIN_SHARE, the week splits evenly instead. A
// tight week — a beginner on lower volume, three focus muscles — would
// otherwise starve that day of the muscle altogether and train it once.
export function emphasisWeight(day, muscle, templateDays = null, target = null) {
  if (!day.emphasis?.includes(muscle)) return 1
  if (templateDays && target != null) {
    const days = templateDays.filter((d) => d.muscles.includes(muscle))
    const total = days.reduce((n, d) => n + (d.emphasis?.includes(muscle) ? EMPHASIS_WEIGHT : 1), 0)
    const lightest = days.some((d) => !d.emphasis?.includes(muscle)) ? target / total : Infinity
    if (lightest < EMPHASIS_MIN_SHARE) return 1
  }
  return EMPHASIS_WEIGHT
}

// Per-day, per-muscle set allocation: the weekly target split across the days
// that train that muscle — evenly, except where a day emphasises it — capped per
// session at the point where the engine's own within-session diminishing
// returns start discounting the work.
//
// What an emphasised day can't hold under the per-session cap goes back to the
// muscle's other days, so the emphasis moves sets and never loses any: at 12
// sets over two days the cap leaves an even 6/6, and the emphasis shows in the
// day's order and movements instead.
export function allocate(targets, templateDays) {
  const out = templateDays.map(() => ({}))
  const muscles = new Set(templateDays.flatMap((d) => d.muscles))
  for (const m of muscles) {
    const target = targets[m]
    if (!target) continue
    let open = templateDays.map((d, i) => i).filter((i) => templateDays[i].muscles.includes(m))
    let left = target
    // Water-fill: share by weight, pin whichever day overflows the cap, repeat.
    while (open.length) {
      const w = (i) => emphasisWeight(templateDays[i], m, templateDays, target)
      const weight = open.reduce((n, i) => n + w(i), 0)
      const over = open.filter((i) => (left * w(i)) / weight > MAX_SETS_PER_MUSCLE_PER_SESSION)
      if (!over.length) {
        for (const i of open) out[i][m] = (left * w(i)) / weight
        break
      }
      for (const i of over) out[i][m] = MAX_SETS_PER_MUSCLE_PER_SESSION
      left -= over.length * MAX_SETS_PER_MUSCLE_PER_SESSION
      open = open.filter((i) => !over.includes(i))
    }
  }
  return out
}

// ---- Scoring -----------------------------------------------------------------

// How good a choice this movement is for `muscle` on this day, right now. The
// same function ranks the generator's picks and (later) a swap suggestion, so
// the two can never disagree about what a good substitute is.
//
// `ctx` carries everything situational: how much of the day's fatigue budget is
// already spent, how long until this muscle is trained again, what's already in
// the week, and whether this slot still wants its compound.
export function scoreExercise(db, ctx) {
  const weights = muscleWeights(db)
  const contribution = weights[ctx.muscle] || 0
  if (!contribution) return null

  // Weights vary by where the person trains: a full gym leans harder on
  // loadability and stability (see GYM_WEIGHTS).
  const w = ctx.weights || WEIGHTS

  let score = 0
  score += w.contribution * contribution
  score += w.hypertrophy * (HP_SCORE[db.hypertrophyPotential] ?? 0.4)
  score += w.sfr * (SFR_SCORE[db.sfr] ?? 0.35)
  score += w.stretch * (STRETCH_SCORE[db.stretchMediated] ?? 0)
  score += w.profile * (PROFILE_SCORE[db.resistanceProfile] ?? 0.35)
  score += w.overload * (OVERLOAD_SCORE[db.progressiveOverload] ?? 0.4)
  score += w.stability * (STABILITY_SCORE[db.stability] ?? 0.6)
  score += (w.simplicity ?? 0) * (SIMPLICITY_SCORE[db.skill] ?? 0.6)
  // Machines, then barbells, then dumbbells (IMPLEMENT_SCORE) — gym only.
  score += (w.implement ?? 0) * (IMPLEMENT_SCORE[db.implement] ?? IMPLEMENT_SCORE.other)

  // What else in the day this movement pays off. Only muscles that still owe
  // sets count — covering a muscle the day has already finished with is not a
  // benefit, it's the overshoot the allocation is trying to avoid.
  if (ctx.remaining) {
    let relief = 0
    for (const [m, w] of Object.entries(weights)) {
      if (m === ctx.muscle) continue
      if ((ctx.remaining[m] ?? 0) >= 1) relief += w
    }
    score += w.debtRelief * Math.min(2, relief)
  }

  // A region of muscle the week hasn't trained yet (WEIGHTS.coverage). Read
  // from the DB's own regions, not the engine muscles, so it can tell the upper
  // chest from the middle and the soleus from the gastrocnemius.
  if (ctx.weekAtoms) {
    let fresh = 0
    for (const [atom, aw] of Object.entries(db.muscles || {})) {
      if (aw >= COVERAGE_MIN_WEIGHT && !ctx.weekAtoms.has(atom)) fresh += aw
    }
    score += (w.coverage ?? 0) * Math.min(1, fresh)
  }

  // The hybrid rule: their own movements get a nudge, damped on a focus muscle
  // where fresh stimulus is the entire point of naming it.
  const fam = ctx.familiarity ?? 0
  score += w.familiarity * fam * (ctx.isFocus ? FAMILIARITY_FOCUS_DAMP : 1)

  // Fatigue, priced against what's LEFT of the day rather than in the abstract.
  const spent = clamp(ctx.budgetUsed ?? 0, 0, 1)
  const fatigueNorm = ((db.fatigueScore ?? DEFAULT_FATIGUE_SCORE) - 1) / 4
  score -= (PENALTIES.fatigueBase + PENALTIES.fatigueRamp * spent) * fatigueNorm
  if (db.axialLoading) score -= PENALTIES.axial * spent

  // Recovery-window fit against the gap to the next session for this muscle.
  const window = db.recoveryWindowHours || DEFAULT_RECOVERY_WINDOW
  const mid = (window[0] + window[1]) / 2
  if (ctx.hoursToNext) {
    const overrunDays = Math.max(0, mid - ctx.hoursToNext) / HOURS_PER_DAY
    score -= Math.min(PENALTIES.recoveryCap, PENALTIES.recovery * overrunDays)
  }

  // Variety across the week.
  if (ctx.weekIds?.has(db.id)) score -= PENALTIES.repeatExercise
  else if (ctx.weekFamilies?.has(movementFamily(db))) score -= PENALTIES.sameFamily
  else if (ctx.weekSignatures?.has(signature(db))) score -= PENALTIES.sameSignature

  // ...and within the day, a second movement for the same job. The generator
  // only writes one on a day built for it (candidates, `repeatJobs`), where it
  // loses ties to a different job; a swap still offers one, ranked lower.
  if (ctx.dayJobs?.has(jobOf(db))) score -= PENALTIES.sameJobInDay

  // One tier of stretch above their level is allowed but discouraged; two is a
  // hard filter and never reaches this function.
  const over = (SKILL_RANK[db.skill] ?? 1) - ctx.maxSkillRank
  if (over > 0) score -= PENALTIES.skillOverreach * over

  // An open injury. Soft on purpose, and soft is the whole design: a hard filter
  // in candidates() would strip most of a push day over a cranky shoulder and
  // leave the generator unable to fill it. Here it just loses ties — and the
  // multiplier is the WEIGHTED risk (injuries.js), so an injury you've marked
  // resolved, or one you've cleared this specific movement for, costs nothing.
  if (ctx.injuryRisk) {
    const hit = ctx.injuryRisk.get(db.id)
    if (hit) score -= PENALTIES.injury * hit.weighted
  }

  if (db.laterality === 'unilateral') score -= PENALTIES.unilateral
  // Something other than the muscle ends the set (see LIMITER_PENALTY).
  if (ctx.limiterPenalty && db.limiter && db.limiter !== 'target') score -= ctx.limiterPenalty
  score -= PENALTIES.perNameChar * db.name.length

  return { score, contribution }
}

// The movements eligible for this slot at all. Everything here is a hard rule:
// a soft preference belongs in scoreExercise, not in the filter.
//
// `wantCompound` is the one structural rule the scoring doesn't express — a
// muscle's first movement of the day is a compound where the database has a
// real one for it, and its best isolation where it doesn't.
export function candidates(muscle, ctx) {
  const eligible = POOL.filter((db) => {
    if (!ctx.allowedEquipment.has(db.equipment)) return false
    if (ctx.excludedEquipment?.has(db.equipment)) return false
    if (ctx.excludedOverload?.has(db.progressiveOverload)) return false
    if (ctx.excludeLimited && db.limiter && db.limiter !== 'target') return false
    if ((SKILL_RANK[db.skill] ?? 1) > ctx.maxSkillRank + 1) return false
    if (ctx.dayIds?.has(db.id)) return false
    if (ctx.dayFamilies?.has(movementFamily(db))) return false
    if (ctx.exclude?.has(db.id)) return false
    // Scoped to one movement path — this is what makes "any vertical pull" a
    // list rather than a search.
    if (ctx.pattern && db.pattern !== ctx.pattern) return false
    // ...or to a muscle's direct-work paths (DIRECT_WORK).
    if (ctx.patterns && !ctx.patterns.includes(db.pattern)) return false
    // ...or to movements this muscle is the main mover of (a focus lead).
    if (ctx.mainMover && primaryMuscleOf(db) !== muscle) return false
    // Ab work and everything else never stand in for each other (CORE_MUSCLES).
    if (CORE_MUSCLES.includes(muscle) !== isCoreMovement(db)) return false
    const w = muscleWeights(db)[muscle] || 0
    return w > 0 && w >= (ctx.minContribution || 0)
  })
  const pool = complementary(eligible, muscle, ctx)
  if (!ctx.wantCompound) return pool
  const leads = pool.filter(
    (db) => db.type === 'compound' && muscleWeights(db)[muscle] >= COMPOUND_LEAD_MIN_CONTRIBUTION
  )
  return leads.length ? leads : pool
}

// Two rules that hold whenever the pool lets them, and give way, in this order,
// only when keeping them would leave the slot empty — a muscle going untrained
// is worse than either.
//
//   1. One heavy movement per muscle per day (`dayHeavy`, HEAVY_FATIGUE_SCORE).
//      Kept longest: it's about what the day can recover from.
//   2. Nothing the week already has, by movement or by family (`noWeekRepeats`,
//      generation only). Hani's rule: a week's days complement each other
//      rather than run the same workout again — the second-best quad movement
//      is nearly as good as the best, and a different one trains the muscle
//      from a different angle. But never at the cost of directness: the fresh
//      movements have to include one that trains the muscle as directly as the
//      best repeat would. A full gym never runs out; at home, three days of
//      side-delt focus with bands would otherwise end on a banded overhead
//      press, which is a shoulder press with some side delt in it.
//
// Swap suggestions pass `dayHeavy` but not `noWeekRepeats`: someone choosing a
// replacement should still see the movement they did on Monday, just ranked
// lower for it (PENALTIES.repeatExercise).
//
// Ahead of both sits the day's one-movement-per-job rule (oneJobPerDay), which
// can leave the slot empty on purpose.
function complementary(pool, muscle, ctx) {
  const jobs = oneJobPerDay(pool, muscle, ctx)
  if (!jobs.length) return jobs
  const spaced = ctx.dayHeavy?.size ? jobs.filter((db) => !ctx.dayHeavy.has(heavyMuscleOf(db))) : jobs
  const base = spaced.length ? spaced : jobs
  if (!ctx.noWeekRepeats) return base
  const directness = (list) => Math.max(0, ...list.map((db) => muscleWeights(db)[muscle] || 0))
  const fresh = base.filter((db) => !ctx.weekIds?.has(db.id) && !ctx.weekFamilies?.has(movementFamily(db)))
  return fresh.length && directness(fresh) >= directness(base) ? fresh : base
}

// Hani's rule (2026-10-03): a day holds one movement per job (SAME_JOB) — with
// a squat in it, a lunge is the same work again; with one row, a second row is.
//
// So once the day has a movement for a job, a slot looks elsewhere: to another
// job that is FOR its muscle (the muscle is its main mover, at least as a
// secondary mover) and that the week doesn't already have. A fly is a chest
// movement, not the front delts' after a press; a reverse curl is a forearm
// movement, not the biceps' after a row. If there's none and the day already
// trains the muscle properly (JOB_COVERED_MIN), the slot stays empty and its
// sets go onto that movement in the top-up pass — one row of four sets, not two
// rows of two. Only a muscle the day doesn't train properly yet may take a
// second movement for the job.
//
// Two days may repeat a job on purpose: a day built around one muscle lists the
// jobs it may (`repeatJobs`: two curls on an arm day), and a muscle the day
// emphasises may take a second ISOLATION down its own job (a second curl on the
// biceps day, never a second row or a lunge after the squat). Either way the
// repeat is FOR the muscle — a second curl for the biceps, not a reverse curl.
//
// Generation only (`oneJobPerDay`): a swap suggestion still offers the second
// row, ranked lower (PENALTIES.sameJobInDay).
function oneJobPerDay(pool, muscle, ctx) {
  if (!ctx.oneJobPerDay || !ctx.dayJobs?.size) return pool
  const repeatable = (db) =>
    (ctx.repeatJobs?.has(jobOf(db)) || (ctx.emphasised && db.type === 'isolation')) && primaryMuscleOf(db) === muscle
  const taken = (db) => ctx.dayJobs.has(jobOf(db)) && !repeatable(db)
  if (!pool.some(taken)) return pool
  let elsewhere = pool.filter(
    (db) => !taken(db) && primaryMuscleOf(db) === muscle && (muscleWeights(db)[muscle] || 0) >= JOB_ALTERNATIVE_MIN
  )
  // ...and one the week doesn't already have (`noWeekRepeats`): a second
  // overhead press of the week is no better for the side delts than a second
  // raise was. If that leaves nothing, the sets go onto what the day has.
  if (ctx.noWeekRepeats) elsewhere = elsewhere.filter((db) => !ctx.weekIds?.has(db.id) && !ctx.weekFamilies?.has(movementFamily(db)))
  if (elsewhere.length) return elsewhere
  return ctx.dayTrained?.has(muscle) ? [] : pool
}

// ---- Filling one day ---------------------------------------------------------

// Turn one template day plus its set allocation into a training day of real
// exercises.
//
// Three passes, in this order for a reason:
//
//   1. COVERAGE — one movement per muscle slot at the minimum set count, walking
//      the slots in priority order (focus first). Every muscle the day is
//      supposed to train gets on the board before anything gets seconds, so the
//      tail of the day is never crowded out by a greedy start.
//   2. SECOND MOVEMENTS — muscles still owing a lot get another angle.
//   3. TOP UP — whatever budget is left is spent a set at a time, priority
//      order, on the movement that's furthest from its own cap. Two movements of
//      three sets beats one of six, which is why depth comes after variety.
//
// Every pass credits ALL the muscles a chosen movement touches, not just the one
// whose slot asked for it — so a day that opens with a bench press has already
// paid down part of its triceps and front-delt debt and spends the room that
// frees somewhere it's actually needed. That single rule is what keeps a
// generated day from reading like a list of body parts.
export function fillDay(template, alloc, gaps, ctx) {
  const day = createDay('train', template.name)
  const remaining = { ...alloc }
  const dayIds = new Set()
  const dayFamilies = new Set()
  const dayJobs = new Set() // SAME_JOB
  const dayTrained = new Set() // muscles a movement already trains at JOB_COVERED_MIN
  const repeatJobs = template.repeatJobs ? new Set(template.repeatJobs) : null
  const dayHeavy = new Set() // muscles a heavy movement already leads today
  const compoundFor = new Set()
  const chosen = []
  let setsUsed = 0
  let load = 0

  const budgetUsed = () => clamp(load / (SYSTEMIC_CAPACITY * DAY_LOAD_TARGET), 0, 1)
  const loadRoom = () => load < SYSTEMIC_CAPACITY * DAY_LOAD_MAX
  // The day's hard-set cap (the volume preference). Unlike the load cap it is
  // never waived, coverage included: generateProgram has already scaled the
  // targets to fit it, so this only bites on what that estimate missed.
  const setCap = ctx.setCap ?? Infinity
  const setRoom = (n) => setsUsed + n <= setCap

  // Charge `sets` of `db` to the day: the set budget, the fatigue budget, and
  // every muscle it credits. An ab movement's sets stay off the set budget
  // (CORE_CATEGORY) — what it costs in fatigue is still charged, it's just small.
  function charge(db, sets) {
    if (!isCoreMovement(db)) setsUsed += sets
    load += setLoad(db) * sets
    for (const [m, w] of Object.entries(muscleWeights(db))) {
      if (remaining[m] != null) remaining[m] -= w * sets
    }
  }

  // The DIRECT_WORK muscles this day guarantees (assignDirectWork), until each
  // has its movement. Room for them is held from the start — a set budget and an
  // exercise count — so the slots ahead of them can't spend it. A guaranteed
  // slot is taken even when the compounds have already paid its allocation:
  // that's the point of it. What keeps it from adding volume is the day's set
  // cap, which generateProgram sizes from the week filled without guarantees.
  const pending = new Set(template.direct || [])
  const held = (muscle) => pending.size - (pending.has(muscle) ? 1 : 0)

  // The day's own `leadPaths`, else LEAD_PATHS — either way only where the day
  // has room for them: the partner still owed a movement of its own, and the
  // day able to hold every slot from here to the partner's, plus the direct
  // work it's holding room for. A day that can't is tight, and its one back
  // movement is whatever the scorer finds pays the most — a row, usually.
  function leadPathsFor(muscle) {
    const lead = LEAD_PATHS[muscle]
    const paths = template.leadPaths?.[muscle] || lead?.paths
    if (!paths) return null
    const partner = lead?.unlessShort
    const from = template.muscles.indexOf(muscle)
    const to = template.muscles.indexOf(partner)
    if (partner && to !== -1) {
      if ((remaining[partner] || 0) < MIN_SLOT_SETS * 2) return null
      const ahead = template.muscles.slice(from, Math.max(from, to) + 1)
      const toFill = template.muscles.filter(
        (m) =>
          !CORE_MUSCLES.includes(m) &&
          !chosen.some((c) => c.muscle === m) &&
          (pending.has(m) || (ahead.includes(m) && (remaining[m] || 0) >= MIN_SLOT_SETS))
      ).length
      const counted = chosen.filter((c) => !isCoreMovement(c.db)).length
      if (counted + toFill > ctx.posture.exerciseCap || !setRoom(MIN_SETS_PER_EXERCISE * toFill)) return null
    }
    return paths
  }

  function tryAdd(muscle, minOwed, { ignoreLoadCap = false } = {}) {
    const first = !chosen.some((c) => c.muscle === muscle)
    // A guaranteed direct movement, or a focus muscle on a day it's planned for,
    // is placed even when earlier days have already paid its sets: "more often"
    // is the point of a focus, and a week that front-loads the volume and then
    // skips the third session hasn't delivered it.
    const owedASlot = first && (pending.has(muscle) || ctx.focus.includes(muscle))
    if (!owedASlot && (remaining[muscle] || 0) < minOwed) return false
    // The day's movement count and set budget bind everything but its ab
    // movement, which counts toward neither — so a full day can still take one,
    // and only one: a second ab movement is just more crunches.
    const budgetFull =
      chosen.filter((c) => !isCoreMovement(c.db)).length + 1 + held(muscle) > ctx.posture.exerciseCap ||
      !setRoom(MIN_SETS_PER_EXERCISE * (1 + held(muscle)))
    const coreFree = !chosen.some((c) => isCoreMovement(c.db))
    if (budgetFull && !coreFree) return false
    if (!ignoreLoadCap && !loadRoom()) return false

    // On its guaranteed day a DIRECT_WORK muscle's first movement comes down its
    // own paths — a curl, an extension, a raise — rather than the compound lead,
    // which hands the triceps slot to a close-grip press. Its other days pick
    // the way they always have: once a week is the ask, and a push day opening
    // on an overhead press is still a good push day.
    //
    // A focus muscle opens EVERY one of its days down those paths, where it has
    // them: a side-delt focus leads with a raise even though the database lists
    // the side delts as the main mover of a behind-the-neck press.
    //
    // Any other muscle can have a path its first movement of the day comes down
    // (LEAD_PATHS, or the day's own `leadPaths`): the lats a pulldown, the
    // upper back a row, the hamstrings a leg curl on a quad day.
    const leadsFocus = first && ctx.focus.includes(muscle)
    // Every movement a day gives a muscle it emphasises is FOR that muscle: a
    // glute day opens on a hip thrust, not a split squat that lists the glutes
    // second, and a side-delt day's second movement is a raise, not a rear-delt
    // fly that brushes them.
    const emphasised = !!template.emphasis?.includes(muscle)
    const paths = first
      ? ((pending.has(muscle) || leadsFocus) && DIRECT_WORK[muscle]) || leadPathsFor(muscle) || null
      : null
    const pickCtx = {
      muscle,
      allowedEquipment: ctx.allowedEquipment,
      excludedEquipment: ctx.excludedEquipment,
      excludedOverload: ctx.excludedOverload,
      limiterPenalty: ctx.limiterPenalty,
      excludeLimited: ctx.excludeLimited,
      weights: ctx.weights,
      maxSkillRank: ctx.maxSkillRank,
      dayIds,
      dayFamilies,
      dayJobs,
      dayTrained,
      repeatJobs,
      emphasised,
      oneJobPerDay: true,
      dayHeavy,
      remaining,
      weekIds: ctx.weekIds,
      weekFamilies: ctx.weekFamilies,
      weekSignatures: ctx.weekSignatures,
      weekAtoms: ctx.weekAtoms,
      noWeekRepeats: ctx.noWeekRepeats,
      injuryRisk: ctx.injuryRisk,
      budgetUsed: budgetUsed(),
      hoursToNext: gaps[muscle],
      isFocus: ctx.focus.includes(muscle),
      // Only the muscle's FIRST movement of the day leads with a compound.
      wantCompound: !paths && !compoundFor.has(muscle) && first,
      patterns: paths,
      // A focus muscle opens on a movement it is the main mover of: bringing up
      // side delts means lateral raises first, not an overhead press that
      // happens to list them. Likewise a muscle the day emphasises, and any
      // movement down a muscle's own paths (DIRECT_WORK, `leadPaths`): a
      // reverse curl is elbow flexion, but it's a forearm movement.
      mainMover: leadsFocus || emphasised || !!paths,
    }

    const pick = (pctx) => {
      let top = null
      for (const db of candidates(muscle, pctx)) {
        if (isCoreMovement(db) ? !coreFree : budgetFull) continue
        const scored = scoreExercise(db, { ...pctx, familiarity: familiarity(db, ctx.history) })
        if (!scored) continue
        if (!top || scored.score > top.score) top = { db, ...scored }
      }
      return top
    }
    // Nothing down those paths with this equipment: fall back to the whole pool
    // and the usual compound lead, rather than leaving the muscle untrained.
    // Likewise a focus muscle with nothing it's the main mover of here.
    const best =
      pick(pickCtx) ||
      (pickCtx.mainMover ? pick({ ...pickCtx, mainMover: false }) : null) ||
      (paths ? pick({ ...pickCtx, mainMover: false, patterns: null, wantCompound: !compoundFor.has(muscle) }) : null)
    if (!best) return false

    pending.delete(muscle)
    chosen.push({ db: best.db, sets: MIN_SETS_PER_EXERCISE, muscle })
    dayIds.add(best.db.id)
    dayFamilies.add(movementFamily(best.db))
    if (jobOf(best.db)) dayJobs.add(jobOf(best.db))
    for (const [m, w] of Object.entries(muscleWeights(best.db))) if (w >= JOB_COVERED_MIN) dayTrained.add(m)
    const heavy = heavyMuscleOf(best.db)
    if (heavy) dayHeavy.add(heavy)
    ctx.weekIds.add(best.db.id)
    ctx.weekFamilies.add(movementFamily(best.db))
    ctx.weekSignatures.add(signature(best.db))
    for (const [atom, aw] of Object.entries(best.db.muscles || {})) {
      if (aw >= COVERAGE_MIN_WEIGHT) ctx.weekAtoms?.add(atom)
    }
    if (best.db.type === 'compound') compoundFor.add(muscle)
    charge(best.db, MIN_SETS_PER_EXERCISE)
    return true
  }

  // 1 — coverage. The load cap is waived here: a muscle the day is supposed to
  // train getting nothing at all is worse than a day that reads heavy, and the
  // cap still governs everything after this.
  for (const muscle of template.muscles) tryAdd(muscle, MIN_SLOT_SETS, { ignoreLoadCap: true })
  // A guarantee that couldn't be placed (no movement at all for it here) stops
  // holding room once coverage is done.
  pending.clear()
  // 2 — a second angle for whatever still owes a movement's worth, except the
  // muscles whose second angle belongs to another day (`oneMovement`)
  for (const muscle of template.muscles) {
    if (!template.oneMovement?.includes(muscle)) tryAdd(muscle, MIN_SLOT_SETS * 2)
  }
  // 3 — spend the remainder a set at a time
  for (let pass = 0; pass < MAX_TOP_UP_PASSES; pass++) {
    let added = false
    for (const muscle of template.muscles) {
      if (!loadRoom() || (remaining[muscle] || 0) < 1) continue
      // Once the set budget is spent, only the ab movement can still take a set.
      const open = setRoom(1) ? () => true : (c) => isCoreMovement(c.db)
      // Prefer the muscle's own movements, furthest from their cap first, so its
      // sets stay spread rather than piling onto whichever came first. Failing
      // that, ANY movement in the day that trains it properly will do — that's
      // how a set gets added to the row rather than nothing to the biceps.
      const row =
        pickRow(chosen, (c) => open(c) && c.muscle === muscle) ||
        pickRow(chosen, (c) => open(c) && (muscleWeights(c.db)[muscle] || 0) >= 0.5)
      if (!row) continue
      row.sets++
      charge(row.db, 1)
      added = true
    }
    if (!added) break
  }

  function pickRow(rows, match) {
    return rows
      .filter((c) => c.sets < ctx.posture.maxSetsPerExercise && match(c))
      .sort((a, b) => a.sets - b.sets)[0]
  }

  // Every row carries the SLOT it was picked for, not just the pick: the
  // movement path the day wanted here and the muscle it wanted it for. That is
  // what the split page and the logger read to offer "any vertical pull"
  // instead of one pulldown, and what a swap is checked against.
  //
  // `openSlots` decides whether the pick is committed. Open leaves the row
  // reading as its path with the pick kept as `suggestedId` — so the day still
  // costs and grades exactly the same (see plannedExerciseDbId), it just hasn't
  // decided yet. Either way the row is UNPINNED: the generator proposes, it
  // doesn't insist.
  const effort = chosen.map(({ db }) => ({ db, rirTarget: rirTargetForExercise(db, ctx.experience, ctx.volumePref) }))
  markFailureSets(effort, ctx.volumePref.failureSetsPerDay || 0)
  day.exercises = chosen.map(({ db, sets, muscle }, i) => plannedRow(db, sets, muscle, effort[i].rirTarget, ctx))
  return day
}

function plannedRow(db, sets, muscle, rirTarget, ctx) {
  const slot = { pattern: db.pattern || null, muscle, pinned: false, suggestedId: db.id }
  const open = ctx.openSlots && db.pattern
  return createPlannedExercise(open ? patternPhrase(db.pattern) : db.name, {
    exerciseId: open ? null : db.id,
    kind: 'strength',
    sets,
    repRange: repRangeForExercise(db, ctx.history),
    rirTarget,
    slot,
  })
}

// One more movement for a focus muscle on a finished day, picked by the same
// scorer under the same hard rules fillDay uses — nothing the day or the week
// already has, no second heavy movement for a muscle, and one the muscle is the
// main mover of — and placed straight after
// the muscle's own movements, so the day still opens on it.
function addFocusMovement(day, muscle, trainingDays, ctx, repeatJobs = null) {
  const dbOf = (e) => DB_BY_ID.get(plannedExerciseDbId(e) || '')
  const today = day.exercises.map(dbOf).filter(Boolean)
  const week = trainingDays.flatMap((d) => d.exercises).map(dbOf).filter(Boolean)
  const load = day.exercises.reduce((n, e) => n + (dbOf(e) ? setLoad(dbOf(e)) * e.sets : 0), 0)
  const pickCtx = {
    muscle,
    allowedEquipment: ctx.allowedEquipment,
    excludedEquipment: ctx.excludedEquipment,
    excludedOverload: ctx.excludedOverload,
    limiterPenalty: ctx.limiterPenalty,
    excludeLimited: ctx.excludeLimited,
    weights: ctx.weights,
    maxSkillRank: ctx.maxSkillRank,
    dayIds: new Set(today.map((db) => db.id)),
    dayFamilies: new Set(today.map(movementFamily)),
    dayJobs: new Set(today.map(jobOf).filter(Boolean)),
    dayTrained: new Set(today.flatMap((db) => Object.entries(muscleWeights(db)).filter(([, w]) => w >= JOB_COVERED_MIN).map(([m]) => m))),
    repeatJobs: repeatJobs ? new Set(repeatJobs) : null,
    oneJobPerDay: true,
    dayHeavy: new Set(today.map(heavyMuscleOf).filter(Boolean)),
    weekIds: new Set(week.map((db) => db.id)),
    weekFamilies: new Set(week.map(movementFamily)),
    weekSignatures: new Set(week.map(signature)),
    noWeekRepeats: true,
    injuryRisk: ctx.injuryRisk,
    budgetUsed: clamp(load / (SYSTEMIC_CAPACITY * DAY_LOAD_TARGET), 0, 1),
    isFocus: true,
    // Real work for the muscle, not a movement that lists it in passing.
    mainMover: true,
  }
  // One ab movement a day, as in fillDay.
  const coreToday = today.some(isCoreMovement)
  let top = null
  for (const db of candidates(muscle, pickCtx)) {
    if (coreToday && isCoreMovement(db)) continue
    const scored = scoreExercise(db, { ...pickCtx, familiarity: familiarity(db, ctx.history) })
    if (scored && (!top || scored.score > top.score)) top = { db, score: scored.score }
  }
  if (!top) return false
  const row = plannedRow(top.db, MIN_SETS_PER_EXERCISE, muscle, rirTargetForExercise(top.db, ctx.experience, ctx.volumePref), ctx)
  const after = day.exercises.findLastIndex((e) => e.slot?.muscle === muscle)
  day.exercises.splice(after + 1, 0, row)
  return true
}

// The systemic cost of one set, mirroring the per-set deposit in planStats.js
// (and engine.js with the RIR term left at 1) so the day this builds grades the
// same here as it will on its own day card.
export function setLoad(db) {
  const coef = FATIGUE_SCORE_COEF[db.fatigueScore ?? DEFAULT_FATIGUE_SCORE] || 1
  return coef * (db.axialLoading ? AXIAL_MULT : 1) * (db.equipment === 'free weight' ? FREE_WEIGHT_MULT : 1)
}

// Effort target for a movement's WORKING sets: the training-age range for its
// type, shifted by the volume preference, never below MIN_WORKING_RIR. Whether
// its last set goes to failure is decided per day (markFailureSets), not here.
export function rirTargetForExercise(db, experience, volumePref = volumePreference()) {
  const byType = RIR_TARGETS[experience] || RIR_TARGETS[DEFAULT_EXPERIENCE]
  const base = db.type === 'compound' ? byType.compound : byType.isolation
  const shift = volumePref.rirShift || 0
  const low = Math.max(MIN_WORKING_RIR, base.low + shift)
  const high = Math.max(low, base.high + shift)
  return { low, high }
}

// Can this movement's last set safely go to failure? Isolations, and machine or
// cable compounds — never free weights or bodyweight compounds, never a heavy
// lift even on a machine, and not an isometric hold.
export function failureSafe(db) {
  if (!db || (db.fatigueScore ?? 0) >= FAILURE_MAX_FATIGUE_SCORE) return false
  if (db.type === 'isolation') return true
  return db.type === 'compound' && (db.equipment === 'machine' || db.equipment === 'cable')
}

// Give the day's last `count` failure-safe movements a last set to failure.
// Last, because the extra fatigue then lands where nothing else in the session
// has to pay for it.
function markFailureSets(rows, count) {
  let left = count
  for (let i = rows.length - 1; i >= 0 && left > 0; i--) {
    if (!failureSafe(rows[i].db)) continue
    rows[i].rirTarget = { ...rows[i].rirTarget, lastSetFailure: true }
    left--
  }
}

// Rep target: their own logged range for this movement when they have one —
// brought under MAX_REPS, keeping room to progress — else the shape of the
// movement decides.
function repRangeForExercise(db, history) {
  const rec = history?.familiar.get(db.id)
  if (rec && rec.reps.length >= 2) {
    const own = repRangeFor(rec.reps)
    const high = Math.min(own.high, MAX_REPS)
    return { low: Math.max(1, Math.min(own.low, high - MIN_REP_SPAN)), high }
  }
  if (db.type === 'compound') {
    return { ...((db.fatigueScore ?? 0) >= 4 ? REP_RANGES.heavyCompound : REP_RANGES.compound) }
  }
  return { ...REP_RANGES.isolation }
}

// ---- Trimming the overshoot --------------------------------------------------

// Weekly contribution-weighted sets per muscle across the training days, using
// the same accounting the day cards and the dashboard use.
function weeklyMuscleSets(trainingDays, perWeek) {
  const out = {}
  for (const day of trainingDays) {
    for (const row of dayStats(day).muscles) out[row.muscle] = (out[row.muscle] || 0) + row.sets * perWeek
  }
  return out
}

// The days are filled one muscle slot at a time, so a muscle that rides along on
// everyone else's work can end the week over its ceiling even though nothing ever
// allocated it that much — glutes, after squats and hinges and lunges and hip
// thrusts have all had their say. This walks the finished week back down.
//
// It is the same move the advisor recommends to users, applied to the plan before
// they ever see it: when volume outruns what it's worth, take sets off the
// movement driving it and leave everything else training. Never a set that would
// drop another muscle below its minimum — that's robbing one to pay another.
//
// A DIRECT_WORK muscle is also held to its weekly target (plus a little slack),
// because its guaranteed slot spends sets the compounds had already covered —
// that must come back out rather than raise what the volume setting asked for.
// Only the muscle's OWN movements give sets back for that: a press doesn't lose
// a set because the triceps extension beside it went over.
export function trimOvershoot(trainingDays, { perWeek, focus = [], targets = {} }) {
  const limitFor = (m) => ceilingFor(m) * (focus.includes(m) ? ADVISOR_BLOCK_SLACK : 1)
  const targetFor = (m) => (DIRECT_WORK[m] && targets[m] != null ? targets[m] + DIRECT_WORK_TARGET_SLACK : Infinity)
  const stuck = new Set() // over target with nothing of its own left to trim

  for (let guard = 0; guard < 60; guard++) {
    const weekly = weeklyMuscleSets(trainingDays, perWeek)
    let worst = null
    for (const [muscle, sets] of Object.entries(weekly)) {
      const overCeiling = sets - limitFor(muscle)
      const over = Math.max(overCeiling, stuck.has(muscle) ? 0 : sets - targetFor(muscle))
      if (over > 0 && (!worst || over > worst.over)) worst = { muscle, over, ownOnly: overCeiling <= 0 }
    }
    if (!worst) return

    // The row contributing most to the offender that can afford to lose a set
    // without pulling one of its other muscles under.
    let victim = null
    for (const day of trainingDays) {
      for (const planned of day.exercises) {
        if (planned.sets <= MIN_SETS_PER_EXERCISE) continue
        if (worst.ownOnly && planned.slot?.muscle !== worst.muscle) continue
        const weights = muscleWeights(DB_BY_ID.get(plannedExerciseDbId(planned)))
        const w = weights[worst.muscle] || 0
        if (!w) continue
        const robs = Object.entries(weights).some(
          ([m, mw]) => m !== worst.muscle && (weekly[m] || 0) - mw * perWeek < mevFor(m)
        )
        if (robs) continue
        if (!victim || w > victim.w) victim = { planned, w }
      }
    }
    if (!victim) {
      if (!worst.ownOnly) return
      stuck.add(worst.muscle)
      continue
    }
    victim.planned.sets--
  }
}

// Take sets back off the week until it holds no more than `total`. Used when a
// day had to be given room for its DIRECT_WORK guarantees beyond what it held on
// its own: those sets come back out of whatever muscle is furthest past its
// weekly target, one at a time, never below a movement's minimum and never
// pulling another muscle under its minimum. Never off the ab movement either:
// its sets aren't in the total, so taking one frees nothing.
function giveBack(trainingDays, total, { perWeek, targets, floors = {} }) {
  for (let guard = 0; guard < 60; guard++) {
    if (trainingDays.reduce((n, d) => n + daySets(d), 0) <= total) return
    const weekly = weeklyMuscleSets(trainingDays, perWeek)
    let victim = null
    for (const day of trainingDays) {
      for (const planned of day.exercises) {
        if (planned.sets <= MIN_SETS_PER_EXERCISE || isCoreRow(planned)) continue
        const muscle = planned.slot?.muscle
        if (!muscle || targets[muscle] == null) continue
        const weights = muscleWeights(DB_BY_ID.get(plannedExerciseDbId(planned)))
        const robs = Object.entries(weights).some(([m, mw]) => (weekly[m] || 0) - mw * perWeek < Math.max(mevFor(m), floors[m] || 0))
        if (robs) continue
        const surplus = (weekly[muscle] || 0) - targets[muscle]
        if (!victim || surplus > victim.surplus) victim = { planned, surplus }
      }
    }
    if (!victim) return
    victim.planned.sets--
  }
}

// ---- Assembling the program --------------------------------------------------

// Lay the training days out over the cycle, with rest days in the gaps. A fixed
// week comes out as exactly 7 days Mon→Sun, which is how program.js infers a
// weekly schedule — there's no mode flag to set.
export function buildProgram(trainingDays, { length, offsets }, name) {
  const program = emptyProgram(name)
  const byOffset = new Map(offsets.map((o, i) => [o, trainingDays[i]]))
  for (let i = 0; i < length; i++) {
    const day = byOffset.get(i)
    program.days.push(day || createDay('rest'))
  }
  return program
}

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// What the split is called: the focus if there is one, else its shape.
function suggestName(focus, daysPerWeek) {
  if (focus.length) return `${focus.slice(0, 2).join(' + ')} focus`
  return `${daysPerWeek}-day split`
}

// ---- The proposal ------------------------------------------------------------

// Everything the preview renders, derived from the finished program rather than
// from the intermediate steps — so what's shown is what will be created. Weekly
// volume is the sum of each training day's dayStats, normalised to a week for a
// rotation whose cycle isn't 7 days long.
export function summarize(program, { targets, schedule, cycle, inputs, shape = null }) {
  const weekly = {}
  const days = []
  const perWeek = 7 / cycle.length

  // One row as the preview lists it. A cardio row carries its prescription
  // instead of a rep target.
  const rowSummary = (e) => ({
    id: e.id,
    name: e.name,
    kind: e.kind === 'cardio' ? 'cardio' : 'strength',
    cardio: e.kind === 'cardio' ? cardioOf(e) : null,
    sets: e.sets,
    repRange: e.repRange,
    rirTarget: e.rirTarget || null,
    pattern: e.slot?.pattern || null,
    open: !!e.slot && !e.exerciseId,
    core: e.kind !== 'cardio' && isCoreRow(e),
    supersetId: e.supersetId || null,
  })

  program.days.forEach((day, i) => {
    if (day.kind === 'rest') {
      days.push({
        id: day.id,
        kind: 'rest',
        name: 'Rest',
        weekday: schedule === 'weekly' ? WEEKDAY_NAMES[i] : null,
        // A rest day can hold optional cardio, and nothing else.
        exercises: (day.exercises || []).map(rowSummary),
      })
      return
    }
    const stats = dayStats(day)
    for (const row of stats.muscles) weekly[row.muscle] = (weekly[row.muscle] || 0) + row.sets
    days.push({
      id: day.id,
      kind: 'train',
      name: day.name,
      weekday: schedule === 'weekly' ? WEEKDAY_NAMES[i] : null,
      // What the day spends of its set cap, and the ab sets on top of it.
      sets: stats.sets - stats.coreSets,
      coreSets: stats.coreSets,
      load: stats.load,
      lead: stats.muscles.slice(0, 3).map((m) => m.muscle),
      // What this day trains, rolled up for the day's donut. Same weighted rows
      // the muscle bars use, so the chart and the numbers can never disagree.
      donut: donutRows(stats.muscles),
      exercises: day.exercises.map(rowSummary),
    })
  })

  const focus = new Set(inputs.focus)
  const pickCtx = {
    allowedEquipment: inputs.allowedEquipment,
    excludedEquipment: inputs.excludedEquipment,
    excludedOverload: inputs.excludedOverload,
    excludeLimited: inputs.excludeLimited,
    maxSkillRank: SKILL_RANK[inputs.posture.maxSkill] ?? 2,
  }
  const volume = ENGINE_MUSCLES.map((muscle) => {
    const sets = round1((weekly[muscle] || 0) * perWeek)
    const tier = volumeTier(sets, muscle)
    return {
      muscle,
      sets,
      target: targets[muscle] ?? null,
      tier,
      status: tier.id,
      focus: focus.has(muscle),
      sessions: program.days.filter((d) => d.kind !== 'rest' && dayHits(d, muscle)).length,
      // Whether the library holds anything at all for this muscle at this
      // equipment level. A muscle that got nothing because there IS nothing (an
      // at-home calf raise, today) is a different message from one that got
      // squeezed out of the session, and the preview says which.
      available: sets > 0 || candidates(muscle, pickCtx).length > 0,
    }
  }).filter((row) => row.sets > 0 || row.target != null)

  // Which movement paths the week covers, and how much of it goes down each.
  //
  // The volume table below says which MUSCLES the week trains; this says how it
  // trains them. They answer different questions and a split can look fine on
  // one and wrong on the other — a chest number that adds up entirely out of
  // flat presses is a week with no incline path in it, which the muscle table
  // has no way to show.
  const patternSets = new Map()
  for (const day of program.days) {
    if (day.kind === 'rest') continue
    for (const e of day.exercises || []) {
      const db = DB_BY_ID.get(plannedExerciseDbId(e) || '')
      if (!db?.pattern) continue
      patternSets.set(db.pattern, (patternSets.get(db.pattern) || 0) + (Number(e.sets) || 0))
    }
  }
  const patterns = PATTERN_IDS.filter((id) => patternSets.has(id)).map((id) => ({
    id,
    label: getPattern(id)?.label || id,
    group: getPattern(id)?.group || null,
    sets: round1(patternSets.get(id) * perWeek),
  }))

  // A focus muscle that didn't reach its target frequency. Someone who named a
  // muscle asked for it to be trained more often; where the shape can't deliver
  // that, they should be told rather than left to count the days themselves.
  //
  // Measured on `sessions` — days that actually train the muscle at all — not on
  // the template's slots, because a muscle picks up real work from movements
  // that were chosen for something else, and that counts.
  const focusShortfall = inputs.focus
    .map((m) => volume.find((v) => v.muscle === m))
    .filter((v) => v && v.sessions < FOCUS_TARGET_FREQUENCY)
    .map((v) => ({
      muscle: v.muscle,
      sessions: v.sessions,
      // Two different reasons, and they deserve different sentences: there
      // aren't enough training days in the week at all, or there are, but none
      // of the others train that half of the body.
      reason: inputs.daysPerWeek < FOCUS_TARGET_FREQUENCY ? 'days' : 'shape',
    }))

  const training = program.days.filter((d) => d.kind !== 'rest').length
  return {
    schedule,
    shapeLabel:
      schedule === 'weekly'
        ? `Fixed week · ${training} training day${training !== 1 ? 's' : ''}`
        : `${program.days.length}-day rotation · ${training} training day${training !== 1 ? 's' : ''}`,
    shape: shape ? { id: shape.id, name: shape.name, note: shape.note } : null,
    // A rotation whose cycle is not 7 days long reports an AVERAGE week, and the
    // preview has to say so — every landmark in engineConfig is weekly, so this
    // is the only form that can be graded, but an averaged number must never be
    // mistaken for a literal one.
    cycleLength: cycle.length,
    perWeek,
    fromHistory: !!inputs.history,
    historySessions: inputs.history?.sessions || 0,
    focus: inputs.focus,
    daysPerWeek: inputs.daysPerWeek,
    equipmentPreset: inputs.equipmentPreset,
    days,
    volume,
    patterns,
    focusShortfall,
  }
}

// Does this day train `muscle` at all (any contribution)? Used for the
// frequency readout, which is a claim about sessions, not about sets.
function dayHits(day, muscle) {
  return (day.exercises || []).some((e) => {
    const db = DB_BY_ID.get(plannedExerciseDbId(e) || '')
    return db ? (muscleWeights(db)[muscle] || 0) > 0 : false
  })
}

// ---- Swapping one movement ---------------------------------------------------

// Which equipment a swap is allowed to reach for, read off the split itself
// rather than asked for again. Someone whose whole split is push-ups and band
// work should not be offered a cable machine; someone with one cable row in
// there evidently has a gym. Only a split that is ENTIRELY at-home, and big
// enough for that to mean something, gets restricted — anything else opens up,
// because guessing a constraint that isn't there is worse than not guessing.
function equipmentUniverse(program) {
  const kinds = new Set()
  for (const day of program?.days || []) {
    for (const planned of day.exercises || []) {
      const db = DB_BY_ID.get(plannedExerciseDbId(planned) || '')
      if (db) kinds.add(db.equipment)
    }
  }
  if (kinds.size >= 1 && kinds.size <= AT_HOME_EQUIPMENT.length && [...kinds].every((k) => AT_HOME_EQUIPMENT.includes(k))) {
    // Three movements is the least that reads as a deliberate at-home split
    // rather than a split someone has only just started writing.
    let n = 0
    for (const day of program.days) n += (day.exercises || []).length
    if (n >= 3) return new Set(AT_HOME_EQUIPMENT)
  }
  return new Set(ALL_EQUIPMENT)
}

// Hours from `dayIndex` to the next day in the program that trains `muscle`,
// wrapping around. Works for both schedule shapes without asking which: a
// program's own day list IS its cycle, and rest days are slots in it either way.
function gapToNextSession(program, dayIndex, muscle) {
  const len = program.days.length || 1
  for (let step = 1; step <= len; step++) {
    const j = (dayIndex + step) % len
    const day = program.days[j]
    if (day.kind !== 'rest' && dayHits(day, muscle)) return step * HOURS_PER_DAY
  }
  return len * HOURS_PER_DAY
}

// The muscle a planned row is really there for: the one it trains hardest.
//
// Plenty of rows train two muscles equally hard — "Seated Cable Row, Wide Grip"
// lists Rear Delts 1.0 and Mid Back 1.0 — and taking whichever the JSON happened
// to list first is how a row ends up offering you rear-delt flies. Ties go to
// what the row says it IS: its Sub Category names an engine muscle outright, and
// failing that its Home Category narrows it to a body region.
export function primaryMuscleOf(db) {
  const weights = muscleWeights(db)
  const max = Math.max(0, ...Object.values(weights))
  if (!max) return null
  const tied = ENGINE_MUSCLES.filter((m) => weights[m] === max)
  if (tied.length === 1) return tied[0]
  if (db.subCategory && tied.includes(db.subCategory)) return db.subCategory
  return tied.find((m) => ENGINE_MUSCLE_TO_COARSE[m] === db.category) || tied[0]
}

// Why this alternative, in one line. Ordered by what a person would actually
// notice first, and only ever claiming something the database says outright —
// the first true statement wins, so each suggestion carries its single most
// relevant reason rather than a paragraph of hedged ones.
function swapReason(db, current, ctx) {
  const fatigueDrop = (current.fatigueScore ?? 3) - (db.fatigueScore ?? 3)
  const sfrGain = (SFR_SCORE[db.sfr] ?? 0) - (SFR_SCORE[current.sfr] ?? 0)
  const hpGain = (HP_SCORE[db.hypertrophyPotential] ?? 0) - (HP_SCORE[current.hypertrophyPotential] ?? 0)
  const skillDrop = (SKILL_RANK[current.skill] ?? 1) - (SKILL_RANK[db.skill] ?? 1)
  const window = db.recoveryWindowHours || DEFAULT_RECOVERY_WINDOW
  const currentWindow = current.recoveryWindowHours || DEFAULT_RECOVERY_WINDOW
  const mid = (window[0] + window[1]) / 2
  const currentMid = (currentWindow[0] + currentWindow[1]) / 2

  if (ctx.hoursToNext && currentMid > ctx.hoursToNext && mid <= ctx.hoursToNext) {
    return `Recovers in time for your next ${ctx.muscle.toLowerCase()} session`
  }
  if (fatigueDrop >= 2 || (current.axialLoading && !db.axialLoading)) return 'Same muscles, much less systemic fatigue'
  if (ctx.weeksSince != null && ctx.weeksSince >= 6) return `You haven't trained this in ${ctx.weeksSince} weeks`
  if (sfrGain > 0 && fatigueDrop >= 0) return 'Better stimulus-to-fatigue for the same work'
  if (hpGain > 0) return 'Rated higher for growth on this muscle'
  if (db.stretchMediated === 'yes' && current.stretchMediated !== 'yes') return 'Loads the muscle in the stretched position'
  if (skillDrop > 0) return 'Simpler to set up and execute'
  if (db.equipment !== current.equipment) return `Same job, ${db.equipment === 'bodyweight' ? 'no equipment' : `on the ${db.equipment}`}`
  if (movementFamily(db) === movementFamily(current)) return 'The same movement from a different angle'
  return `Trains ${ctx.muscle.toLowerCase()} about as directly`
}

// Everything situational about one planned row's slot, gathered once.
//
// Both "give me something else" (suggestAlternatives) and "show me this whole
// movement path" (patternOptions) rank with the generator's own scorer, and they
// have to rank it in the SAME context or the two panels would quietly disagree
// about what a good vertical pull is. So the context is built here, once, and
// each of them narrows it.
//
// Resolves through plannedExerciseDbId, so an OPEN slot works too: the row has
// no committed movement, but its slot still carries the one the generator would
// have picked, and that is a perfectly good thing to rank against.
function slotContext(planned, { program, dayId, sessions = [], injuries = [], now = Date.now() } = {}) {
  if (!planned || planned.kind === 'cardio' || !program) return null
  const currentDb = DB_BY_ID.get(plannedExerciseDbId(planned) || '')
  if (!currentDb) return null // custom movement: nothing to compare it against

  const dayIndex = program.days.findIndex((d) => d.id === dayId)
  const day = dayIndex === -1 ? null : program.days[dayIndex]
  if (!day) return null

  // The slot's own muscle outranks the movement's, because the slot is what the
  // day asked for — a row that has drifted through a couple of swaps should
  // still be ranked for the job it was put there to do.
  const slotMuscle = planned.slot?.muscle
  const muscle = (slotMuscle && ENGINE_MUSCLES.includes(slotMuscle) ? slotMuscle : null) || primaryMuscleOf(currentDb)
  if (!muscle) return null

  // Everything else in the day is off the table; everything else in the WEEK is
  // merely discouraged, through the scorer's own repeat penalties.
  //
  // "Else" is measured against the PLAN row, because the caller may be holding a
  // session exercise rather than a plan row — the logger passes what you are
  // mid-way through logging, and its id is a session id. Without the plan link
  // the row would fail to recognise itself and filter its own movement (and
  // every variant of it) out of its own picker.
  const selfPlannedId = planned.plannedExerciseId || planned.id
  const dayIds = new Set()
  const dayFamilies = new Set()
  const dayJobs = new Set()
  const dayHeavy = new Set()
  let load = 0
  for (const other of day.exercises) {
    const db = DB_BY_ID.get(plannedExerciseDbId(other) || '')
    if (!db) continue
    if (other.id !== selfPlannedId) {
      dayIds.add(db.id)
      dayFamilies.add(movementFamily(db))
      if (jobOf(db)) dayJobs.add(jobOf(db))
      const heavy = heavyMuscleOf(db)
      if (heavy) dayHeavy.add(heavy)
      load += setLoad(db) * (Number(other.sets) || 0)
    }
  }
  const weekIds = new Set()
  const weekFamilies = new Set()
  const weekSignatures = new Set()
  for (const other of program.days) {
    if (other.id === dayId) continue
    for (const row of other.exercises || []) {
      const db = DB_BY_ID.get(plannedExerciseDbId(row) || '')
      if (!db) continue
      weekIds.add(db.id)
      weekFamilies.add(movementFamily(db))
      weekSignatures.add(signature(db))
    }
  }

  const history = historyContext(sessions, { now })
  const sets = Math.max(1, Number(planned.sets) || 1)
  const allowedEquipment = equipmentUniverse(program)
  // A split that reaches beyond at-home equipment is a gym split, and gets the
  // gym's posture: loadability and stability weighted up, bands and un-loadable
  // movements off the table. An at-home split keeps the neutral weights and the
  // whole at-home pool, because there is nothing better available to it.
  const atGym = allowedEquipment.size > AT_HOME_EQUIPMENT.length
  const base = {
    muscle,
    allowedEquipment,
    excludedEquipment: atGym ? new Set(GYM_EXCLUDED_EQUIPMENT) : new Set(),
    excludedOverload: atGym ? new Set(GYM_EXCLUDED_OVERLOAD) : new Set(),
    // A generated split remembers the experience it was written for; one they
    // wrote themselves gets the default's softer penalty rather than the filter.
    ...limiterPolicy(program.settings?.experience, atGym),
    weights: atGym ? { ...WEIGHTS, ...GYM_WEIGHTS } : WEIGHTS,
    maxSkillRank: SKILL_RANK.high, // a split they wrote themselves; only the very hardest is held back
    dayIds,
    dayFamilies,
    dayJobs,
    dayHeavy,
    weekIds,
    weekFamilies,
    weekSignatures,
    exclude: new Set([currentDb.id]),
    budgetUsed: clamp(load / (SYSTEMIC_CAPACITY * DAY_LOAD_TARGET), 0, 1),
    hoursToNext: gapToNextSession(program, dayIndex, muscle),
    // Debt relief measured against what the row being replaced was covering, so
    // a swap is offered like for like: an alternative that also carries this
    // day's triceps work scores the way the movement it's replacing did.
    remaining: Object.fromEntries(Object.entries(muscleWeights(currentDb)).map(([m, w]) => [m, w * sets])),
    minContribution: (muscleWeights(currentDb)[muscle] || 0) * SWAP_MIN_CONTRIBUTION_RATIO,
    wantCompound: currentDb.type === 'compound',
    // suggestAlternatives builds its own ctx rather than going through
    // resolveInputs, so the injury map has to be threaded in separately — miss
    // this and the generator would avoid a movement the swap panel then offers.
    injuryRisk: injuryRiskMap(injuries, POOL),
  }

  return { base, currentDb, muscle, history, now }
}

// Rank a candidate list with the generator's own scorer. Shared tail of both
// entry points below, so a movement can never rank differently in the two.
function rankWithin(muscle, base, history) {
  const scored = []
  for (const db of candidates(muscle, base)) {
    const result = scoreExercise(db, { ...base, familiarity: familiarity(db, history) })
    if (!result) continue
    scored.push({ db, score: result.score })
  }
  return scored.sort((a, b) => b.score - a.score)
}

// Alternatives to one planned movement, best first.
//
// Runs the generator's own scorer against the muscle the row is there for, in
// the context it is actually sitting in: what else is in that day, how much
// fatigue the day is already carrying, and how long until the muscle is trained
// again. So the answer to "give me something else for this slot" changes
// depending on where the slot is, which is the whole point — the same two
// movements are not equally good on a fresh day and a fried one.
//
// Every option says whether it is the same movement PATH as what is there now,
// so the panel can separate a true substitute from a different angle.
//
// Nothing is mutated; the caller applies a choice through substituteExercise,
// which keeps the sets, the rep target and the note exactly as planned.
export function suggestAlternatives(planned, { program, dayId, sessions = [], injuries = [], now = Date.now(), limit = 4 } = {}) {
  const ctx = slotContext(planned, { program, dayId, sessions, injuries, now })
  if (!ctx) return []
  const { base, currentDb, muscle, history } = ctx

  return rankWithin(muscle, base, history).slice(0, limit).map(({ db, score }) => {
    const seen = history?.familiar.get(db.id)
    const weeksSince = seen ? Math.floor((now - seen.lastDate) / (7 * DAY_MS)) : null
    return {
      id: db.id,
      name: db.name,
      category: db.category,
      // The muscle the ranking was done for — carried on every option so the UI
      // can say what it optimised for instead of asking the reader to infer it.
      muscle,
      score: round1(score),
      // Whether this is the same movement path as what is there now. The panel
      // groups on it: swapping WITHIN the path is a true like-for-like
      // substitute, swapping across it is a different angle on the same muscle,
      // and those are different decisions that deserve different headings.
      pattern: db.pattern || null,
      samePattern: !!db.pattern && db.pattern === currentDb.pattern,
      reason: swapReason(db, currentDb, { ...base, weeksSince }),
    }
  })
}

// Every movement down one path that trains this slot's muscle, best first.
//
// This is the list behind "any vertical pull". It is deliberately the SAME
// scorer and the SAME hard filters the generator used to write the split, run in
// the slot's real context — what else is in the day, how much fatigue the day is
// already carrying, how long until the muscle is trained again, your open
// injuries, and the equipment the split itself implies you have. So the order
// you are offered is the order the generator would have picked in, and taking
// the top one gives you back exactly what it proposed.
//
// `pattern` defaults to the slot's own path; pass one to browse a different
// path. Nothing is mutated — the caller applies a choice through
// substituteExercise.
export function patternOptions(planned, { program, dayId, sessions = [], injuries = [], now = Date.now(), pattern, limit = PATTERN_OPTION_LIMIT } = {}) {
  const ctx = slotContext(planned, { program, dayId, sessions, injuries, now })
  if (!ctx) return []
  const path = pattern || planned.slot?.pattern || ctx.currentDb.pattern
  if (!path) return []

  const { currentDb, history } = ctx
  let { muscle } = ctx
  let base = {
    ...ctx.base,
    pattern: path,
    // Browsing a path, not hunting a replacement: show everything on it that
    // trains this muscle at all and let the ranking speak, rather than imposing
    // the swap panel's "at least as direct as what is there" floor. Nothing is
    // excluded either — for an open slot the generator's own suggestion belongs
    // in the list, and for a filled one, seeing where the current pick sits is
    // the most useful thing the list can show.
    minContribution: 0,
    exclude: new Set(),
    wantCompound: false,
  }

  // A slot can be filled by a movement its muscle only rides along on — a
  // Copenhagen adduction picked for the abs, toes-to-bar for the lats — and
  // down that movement's path nothing else trains the slot's muscle at all, so
  // the list would hold the current movement and nothing to swap it for. Then
  // the path is ranked for what the movement mainly trains: "other ways to do
  // this movement" is the question being asked.
  let ranked = rankWithin(muscle, base, history)
  const own = primaryMuscleOf(currentDb)
  if (own && own !== muscle && !ranked.some(({ db }) => db.id !== currentDb.id)) {
    const dayIndex = program.days.findIndex((d) => d.id === dayId)
    muscle = own
    base = { ...base, muscle, hoursToNext: gapToNextSession(program, dayIndex, muscle) }
    ranked = rankWithin(muscle, base, history)
  }

  return ranked.slice(0, limit).map(({ db, score }) => {
    const seen = history?.familiar.get(db.id)
    const weeksSince = seen ? Math.floor((ctx.now - seen.lastDate) / (7 * DAY_MS)) : null
    return {
      id: db.id,
      name: db.name,
      category: db.category,
      equipment: db.equipment,
      muscle,
      pattern: path,
      score: round1(score),
      current: !!planned.exerciseId && db.id === planned.exerciseId,
      suggested: db.id === (planned.slot?.suggestedId || null),
      reason:
        db.id !== currentDb.id
          ? swapReason(db, currentDb, { ...base, weeksSince })
          : planned.exerciseId
            ? 'What you have here now'
            : 'What the generator would pick for this slot',
    }
  })
}

// Build a split. `answers` is what the wizard collected; `profile` and
// `sessions` fill in what it didn't ask. Returns { program, summary, inputs } —
// nothing is persisted, the caller decides whether to keep it.
export function generateProgram({ answers = {}, profile = null, sessions = [], injuries = [], now = Date.now() } = {}) {
  const inputs = resolveInputs({ answers, profile, sessions, injuries, now })
  const templateDays = pickTemplate(inputs.daysPerWeek, inputs.focus, inputs.shape)
  // A focus is planned against the same week without it (focusPlan), and the
  // preview reports what it actually changed against that week built in full —
  // so "Side Delts: 3 sessions, +2 sets" is a measurement, not a promise.
  const baseline = inputs.focus.length
    ? generateProgram({ answers: { ...answers, focus: [] }, profile, sessions, injuries, now })
    : null
  const { targets, sessionCap, extraSets } = baseline
    ? focusPlan(
        weeklyTargets(inputs), inputs.focus, pickTemplate(inputs.daysPerWeek, [], inputs.shape), templateDays,
        new Map(baseline.summary.volume.map((v) => [v.muscle, v.sets])),
      )
    : { targets: weeklyTargets(inputs), sessionCap: {}, extraSets: {} }
  // A focus muscle's share of any one day never exceeds sessionCap.
  const capSession = (alloc) => {
    for (const [m, cap] of Object.entries(sessionCap)) if (alloc[m] != null) alloc[m] = Math.min(alloc[m], cap)
    return alloc
  }
  const cycle = cycleShape(inputs)
  const gaps = recoveryGaps(templateDays, cycle)
  const perWeek = 7 / cycle.length
  const setCap = inputs.volumePref.setCap

  // `direct` is each day's DIRECT_WORK guarantees (assignDirectWork); without it
  // the week fills the way it did before they existed. `dayCaps` holds each day
  // to a set count of its own (under the volume cap) without switching the week
  // into the owed-allocation mode, which stays tied to `cap`.
  const fillWeek = (weekTargets, cap, { direct = null, dayCaps = null } = {}) => {
    const directWork = !!direct
    // Uncapped, each day gets a fixed share of the week (allocate). Capped, the
    // days are planned in order against what the week still OWES: a muscle
    // Monday already paid off is skipped on Wednesday, and that room goes to
    // whatever Monday's cap squeezed out. A fixed share can't do that — it
    // splits a small target into slivers too thin to earn an exercise, and the
    // same muscles at the bottom of every day lose out every day.
    const allocation = Number.isFinite(cap) ? null : allocate(weekTargets, templateDays).map(capSession)
    const credited = {}
    const owedAlloc = (i) => {
      const alloc = {}
      for (const m of templateDays[i].muscles) {
        const target = weekTargets[m]
        if (!target) continue
        const w = (d) => emphasisWeight(d, m, templateDays, target)
        const sharesLeft = templateDays.slice(i).filter((d) => d.muscles.includes(m)).reduce((n, d) => n + w(d), 0)
        const owed = Math.max(0, target - (credited[m] || 0))
        // An even share can be too thin to earn an exercise on any day; a
        // muscle still owed a slot's worth may take one today instead.
        const share = Math.max((owed * w(templateDays[i])) / sharesLeft, owed >= MIN_SLOT_SETS ? MIN_SLOT_SETS : 0)
        alloc[m] = Math.min(share, MAX_SETS_PER_MUSCLE_PER_SESSION)
      }
      return capSession(alloc)
    }
    // Under the cap the day's lead muscles still open it (that order is the
    // point of a lead), but the rest go most-owed first, so the muscles a
    // previous day's cap squeezed out are first in line today.
    const owedOrder = (template) => {
      const lead = template.muscles.slice(0, CAPPED_LEAD_SLOTS)
      const owedFrac = (m) => (weekTargets[m] ? 1 - (credited[m] || 0) / weekTargets[m] : 0)
      const rest = template.muscles.slice(CAPPED_LEAD_SLOTS).sort((a, b) => owedFrac(b) - owedFrac(a))
      return { ...template, muscles: [...lead, ...rest] }
    }
    const ctx = {
      posture: inputs.posture,
      allowedEquipment: inputs.allowedEquipment,
      excludedEquipment: inputs.excludedEquipment,
      excludedOverload: inputs.excludedOverload,
      limiterPenalty: inputs.limiterPenalty,
      excludeLimited: inputs.excludeLimited,
      weights: inputs.weights,
      maxSkillRank: SKILL_RANK[inputs.posture.maxSkill] ?? 2,
      focus: inputs.focus,
      history: inputs.history,
      injuryRisk: inputs.injuryRisk,
      openSlots: inputs.openSlots,
      experience: inputs.experience,
      volumePref: inputs.volumePref,
      setCap: cap,
      // Week-wide variety state, shared across days on purpose: the second Push
      // day should know what the first one already used — and, with
      // `noWeekRepeats`, never use it again while anything else fits.
      weekIds: new Set(),
      weekFamilies: new Set(),
      weekSignatures: new Set(),
      weekAtoms: new Set(),
      noWeekRepeats: true,
    }
    const days = templateDays.map((template, i) => {
      // Measuring the day's size uses the order it is sized in (`sizedAs`).
      const t = directWork
        ? { ...template, direct: direct[i] }
        : template.sizedAs ? { ...template, muscles: template.sizedAs } : template
      const alloc = allocation ? allocation[i] : owedAlloc(i)
      const dayCtx = dayCaps ? { ...ctx, setCap: Math.min(cap, dayCaps[i]) } : ctx
      const day = fillDay(allocation ? t : owedOrder(t), alloc, gaps[i], dayCtx)
      for (const e of day.exercises) {
        const weights = muscleWeights(DB_BY_ID.get(plannedExerciseDbId(e)))
        for (const [m, w] of Object.entries(weights)) credited[m] = (credited[m] || 0) + w * e.sets
      }
      return day
    })
    trimOvershoot(days, { perWeek, focus: inputs.focus, targets: directWork ? weekTargets : {} })
    return days
  }

  // DIRECT_WORK moves volume, it doesn't add any. So the week is filled once
  // without it, to learn how many sets each day and the week hold on their own
  // and where it already trains these muscles directly, and then again with it.
  // A day whose guaranteed muscle had no movement of its own gets exactly the
  // room that movement needs — squeezing it into the old count would push out
  // the second press on a small push day, and the close-grip press it replaced
  // was half chest work — and the week then gives the same number of sets back
  // from wherever it is most over its targets (giveBack). The volume setting's
  // day cap still bounds every day.
  const fit = (cap) => {
    const natural = fillWeek(targets, cap)
    const direct = assignDirectWork(templateDays, natural)
    const room = natural.map((d, i) => {
      const missing = direct[i].filter((m) => !hasDirectMovement(d, m)).length
      return Math.min(setCap, daySets(d) + MIN_SETS_PER_EXERCISE * missing)
    })
    const days = fillWeek(targets, cap, { direct, dayCaps: room })
    giveBack(days, natural.reduce((n, d) => n + daySets(d), 0), { perWeek, targets })
    return { natural, days }
  }

  // Fill the week as before; only if a day comes out over the cap is it
  // refilled under the cap, planned day by day against what the week still
  // owes. That way a split whose days already fit is exactly what it was, and
  // one that doesn't gets the cap spread across the week rather than the same
  // muscles losing out every day. Decided on the natural fill, so the
  // guarantees never change which of the two a week gets.
  let week = fit(Infinity)
  if (Math.max(0, ...week.natural.map(daySets)) > setCap) week = fit(setCap)
  const trainingDays = week.days
  // The focus promises, held on the finished week: no session of a focus
  // muscle above its cap, and no more sets in the week than without the focus.
  if (baseline) {
    holdSessions(trainingDays, sessionCap)
    const before = new Map(baseline.summary.volume.map((v) => [v.muscle, v.sets]))
    const goal = Object.fromEntries(inputs.focus.map((m) => [m, Math.min(
      (before.get(m) || 0) + (extraSets[m] || 0),
      ceilingFor(m) * ADVISOR_BLOCK_SLACK,
    )]))
    const focusOpts = {
      focus: inputs.focus, goal, sessionCap, setCap, perWeek, targets,
      maxSets: inputs.posture.maxSetsPerExercise,
      planned: templateDays,
      week: trainingDays,
      gen: { ...inputs, maxSkillRank: SKILL_RANK[inputs.posture.maxSkill] ?? 2 },
    }
    // Made whole first, then raised: every focus muscle back up to what it had
    // without the focus before any of them takes its extra. Raising them in
    // list order alone let the first ones spend a full week's last room on
    // their extra set and left the last one under where it started — glutes
    // behind chest and lats on a 3-day full body.
    const whole = Object.fromEntries(inputs.focus.map((m) => [m, Math.min(goal[m], before.get(m) || 0)]))
    deliverFocus(trainingDays, { ...focusOpts, goal: whole })
    deliverFocus(trainingDays, focusOpts)
    const total = programSets(baseline.program)
    giveBack(trainingDays, total, { perWeek, targets, floors: goal })
    // Every movement already at its two sets leaves giveBack nothing to trim;
    // then the week drops the movement it can best spare, as deliverFocus does.
    for (let guard = 0; guard < 8 && trainingDays.reduce((n, d) => n + daySets(d), 0) > total; guard++) {
      const weekly = weeklyMuscleSets(trainingDays, perWeek)
      if (!makeRoom(trainingDays, weekly, focusOpts)) break
    }
  }
  placeCore(trainingDays, inputs.core, inputs.focus)

  const program = buildProgram(trainingDays, cycle, answers.name || suggestName(inputs.focus, inputs.daysPerWeek))
  // What the split was built FOR, kept on it: the day cap the split editor
  // measures against, and what the wizard reopens with next time. Focus and
  // shape are kept for the NEXT program — a split runs for months, and knowing
  // what this one emphasised is what lets a later one suggest a change.
  program.settings = {
    volume: inputs.volumePref.value,
    experience: inputs.experience,
    focus: [...inputs.focus],
    shape: templateDays.shape?.id || null,
    core: inputs.core,
  }
  const summary = summarize(program, { targets, schedule: inputs.schedule, cycle, inputs, shape: templateDays.shape })
  if (baseline) summary.focusTrade = focusTrade(program, summary, baseline, inputs.focus, sessionCap)
  // What the summary was measured against, kept so a proposal edited in the
  // preview (swapProposedRow) can be re-summarised on the same terms.
  const context = { targets, cycle, shape: templateDays.shape, baseline, sessionCap }
  return { program, summary, inputs, context }
}

// ---- Editing the proposal ----------------------------------------------------

// One movement in a not-yet-created split swapped for another, from the
// wizard's preview. The sets stay — they're the volume setting's, and the week
// was sized around them — but the rep range and the effort target are the
// generator's own numbers for the NEW movement, since nothing about this row is
// the user's yet: a press swapped in for a fly gets compound reps, not the
// isolation range. The last set to failure stays only where the
// generator put one AND the new movement can take it (failureSafe). The slot,
// the superset pairing and the row id all survive, through substituteExercise —
// except the slot's muscle when the new movement doesn't train it at all (an
// adduction machine in for a Copenhagen that was there for the abs): the row is
// now there for what the new movement trains, and a later swap ranks for that.
export function swapProposedRow(built, program, dayId, rowId, { id, name, category, pattern }) {
  const original = built.program.days.find((d) => d.id === dayId)?.exercises.find((e) => e.id === rowId)
  // Back to what the generator picked: the row exactly as it was proposed.
  if (original?.exerciseId && id === original.exerciseId) {
    return { ...program, days: program.days.map((d) => d.id !== dayId ? d : { ...d, exercises: d.exercises.map((e) => (e.id === rowId ? original : e)) }) }
  }
  const db = DB_BY_ID.get(id || '') || null
  const next = substituteExercise(program, dayId, rowId, { name, category, exerciseId: id || null, pattern: pattern || db?.pattern })
  // A custom movement from the search: nothing to derive numbers from.
  if (!db) return next
  const { experience, volumePref, history } = built.inputs
  const rirTarget = rirTargetForExercise(db, experience, volumePref)
  if (original?.rirTarget?.lastSetFailure && failureSafe(db)) rirTarget.lastSetFailure = true
  return {
    ...next,
    days: next.days.map((d) => d.id !== dayId ? d : {
      ...d,
      exercises: d.exercises.map((e) => {
        if (e.id !== rowId) return e
        const muscle = muscleWeights(db)[e.slot?.muscle] ? e.slot.muscle : primaryMuscleOf(db)
        return {
          ...e,
          slot: e.slot && muscle && muscle !== e.slot.muscle ? { ...e.slot, muscle } : e.slot,
          repRange: repRangeForExercise(db, history),
          rirTarget,
        }
      }),
    }),
  }
}

// The preview's summary for a proposal that may have been edited: the day
// cards, the weekly volume, the movement paths and the focus trade, measured
// against the same targets and the same no-focus week the original was.
export function summarizeProposal(built, program) {
  if (program === built.program) return built.summary
  const { targets, cycle, shape, baseline, sessionCap } = built.context
  const summary = summarize(program, { targets, schedule: built.inputs.schedule, cycle, inputs: built.inputs, shape })
  if (baseline) summary.focusTrade = focusTrade(program, summary, baseline, built.inputs.focus, sessionCap)
  return summary
}

// What bringing the focus muscles up did, measured against the same week built
// without them: each focus muscle's sessions and weekly sets before and after,
// who paid for it, and the week's total (which shouldn't have grown).
//
// Sessions here are days that give the muscle at least one real set, not any
// trace of it: a push-up that brushes the side delts is not a side-delt session,
// and counting it would make trimming one look like a lost day.
function focusTrade(program, summary, baseline, focus, sessionCap) {
  const before = new Map(baseline.summary.volume.map((v) => [v.muscle, v]))
  const after = new Map(summary.volume.map((v) => [v.muscle, v]))
  const realSessions = (p, m) =>
    p.days.filter((d) => d.kind !== 'rest' && (dayStats(d).muscles.find((r) => r.muscle === m)?.sets || 0) >= 1).length
  return {
    raised: focus.map((m) => ({
      muscle: m,
      sessions: realSessions(program, m),
      sessionsBefore: realSessions(baseline.program, m),
      sets: after.get(m)?.sets ?? 0,
      setsBefore: before.get(m)?.sets ?? 0,
      sessionCap: sessionCap[m] ?? null,
    })),
    paid: [...after.values()]
      .filter((v) => !focus.includes(v.muscle))
      .map((v) => ({ muscle: v.muscle, change: round1(v.sets - (before.get(v.muscle)?.sets ?? 0)) }))
      .filter((p) => p.change <= -0.5)
      .sort((a, b) => a.change - b.change),
    totalSets: programSets(program),
    totalSetsBefore: programSets(baseline.program),
  }
}

// The sets a day spends of the volume setting's cap: every row but its ab
// movement, which doesn't count (CORE_CATEGORY). Everything that measures a day
// or a week against the setting goes through here, so they all agree.
function daySets(day) {
  return day.exercises.reduce((sum, e) => sum + (e.kind === 'cardio' || isCoreRow(e) ? 0 : Number(e.sets) || 0), 0)
}

// ...and the movements it spends of the posture's exercise cap, likewise.
// Cardio spends neither: it's planned on top of the lifting, not inside it.
function countedRows(day) {
  return day.exercises.filter((e) => e.kind !== 'cardio' && !isCoreRow(e)).length
}

function isCoreRow(planned) {
  return isCoreMovement(DB_BY_ID.get(plannedExerciseDbId(planned) || ''))
}

// Where each day's ab movement goes, as the user asked (CORE_PLACEMENTS):
// paired as a superset with a light movement, or after everything else. Run on
// the finished week, so nothing a later pass adds can land between a pair. An
// ab movement that is itself a focus stays at the front, where the focus put it.
//
// Partners in a superset do the same number of sets — you go back and forth
// between them, so 2 sets can't pair with 4 (Hani). The partner is the light
// movement (supersetPartnerOk) whose set count is closest to the ab row's, ties
// to the lowest per-set systemic cost and then the later one, where the day's
// heavy work is already done; the ab row then takes the partner's count. Ab
// sets sit outside the day's cap, so matching them moves nothing else. A day
// with nothing light to pair with puts its abs last.
function placeCore(trainingDays, placement, focus) {
  for (const day of trainingDays) {
    const core = day.exercises.find(isCoreRow)
    if (!core || focus.includes(core.slot?.muscle)) continue
    const rest = day.exercises.filter((e) => e !== core)
    let partner = null
    let lightest = Infinity
    let closest = Infinity
    if (placement === 'superset') {
      for (const e of rest) {
        const db = DB_BY_ID.get(plannedExerciseDbId(e) || '')
        if (!supersetPartnerOk(db)) continue
        const cost = setLoad(db)
        const gap = Math.abs((Number(e.sets) || 0) - (Number(core.sets) || 0))
        if (gap < closest || (gap === closest && cost <= lightest)) {
          partner = e
          lightest = cost
          closest = gap
        }
      }
    }
    if (partner) core.sets = partner.sets
    if (!partner) {
      day.exercises = [...rest, core]
      continue
    }
    const id = newSupersetId()
    partner.supersetId = id
    core.supersetId = id
    rest.splice(rest.indexOf(partner) + 1, 0, core)
    day.exercises = rest
  }
}

// Light enough to superset abs with: nothing that loads the spine, and no
// compound at SUPERSET_MAX_COMPOUND_FATIGUE or above — bracing for an RDL or a
// hack squat between sets of crunches defeats both.
export function supersetPartnerOk(db) {
  if (!db || db.axialLoading) return false
  return db.type !== 'compound' || (db.fatigueScore ?? DEFAULT_FATIGUE_SCORE) < SUPERSET_MAX_COMPOUND_FATIGUE
}

function programSets(program) {
  return program.days.reduce((n, d) => n + (d.kind === 'rest' ? 0 : daySets(d)), 0)
}

// Every focus muscle ends the week with at least `goal` sets: what it had in the
// week without the focus, plus what focusPlan promised it. The fill aims there,
// but under a tight day cap the muscles ahead of it can leave it short — so the
// difference is made up here, a set at a time on its own movements, on the day
// it has the most room, and never past its `sessionCap`.
//
// When every movement it has is already at its most sets, it gets a new one
// instead, on a day the week plans it for that still has room under its cap.
//
// A day already at the volume setting's cap makes room inside itself rather than
// growing (makeRoom). A day that can't is passed over for the next.
function deliverFocus(trainingDays, opts) {
  const { focus, goal, sessionCap, setCap, perWeek, maxSets, planned, gen } = opts
  const ownSets = (day, muscle) => day.exercises.reduce((n, e) => n + (e.slot?.muscle === muscle ? Number(e.sets) || 0 : 0), 0)
  for (const muscle of focus) {
    const cap = sessionCap[muscle] ?? Infinity
    const full = new Set()
    for (let guard = 0; guard < 12; guard++) {
      const weekly = weeklyMuscleSets(trainingDays, perWeek)
      if ((weekly[muscle] || 0) >= goal[muscle] - 0.05) break
      let best = null
      for (const day of trainingDays) {
        if (full.has(day)) continue
        const held = ownSets(day, muscle)
        if (held >= cap) continue
        for (const row of day.exercises) {
          if (row.slot?.muscle === muscle && row.sets < maxSets && (!best || held < best.held)) best = { day, row, held }
        }
      }
      if (best) {
        // An ab movement's set needs no room under the cap (CORE_CATEGORY).
        if (!isCoreRow(best.row) && daySets(best.day) >= setCap && !makeRoom([best.day], weekly, opts)) full.add(best.day)
        else best.row.sets++
        continue
      }
      // No movement of its own has a set to spare: a new one, on the planned
      // day with the most room under the cap. Where the cap leaves room for one
      // more set but a movement needs two, the new one takes a set from the
      // muscle's existing movement — 4 sets of one row become 3 + 2 of two
      // angles, one set more than before and still inside the cap.
      const spare = (d) => d.exercises.filter((e) => e.slot?.muscle === muscle && e.sets > MIN_SETS_PER_EXERCISE)
      const fits = (d) => ownSets(d, muscle) + MIN_SETS_PER_EXERCISE - (spare(d).length ? 1 : 0) <= cap
      const day = trainingDays
        .filter((d, i) => !full.has(d) && planned[i]?.muscles.includes(muscle) && fits(d))
        .sort((a, b) => ownSets(a, muscle) - ownSets(b, muscle))[0]
      if (!day) break
      const split = ownSets(day, muscle) + MIN_SETS_PER_EXERCISE > cap ? spare(day).sort((a, b) => b.sets - a.sets)[0] : null
      const room = MIN_SETS_PER_EXERCISE - (split ? 1 : 0)
      while (setCap - daySets(day) < room && makeRoom([day], weeklyMuscleSets(trainingDays, perWeek), opts));
      if (setCap - daySets(day) < room || countedRows(day) >= gen.posture.exerciseCap || !addFocusMovement(day, muscle, trainingDays, gen, planned[trainingDays.indexOf(day)]?.repeatJobs)) {
        full.add(day)
        continue
      }
      if (split) split.sets--
    }
  }
}

// One set of room in `days`, for a focus week: a set off a movement that has
// sets to spare, or — when every one is down to its minimum two, as a Standard
// upper day of eight movements is — the movement the week can best spare,
// dropped. Never a focus muscle's own movement, never one that takes a muscle
// under its minimum (or a focus muscle under its goal), never a movement
// for a muscle with DIRECT_WORK, which may be its only direct one, and never
// the ab movement, which takes up no room to give.
function makeRoom(days, weekly, { focus, goal, perWeek, targets, week }) {
  const rows = days.flatMap((day) =>
    day.exercises.filter((e) => !focus.includes(e.slot?.muscle) && !isCoreRow(e)).map((e) => ({ day, e }))
  )
  const robs = (e, sets) =>
    Object.entries(muscleWeights(DB_BY_ID.get(plannedExerciseDbId(e)))).some(
      ([m, w]) => targets[m] != null && (weekly[m] || 0) - w * sets * perWeek < Math.max(mevFor(m), goal[m] ?? 0)
    )
  const trim = rows
    .filter(({ e }) => e.sets > MIN_SETS_PER_EXERCISE && !robs(e, 1))
    .sort((a, b) => b.e.sets - a.e.sets)[0]
  if (trim) {
    trim.e.sets--
    return true
  }
  const surplus = ({ e }) => (weekly[e.slot?.muscle] || 0) - (targets[e.slot?.muscle] ?? 0)
  // ...and never the movement that is a muscle's only work that day when the
  // muscle is down to two sessions a week: that would make it once-a-week.
  const hits = (day, m, skip) =>
    day.exercises.some((x) => x !== skip && (muscleWeights(DB_BY_ID.get(plannedExerciseDbId(x)))[m] || 0) > 0)
  const costsASession = ({ day, e }) =>
    Object.keys(muscleWeights(DB_BY_ID.get(plannedExerciseDbId(e)))).some(
      (m) => targets[m] != null && !hits(day, m, e) && week.filter((d) => hits(d, m)).length <= 2
    )
  const drop = rows
    .filter((r) => !DIRECT_WORK[r.e.slot?.muscle] && !robs(r.e, r.e.sets) && !costsASession(r))
    .sort((a, b) => surplus(b) - surplus(a))[0]
  if (!drop) return false
  drop.day.exercises.splice(drop.day.exercises.indexOf(drop.e), 1)
  return true
}

// A focus muscle's own movements never hold more sets in one day than its
// `sessionCap` (focusPlan). Trimmed a set at a time from the biggest of them,
// never below the two sets a movement needs to be worth writing down.
function holdSessions(trainingDays, sessionCap) {
  for (const day of trainingDays) {
    for (const [muscle, cap] of Object.entries(sessionCap)) {
      const rows = day.exercises.filter((e) => e.slot?.muscle === muscle)
      let over = rows.reduce((n, e) => n + (Number(e.sets) || 0), 0) - cap
      while (over > 0) {
        const row = rows.filter((e) => e.sets > MIN_SETS_PER_EXERCISE).sort((a, b) => b.sets - a.sets)[0]
        if (!row) break
        row.sets--
        over--
      }
    }
  }
}

// Does the day already hold a movement down one of `muscle`'s DIRECT_WORK paths?
function hasDirectMovement(day, muscle) {
  const paths = DIRECT_WORK[muscle] || []
  return day.exercises.some((e) => paths.includes(DB_BY_ID.get(plannedExerciseDbId(e) || '')?.pattern))
}

// ---- A single session -----------------------------------------------------------
//
// The session generator (pages/SessionGenerator.jsx): one day, built by the
// same fillDay that writes a split's days, sized against the WEEK it lands in.
// Each muscle gets the share of its weekly target a split would give one of its
// sessions (SESSION_TYPES perWeek), trimmed where the last 7 days already paid
// for it — to what's still owed, but never under half the usual share (and not
// at all on a one-muscle day: a Chest day asked for by name is a chest day) —
// and where the muscle is still recovering, to a token slot (never to nothing).

const DAY_7 = 7
const SESSION_LEAD_MUSCLES = 3

// Where each muscle stands this week: its target, what the last 7 days already
// credited, and how recovered it is right now (100 when never trained).
function weekStanding(inputs, sessions, now) {
  const targets = weeklyTargets(inputs)
  const done = new Map(effectiveWeeklyVolume(sessions, { days: DAY_7, now }).map((r) => [r.muscle, r.sets]))
  const recovery = new Map(muscleRecovery(sessions, { now }).muscles.map((m) => [m.muscle, m.recoveryPct]))
  return {
    targets,
    owed: (m) => Math.max(0, (targets[m] || 0) - (done.get(m) || 0)),
    need: (m) => (targets[m] ? clamp(Math.max(0, targets[m] - (done.get(m) || 0)) / targets[m], 0, 1) : 0),
    ready: (m) => (recovery.has(m) ? recovery.get(m) : 100),
  }
}

export function sessionType(id) {
  return SESSION_TYPES.find((t) => t.id === id) || null
}

// "Pick for me": the broad session whose muscles are most both owed this week
// and recovered, averaged over the session so a big day isn't favoured for its
// size. The day's lead muscles (its first SESSION_LEAD_MUSCLES) count triple:
// a Lower day is about quads, hamstrings and glutes, and fresh calves don't make
// it a good idea while those are still recovering. A brand-new log ties
// everything, and the order breaks it — full body. The reason names the two
// muscles that won it, and a fatigued one it avoids.
export function recommendSession({ sessions = [], answers = {}, profile = null, injuries = [], now = Date.now() } = {}) {
  const inputs = resolveInputs({ answers, profile, sessions, injuries, now })
  const week = weekStanding(inputs, sessions, now)
  const programmed = (t) => t.muscles.filter((m) => week.targets[m])
  const value = (m) => week.need(m) * (week.ready(m) / 100)
  let best = null
  for (const id of SESSION_RECOMMENDABLE) {
    const t = sessionType(id)
    const muscles = programmed(t)
    if (!muscles.length) continue
    const weight = (m) => (t.muscles.indexOf(m) < SESSION_LEAD_MUSCLES ? 3 : 1)
    const score = muscles.reduce((sum, m) => sum + weight(m) * value(m), 0) / muscles.reduce((sum, m) => sum + weight(m), 0)
    if (!best || score > best.score + 1e-9) best = { type: t, score, muscles }
  }
  if (!best) return { type: sessionType('full'), reason: null }
  // Only muscles that really are recovered get named as the reason.
  const lead = best.muscles.filter((m) => best.type.muscles.indexOf(m) < SESSION_LEAD_MUSCLES && week.ready(m) >= SESSION_FATIGUED_BELOW)
  const fresh = [...lead].sort((a, b) => value(b) - value(a)).slice(0, 2)
  const tired = ENGINE_MUSCLES
    .filter((m) => !best.muscles.includes(m) && week.targets[m] && week.ready(m) < SESSION_FATIGUED_BELOW)
    .sort((a, b) => week.ready(a) - week.ready(b))[0]
  const untouched = sessions.length === 0
  const reason = untouched
    ? 'Nothing logged yet, so a full body session to start.'
    : !fresh.length
      ? `Everything is still recovering a little, so a lighter ${best.type.label.toLowerCase()} session.`
      : `${fresh.join(' and ')} ${fresh.length > 1 ? 'are' : 'is'} recovered and still owed sets this week` +
        (tired ? `; ${tired.toLowerCase()} ${tired.endsWith('s') ? 'are' : 'is'} still recovering.` : '.')
  return { type: best.type, reason }
}

// Build one session. `type` is a SESSION_TYPES id, or 'auto' for the
// recommendation. Returns { program, day, type, recommendation, inputs,
// trimmed } — `program` is a one-day split holding the day, so the split
// editor's pieces (DayEditor, swapProposedRow) work on it unchanged, and
// nothing is persisted. `trimmed` lists the muscles held to a token slot, and
// why, for the preview to say.
export function generateSession({ type = 'auto', answers = {}, profile = null, sessions = [], injuries = [], now = Date.now() } = {}) {
  const inputs = resolveInputs({ answers: { ...answers, focus: [] }, profile, sessions, injuries, now })
  const recommendation = type === 'auto' ? recommendSession({ sessions, answers, profile, injuries, now }) : null
  const t = recommendation?.type || sessionType(type) || sessionType('full')
  const week = weekStanding(inputs, sessions, now)

  const alloc = {}
  const trimmed = []
  for (const m of t.muscles) {
    const target = week.targets[m]
    if (!target) continue
    const share = Math.min(target / t.perWeek, MAX_SETS_PER_MUSCLE_PER_SESSION)
    let sets = share
    if (week.ready(m) < SESSION_FATIGUED_BELOW) {
      sets = MIN_SLOT_SETS
      trimmed.push({ muscle: m, why: 'recovering' })
    } else if (week.owed(m) < share) {
      const floor = t.perWeek === 1 ? share : share / 2
      sets = Math.max(week.owed(m), floor, MIN_SLOT_SETS)
      if (sets < share * 0.75) trimmed.push({ muscle: m, why: 'done' })
    }
    alloc[m] = sets
  }

  const gaps = Object.fromEntries(t.muscles.map((m) => [m, SESSION_GAP_HOURS]))
  const ctx = {
    posture: inputs.posture,
    allowedEquipment: inputs.allowedEquipment,
    excludedEquipment: inputs.excludedEquipment,
    excludedOverload: inputs.excludedOverload,
    limiterPenalty: inputs.limiterPenalty,
    excludeLimited: inputs.excludeLimited,
    weights: inputs.weights,
    maxSkillRank: SKILL_RANK[inputs.posture.maxSkill] ?? 2,
    focus: [],
    history: inputs.history,
    injuryRisk: inputs.injuryRisk,
    openSlots: inputs.openSlots,
    experience: inputs.experience,
    volumePref: inputs.volumePref,
    setCap: inputs.volumePref.setCap,
    weekIds: new Set(),
    weekFamilies: new Set(),
    weekSignatures: new Set(),
    weekAtoms: new Set(),
    noWeekRepeats: false,
  }
  const template = { name: t.label, muscles: [...t.muscles], direct: t.direct.filter((m) => week.targets[m]), repeatJobs: t.repeatJobs || null }
  const day = fillDay(template, alloc, gaps, ctx)
  placeCore([day], inputs.core, [])

  const program = emptyProgram(`${t.label} session`)
  program.days = [day]
  program.settings = { volume: inputs.volumePref.value, experience: inputs.experience, session: t.id, core: inputs.core }
  return { program, day, type: t, recommendation, inputs, trimmed }
}
