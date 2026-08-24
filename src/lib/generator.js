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
import { dayStats } from './planStats'
import { effectiveWeeklyVolume } from './engine'
import { exerciseIdForName } from './exerciseLibrary'
import { repRangeFor } from './splitFromHistory'
import { equipmentValuesFor } from './profileFields'
import { ALL_EQUIPMENT } from '../data/equipmentGroups'
import {
  ATOM_TO_GROUP, ENGINE_MUSCLES, mevFor, ceilingFor, volumeTier, volumeScale,
  ADVISOR_BLOCK_SLACK, SYSTEMIC_CAPACITY, DEFAULT_FATIGUE_SCORE, DEFAULT_RECOVERY_WINDOW,
  FATIGUE_SCORE_COEF, AXIAL_MULT, FREE_WEIGHT_MULT,
} from './engineConfig'
import {
  PROGRAMMED_MUSCLES, TEMPLATES, DAYS_PER_WEEK_OPTIONS, DEFAULT_DAYS_PER_WEEK, DEFAULT_WEEKDAYS,
  MAX_FOCUS_MUSCLES, FOCUS_VOLUME_MULT, FOCUS_TARGET_FREQUENCY, FAMILIARITY_FOCUS_DAMP,
  EXPERIENCE_POSTURE, DEFAULT_EXPERIENCE, SKILL_RANK,
  DEFAULT_SESSION_MINUTES, MINUTES_PER_SET, MIN_SETS_PER_SESSION, MAX_SETS_PER_SESSION,
  MIN_SETS_PER_EXERCISE, MAX_SETS_PER_MUSCLE_PER_SESSION, MIN_SLOT_SETS,
  HISTORY_VOLUME_DAYS, HISTORY_MIN_SESSIONS, FAMILIARITY_DAYS,
  HP_SCORE, SFR_SCORE, STRETCH_SCORE, PROFILE_SCORE, OVERLOAD_SCORE, STABILITY_SCORE,
  WEIGHTS, PENALTIES, DAY_LOAD_TARGET, DAY_LOAD_MAX, COMPOUND_LEAD_MIN_CONTRIBUTION,
  REP_RANGES, HIGH_REP_MUSCLES,
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

// Two movements are "the same idea" when they train the same thing the same way.
// Coarser than the family: it's what stops a week reading Barbell Row / Dumbbell
// Row / T-Bar Row, none of which share a family name.
function signature(db) {
  return [db.category, db.subCategory || '-', db.type, db.equipment].join('|')
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
export function resolveInputs({ answers = {}, profile = null, sessions = [], now = Date.now() } = {}) {
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

  const sessionMinutes = Number(answers.sessionMinutes) > 0 ? Number(answers.sessionMinutes) : DEFAULT_SESSION_MINUTES
  const setsPerSession = clamp(
    Math.round(sessionMinutes / MINUTES_PER_SET),
    MIN_SETS_PER_SESSION,
    MAX_SETS_PER_SESSION
  )
  // The experience cap is an opinion about how many movements someone should be
  // learning at once; the clock is a fact. A 30-minute session can't hold nine
  // exercises whatever the posture says, so take the lower of the two.
  const posture = {
    ...EXPERIENCE_POSTURE[experience],
    exerciseCap: Math.min(
      EXPERIENCE_POSTURE[experience].exerciseCap,
      Math.floor(setsPerSession / MIN_SETS_PER_EXERCISE)
    ),
  }

  const schedule = answers.schedule === 'rotation' ? 'rotation' : 'weekly'
  const weekdays = normaliseWeekdays(answers.weekdays, daysPerWeek)

  return {
    daysPerWeek,
    focus,
    experience,
    posture,
    equipmentPreset: preset,
    allowedEquipment,
    sessionMinutes,
    setsPerSession,
    schedule,
    weekdays,
    history: historyContext(sessions, { now }),
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
export function pickTemplate(daysPerWeek, focus = []) {
  const base = TEMPLATES[daysPerWeek] || TEMPLATES[DEFAULT_DAYS_PER_WEEK]
  const days = base.map((d) => ({ name: d.name, muscles: [...d.muscles] }))

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

  let score = 0
  score += WEIGHTS.contribution * contribution
  score += WEIGHTS.hypertrophy * (HP_SCORE[db.hypertrophyPotential] ?? 0.4)
  score += WEIGHTS.sfr * (SFR_SCORE[db.sfr] ?? 0.35)
  score += WEIGHTS.stretch * (STRETCH_SCORE[db.stretchMediated] ?? 0)
  score += WEIGHTS.profile * (PROFILE_SCORE[db.resistanceProfile] ?? 0.35)
  score += WEIGHTS.overload * (OVERLOAD_SCORE[db.progressiveOverload] ?? 0.4)
  score += WEIGHTS.stability * (STABILITY_SCORE[db.stability] ?? 0.6)

  // What else in the day this movement pays off. Only muscles that still owe
  // sets count — covering a muscle the day has already finished with is not a
  // benefit, it's the overshoot the allocation is trying to avoid.
  if (ctx.remaining) {
    let relief = 0
    for (const [m, w] of Object.entries(weights)) {
      if (m === ctx.muscle) continue
      if ((ctx.remaining[m] ?? 0) >= 1) relief += w
    }
    score += WEIGHTS.debtRelief * Math.min(2, relief)
  }

  // The hybrid rule: their own movements get a nudge, damped on a focus muscle
  // where fresh stimulus is the entire point of naming it.
  const fam = ctx.familiarity ?? 0
  score += WEIGHTS.familiarity * fam * (ctx.isFocus ? FAMILIARITY_FOCUS_DAMP : 1)

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

  // One tier of stretch above their level is allowed but discouraged; two is a
  // hard filter and never reaches this function.
  const over = (SKILL_RANK[db.skill] ?? 1) - ctx.maxSkillRank
  if (over > 0) score -= PENALTIES.skillOverreach * over

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
    if ((SKILL_RANK[db.skill] ?? 1) > ctx.maxSkillRank + 1) return false
    if (ctx.dayIds?.has(db.id)) return false
    if (ctx.dayFamilies?.has(movementFamily(db))) return false
    if (ctx.exclude?.has(db.id)) return false
    return (muscleWeights(db)[muscle] || 0) > 0
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
  const compoundFor = new Set()
  const chosen = []
  let setsUsed = 0
  let load = 0

  const budgetUsed = () => clamp(load / (SYSTEMIC_CAPACITY * DAY_LOAD_TARGET), 0, 1)
  const room = () => ctx.setsPerSession - setsUsed
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
    if (room() < MIN_SETS_PER_EXERCISE) return false
    if (!ignoreLoadCap && !loadRoom()) return false

    const pickCtx = {
      muscle,
      allowedEquipment: ctx.allowedEquipment,
      maxSkillRank: ctx.maxSkillRank,
      dayIds,
      dayFamilies,
      remaining,
      weekIds: ctx.weekIds,
      weekFamilies: ctx.weekFamilies,
      weekSignatures: ctx.weekSignatures,
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
  for (let pass = 0; pass < ctx.setsPerSession; pass++) {
    let added = false
    for (const muscle of template.muscles) {
      if (room() < 1 || !loadRoom() || (remaining[muscle] || 0) < 1) continue
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

  day.exercises = chosen.map(({ db, sets, muscle }) =>
    createPlannedExercise(db.name, {
      exerciseId: db.id,
      kind: 'strength',
      sets,
      repRange: repRangeForExercise(db, muscle, ctx.history),
    })
  )
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
        const weights = muscleWeights(DB_BY_ID.get(planned.exerciseId))
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
export function summarize(program, { targets, schedule, cycle, inputs }) {
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
      exercises: day.exercises.map((e) => ({
        id: e.id,
        name: e.name,
        sets: e.sets,
        repRange: e.repRange,
      })),
    })
  })

  const focus = new Set(inputs.focus)
  const pickCtx = { allowedEquipment: inputs.allowedEquipment, maxSkillRank: SKILL_RANK[inputs.posture.maxSkill] ?? 2 }
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

  const training = program.days.filter((d) => d.kind !== 'rest').length
  return {
    schedule,
    shapeLabel:
      schedule === 'weekly'
        ? `Fixed week · ${training} training day${training !== 1 ? 's' : ''}`
        : `${program.days.length}-day rotation · ${training} training day${training !== 1 ? 's' : ''}`,
    fromHistory: !!inputs.history,
    historySessions: inputs.history?.sessions || 0,
    focus: inputs.focus,
    daysPerWeek: inputs.daysPerWeek,
    sessionMinutes: inputs.sessionMinutes,
    days,
    volume,
  }
}

// Does this day train `muscle` at all (any contribution)? Used for the
// frequency readout, which is a claim about sessions, not about sets.
function dayHits(day, muscle) {
  return (day.exercises || []).some((e) => {
    const db = e.exerciseId ? DB_BY_ID.get(e.exerciseId) : null
    return db ? (muscleWeights(db)[muscle] || 0) > 0 : false
  })
}

// Build a split. `answers` is what the wizard collected; `profile` and
// `sessions` fill in what it didn't ask. Returns { program, summary, inputs } —
// nothing is persisted, the caller decides whether to keep it.
export function generateProgram({ answers = {}, profile = null, sessions = [], now = Date.now() } = {}) {
  const inputs = resolveInputs({ answers, profile, sessions, now })
  const targets = weeklyTargets(inputs)
  const templateDays = pickTemplate(inputs.daysPerWeek, inputs.focus)
  const cycle = cycleShape(inputs)
  const gaps = recoveryGaps(templateDays, cycle)
  const allocation = allocate(targets, templateDays)

  const ctx = {
    posture: inputs.posture,
    setsPerSession: inputs.setsPerSession,
    allowedEquipment: inputs.allowedEquipment,
    maxSkillRank: SKILL_RANK[inputs.posture.maxSkill] ?? 2,
    focus: inputs.focus,
    history: inputs.history,
    // Week-wide variety state, shared across days on purpose: the second Push
    // day should know what the first one already used.
    weekIds: new Set(),
    weekFamilies: new Set(),
    weekSignatures: new Set(),
  }

  const trainingDays = templateDays.map((t, i) => fillDay(t, allocation[i], gaps[i], ctx))
  trimOvershoot(trainingDays, { perWeek: 7 / cycle.length, focus: inputs.focus })
  const program = buildProgram(trainingDays, cycle, answers.name || suggestName(inputs.focus, inputs.daysPerWeek))
  return { program, summary: summarize(program, { targets, schedule: inputs.schedule, cycle, inputs }), inputs }
}
