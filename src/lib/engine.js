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
import { withAliases } from '../data/exerciseAliases'
import {
  rirEffectiveness, ATOM_TO_GROUP, ENGINE_MUSCLES, landmarksFor, volumeTier, fallbackMuscle, withinSessionMult,
  rirFatigue, FATIGUE_SCORE_COEF, DEFAULT_FATIGUE_SCORE, DEFAULT_RECOVERY_WINDOW,
  RECOVERY_DECAY_FACTOR, capacityFor, READY_THRESHOLD, RECOVERY_LOOKBACK_DAYS,
  AXIAL_MULT, FREE_WEIGHT_MULT, SYSTEMIC_TAU, SYSTEMIC_CAPACITY, systemicLevel,
  TARGET_CONTRIBUTION_MIN,
  EWMA_ALPHA, RESIDUAL_CLAMP, MIN_EXPOSURES_TO_LEARN, MAX_E1RM_REPS,
  PERSONAL_LEARNING_RATE, TAU_MULT_MIN, TAU_MULT_MAX, TAU_MULT_NOTEWORTHY, noveltyMult,
} from './engineConfig'
import { exerciseIdForName } from './exerciseLibrary'
import { estimatedOneRepMax, convertWeight } from './workoutStats'

const DAY = 86400000
const DB_BY_ID = withAliases(new Map((exercisesDb.exercises || []).map((e) => [e.id, e])))

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

// Walk every working resistance set logged on/after `since` (a start-of-day
// timestamp), resolving each exercise's DB entry once. Prefers the stored id;
// falls back to matching by name for sessions logged before ids existed (or
// typed rather than picked from the search box) — otherwise those silently
// lose their muscle-atom detail (or all credit). `db` is null for custom /
// unmatched exercises. Shared by volume (v1) and recovery (v2) so the two
// never drift on what counts as a working set.
function forEachWorkingSet(sessions, since, cb) {
  for (const s of sessions) {
    if (startOfDay(s.date) < since) continue
    for (const ex of s.exercises) {
      if (ex.kind === 'cardio') continue
      const dbId = ex.exerciseId || exerciseIdForName(ex.name)
      const db = dbId ? DB_BY_ID.get(dbId) : null
      for (const set of ex.sets) {
        if (isWorking(set, ex.kind)) cb(set, ex, db, s)
      }
    }
  }
}

// Effective weekly volume per muscle over the last `days` days (inclusive).
// Returns one entry per ENGINE_MUSCLES group: { muscle, sets, atoms:[{atom,
// sets}], landmarks:{low,high}, tier, status } where status is the tier id
// ('under' | 'prime' | 'solid' | 'taxing' | 'excess') — a position on the
// diminishing-returns curve, not a pass/fail band. One hard set credits at most
// 1.0 to any one muscle.
export function effectiveWeeklyVolume(sessions, { days = 7, now = Date.now() } = {}) {
  const cutoff = startOfDay(now) - (days - 1) * DAY
  const atomSets = {} // DB atom -> effective sets (regional detail, drill-down only)
  const groupSets = {} // engine muscle -> effective sets (the volume verdict)
  const groupFallback = {} // engine muscle -> effective sets (custom exercises, no DB atoms)

  // Within-session diminishing returns: per session, per muscle group, later
  // sets earn less credit. `k` = effective sets already credited this session.
  let curSession = null
  let k = {}

  forEachWorkingSet(sessions, cutoff, (set, ex, db, s) => {
    if (s !== curSession) {
      curSession = s
      k = {}
    }
    const eff = rirEffectiveness(setRir(set))
    if (db && db.muscles && Object.keys(db.muscles).length) {
      // Bucket the set's atoms by group so the multiplier applies once per
      // muscle group per set (a deadlift's three Back atoms share one slot).
      const byGroup = {}
      for (const [atom, w] of Object.entries(db.muscles)) {
        const g = ATOM_TO_GROUP[atom]
        if (g) (byGroup[g] = byGroup[g] || []).push([atom, w])
      }
      for (const [g, atoms] of Object.entries(byGroup)) {
        const dim = withinSessionMult(k[g] || 0)
        // A set is at most a set. The muscle's credit is its best-trained atom,
        // NEVER the sum: incline bench lists Upper 1.0 / Middle 0.5 / Lower 0.25
        // to say which region it biases toward — summing that to 1.75 "chest
        // sets" is a category error (the same one the taxonomy already avoids by
        // collapsing the three triceps heads). Cross-muscle credit stays
        // independent, so a squat still earns Quads AND Glutes on its own terms.
        const groupW = Math.max(...atoms.map(([, w]) => w))
        for (const [atom, w] of atoms) atomSets[atom] = (atomSets[atom] || 0) + w * eff * dim
        groupSets[g] = (groupSets[g] || 0) + groupW * eff * dim
        k[g] = (k[g] || 0) + groupW
      }
    } else {
      // Custom / unmatched exercise: guess the muscle from the name (no atoms).
      const g = fallbackMuscle(ex.name)
      if (g) {
        groupFallback[g] = (groupFallback[g] || 0) + eff * withinSessionMult(k[g] || 0)
        k[g] = (k[g] || 0) + 1
      }
    }
  })

  const byGroup = {} // muscle -> { sets, atoms: {atom: sets} }
  const ensure = (muscle) => {
    byGroup[muscle] = byGroup[muscle] || { sets: 0, atoms: {} }
    return byGroup[muscle]
  }
  // Totals come from the per-set capped credit…
  for (const [muscle, sets] of Object.entries(groupSets)) ensure(muscle).sets += sets
  for (const [muscle, sets] of Object.entries(groupFallback)) ensure(muscle).sets += sets
  // …while atoms carry the regional detail for the drill-down and heatmap only.
  for (const [atom, sets] of Object.entries(atomSets)) {
    const muscle = ATOM_TO_GROUP[atom]
    if (!muscle) continue
    const g = ensure(muscle)
    g.atoms[atom] = (g.atoms[atom] || 0) + sets
  }

  // Tiers are weekly; normalise the window's total to a weekly rate before
  // grading it (a 30-day view holds ~4.3x a week's sets) so the verdict stays
  // meaningful at any range. Landmarks are scaled the other way, to the window,
  // for the progress bar and the advisor's trim maths.
  const scale = days / 7
  return ENGINE_MUSCLES.map((muscle) => {
    const g = byGroup[muscle] || { sets: 0, atoms: {} }
    const sets = round1(g.sets)
    const weekly = landmarksFor(muscle)
    const lm = { low: round1(weekly.low * scale), high: round1(weekly.high * scale) }
    const tier = volumeTier(sets / scale, muscle)
    return {
      muscle,
      sets,
      landmarks: lm,
      tier,
      status: tier.id,
      atoms: Object.entries(g.atoms)
        .map(([atom, s]) => ({ atom, sets: round1(s) }))
        .sort((a, b) => b.sets - a.sets),
    }
  })
}

// ---- Engine v2: fatigue + recovery ------------------------------------------

const HOUR = 3600000

// Stable identity for exposure/trend tracking: DB id when known, else the
// typed name — so custom movements still get novelty and e1RM trends.
function exerciseKey(ex) {
  return ex.exerciseId || exerciseIdForName(ex.name) || `name:${ex.name.trim().toLowerCase()}`
}

// For each session: how many EARLIER sessions included each exercise. Drives
// the repeated-bout effect and the learning warm-up. Keyed by session id.
function exposureIndex(sessions) {
  const ordered = [...sessions].sort((a, b) => a.date - b.date)
  const counts = {}
  const before = new Map() // session.id -> { exerciseKey: prior session count }
  for (const s of ordered) {
    const keys = new Set()
    for (const ex of s.exercises || []) if (ex.kind !== 'cardio') keys.add(exerciseKey(ex))
    const snap = {}
    for (const k of keys) snap[k] = counts[k] || 0
    before.set(s.id, snap)
    for (const k of keys) counts[k] = (counts[k] || 0) + 1
  }
  return { before, counts }
}

// One working set's fatigue deposits: entries per engine muscle (base τ in
// hours — personalization scales it later) plus the systemic-pool amount.
// `extraMult` scales the muscle damage only (repeated-bout novelty).
function setFatigueDeposits(set, ex, db, extraMult = 1) {
  const coef = FATIGUE_SCORE_COEF[db?.fatigueScore] || FATIGUE_SCORE_COEF[DEFAULT_FATIGUE_SCORE]
  const rf = rirFatigue(setRir(set))
  const [lo, hi] = db?.recoveryWindowHours || DEFAULT_RECOVERY_WINDOW
  const tau = (lo + hi) / 2 / RECOVERY_DECAY_FACTOR
  const base = coef * rf * extraMult
  const entries = []
  if (db && db.muscles && Object.keys(db.muscles).length) {
    for (const [atom, w] of Object.entries(db.muscles)) {
      const g = ATOM_TO_GROUP[atom]
      if (g) entries.push({ muscle: g, atom, f0: w * base, tau })
    }
  } else {
    const g = fallbackMuscle(ex.name)
    if (g) entries.push({ muscle: g, atom: null, f0: base, tau })
  }
  const systemicF0 =
    coef * rf * (db?.axialLoading ? AXIAL_MULT : 1) * (db?.equipment === 'free weight' ? FREE_WEIGHT_MULT : 1)
  return { entries, systemicF0 }
}

// The engine muscles an exercise primarily trains (atoms ≥ TARGET_CONTRIBUTION_MIN,
// or the coarse name-based group) — where its performance evidence points.
// Exported flavor (resolves the DB entry itself) is used by the advisor.
export function primaryMusclesFor(ex) {
  const dbId = ex.exerciseId || exerciseIdForName(ex.name)
  return primaryMuscles(ex, dbId ? DB_BY_ID.get(dbId) : null)
}

function primaryMuscles(ex, db) {
  const out = new Set()
  if (db && db.muscles && Object.keys(db.muscles).length) {
    for (const [atom, w] of Object.entries(db.muscles)) {
      if (w >= TARGET_CONTRIBUTION_MIN && ATOM_TO_GROUP[atom]) out.add(ATOM_TO_GROUP[atom])
    }
  } else {
    const g = fallbackMuscle(ex.name)
    if (g) out.add(g)
  }
  return out
}

// Session-best e1RM for one logged exercise, in kg, RIR-normalized: reps + RIR
// ≈ reps to failure, so 100×8@2 and 100×10@0 read the same. Warm-ups skipped,
// unilateral limbs counted separately, effective reps past MAX_E1RM_REPS
// skipped (Brzycki is unreliable there).
function sessionE1rm(ex, sessionUnit) {
  let best = null
  for (const set of ex.sets) {
    if (set.type === 'warmup') continue
    const sides = set.left ? [set.left, set.right] : [set]
    for (const side of sides) {
      if (!side) continue
      const reps = Number(side.reps)
      const weight = Number(side.weight)
      if (!(reps > 0) || !(weight > 0)) continue
      const rir = side.rir === '' || side.rir == null ? 0 : Math.max(0, Math.min(10, Number(side.rir) || 0))
      const effReps = reps + rir
      if (effReps > MAX_E1RM_REPS) continue
      const v = estimatedOneRepMax(weight, effReps)
      if (v != null && (best == null || v > best)) best = v
    }
  }
  return best == null ? null : convertWeight(best, sessionUnit || 'kg', 'kg')
}

// ---- Engine v3: e1RM-residual personalization --------------------------------

// Chronological fold over the whole history — pure and deterministic, no
// stored learning state. Per session it (1) compares each familiar exercise's
// session e1RM against its EWMA trend and, when the residual CONTRADICTS the
// recovery prediction at that moment, nudges the muscle's τ multiplier
// (predicted recovering + performed at/above trend → recovers faster; predicted
// ready + underperformed → slower); then (2) deposits the session's fatigue so
// later predictions see it. Guards: ≥ MIN_EXPOSURES_TO_LEARN sessions of an
// exercise first, residuals clamped, small learning rate, multiplier clamped.
//
// Returns {
//   tauMult:   { muscle: 0.6–1.6 },          // recovery-speed multipliers
//   exposures: { exerciseKey: count },        // total sessions per exercise
//   perf:      { exerciseKey: { name, residuals:[last ≤6] } },
//   workedLow: { muscle: [bool, …last ≤6] },  // trained while under threshold?
//   observations,                             // residual comparisons made
//   exposureBefore: Map(sessionId -> {key: prior count}),  // for muscleRecovery
// }
export function personalizedModel(sessions) {
  const { before, counts } = exposureIndex(sessions)
  const ordered = [...sessions].filter((s) => s.exercises?.length).sort((a, b) => a.date - b.date)
  const tauMult = {}
  const trends = {} // exerciseKey -> EWMA of session e1RM (kg)
  const perf = {}
  const workedLow = {}
  let observations = 0

  // Fatigue deposits accumulated as the fold walks forward (base τ — the
  // CURRENT multiplier is applied at evaluation, so predictions always use
  // what's been learned so far, with no circularity).
  const deposits = {} // muscle -> [{f0, tau, ts}]
  const pctAt = (muscle, t) => {
    const scale = tauMult[muscle] || 1
    let sum = 0
    for (const d of deposits[muscle] || []) sum += d.f0 * Math.exp(-Math.max(0, t - d.ts) / HOUR / (d.tau * scale))
    return 100 * Math.max(0, 1 - sum / capacityFor(muscle))
  }

  for (const s of ordered) {
    // Old deposits are fully decayed — prune so the fold stays O(recent).
    const cut = s.date - RECOVERY_LOOKBACK_DAYS * DAY
    for (const m of Object.keys(deposits)) deposits[m] = deposits[m].filter((d) => d.ts >= cut)

    const seenBefore = before.get(s.id) || {}
    const musclesWorked = new Map() // muscle -> under threshold at session start?

    // 1) Learn from performance BEFORE this session's own fatigue lands.
    for (const ex of s.exercises) {
      if (ex.kind === 'cardio') continue
      const key = exerciseKey(ex)
      const dbId = ex.exerciseId || exerciseIdForName(ex.name)
      const db = dbId ? DB_BY_ID.get(dbId) : null
      for (const m of primaryMuscles(ex, db)) {
        if (!musclesWorked.has(m)) musclesWorked.set(m, pctAt(m, s.date) < READY_THRESHOLD)
      }

      const e1 = sessionE1rm(ex, s.unit)
      const trend = trends[key]
      if (e1 != null && trend > 0 && (seenBefore[key] || 0) >= MIN_EXPOSURES_TO_LEARN) {
        const residual = Math.max(-RESIDUAL_CLAMP, Math.min(RESIDUAL_CLAMP, (e1 - trend) / trend))
        observations++
        const p = (perf[key] = perf[key] || { name: ex.name, residuals: [] })
        p.residuals.push(residual)
        if (p.residuals.length > 6) p.residuals.shift()
        const strength = Math.abs(residual) / RESIDUAL_CLAMP // 0..1 evidence weight
        for (const m of primaryMuscles(ex, db)) {
          const under = musclesWorked.get(m)
          const dir = under && residual >= 0 ? -1 : !under && residual < 0 ? 1 : 0
          if (dir) {
            tauMult[m] = Math.min(TAU_MULT_MAX, Math.max(TAU_MULT_MIN, (tauMult[m] || 1) + dir * PERSONAL_LEARNING_RATE * strength))
          }
        }
      }
      if (e1 != null) trends[key] = trend == null ? e1 : EWMA_ALPHA * e1 + (1 - EWMA_ALPHA) * trend
    }
    for (const [m, under] of musclesWorked) {
      const list = (workedLow[m] = workedLow[m] || [])
      list.push(under)
      if (list.length > 6) list.shift()
    }

    // 2) Deposit this session's fatigue (novelty from exposures before it).
    for (const ex of s.exercises) {
      if (ex.kind === 'cardio') continue
      const dbId = ex.exerciseId || exerciseIdForName(ex.name)
      const db = dbId ? DB_BY_ID.get(dbId) : null
      const novelty = noveltyMult(seenBefore[exerciseKey(ex)] || 0)
      for (const set of ex.sets) {
        if (!isWorking(set, ex.kind)) continue
        const ts = set.completedAt || s.date
        for (const { muscle, f0, tau } of setFatigueDeposits(set, ex, db, novelty).entries) {
          ;(deposits[muscle] = deposits[muscle] || []).push({ f0, tau, ts })
        }
      }
    }
  }

  return { tauMult, exposures: counts, perf, workedLow, observations, exposureBefore: before }
}

// Per-muscle recovery right now, plus the whole-body pool. Every working set
// deposits fatigue on the muscles it loads (contribution × fatigue-score coef ×
// RIR multiplier × repeated-bout novelty) which decays exponentially with the
// exercise's own recovery window as the time constant — scaled by the
// PERSONALIZED per-muscle multiplier learned from e1RM residuals (pass
// personalize:false for the raw priors). Recovery % = how much of the muscle's
// capacity is free again; `readyAt` estimates when it crosses READY_THRESHOLD.
//
// Returns {
//   muscles: [{ muscle, recoveryPct, status:'ready'|'recovering', readyAt,
//               lastTrained,
//               atoms:[{ atom, recoveryPct, status }] }],  // one per ENGINE_MUSCLES;
//                                          // atoms = trained sub-muscles, most-fatigued first
//   systemic: { pct, level:'fresh'|'moderate'|'high' },  // pct = strain, 100 = wrecked
//   personal: { observations, notes:[{ muscle, mult }] }, // learned recovery speeds
// }
export function muscleRecovery(sessions, { now = Date.now(), personalize = true } = {}) {
  const since = startOfDay(now) - RECOVERY_LOOKBACK_DAYS * DAY
  const model = personalizedModel(sessions)
  const tauScale = (muscle) => (personalize ? model.tauMult[muscle] || 1 : 1)
  // Keep each deposit as {f0, tau, ts} so the same sum-of-exponentials can be
  // re-evaluated at future times for the ready-time scan.
  const deposits = {} // engine muscle -> [{ f0, tau, ts }]
  const atomDeposits = {} // DB atom -> [{ f0, tau, ts }] (for the group drill-down)
  const systemicDeposits = [] // [{ f0, ts }]
  const lastTrained = {} // engine muscle -> latest set timestamp

  forEachWorkingSet(sessions, since, (set, ex, db, s) => {
    // Old logs predate per-set timestamps — fall back to the session's date.
    const ts = Math.min(set.completedAt || s.date, now)
    const novelty = noveltyMult((model.exposureBefore.get(s.id) || {})[exerciseKey(ex)] || 0)
    const { entries, systemicF0 } = setFatigueDeposits(set, ex, db, novelty)
    for (const { muscle, atom, f0, tau } of entries) {
      ;(deposits[muscle] = deposits[muscle] || []).push({ f0, tau: tau * tauScale(muscle), ts })
      // Atoms inherit their group's learned recovery-speed multiplier, so the
      // drill-down and the group headline stay on one consistent scale.
      if (atom) (atomDeposits[atom] = atomDeposits[atom] || []).push({ f0, tau: tau * tauScale(muscle), ts })
      if (!lastTrained[muscle] || ts > lastTrained[muscle]) lastTrained[muscle] = ts
    }
    systemicDeposits.push({ f0: systemicF0, ts })
  })

  const decayedSum = (list, t, tauOverride) =>
    list.reduce((sum, d) => sum + d.f0 * Math.exp(-Math.max(0, t - d.ts) / HOUR / (tauOverride ?? d.tau)), 0)

  const muscles = ENGINE_MUSCLES.map((muscle) => {
    const list = deposits[muscle] || []
    const capacity = capacityFor(muscle)
    const pctAt = (t) => 100 * Math.max(0, 1 - decayedSum(list, t) / capacity)
    const recoveryPct = Math.round(pctAt(now))
    const ready = recoveryPct >= READY_THRESHOLD
    // Recovering: scan forward hour by hour for the crossing (the sum mixes
    // time constants, so there's no clean closed form — and this is cheap).
    let readyAt = null
    if (!ready) {
      for (let h = 1; h <= RECOVERY_LOOKBACK_DAYS * 24; h++) {
        if (pctAt(now + h * HOUR) >= READY_THRESHOLD) {
          readyAt = now + h * HOUR
          break
        }
      }
    }
    // Per-sub-muscle breakdown for the drill-down: each trained atom in this
    // group, over the SAME group capacity (so the group — carrying the summed
    // load of all its atoms — sits at or below any single one), most-fatigued
    // first. Mirrors effectiveWeeklyVolume's atoms[].
    const atoms = Object.entries(atomDeposits)
      .filter(([atom]) => ATOM_TO_GROUP[atom] === muscle)
      .map(([atom, atomList]) => {
        const pct = Math.round(100 * Math.max(0, 1 - decayedSum(atomList, now) / capacity))
        return { atom, recoveryPct: pct, status: pct >= READY_THRESHOLD ? 'ready' : 'recovering' }
      })
      .sort((a, b) => a.recoveryPct - b.recoveryPct)
    return {
      muscle,
      recoveryPct,
      status: ready ? 'ready' : 'recovering',
      readyAt,
      lastTrained: lastTrained[muscle] || null,
      atoms,
    }
  })

  const strain = Math.round(100 * Math.min(1, decayedSum(systemicDeposits, now, SYSTEMIC_TAU) / SYSTEMIC_CAPACITY))
  // Learned recovery speeds worth telling the user about (well off the default).
  const notes = Object.entries(model.tauMult)
    .filter(([, mult]) => Math.abs(mult - 1) >= TAU_MULT_NOTEWORTHY)
    .map(([muscle, mult]) => ({ muscle, mult }))
    .sort((a, b) => Math.abs(b.mult - 1) - Math.abs(a.mult - 1))
  return {
    muscles,
    systemic: { pct: strain, level: systemicLevel(strain) },
    personal: { observations: model.observations, notes },
  }
}

// The engine muscles an exercise list meaningfully targets (atoms at/above
// TARGET_CONTRIBUTION_MIN — primaries and secondaries). Accepts anything with
// {exerciseId, name}, e.g. a program day's planned exercises; used to flag
// when today's planned session hits muscles that are still recovering.
export function musclesForExercises(list) {
  const out = new Set()
  for (const e of list || []) {
    const dbId = e.exerciseId || exerciseIdForName(e.name)
    const db = dbId ? DB_BY_ID.get(dbId) : null
    if (db && db.muscles && Object.keys(db.muscles).length) {
      for (const [atom, w] of Object.entries(db.muscles)) {
        if (w >= TARGET_CONTRIBUTION_MIN && ATOM_TO_GROUP[atom]) out.add(ATOM_TO_GROUP[atom])
      }
    } else {
      const g = fallbackMuscle(e.name)
      if (g) out.add(g)
    }
  }
  return out
}

// "~6h" / "~1d 8h" until `readyAt`, or null once it's in the past.
export function formatReadyIn(readyAt, now = Date.now()) {
  if (!readyAt || readyAt <= now) return null
  const hours = Math.ceil((readyAt - now) / HOUR)
  if (hours < 24) return `~${hours}h`
  const d = Math.floor(hours / 24)
  const h = hours % 24
  return h ? `~${d}d ${h}h` : `~${d}d`
}
