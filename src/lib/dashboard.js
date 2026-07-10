// Dashboard analytics — pure functions that turn logged sessions into the
// numbers behind the home dashboard. No storage, no UI. Everything normalises
// weights to a single display unit so totals are consistent even if you logged
// some sessions in kg and others in lbs.

import { convertWeight, estimatedOneRepMax } from './workoutStats'
import { MOVEMENTS } from './movements'
import exercisesDb from '../data/exercises.json'

const DAY = 86400000

// ---- Muscle mapping --------------------------------------------------------
// Infer the primary muscle of an exercise from the movement library's keywords
// (falling back to its category). Custom exercises we don't recognise return
// null and are simply left out of muscle breakdowns.
export const MUSCLE_GROUPS = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Abs']

// Order matters: specific muscles are checked before broad ones so e.g. a
// Romanian deadlift (hamstrings, glutes) resolves to Hamstrings, and a squat
// (quads, glutes) to Quads.
const MUSCLE_MATCHERS = [
  ['Triceps', ['triceps', 'tricep']],
  ['Forearms', ['forearm', 'brachioradialis', 'wrist flexor', 'wrist extensor', 'grip']],
  ['Biceps', ['biceps', 'bicep', 'brachialis']],
  ['Hamstrings', ['hamstrings', 'hamstring']],
  ['Calves', ['calves', 'calf', 'soleus']],
  ['Quads', ['quads', 'quad']],
  ['Glutes', ['glutes', 'glute']],
  ['Abs', ['abs', 'obliques', 'core']],
  ['Chest', ['chest', 'pecs', 'pec']],
  ['Shoulders', ['delts', 'delt', 'shoulder']],
  ['Back', ['lats', 'lat', 'traps', 'trap', 'back']],
]

const CATEGORY_MUSCLE = { Chest: 'Chest', Back: 'Back', Shoulders: 'Shoulders', Arms: 'Biceps', Forearms: 'Forearms', Legs: 'Quads', Core: 'Abs' }

// For custom exercises we don't have in the library, guess the muscle from
// common exercise-name patterns. Ordered so more specific movements win — e.g.
// "leg curl" is Hamstrings before the generic "curl" → Biceps rule.
const NAME_PATTERNS = [
  ['Hamstrings', ['leg curl', 'lying curl', 'seated curl', 'ham curl', 'nordic', 'hamstring', 'rdl', 'romanian', 'good morning']],
  ['Glutes', ['hip thrust', 'glute', 'bridge', 'kickback', 'pull-through', 'pull through', 'hip abduction']],
  ['Calves', ['calf raise', 'calf', 'soleus']],
  ['Quads', ['squat', 'lunge', 'leg extension', 'leg press', 'step up', 'step-up', 'hack']],
  ['Triceps', ['pushdown', 'pressdown', 'tricep', 'skull', 'overhead extension', 'kickback', 'close-grip', 'close grip']],
  ['Forearms', ['wrist curl', 'forearm curl', 'forearm', 'reverse curl', 'grip', 'farmer']],
  ['Biceps', ['curl']],
  ['Back', ['row', 'pulldown', 'pull-up', 'pullup', 'pull up', 'chin', 'deadlift', 'shrug', 'pullover', 'lat ']],
  ['Chest', ['bench', 'chest', 'fly', 'flye', 'push-up', 'pushup', 'press up', 'pec', 'dip']],
  ['Shoulders', ['lateral raise', 'front raise', 'overhead press', 'shoulder press', 'ohp', 'delt', 'arnold', 'upright row', 'face pull', 'reverse fly']],
  ['Abs', ['crunch', 'plank', 'sit-up', 'situp', 'leg raise', 'rollout', 'woodchop', 'russian twist', 'ab ']],
]

const MOVEMENT_BY_NAME = new Map(MOVEMENTS.map((m) => [m.name.toLowerCase(), m]))

// The ID'd exercise DB carries per-muscle contributions. Map its anatomical
// muscle names onto the dashboard's broader groups and take each exercise's
// dominant (highest-contribution) muscle, so a DB movement resolves from real
// data rather than name guessing. (Muscles with no dashboard group — e.g.
// abductors — are skipped; those exercises fall through below.)
const DB_MUSCLE_TO_GROUP = {
  Triceps: 'Triceps',
  Biceps: 'Biceps', Brachialis: 'Biceps',
  Brachioradialis: 'Forearms', 'Wrist Flexors': 'Forearms', 'Wrist Extensors': 'Forearms', 'Deep Finger Flexors': 'Forearms',
  Quadriceps: 'Quads',
  Hamstrings: 'Hamstrings',
  'Glute Max': 'Glutes',
  Gastrocnemius: 'Calves', Soleus: 'Calves',
  'Front Delts': 'Shoulders', 'Side Delts': 'Shoulders', 'Rear Delts': 'Shoulders', 'Rotator Cuff': 'Shoulders',
  'Upper Chest': 'Chest', 'Middle Chest': 'Chest', 'Lower Chest': 'Chest',
  Lats: 'Back', 'Mid Back': 'Back', Rhomboids: 'Back', 'Upper Traps': 'Back', 'Mid Traps': 'Back', 'Lower Traps': 'Back', 'Spinal Erectors': 'Back',
  'Rectus Abdominis': 'Abs', 'Transverse Abdominis': 'Abs', Obliques: 'Abs', 'Hip Flexors': 'Abs',
}

function dominantGroup(muscles) {
  let best = null
  let bestWeight = -1
  for (const [muscle, weight] of Object.entries(muscles || {})) {
    const group = DB_MUSCLE_TO_GROUP[muscle]
    if (group && weight > bestWeight) {
      best = group
      bestWeight = weight
    }
  }
  return best
}

const DB_MUSCLE_BY_NAME = new Map(
  (exercisesDb.exercises || []).map((e) => [e.name.trim().toLowerCase(), dominantGroup(e.muscles)])
)

export function muscleForExercise(name) {
  const raw = (name || '').trim().toLowerCase()
  if (!raw) return null
  // Prefer the DB's real muscle data when we recognise the exercise by name.
  const fromDb = DB_MUSCLE_BY_NAME.get(raw)
  if (fromDb) return fromDb
  const m = MOVEMENT_BY_NAME.get(raw)
  if (m) {
    if (m.category === 'Cardio' || m.category === 'Full Body' || m.category === 'Olympic') return null
    const hay = [m.name, ...(m.keywords || [])].join(' ').toLowerCase()
    for (const [muscle, words] of MUSCLE_MATCHERS) {
      if (words.some((w) => hay.includes(w))) return muscle
    }
    return CATEGORY_MUSCLE[m.category] || null
  }
  // Not in the library — infer from the custom name. First look for an explicit
  // muscle word, then fall back to exercise-name patterns.
  for (const [muscle, words] of MUSCLE_MATCHERS) {
    if (words.some((w) => raw.includes(w))) return muscle
  }
  for (const [muscle, patterns] of NAME_PATTERNS) {
    if (patterns.some((p) => raw.includes(p))) return muscle
  }
  return null
}

// ---- Small helpers ---------------------------------------------------------
function startOfDay(ts) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function isCardio(ex) {
  return ex.kind === 'cardio'
}

// Unilateral sets store each limb separately ({left, right}) instead of
// top-level reps/weight/rir — every stat below needs to see through that
// shape or it silently drops unilateral exercises entirely (Bulgarian split
// squats, single-arm rows, …). Each limb moved its own real weight/reps, so
// they're aggregated as independent entries; bilateral sets pass through
// unchanged. Mirrors the flattening workoutStats.js already does for graphs.
function sides(s) {
  return s.left ? [s.left, s.right].filter(Boolean) : [s]
}

// Whether this logged row is a performed set at all — a unilateral row is one
// set of the movement (not two), so this checks either limb, not both summed.
function hasReps(s) {
  return sides(s).some((side) => Number(side.reps) > 0)
}

// Working strength sets only (reps logged). Cardio entries are counted where
// relevant via duration instead.
function workingSets(ex) {
  return ex.sets.filter(hasReps)
}

// ---- Per-session numbers ---------------------------------------------------
export function sessionVolume(session, unit = 'kg') {
  const from = session.unit || 'kg'
  let vol = 0
  for (const ex of session.exercises) {
    if (isCardio(ex)) continue
    for (const s of ex.sets) {
      for (const side of sides(s)) {
        const reps = Number(side.reps) || 0
        const w = Number(side.weight) || 0
        if (reps > 0 && w > 0) vol += reps * convertWeight(w, from, unit)
      }
    }
  }
  return Math.round(vol)
}

export function sessionSetCount(session) {
  let n = 0
  for (const ex of session.exercises) {
    if (isCardio(ex)) n += ex.sets.filter((s) => Number(s.duration) > 0).length
    else n += workingSets(ex).length
  }
  return n
}

export function sessionRepCount(session) {
  let n = 0
  for (const ex of session.exercises) {
    if (isCardio(ex)) continue
    for (const s of ex.sets) {
      for (const side of sides(s)) n += Number(side.reps) > 0 ? Number(side.reps) : 0
    }
  }
  return n
}

function sessionRirValues(session) {
  const out = []
  for (const ex of session.exercises) {
    if (isCardio(ex)) continue
    for (const s of ex.sets) {
      for (const side of sides(s)) {
        if (Number(side.reps) > 0 && side.rir !== '' && side.rir != null && Number.isFinite(Number(side.rir))) out.push(Number(side.rir))
      }
    }
  }
  return out
}

// A friendly duration string from stored ms, or null if not tracked.
export function formatDuration(ms) {
  if (!ms || !Number.isFinite(ms) || ms <= 0) return null
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

// ---- Weekly streak ---------------------------------------------------------
// Number of weeks (Mon–Sun) trained in a row. A weekly measure fits training
// with rest days — off days never break it. The current week counts once it
// has a workout, but an empty current week doesn't break the streak (we start
// counting from the most recent trained week).
function weekStart(ts) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  const mondayOffset = (d.getDay() + 6) % 7 // Mon=0 … Sun=6
  d.setDate(d.getDate() - mondayOffset)
  return d.getTime()
}

export function weeklyStreak(sessions) {
  if (!sessions.length) return 0
  const WEEK = 7 * DAY
  const active = new Set(sessions.map((s) => weekStart(s.date)))
  let cursor = weekStart(Date.now())
  if (!active.has(cursor)) cursor -= WEEK // this week empty so far — don't break
  let streak = 0
  while (active.has(cursor)) {
    streak += 1
    cursor -= WEEK
  }
  return streak
}

// ---- Split detection / next suggested --------------------------------------
const SPLIT_CYCLES = {
  push: 'Pull day',
  pull: 'Legs day',
  legs: 'Push day',
  upper: 'Lower day',
  lower: 'Upper day',
}

export function nextSuggestedWorkout(sessions) {
  const last = [...sessions].sort((a, b) => b.date - a.date)[0]
  const name = (last?.name || '').toLowerCase()
  for (const key of Object.keys(SPLIT_CYCLES)) {
    if (name.includes(key)) return SPLIT_CYCLES[key]
  }
  return 'Full body'
}

// ---- Aggregate over a filtered set of sessions -----------------------------
function aggregate(sessions, unit) {
  let volume = 0
  let sets = 0
  let reps = 0
  let durationMs = 0
  const rir = []
  const days = new Set()
  const exercises = new Set()
  for (const s of sessions) {
    volume += sessionVolume(s, unit)
    sets += sessionSetCount(s)
    reps += sessionRepCount(s)
    if (s.durationMs) durationMs += s.durationMs
    for (const v of sessionRirValues(s)) rir.push(v)
    days.add(startOfDay(s.date))
    for (const ex of s.exercises) exercises.add(ex.name.trim().toLowerCase())
  }
  return {
    workouts: sessions.length,
    daysTrained: days.size,
    volume,
    sets,
    reps,
    durationMs,
    avgDurationMs: sessions.length ? Math.round(durationMs / sessions.filter((s) => s.durationMs).length || 0) : 0,
    avgRir: rir.length ? Math.round((rir.reduce((a, b) => a + b, 0) / rir.length) * 10) / 10 : null,
    exercises: exercises.size,
  }
}

export function monthStats(sessions, year, month, unit = 'kg') {
  const inMonth = sessions.filter((s) => {
    const d = new Date(s.date)
    return d.getFullYear() === year && d.getMonth() === month
  })
  const base = aggregate(inMonth, unit)
  // Average duration should divide by sessions that actually have a duration.
  const withDur = inMonth.filter((s) => s.durationMs)
  base.avgDurationMs = withDur.length ? Math.round(withDur.reduce((a, s) => a + s.durationMs, 0) / withDur.length) : 0
  base.prs = countPRsInRange(sessions, unit, (d) => d.getFullYear() === year && d.getMonth() === month)
  return base
}

export function lifetimeStats(sessions, unit = 'kg') {
  const base = aggregate(sessions, unit)
  return {
    workouts: base.workouts,
    exercises: base.exercises,
    sets: base.sets,
    reps: base.reps,
    volume: base.volume,
    durationMs: base.durationMs,
  }
}

// ---- Weekly muscle volume (hard sets per muscle) ---------------------------
// Count working sets per muscle group over an inclusive day window.
function muscleSetsInRange(sessions, fromTs, toTs) {
  const from = startOfDay(fromTs)
  const to = startOfDay(toTs)
  const counts = Object.fromEntries(MUSCLE_GROUPS.map((m) => [m, 0]))
  for (const s of sessions) {
    const d = startOfDay(s.date)
    if (d < from || d > to) continue
    for (const ex of s.exercises) {
      if (isCardio(ex)) continue
      const muscle = muscleForExercise(ex.name)
      if (!muscle) continue
      counts[muscle] += workingSets(ex).length
    }
  }
  return counts
}

export function weeklyMuscleSets(sessions, days = 7) {
  const counts = muscleSetsInRange(sessions, Date.now() - (days - 1) * DAY, Date.now())
  return MUSCLE_GROUPS.map((m) => ({ muscle: m, sets: counts[m] }))
}

// ---- Specialization-block summary ------------------------------------------
// Per-muscle volume over a block's window, with the focus muscles flagged, plus
// how much of the total volume landed on them. Powers the dashboard's block card.
export function blockSummary(sessions, block, unit = 'kg') {
  if (!block) return null
  const to = block.endDate != null ? Math.min(block.endDate, Date.now()) : Date.now()
  const inBlock = sessions.filter((s) => {
    const d = startOfDay(s.date)
    return d >= startOfDay(block.startDate) && d <= startOfDay(to)
  })
  const counts = muscleSetsInRange(sessions, block.startDate, to)
  const weeks = Math.max(1, (startOfDay(to) - startOfDay(block.startDate)) / (7 * DAY) + 1 / 7)
  const focus = new Set(block.focusMuscles || [])
  const perMuscle = MUSCLE_GROUPS
    .map((m) => ({ muscle: m, sets: counts[m], weeklyAvg: Math.round((counts[m] / weeks) * 10) / 10, focus: focus.has(m) }))
    .sort((a, b) => Number(b.focus) - Number(a.focus) || b.sets - a.sets)
  const focusSets = perMuscle.filter((p) => p.focus).reduce((a, p) => a + p.sets, 0)
  const totalSets = perMuscle.reduce((a, p) => a + p.sets, 0)
  return {
    sessions: inBlock.length,
    volume: aggregate(inBlock, unit).volume,
    focusSets,
    totalSets,
    perMuscle,
  }
}

// ---- Personal records ------------------------------------------------------
// Best-ever numbers per exercise, plus the lifetime bests overall.
export function exerciseBests(sessions, unit = 'kg') {
  const map = new Map()
  for (const s of sessions) {
    const from = s.unit || 'kg'
    for (const ex of s.exercises) {
      if (isCardio(ex)) continue
      const key = ex.name.trim().toLowerCase()
      const cur = map.get(key) || { name: ex.name.trim(), weight: 0, e1rm: 0, reps: 0, volume: 0 }
      for (const set of ex.sets) {
        for (const side of sides(set)) {
          const reps = Number(side.reps) || 0
          const w = reps > 0 ? convertWeight(Number(side.weight) || 0, from, unit) : 0
          if (reps > 0) {
            if (w > cur.weight) cur.weight = w
            if (reps > cur.reps) cur.reps = reps
            const e = estimatedOneRepMax(w, reps)
            if (e && e > cur.e1rm) cur.e1rm = e
            cur.volume += w * reps
          }
        }
      }
      map.set(key, cur)
    }
  }
  return [...map.values()]
}

export function personalRecords(sessions, unit = 'kg') {
  const bests = exerciseBests(sessions, unit)
  let bestWeight = { value: 0 }
  let bestE1rm = { value: 0 }
  let bestReps = { value: 0 }
  for (const b of bests) {
    if (b.weight > bestWeight.value) bestWeight = { value: Math.round(b.weight), name: b.name }
    if (b.e1rm > bestE1rm.value) bestE1rm = { value: Math.round(b.e1rm), name: b.name }
    if (b.reps > bestReps.value) bestReps = { value: b.reps, name: b.name }
  }
  const lifetimeVolume = bests.reduce((a, b) => a + b.volume, 0)
  return {
    bestWeight,
    bestE1rm,
    bestReps,
    lifetimeVolume: Math.round(lifetimeVolume),
    sessions: sessions.length,
  }
}

// Count exercises that hit a new best estimated-1RM within a date range,
// comparing each session's top e1RM against the best from all earlier sessions.
function countPRsInRange(sessions, unit, inRange) {
  return recentPRs(sessions, unit, Infinity).filter((pr) => inRange(new Date(pr.date))).length
}

// PRs as a timeline: each time an exercise beats its previous best e1RM.
export function recentPRs(sessions, unit = 'kg', limit = 6) {
  const sorted = [...sessions].sort((a, b) => a.date - b.date)
  const best = new Map()
  const prs = []
  for (const s of sorted) {
    const from = s.unit || 'kg'
    for (const ex of s.exercises) {
      if (isCardio(ex)) continue
      const key = ex.name.trim().toLowerCase()
      let top = 0
      for (const set of ex.sets) {
        for (const side of sides(set)) {
          const reps = Number(side.reps) || 0
          if (reps < 1) continue
          const w = convertWeight(Number(side.weight) || 0, from, unit)
          const e = estimatedOneRepMax(w, reps)
          if (e && e > top) top = e
        }
      }
      if (top <= 0) continue
      const prev = best.get(key) || 0
      if (top > prev + 0.01) {
        if (prev > 0) prs.push({ name: ex.name.trim(), from: Math.round(prev), to: Math.round(top), date: s.date })
        best.set(key, top)
      }
    }
  }
  prs.sort((a, b) => b.date - a.date)
  return limit === Infinity ? prs : prs.slice(0, limit)
}

// ---- Training distribution -------------------------------------------------
export function splitDistribution(sessions) {
  const buckets = { Push: 0, Pull: 0, Legs: 0, Upper: 0, Lower: 0, Other: 0 }
  for (const s of sessions) {
    const n = (s.name || '').toLowerCase()
    if (n.includes('push')) buckets.Push += 1
    else if (n.includes('pull')) buckets.Pull += 1
    else if (n.includes('leg')) buckets.Legs += 1
    else if (n.includes('upper')) buckets.Upper += 1
    else if (n.includes('lower')) buckets.Lower += 1
    else buckets.Other += 1
  }
  return Object.entries(buckets)
    .filter(([, v]) => v > 0)
    .map(([label, value]) => ({ label, value }))
}


// ---- Recent activity + this-day-in-history ---------------------------------
export function recentActivity(sessions, limit = 8) {
  const prDays = new Set(recentPRs(sessions, 'kg', Infinity).map((p) => startOfDay(p.date)))
  return [...sessions]
    .sort((a, b) => b.date - a.date)
    .slice(0, limit)
    .map((s) => ({
      id: s.id,
      name: s.name || 'Workout',
      date: s.date,
      exercises: s.exercises.length,
      sets: sessionSetCount(s),
      hadPR: prDays.has(startOfDay(s.date)),
    }))
}

export function thisDayInHistory(sessions, unit = 'kg') {
  const now = new Date()
  const matches = sessions.filter((s) => {
    const d = new Date(s.date)
    const years = now.getFullYear() - d.getFullYear()
    return years >= 1 && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  })
  if (!matches.length) return null
  const s = matches.sort((a, b) => b.date - a.date)[0]
  const years = now.getFullYear() - new Date(s.date).getFullYear()
  return {
    yearsAgo: years,
    session: s,
    volume: sessionVolume(s, unit),
    sets: sessionSetCount(s),
    date: s.date,
  }
}

// ---- Hero summary ----------------------------------------------------------
export function heroSummary(sessions, unit = 'kg') {
  const sorted = [...sessions].sort((a, b) => b.date - a.date)
  const last = sorted[0] || null
  return {
    streak: weeklyStreak(sessions),
    last: last
      ? {
          name: last.name || 'Workout',
          date: last.date,
          volume: sessionVolume(last, unit),
          sets: sessionSetCount(last),
          durationMs: last.durationMs || null,
        }
      : null,
    next: nextSuggestedWorkout(sessions),
  }
}
