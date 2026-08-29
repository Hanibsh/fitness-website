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
import { createDay, createPlannedExercise, emptyProgram } from './program'
import { dayStats, ENGINE_MUSCLE_TO_COARSE, plannedExerciseDbId, donutRows } from './planStats'
import { injuryRiskMap } from './injuries'
import { effectiveWeeklyVolume } from './engine'
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
  MAX_FOCUS_MUSCLES, FOCUS_VOLUME_MULT, FOCUS_TARGET_FREQUENCY, FAMILIARITY_FOCUS_DAMP,
  EXPERIENCE_POSTURE, DEFAULT_EXPERIENCE, SKILL_RANK,
  MIN_SETS_PER_EXERCISE, MAX_SETS_PER_MUSCLE_PER_SESSION, MIN_SLOT_SETS,
  HISTORY_VOLUME_DAYS, HISTORY_MIN_SESSIONS, FAMILIARITY_DAYS,
  HP_SCORE, SFR_SCORE, STRETCH_SCORE, PROFILE_SCORE, OVERLOAD_SCORE, STABILITY_SCORE, SIMPLICITY_SCORE,
  WEIGHTS, GYM_WEIGHTS, GYM_EXCLUDED_EQUIPMENT, GYM_EXCLUDED_OVERLOAD,
  PENALTIES, DAY_LOAD_TARGET, DAY_LOAD_MAX, COMPOUND_LEAD_MIN_CONTRIBUTION,
  REP_RANGES, HIGH_REP_MUSCLES, SWAP_MIN_CONTRIBUTION_RATIO,
  PATTERN_OPTION_LIMIT,
} from './generatorConfig'

const DAY_MS = 86400000
const HOURS_PER_DAY = 24

const DB_BY_ID = withAliases(new Map((exercisesDb.exercises || []).map((e) => [e.id, e])))

// The pool the generator picks from. Isometrics are excluded: a plan row carries
// a rep range, and "8–12 reps of a plank" is a lie the logger would then have to
// live with. They stay pickable by hand in the split editor.
const POOL = (exercisesDb.exercises || []).filter(
  (e) => e.type !== 'isometric' && e.muscles && Object.keys(e.muscles).length
)

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
    equipmentPreset: preset,
    allowedEquipment,
    excludedEquipment,
    excludedOverload,
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
export function weeklyTargets({ posture, focus, history }) {
  const wanted = new Set([...PROGRAMMED_MUSCLES, ...focus])
  const isFocus = new Set(focus)
  const targets = {}

  for (const muscle of ENGINE_MUSCLES) {
    if (!wanted.has(muscle)) continue
    const scale = volumeScale(muscle)
    const seen = history?.volume.get(muscle) || 0
    // A muscle they've been neglecting still gets a real slot — their zero is
    // the reason they're generating a split, not a preference to honour.
    let target = seen > mevFor(muscle) ? seen : posture.baseWeeklySets * scale
    target = clamp(target, mevFor(muscle), ceilingFor(muscle))
    if (isFocus.has(muscle)) {
      target = Math.min(target * FOCUS_VOLUME_MULT, ceilingFor(muscle) * ADVISOR_BLOCK_SLACK)
    }
    targets[muscle] = round1(target)
  }
  return targets
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
  const days = shape.days.map((d) => ({ name: d.name, muscles: [...d.muscles] }))

  for (const muscle of focus) {
    let freq = days.filter((d) => d.muscles.includes(muscle)).length
    for (const d of days) {
      if (freq >= FOCUS_TARGET_FREQUENCY) break
      if (!d.muscles.includes(muscle)) {
        d.muscles.push(muscle)
        freq++
      }
    }
  }

  // One ordering pass at the end rather than promoting as we go, so the focus
  // muscles lead in the order the user listed them.
  for (const d of days) {
    const lead = focus.filter((m) => d.muscles.includes(m))
    d.muscles = [...lead, ...d.muscles.filter((m) => !lead.includes(m))]
  }
  // The shape rides along on the days so summarize can name it without having to
  // resolve the id a second time.
  days.shape = shape
  return days
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

// Per-day, per-muscle set allocation: the weekly target split across the days
// that train that muscle, capped per session at the point where the engine's own
// within-session diminishing returns start discounting the work.
export function allocate(targets, templateDays) {
  const frequency = {}
  for (const day of templateDays) for (const m of day.muscles) frequency[m] = (frequency[m] || 0) + 1

  return templateDays.map((day) => {
    const alloc = {}
    for (const m of day.muscles) {
      const target = targets[m]
      if (!target) continue
      alloc[m] = Math.min(target / frequency[m], MAX_SETS_PER_MUSCLE_PER_SESSION)
    }
    return alloc
  })
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

  // ...and within the day, down the same path. Not a filter: the point of a
  // second movement for a muscle is usually a second ANGLE, but sometimes the
  // volume genuinely wants two rows, and this lets it have them at a cost.
  if (db.pattern && ctx.dayPatterns?.has(db.pattern)) score -= PENALTIES.samePatternInDay

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
  const pool = POOL.filter((db) => {
    if (!ctx.allowedEquipment.has(db.equipment)) return false
    if (ctx.excludedEquipment?.has(db.equipment)) return false
    if (ctx.excludedOverload?.has(db.progressiveOverload)) return false
    if ((SKILL_RANK[db.skill] ?? 1) > ctx.maxSkillRank + 1) return false
    if (ctx.dayIds?.has(db.id)) return false
    if (ctx.dayFamilies?.has(movementFamily(db))) return false
    if (ctx.exclude?.has(db.id)) return false
    // Scoped to one movement path — this is what makes "any vertical pull" a
    // list rather than a search.
    if (ctx.pattern && db.pattern !== ctx.pattern) return false
    const w = muscleWeights(db)[muscle] || 0
    return w > 0 && w >= (ctx.minContribution || 0)
  })
  if (!ctx.wantCompound) return pool
  const leads = pool.filter(
    (db) => db.type === 'compound' && muscleWeights(db)[muscle] >= COMPOUND_LEAD_MIN_CONTRIBUTION
  )
  return leads.length ? leads : pool
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
  const dayPatterns = new Set()
  const compoundFor = new Set()
  const chosen = []
  let setsUsed = 0
  let load = 0

  const budgetUsed = () => clamp(load / (SYSTEMIC_CAPACITY * DAY_LOAD_TARGET), 0, 1)
  const loadRoom = () => load < SYSTEMIC_CAPACITY * DAY_LOAD_MAX

  // Charge `sets` of `db` to the day: the set budget, the fatigue budget, and
  // every muscle it credits.
  function charge(db, sets) {
    setsUsed += sets
    load += setLoad(db) * sets
    for (const [m, w] of Object.entries(muscleWeights(db))) {
      if (remaining[m] != null) remaining[m] -= w * sets
    }
  }

  function tryAdd(muscle, minOwed, { ignoreLoadCap = false } = {}) {
    if ((remaining[muscle] || 0) < minOwed) return false
    if (chosen.length >= ctx.posture.exerciseCap) return false
    if (!ignoreLoadCap && !loadRoom()) return false

    const pickCtx = {
      muscle,
      allowedEquipment: ctx.allowedEquipment,
      excludedEquipment: ctx.excludedEquipment,
      excludedOverload: ctx.excludedOverload,
      weights: ctx.weights,
      maxSkillRank: ctx.maxSkillRank,
      dayIds,
      dayFamilies,
      dayPatterns,
      remaining,
      weekIds: ctx.weekIds,
      weekFamilies: ctx.weekFamilies,
      weekSignatures: ctx.weekSignatures,
      injuryRisk: ctx.injuryRisk,
      budgetUsed: budgetUsed(),
      hoursToNext: gaps[muscle],
      isFocus: ctx.focus.includes(muscle),
      // Only the muscle's FIRST movement of the day leads with a compound.
      wantCompound: !compoundFor.has(muscle) && !chosen.some((c) => c.muscle === muscle),
    }

    let best = null
    for (const db of candidates(muscle, pickCtx)) {
      const scored = scoreExercise(db, { ...pickCtx, familiarity: familiarity(db, ctx.history) })
      if (!scored) continue
      if (!best || scored.score > best.score) best = { db, ...scored }
    }
    if (!best) return false

    chosen.push({ db: best.db, sets: MIN_SETS_PER_EXERCISE, muscle })
    dayIds.add(best.db.id)
    dayFamilies.add(movementFamily(best.db))
    if (best.db.pattern) dayPatterns.add(best.db.pattern)
    ctx.weekIds.add(best.db.id)
    ctx.weekFamilies.add(movementFamily(best.db))
    ctx.weekSignatures.add(signature(best.db))
    if (best.db.type === 'compound') compoundFor.add(muscle)
    charge(best.db, MIN_SETS_PER_EXERCISE)
    return true
  }

  // 1 — coverage. The load cap is waived here: a muscle the day is supposed to
  // train getting nothing at all is worse than a day that reads heavy, and the
  // cap still governs everything after this.
  for (const muscle of template.muscles) tryAdd(muscle, MIN_SLOT_SETS, { ignoreLoadCap: true })
  // 2 — a second angle for whatever still owes a movement's worth
  for (const muscle of template.muscles) tryAdd(muscle, MIN_SLOT_SETS * 2)
  // 3 — spend the remainder a set at a time
  for (let pass = 0; pass < MAX_TOP_UP_PASSES; pass++) {
    let added = false
    for (const muscle of template.muscles) {
      if (!loadRoom() || (remaining[muscle] || 0) < 1) continue
      // Prefer the muscle's own movements, furthest from their cap first, so its
      // sets stay spread rather than piling onto whichever came first. Failing
      // that, ANY movement in the day that trains it properly will do — that's
      // how a set gets added to the row rather than nothing to the biceps.
      const row =
        pickRow(chosen, (c) => c.muscle === muscle) ||
        pickRow(chosen, (c) => (muscleWeights(c.db)[muscle] || 0) >= 0.5)
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
  day.exercises = chosen.map(({ db, sets, muscle }) => {
    const slot = { pattern: db.pattern || null, muscle, pinned: false, suggestedId: db.id }
    const open = ctx.openSlots && db.pattern
    return createPlannedExercise(open ? patternPhrase(db.pattern) : db.name, {
      exerciseId: open ? null : db.id,
      kind: 'strength',
      sets,
      repRange: repRangeForExercise(db, muscle, ctx.history),
      slot,
    })
  })
  return day
}

// The systemic cost of one set, mirroring the per-set deposit in planStats.js
// (and engine.js with the RIR term left at 1) so the day this builds grades the
// same here as it will on its own day card.
function setLoad(db) {
  const coef = FATIGUE_SCORE_COEF[db.fatigueScore ?? DEFAULT_FATIGUE_SCORE] || 1
  return coef * (db.axialLoading ? AXIAL_MULT : 1) * (db.equipment === 'free weight' ? FREE_WEIGHT_MULT : 1)
}

// Rep target: their own logged range for this movement when they have one,
// else the shape of the movement decides.
function repRangeForExercise(db, muscle, history) {
  const rec = history?.familiar.get(db.id)
  if (rec && rec.reps.length >= 2) return repRangeFor(rec.reps)
  if (HIGH_REP_MUSCLES.has(muscle) && db.type !== 'compound') return { ...REP_RANGES.shortened }
  if (db.type === 'compound') {
    return { ...((db.fatigueScore ?? 0) >= 4 ? REP_RANGES.heavyCompound : REP_RANGES.compound) }
  }
  if (db.stretchMediated === 'yes' || db.resistanceProfile === 'lengthened') return { ...REP_RANGES.lengthened }
  if (db.resistanceProfile === 'shortened') return { ...REP_RANGES.shortened }
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
export function trimOvershoot(trainingDays, { perWeek, focus = [] }) {
  const limitFor = (m) => ceilingFor(m) * (focus.includes(m) ? ADVISOR_BLOCK_SLACK : 1)

  for (let guard = 0; guard < 60; guard++) {
    const weekly = weeklyMuscleSets(trainingDays, perWeek)
    let worst = null
    for (const [muscle, sets] of Object.entries(weekly)) {
      const over = sets - limitFor(muscle)
      if (over > 0 && (!worst || over > worst.over)) worst = { muscle, over }
    }
    if (!worst) return

    // The row contributing most to the offender that can afford to lose a set
    // without pulling one of its other muscles under.
    let victim = null
    for (const day of trainingDays) {
      for (const planned of day.exercises) {
        if (planned.sets <= MIN_SETS_PER_EXERCISE) continue
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

  program.days.forEach((day, i) => {
    if (day.kind === 'rest') {
      days.push({
        id: day.id,
        kind: 'rest',
        name: 'Rest',
        weekday: schedule === 'weekly' ? WEEKDAY_NAMES[i] : null,
        exercises: [],
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
      sets: stats.sets,
      load: stats.load,
      lead: stats.muscles.slice(0, 3).map((m) => m.muscle),
      // What this day trains, rolled up for the day's donut. Same weighted rows
      // the muscle bars use, so the chart and the numbers can never disagree.
      donut: donutRows(stats.muscles),
      exercises: day.exercises.map((e) => ({
        id: e.id,
        name: e.name,
        sets: e.sets,
        repRange: e.repRange,
        pattern: e.slot?.pattern || null,
        open: !!e.slot && !e.exerciseId,
      })),
    })
  })

  const focus = new Set(inputs.focus)
  const pickCtx = {
    allowedEquipment: inputs.allowedEquipment,
    excludedEquipment: inputs.excludedEquipment,
    excludedOverload: inputs.excludedOverload,
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
  let load = 0
  for (const other of day.exercises) {
    const db = DB_BY_ID.get(plannedExerciseDbId(other) || '')
    if (!db) continue
    if (other.id !== selfPlannedId) {
      dayIds.add(db.id)
      dayFamilies.add(movementFamily(db))
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
    weights: atGym ? { ...WEIGHTS, ...GYM_WEIGHTS } : WEIGHTS,
    maxSkillRank: SKILL_RANK.high, // a split they wrote themselves; only the very hardest is held back
    dayIds,
    dayFamilies,
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

  const { currentDb, muscle, history } = ctx
  const base = {
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

  return rankWithin(muscle, base, history).slice(0, limit).map(({ db, score }) => {
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
  const targets = weeklyTargets(inputs)
  const templateDays = pickTemplate(inputs.daysPerWeek, inputs.focus, inputs.shape)
  const cycle = cycleShape(inputs)
  const gaps = recoveryGaps(templateDays, cycle)
  const allocation = allocate(targets, templateDays)

  const ctx = {
    posture: inputs.posture,
    allowedEquipment: inputs.allowedEquipment,
    excludedEquipment: inputs.excludedEquipment,
    excludedOverload: inputs.excludedOverload,
    weights: inputs.weights,
    maxSkillRank: SKILL_RANK[inputs.posture.maxSkill] ?? 2,
    focus: inputs.focus,
    history: inputs.history,
    injuryRisk: inputs.injuryRisk,
    openSlots: inputs.openSlots,
    // Week-wide variety state, shared across days on purpose: the second Push
    // day should know what the first one already used.
    weekIds: new Set(),
    weekFamilies: new Set(),
    weekSignatures: new Set(),
  }

  const trainingDays = templateDays.map((t, i) => fillDay(t, allocation[i], gaps[i], ctx))
  trimOvershoot(trainingDays, { perWeek: 7 / cycle.length, focus: inputs.focus })
  const program = buildProgram(trainingDays, cycle, answers.name || suggestName(inputs.focus, inputs.daysPerWeek))
  return {
    program,
    summary: summarize(program, { targets, schedule: inputs.schedule, cycle, inputs, shape: templateDays.shape }),
    inputs,
  }
}
