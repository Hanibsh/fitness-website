// Hypertrophy engine v1 — effective weekly volume per muscle.
//
// Pure functions over logged sessions (same pattern as dashboard.js /
// workoutStats.js): deterministic, portable, works for guests. "Effective
// volume" = for each working set, sum `muscle_contribution × RIR_effectiveness`
// per muscle, so a set counts more for the muscles it actually targets and more
// when taken closer to failure. Warm-ups are excluded; bodyweight sets are
// ordinary working sets and count. Tracks sub-muscle atoms from the exercise DB
// and rolls them up to engine muscle groups (the drill-down shows the atoms).

import exercisesDb from '../data/exercises.json'
import { rirEffectiveness, ATOM_TO_GROUP, ENGINE_MUSCLES, landmarksFor } from './engineConfig'
import { muscleForExercise } from './dashboard'
import { exerciseIdForName } from './exerciseLibrary'

const DAY = 86400000
const DB_BY_ID = new Map((exercisesDb.exercises || []).map((e) => [e.id, e]))

function startOfDay(ts) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// A resistance set counts if it's a real working set (reps logged, not a
// warm-up). Cardio has no resistance muscle volume.
function isWorking(set, kind) {
  if (kind === 'cardio' || set.type === 'warmup') return false
  if (set.left) return Number(set.left?.reps) > 0 || Number(set.right?.reps) > 0
  return Number(set.reps) > 0
}

// The set's RIR (unilateral: average the logged limbs), or null if unlogged.
function setRir(set) {
  if (set.left) {
    const vals = [set.left?.rir, set.right?.rir]
      .filter((v) => v !== '' && v != null)
      .map(Number)
      .filter(Number.isFinite)
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }
  return set.rir === '' || set.rir == null ? null : Number(set.rir)
}

const round1 = (n) => Math.round(n * 10) / 10

// Effective weekly volume per muscle over the last `days` days (inclusive).
// Returns one entry per ENGINE_MUSCLES group: { muscle, sets, atoms:[{atom,
// sets}], landmarks:{low,high}, status:'under'|'in'|'over' }.
export function effectiveWeeklyVolume(sessions, { days = 7, now = Date.now() } = {}) {
  const cutoff = startOfDay(now) - (days - 1) * DAY
  const atomSets = {} // DB atom -> effective sets
  const groupFallback = {} // engine muscle -> effective sets (custom exercises, no DB atoms)

  for (const s of sessions) {
    if (startOfDay(s.date) < cutoff) continue
    for (const ex of s.exercises) {
      if (ex.kind === 'cardio') continue
      // Prefer the stored id; fall back to matching by name for sessions logged
      // before ids existed (or typed rather than picked from the search box) —
      // otherwise these silently lost their muscle-atom detail (or all credit).
      const dbId = ex.exerciseId || exerciseIdForName(ex.name)
      const db = dbId ? DB_BY_ID.get(dbId) : null
      for (const set of ex.sets) {
        if (!isWorking(set, ex.kind)) continue
        const eff = rirEffectiveness(setRir(set))
        if (db && db.muscles && Object.keys(db.muscles).length) {
          for (const [atom, w] of Object.entries(db.muscles)) atomSets[atom] = (atomSets[atom] || 0) + w * eff
        } else {
          // Custom / unmatched exercise: coarse group from the name (no atoms).
          const g = muscleForExercise(ex.name)
          if (g) groupFallback[g] = (groupFallback[g] || 0) + eff
        }
      }
    }
  }

  const byGroup = {} // muscle -> { sets, atoms: {atom: sets} }
  const bump = (muscle, sets, atom) => {
    if (!muscle) return
    byGroup[muscle] = byGroup[muscle] || { sets: 0, atoms: {} }
    byGroup[muscle].sets += sets
    if (atom) byGroup[muscle].atoms[atom] = (byGroup[muscle].atoms[atom] || 0) + sets
  }
  for (const [atom, sets] of Object.entries(atomSets)) bump(ATOM_TO_GROUP[atom], sets, atom)
  for (const [muscle, sets] of Object.entries(groupFallback)) bump(muscle, sets, null)

  // Landmarks are weekly guidance; scale them to the requested window (e.g. a
  // 30-day view compares against ~4.3x the weekly range) so status stays
  // meaningful at any range, not just the default 7 days.
  const scale = days / 7
  return ENGINE_MUSCLES.map((muscle) => {
    const g = byGroup[muscle] || { sets: 0, atoms: {} }
    const sets = round1(g.sets)
    const weekly = landmarksFor(muscle)
    const lm = { low: Math.round(weekly.low * scale), high: Math.round(weekly.high * scale) }
    const status = sets < lm.low ? 'under' : sets > lm.high ? 'over' : 'in'
    return {
      muscle,
      sets,
      landmarks: lm,
      status,
      atoms: Object.entries(g.atoms)
        .map(([atom, s]) => ({ atom, sets: round1(s) }))
        .sort((a, b) => b.sets - a.sets),
    }
  })
}
