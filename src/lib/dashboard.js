// Dashboard analytics — pure functions that turn logged sessions into the
// numbers behind the home dashboard. No storage, no UI. Everything normalises
// weights to a single display unit so totals are consistent even if you logged
// some sessions in kg and others in lbs.

import { convertWeight, estimatedOneRepMax } from './workoutStats'
import { MOVEMENTS } from './movements'

const DAY = 86400000

// ---- Muscle mapping --------------------------------------------------------
// Infer the primary muscle of an exercise from the movement library's keywords
// (falling back to its category). Custom exercises we don't recognise return
// null and are simply left out of muscle breakdowns.
export const MUSCLE_GROUPS = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Abs']

// Order matters: specific muscles are checked before broad ones so e.g. a
// Romanian deadlift (hamstrings, glutes) resolves to Hamstrings, and a squat
// (quads, glutes) to Quads.
const MUSCLE_MATCHERS = [
  ['Triceps', ['triceps', 'tricep']],
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

const CATEGORY_MUSCLE = { Chest: 'Chest', Back: 'Back', Shoulders: 'Shoulders', Arms: 'Biceps', Legs: 'Quads', Core: 'Abs' }

const MOVEMENT_BY_NAME = new Map(MOVEMENTS.map((m) => [m.name.toLowerCase(), m]))

export function muscleForExercise(name) {
  const m = MOVEMENT_BY_NAME.get((name || '').trim().toLowerCase())
  if (!m) return null
  if (m.category === 'Cardio' || m.category === 'Full Body' || m.category === 'Olympic') return null
  const hay = [m.name, ...(m.keywords || [])].join(' ').toLowerCase()
  for (const [muscle, words] of MUSCLE_MATCHERS) {
    if (words.some((w) => hay.includes(w))) return muscle
  }
  return CATEGORY_MUSCLE[m.category] || null
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

// Working strength sets only (reps logged). Cardio entries are counted where
// relevant via duration instead.
function workingSets(ex) {
  return ex.sets.filter((s) => Number(s.reps) > 0)
}

// ---- Per-session numbers ---------------------------------------------------
export function sessionVolume(session, unit = 'kg') {
  const from = session.unit || 'kg'
  let vol = 0
  for (const ex of session.exercises) {
    if (isCardio(ex)) continue
    for (const s of ex.sets) {
      const reps = Number(s.reps) || 0
      const w = Number(s.weight) || 0
      if (reps > 0 && w > 0) vol += reps * convertWeight(w, from, unit)
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
    for (const s of ex.sets) n += Number(s.reps) > 0 ? Number(s.reps) : 0
  }
  return n
}

function sessionRirValues(session) {
  const out = []
  for (const ex of session.exercises) {
    if (isCardio(ex)) continue
    for (const s of ex.sets) {
      if (Number(s.reps) > 0 && s.rir !== '' && s.rir != null && Number.isFinite(Number(s.rir))) out.push(Number(s.rir))
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

// ---- Streak ----------------------------------------------------------------
export function computeStreak(sessions) {
  const days = [...new Set(sessions.map((s) => startOfDay(s.date)))].sort((a, b) => b - a)
  if (!days.length) return 0
  const today = startOfDay(Date.now())
  // Streak only counts if the latest workout was today or yesterday.
  if (days[0] !== today && days[0] !== today - DAY) return 0
  let cursor = days[0]
  let streak = 0
  for (const d of days) {
    if (d === cursor) {
      streak += 1
      cursor -= DAY
    } else if (d < cursor) {
      break
    }
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

// ---- Weekly muscle volume (hard sets per muscle, last 7 days) --------------
export function weeklyMuscleSets(sessions, days = 7) {
  const cutoff = startOfDay(Date.now()) - (days - 1) * DAY
  const counts = Object.fromEntries(MUSCLE_GROUPS.map((m) => [m, 0]))
  for (const s of sessions) {
    if (startOfDay(s.date) < cutoff) continue
    for (const ex of s.exercises) {
      if (isCardio(ex)) continue
      const muscle = muscleForExercise(ex.name)
      if (!muscle) continue
      counts[muscle] += workingSets(ex).length
    }
  }
  return MUSCLE_GROUPS.map((m) => ({ muscle: m, sets: counts[m] }))
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
        const reps = Number(set.reps) || 0
        const w = reps > 0 ? convertWeight(Number(set.weight) || 0, from, unit) : 0
        if (reps > 0) {
          if (w > cur.weight) cur.weight = w
          if (reps > cur.reps) cur.reps = reps
          const e = estimatedOneRepMax(w, reps)
          if (e && e > cur.e1rm) cur.e1rm = e
          cur.volume += w * reps
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
        const reps = Number(set.reps) || 0
        if (reps < 1) continue
        const w = convertWeight(Number(set.weight) || 0, from, unit)
        const e = estimatedOneRepMax(w, reps)
        if (e && e > top) top = e
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

export function muscleDistribution(sessions) {
  const counts = Object.fromEntries(MUSCLE_GROUPS.map((m) => [m, 0]))
  for (const s of sessions) {
    for (const ex of s.exercises) {
      if (isCardio(ex)) continue
      const muscle = muscleForExercise(ex.name)
      if (!muscle) continue
      counts[muscle] += workingSets(ex).length
    }
  }
  return MUSCLE_GROUPS.map((m) => ({ label: m, value: counts[m] })).filter((x) => x.value > 0)
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
    streak: computeStreak(sessions),
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
