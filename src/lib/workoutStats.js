// Progress analytics for the workout log.
//
// Pure functions only — they take sessions and hand back numbers/series.
// No storage, no UI. This is the layer that turns your logged sets into the
// data behind the graphs, and it'll move to the app untouched.

const LB_PER_KG = 2.2046226218

// Convert a weight between kg and lbs. Sessions store the unit they were
// logged in; graphs normalise everything to one display unit so a line stays
// continuous even if you switched units partway through.
export function convertWeight(value, from, to) {
  if (from === to || value === '' || value == null) return value
  return from === 'kg' ? value * LB_PER_KG : value / LB_PER_KG
}

// Brzycki 1RM estimate — the same formula the site's 1RM calculator uses,
// so the graph agrees with that tool. Accurate at low reps, rough past ~12.
export function estimatedOneRepMax(weight, reps) {
  if (!(weight > 0) || !(reps >= 1)) return null
  if (reps === 1) return weight
  const r = Math.min(reps, 36) // guard the 37-rep divide-by-zero
  return (weight * 36) / (37 - r)
}

// Gather every set of one exercise within a single session (an exercise can
// appear more than once — combine them).
function setsForExercise(session, name) {
  const target = name.trim().toLowerCase()
  const sets = []
  for (const ex of session.exercises) {
    if (ex.name.trim().toLowerCase() === target) sets.push(...ex.sets)
  }
  return sets
}

// Each metric turns one session's sets into a single number (or null if the
// session has no usable data for it).
export const METRICS = [
  {
    id: 'e1rm',
    label: 'Est. 1RM',
    unit: 'kg',
    compute(sets) {
      let best = null
      for (const s of sets) {
        const v = estimatedOneRepMax(Number(s.weight), Number(s.reps))
        if (v !== null && (best === null || v > best)) best = v
      }
      return best === null ? null : Math.round(best)
    },
  },
  {
    id: 'top',
    label: 'Top set',
    unit: 'kg',
    compute(sets) {
      let best = null
      for (const s of sets) {
        const w = Number(s.weight)
        if (w > 0 && Number(s.reps) >= 1 && (best === null || w > best)) best = w
      }
      return best
    },
  },
  {
    id: 'volume',
    label: 'Volume',
    unit: 'kg',
    compute(sets) {
      let total = 0
      for (const s of sets) {
        const w = Number(s.weight) || 0
        const r = Number(s.reps) || 0
        if (r >= 1) total += w * r
      }
      return total > 0 ? Math.round(total) : null
    },
  },
  {
    id: 'reps',
    label: 'Total reps',
    unit: 'reps',
    compute(sets) {
      let total = 0
      for (const s of sets) {
        const r = Number(s.reps) || 0
        if (r >= 1) total += r
      }
      return total > 0 ? total : null
    },
  },
]

export const RANGES = [
  { id: '1m', label: '1M', days: 30 },
  { id: '3m', label: '3M', days: 91 },
  { id: '6m', label: '6M', days: 182 },
  { id: '1y', label: '1Y', days: 365 },
  { id: '2y', label: '2Y', days: 730 },
  { id: '3y', label: '3Y', days: 1095 },
  { id: '5y', label: '5Y', days: 1825 },
  { id: 'all', label: 'All', days: Infinity },
]

export function metricById(id) {
  return METRICS.find((m) => m.id === id) || METRICS[0]
}

// Build the plotted series: one point per session that has data, filtered to
// the chosen time range, sorted oldest → newest.
export function buildSeries(sessions, exerciseName, metricId, rangeId, displayUnit = 'kg') {
  const metric = metricById(metricId)
  const range = RANGES.find((r) => r.id === rangeId) || RANGES[RANGES.length - 1]
  const cutoff = range.days === Infinity ? 0 : Date.now() - range.days * 86400000

  const points = []
  for (const session of sessions) {
    if (session.date < cutoff) continue
    const sessionUnit = session.unit || 'kg'
    const sets = setsForExercise(session, exerciseName).map((s) => ({
      ...s,
      weight: s.weight === '' || s.weight == null ? s.weight : convertWeight(Number(s.weight), sessionUnit, displayUnit),
    }))
    if (sets.length === 0) continue
    const value = metric.compute(sets)
    if (value === null) continue
    points.push({ date: session.date, value, provisional: !!session.provisional })
  }
  points.sort((a, b) => a.date - b.date)
  return points
}

// Turn a session into anonymized rows for the shared strength dataset,
// normalising every weight to kg so the dataset is consistent. Bodyweight and
// sex come from the user's profile; no identity is included.
export function buildSharedLifts(session, profile) {
  const rows = []
  const sessionUnit = session.unit || 'kg'
  const bwKg = profile.bodyweight ? convertWeight(Number(profile.bodyweight), profile.unit || 'kg', 'kg') : null
  for (const ex of session.exercises) {
    for (const s of ex.sets) {
      const reps = Number(s.reps)
      if (!(reps > 0)) continue
      const weight = Number(s.weight)
      rows.push({
        exercise: ex.name,
        weight: weight > 0 ? Math.round(convertWeight(weight, sessionUnit, 'kg') * 100) / 100 : null,
        reps,
        rir: s.rir === '' || s.rir == null ? null : Number(s.rir),
        unit: 'kg',
        bodyweight: bwKg ? Math.round(bwKg * 100) / 100 : null,
        sex: profile.sex || null,
        logged_at: new Date(session.date).toISOString(),
      })
    }
  }
  return rows
}

// Every unique exercise name ever logged, most-recent first.
export function loggedExerciseNames(sessions) {
  const seen = new Map()
  for (const session of sessions) {
    for (const ex of session.exercises) {
      const key = ex.name.trim().toLowerCase()
      if (!seen.has(key)) seen.set(key, ex.name.trim())
    }
  }
  return [...seen.values()]
}
