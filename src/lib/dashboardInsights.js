// The numbers behind the dashboard's optional cards (Plan adherence, Stalled
// lifts, Strength level, Effort, Rest times, Cardio, Training time). Pure
// functions over the session history, same split as lib/dashboard.js is for the
// original cards — the components live in components/DashboardInsightCards.jsx.

import { convertWeight, convertDistance, distanceUnit, estimatedOneRepMax, canonicalExerciseId, restBetweenSets } from './workoutStats'
import { getExercise, exerciseIdForName } from './exerciseLibrary'
import { lifts, matchTier, CATEGORY_ORDER } from './strengthStandards'
import { dayStatusesForRange, scheduleMode } from './program'
import { weeklyTrainingHours } from './profilePrefill'

const DAY_MS = 86400000

function startOfDay(ts) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// Monday 00:00 of the week `ts` falls in — the week every weekly number on the
// dashboard uses (see weeklyStreak in lib/dashboard.js).
export function weekStart(ts) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.getTime()
}

// Each limb of a unilateral set is its own effort; a bilateral set is one.
function sides(set) {
  return set.left ? [set.left, set.right].filter(Boolean) : [set]
}

const isWarmup = (set) => set.type === 'warmup'
const inWindow = (s, from, to) => s.date >= from && s.date < to

// A logged exercise's place in the exercise DB: its stored id (renamed ids
// resolved forward), else its name — older logs and typed entries have no id.
function dbIdOf(ex) {
  return canonicalExerciseId(ex.exerciseId) || exerciseIdForName(ex.name)
}

// ---- Plan adherence -----------------------------------------------------------
// Sessions done vs what the split asked for, from the same day statuses the
// calendar draws. Days marked off (sick, travel…) aren't held against you, and
// nor are days from before this split existed — you can't miss a plan you
// didn't have yet. Today only counts once it's trained.
//
//   fixed week — the weekdays the split trains are the plan; a session on a
//                rest day is `extra`, not a planned one done.
//   rotation   — workouts wait for you, so there's no weekday to miss: the
//                plan is the cycle's share of training days over the window.
export function planAdherence(sessions, annotations, program, now = Date.now()) {
  if (!program?.days?.length) return null
  const weekly = scheduleMode(program) === 'weekly'
  const since = Number.isFinite(program.createdAt) ? startOfDay(program.createdAt) : -Infinity
  const trainShare = program.days.filter((d) => d.kind !== 'rest').length / program.days.length
  const today = startOfDay(now)

  const summarize = (from) => {
    const start = Math.max(from, since)
    const out = { trained: 0, planned: 0, missed: 0, extra: 0, byReason: {}, pct: null }
    if (start > today) return out
    let days = 0
    let done = 0
    const statuses = dayStatusesForRange(program, { start, end: today, sessions, annotations, now })
    for (const [date, st] of statuses) {
      if (st.annotation) out.byReason[st.annotation.reason] = (out.byReason[st.annotation.reason] || 0) + 1
      const trained = st.status === 'done'
      if (date === today && !trained) continue
      if (st.status === 'off') continue
      if (trained) done++
      days++
      if (!weekly) continue
      const train = program.days[(new Date(date).getDay() + 6) % 7]?.kind !== 'rest'
      if (train) {
        out.planned++
        if (trained) out.trained++
        else out.missed++
      } else if (trained) {
        out.extra++
      }
    }
    if (!weekly) {
      out.planned = Math.round(trainShare * days)
      out.trained = Math.min(done, out.planned)
      out.missed = Math.max(0, out.planned - done)
      out.extra = Math.max(0, done - out.planned)
    }
    if (out.planned > 0) out.pct = Math.round((100 * out.trained) / out.planned)
    return out
  }
  return {
    week: summarize(weekStart(now)),
    month: summarize(today - 27 * DAY_MS),
  }
}

// ---- Stalled lifts ------------------------------------------------------------
// Each lift's best estimated 1RM in the last 2 weeks against the 4 weeks before
// that. Moving = up 1% or more; dropping = down 3% or more (a bad day is noise,
// three is a trend); anything between is stalled. Lifts done with no load
// compare best reps instead. Needs the lift in both windows.
const RECENT_DAYS = 14
const EARLIER_DAYS = 28
const UP_PCT = 1
const DOWN_PCT = -3

function bestOf(ex, from, unit) {
  let e1rm = 0
  let reps = 0
  for (const set of ex.sets) {
    if (isWarmup(set)) continue
    for (const side of sides(set)) {
      const r = Number(side.reps) || 0
      if (r < 1) continue
      reps = Math.max(reps, r)
      const e = estimatedOneRepMax(convertWeight(Number(side.weight) || 0, from, unit), r)
      if (e) e1rm = Math.max(e1rm, e)
    }
  }
  return { e1rm, reps }
}

export function liftProgress(sessions, unit = 'kg', now = Date.now()) {
  const recentFrom = startOfDay(now) - (RECENT_DAYS - 1) * DAY_MS
  const earlierFrom = recentFrom - EARLIER_DAYS * DAY_MS
  const byLift = new Map()
  for (const s of sessions) {
    if (s.date < earlierFrom || s.date > now) continue
    const slot = s.date >= recentFrom ? 'recent' : 'earlier'
    for (const ex of s.exercises) {
      if (ex.kind === 'cardio') continue
      const key = ex.name.trim().toLowerCase()
      const cur = byLift.get(key) || { name: ex.name.trim(), recent: { e1rm: 0, reps: 0 }, earlier: { e1rm: 0, reps: 0 } }
      const best = bestOf(ex, s.unit || 'kg', unit)
      cur[slot] = { e1rm: Math.max(cur[slot].e1rm, best.e1rm), reps: Math.max(cur[slot].reps, best.reps) }
      byLift.set(key, cur)
    }
  }
  const out = { up: [], flat: [], down: [] }
  for (const l of byLift.values()) {
    const loaded = l.recent.e1rm > 0 && l.earlier.e1rm > 0
    const from = loaded ? l.earlier.e1rm : l.earlier.reps
    const to = loaded ? l.recent.e1rm : l.recent.reps
    if (!(from > 0) || !(to > 0)) continue
    const pct = Math.round(((to - from) / from) * 1000) / 10
    const row = { name: l.name, from: Math.round(from), to: Math.round(to), pct, metric: loaded ? 'e1rm' : 'reps' }
    if (pct >= UP_PCT) out.up.push(row)
    else if (pct <= DOWN_PCT) out.down.push(row)
    else out.flat.push(row)
  }
  out.up.sort((a, b) => b.pct - a.pct)
  out.down.sort((a, b) => a.pct - b.pct)
  out.flat.sort((a, b) => a.name.localeCompare(b.name))
  return out
}

// ---- Strength level -------------------------------------------------------------
// Logged lifts placed on the Strength Standards tool's tiers. Only movements
// that ARE the standard's lift count — a Smith machine bench isn't a bench
// press, and grading it as one would flatter or insult you at random.
const STANDARD_FOR_EXERCISE = {
  'barbell-squat': 'squat',
  'flat-bench-press': 'bench',
  deadlift: 'deadlift',
  'hack-squat': 'hackSquat',
  'romanian-deadlift-rdl': 'rdl',
  'dumbbell-curl': 'bicepCurl',
  'ez-bar-skull-crusher': 'skullCrusher',
  't-bar-row': 'tBarRow',
  'smith-machine-squat': 'smithSquat',
  'leg-extension': 'legExtension',
  'lying-leg-curl': 'legCurl',
  'seated-leg-curl': 'legCurl',
  'incline-barbell-bench-press': 'inclineBench',
  'close-grip-bench-press': 'closeGripBench',
  'machine-chest-press': 'machineChestPress',
  'chest-press-machine': 'machineChestPress',
  'lat-pulldown-wide-grip': 'latPulldown',
  'lat-pulldown-overhand-grip': 'latPulldown',
  'seated-cable-row': 'seatedCableRow',
  'barbell-bent-over-row': 'pendlayRow',
  'seated-row-machine': 'machineRow',
  'barbell-shrug': 'shrug',
  'overhead-press-machine-wide-grip': 'machineShoulderPress',
  'overhead-press-machine-narrow-grip': 'machineShoulderPress',
  'seated-dumbbell-lateral-raise': 'lateralRaise',
  'barbell-upright-row': 'uprightRow',
  'face-pull': 'facePull',
  'barbell-front-squat': 'frontSquat',
  'leg-press': 'legPress',
  'dumbbell-bulgarian-split-squat': 'bulgarianSplitSquat',
  'sumo-deadlift': 'sumoDeadlift',
  'barbell-hip-thrusts': 'hipThrust',
  'calf-raise-machine': 'calfRaise',
  'smith-machine-standing-calf-raise': 'calfRaise',
  'barbell-curl': 'barbellCurl',
  'ez-bar-preacher-curl': 'preacherCurl',
  'hammer-curl': 'hammerCurl',
  'push-down-straight-bar': 'tricepPushdown',
  'push-down-rope': 'tricepPushdown',
  'cable-rope-overhead-triceps-extension': 'overheadExtension',
  'standing-ez-bar-overhead-tricep-extensions': 'overheadExtension',
}

// Your current level, so the best lift of the last 12 weeks — not an all-time
// best from a stronger year.
const STRENGTH_WINDOW_DAYS = 84

export function strengthLevels(sessions, { sex, bodyweightKg, now = Date.now() }) {
  if (!sex || !(bodyweightKg > 0)) return null
  const from = startOfDay(now) - (STRENGTH_WINDOW_DAYS - 1) * DAY_MS
  const best = new Map() // standard key -> { kg, name }
  for (const s of sessions) {
    if (s.date < from || s.date > now) continue
    for (const ex of s.exercises) {
      if (ex.kind === 'cardio') continue
      const key = STANDARD_FOR_EXERCISE[dbIdOf(ex)]
      if (!key) continue
      const { e1rm } = bestOf(ex, s.unit || 'kg', 'kg')
      if (e1rm > (best.get(key)?.kg || 0)) best.set(key, { kg: e1rm, name: ex.name.trim() })
    }
  }
  const rows = []
  for (const [key, { kg, name }] of best) {
    const tiers = lifts[key][sex]
    const ratio = kg / bodyweightKg
    const tier = matchTier(tiers, ratio)
    const index = tiers.findIndex((t) => t.label === tier)
    const next = tiers[index + 1] || null
    rows.push({
      key,
      name,
      category: lifts[key].category,
      e1rmKg: kg,
      ratio: Math.round(ratio * 100) / 100,
      tier,
      index,
      count: tiers.length,
      next: next ? { label: next.label, kg: next.floor * bodyweightKg } : null,
    })
  }
  rows.sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || b.ratio - a.ratio)
  return rows
}

// ---- Effort ------------------------------------------------------------------------
// How close to failure the working sets in the last 4 weeks were, by logged RIR,
// against the 4 weeks before. Warm-ups and sets with no RIR don't count.
const EFFORT_DAYS = 28

function rirValues(sessions, from, to) {
  const out = []
  for (const s of sessions) {
    if (!inWindow(s, from, to)) continue
    for (const ex of s.exercises) {
      if (ex.kind === 'cardio') continue
      for (const set of ex.sets) {
        if (isWarmup(set)) continue
        for (const side of sides(set)) {
          if (!(Number(side.reps) > 0)) continue
          if (side.rir === '' || side.rir == null || !Number.isFinite(Number(side.rir))) continue
          out.push(Number(side.rir))
        }
      }
    }
  }
  return out
}

const avg = (xs) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null)

export function effortSummary(sessions, now = Date.now()) {
  const to = now + 1
  const from = startOfDay(now) - (EFFORT_DAYS - 1) * DAY_MS
  const rirs = rirValues(sessions, from, to)
  const prev = rirValues(sessions, from - EFFORT_DAYS * DAY_MS, from)
  const share = (test) => (rirs.length ? Math.round((100 * rirs.filter(test).length) / rirs.length) : 0)
  return {
    sets: rirs.length,
    avg: avg(rirs),
    prevAvg: avg(prev),
    failure: share((r) => r <= 0),
    hard: share((r) => r >= 1 && r <= 3),
    easy: share((r) => r >= 4),
  }
}

// ---- Rest times -----------------------------------------------------------------
// Your average rest between working sets in the last 4 weeks, per movement,
// against the DB's recommended range for it (restSeconds). Rests come from the
// sets' completion stamps, so only sets ticked off live are measured.
const REST_DAYS = 28

export function restSummary(sessions, now = Date.now(), limit = 6) {
  const from = startOfDay(now) - (REST_DAYS - 1) * DAY_MS
  const all = []
  const byName = new Map()
  for (const s of sessions) {
    if (!inWindow(s, from, now + 1)) continue
    for (const ex of s.exercises) {
      if (ex.kind === 'cardio') continue
      const rests = restBetweenSets(ex)
      if (!rests.length) continue
      all.push(...rests)
      const key = ex.name.trim().toLowerCase()
      const cur = byName.get(key) || { name: ex.name.trim(), rests: [], range: getExercise(dbIdOf(ex))?.restSeconds || null }
      cur.rests.push(...rests)
      byName.set(key, cur)
    }
  }
  const mean = (xs) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length)
  const rows = [...byName.values()]
    .map((r) => {
      const sec = mean(r.rests)
      const [lo, hi] = Array.isArray(r.range) ? r.range : [null, null]
      const status = lo == null ? null : sec < lo ? 'short' : sec > hi ? 'long' : 'ok'
      return { name: r.name, sec, lo, hi, status, count: r.rests.length }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
  return { avgSec: all.length ? mean(all) : null, rests: all.length, rows }
}

// ---- Cardio --------------------------------------------------------------------------
// Cardio logged since Monday: sessions with any, minutes, and distance in the
// display unit's system.
export function cardioThisWeek(sessions, unit = 'kg', now = Date.now()) {
  const from = weekStart(now)
  const dist = distanceUnit(unit)
  let minutes = 0
  let distance = 0
  let days = 0
  for (const s of sessions) {
    if (!inWindow(s, from, now + 1)) continue
    let any = false
    for (const ex of s.exercises) {
      if (ex.kind !== 'cardio') continue
      for (const set of ex.sets) {
        const m = Number(set.duration) || 0
        if (m <= 0) continue
        any = true
        minutes += m
        const d = Number(set.distance) || 0
        if (d > 0) distance += convertDistance(d, distanceUnit(s.unit || 'kg'), dist)
      }
    }
    if (any) days++
  }
  return { days, minutes: Math.round(minutes), distance: Math.round(distance * 10) / 10, distanceUnit: dist }
}

// ---- Training time ----------------------------------------------------------------
// Hours a week (the same figure the calculators use), the average session over
// the last 4 weeks against the 4 before, and the last 8 weeks' hours for bars.
export function trainingTime(sessions, now = Date.now()) {
  const from = startOfDay(now) - 27 * DAY_MS
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
  const timed = (a, b) => sessions.filter((s) => inWindow(s, a, b) && s.durationMs > 0).map((s) => s.durationMs)
  const thisWeek = weekStart(now)
  const weeks = []
  for (let i = 7; i >= 0; i--) {
    const d = new Date(thisWeek)
    d.setDate(d.getDate() - 7 * i)
    const start = d.getTime()
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    const ms = sessions.filter((s) => inWindow(s, start, end.getTime())).reduce((sum, s) => sum + (s.durationMs || 0), 0)
    weeks.push({ start, hours: Math.round((ms / 3600000) * 10) / 10 })
  }
  return {
    hoursPerWeek: weeklyTrainingHours(sessions, now),
    avgSessionMs: mean(timed(from, now + 1)),
    prevAvgSessionMs: mean(timed(from - 28 * DAY_MS, from)),
    weeks,
  }
}
