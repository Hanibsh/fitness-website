// Hypertrophy engine — tunable coefficients.
//
// Every categorical→number mapping the engine uses lives HERE, so the formulas
// stay readable and the model can be dialled in without hunting through code.
// These are evidence-informed starting points, not gospel — tune freely.

// ---- RIR effectiveness -----------------------------------------------------
// How much hypertrophic stimulus a working set delivers by proximity to
// failure. Sets at RIR 0–2 count fully (the sweet spot the app already coaches),
// tapering as you leave more reps in reserve. Junk-close-to-nothing past ~6.
export const RIR_EFFECTIVENESS = {
  0: 1.0, 1: 1.0, 2: 1.0, 3: 0.95, 4: 0.88, 5: 0.75,
  6: 0.6, 7: 0.45, 8: 0.33, 9: 0.25, 10: 0.2,
}
// When RIR wasn't logged, assume a hard-ish set but don't reward the missing data.
export const RIR_EFFECTIVENESS_DEFAULT = 0.9

export function rirEffectiveness(rir) {
  if (rir == null || rir === '') return RIR_EFFECTIVENESS_DEFAULT
  const r = Math.max(0, Math.min(10, Math.round(Number(rir))))
  return Number.isFinite(r) ? RIR_EFFECTIVENESS[r] : RIR_EFFECTIVENESS_DEFAULT
}

// ---- Within-session diminishing returns (stimulus) ---------------------------
// The first hard sets a muscle gets in a session count fully; past that, each
// extra set adds less (junk-volume protection). Applied per muscle group per
// session in effectiveWeeklyVolume.
export const WITHIN_SESSION_FULL_SETS = 5
export const WITHIN_SESSION_DECAY = 0.1 // credit lost per set past the full allotment
export const WITHIN_SESSION_FLOOR = 0.5

// `k` = effective sets this muscle has already been credited this session.
export function withinSessionMult(k) {
  return Math.max(WITHIN_SESSION_FLOOR, 1 - Math.max(0, k - WITHIN_SESSION_FULL_SETS + 1) * WITHIN_SESSION_DECAY)
}

// ---- Fatigue model (engine v2) ----------------------------------------------
// Fatigue mirrors stimulus with opposite curvature: pushing closer to failure
// adds disproportionate fatigue (stimulus saturates, fatigue accelerates).

// How hard a set hits the muscles it loads, by the exercise DB's 1–5 fatigue
// score. 3 = the reference movement.
export const FATIGUE_SCORE_COEF = { 1: 0.7, 2: 0.85, 3: 1.0, 4: 1.25, 5: 1.5 }

// RIR → fatigue multiplier. The exercise DB's Estimated Recovery Window is
// itself calibrated to a typical HARD set (~0-2 RIR, same band RIR_EFFECTIVENESS
// already treats as "counts fully") — so 0-2 RIR must multiply to ~1.0, or the
// model double-counts failure on top of a window that already assumes it. Real
// failure still costs a bit more than 1-2 RIR (acute velocity-loss studies show
// ~2x the fatigue of 1-RIR at 4 min post-set) even though full recovery time
// barely differs, hence the small premium at 0 rather than a flat 1.0. Past
// 2 RIR the curve tapers below 1.0 — genuinely less fatiguing, faster recovery.
// See data/recovery-rubric.md §0 for the evidence.
export const RIR_FATIGUE = {
  0: 1.1, 1: 1.0, 2: 1.0, 3: 0.9, 4: 0.8, 5: 0.7,
  6: 0.62, 7: 0.56, 8: 0.52, 9: 0.5, 10: 0.5,
}
export const RIR_FATIGUE_DEFAULT = 1.0

export function rirFatigue(rir) {
  if (rir == null || rir === '') return RIR_FATIGUE_DEFAULT
  const r = Math.max(0, Math.min(10, Math.round(Number(rir))))
  return Number.isFinite(r) ? RIR_FATIGUE[r] : RIR_FATIGUE_DEFAULT
}

// Custom / unmatched exercises have no DB entry — assume a middling movement.
export const DEFAULT_FATIGUE_SCORE = 2
export const DEFAULT_RECOVERY_WINDOW = [24, 48] // hours

// Each set's fatigue decays exponentially with τ = (recovery-window midpoint) /
// this factor: one set is ~95% dissipated by the end of its own window, while a
// full session's stack takes roughly the whole window to clear.
export const RECOVERY_DECAY_FACTOR = 3

// Fatigue units that drive a muscle to 0% recovered — roughly one hard direct
// session's worth. Per-muscle overrides use the same shape as the landmarks.
export const RECOVERY_CAPACITY = { default: 8 }
export function capacityFor(muscle) {
  return RECOVERY_CAPACITY[muscle] ?? RECOVERY_CAPACITY.default
}

// Recovered enough to hit the muscle hard again.
export const READY_THRESHOLD = 90 // %

// Sessions older than this contribute nothing measurable — skip them.
export const RECOVERY_LOOKBACK_DAYS = 14

// Only atoms at/above this contribution make an exercise "target" a muscle
// for readiness hints (primaries + secondaries; tertiaries ride along).
export const TARGET_CONTRIBUTION_MIN = 0.5

// ---- Personalization: e1RM-residual learning (engine v3) ---------------------
// Performance is ground truth. If you keep matching/beating your e1RM trend on
// lifts hitting a muscle the model calls "recovering", the model is too
// pessimistic for you — that muscle's recovery τ shrinks. Underperforming
// while "ready" pushes it the other way. Guards keep one noisy session from
// steering the model.
export const EWMA_ALPHA = 0.3 // per-exercise e1RM trend smoothing
export const RESIDUAL_CLAMP = 0.1 // |e1RM residual| cap, as a fraction of trend
export const MIN_EXPOSURES_TO_LEARN = 3 // sessions of an exercise before residuals count
export const MAX_E1RM_REPS = 12 // Brzycki unreliable past this (reps + RIR)
export const PERSONAL_LEARNING_RATE = 0.05 // max τ-multiplier step per observation
export const TAU_MULT_MIN = 0.6
export const TAU_MULT_MAX = 1.6
// Learned recovery speeds only get surfaced in UI past this deviation from 1.
export const TAU_MULT_NOTEWORTHY = 0.1

// ---- Repeated-bout effect -----------------------------------------------------
// Unfamiliar movements cause disproportionate damage; the bonus halves with
// each exposure (effectively gone by the ~5th time you log the exercise).
export const NOVELTY_BONUS = 0.3
export function noveltyMult(exposures) {
  return 1 + NOVELTY_BONUS * Math.pow(0.5, exposures)
}

// ---- Systemic fatigue (whole-body pool) -------------------------------------
// Second compartment: every working set also taxes one shared pool, weighted
// up for axially-loading and free-weight work (more whole-body demand).
export const AXIAL_MULT = 1.3
export const FREE_WEIGHT_MULT = 1.15
export const SYSTEMIC_TAU = 20 // hours — the pool mostly clears in ~2 days
export const SYSTEMIC_CAPACITY = 30 // units ≈ one brutal heavy free-weight day

// Strain % bands (100 = completely wrecked).
export const SYSTEMIC_LEVELS = { fresh: 33, moderate: 66 } // above moderate = high
export function systemicLevel(pct) {
  return pct < SYSTEMIC_LEVELS.fresh ? 'fresh' : pct < SYSTEMIC_LEVELS.moderate ? 'moderate' : 'high'
}

// ---- Muscle model ----------------------------------------------------------
// The muscle groups the engine reports volume for (finer than the taxonomy's 6
// so arms/legs are actionable). Sub-muscle atoms from the exercise DB roll up
// into these; the drill-down shows the atoms.
export const ENGINE_MUSCLES = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms',
  'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Abs',
]

// Exercise-DB muscle atom → engine muscle group. A couple are judgement calls
// (adductors→Quads, abductors→Glutes) and easy to retune here.
export const ATOM_TO_GROUP = {
  'Upper Chest': 'Chest', 'Middle Chest': 'Chest', 'Lower Chest': 'Chest',
  Lats: 'Back', 'Mid Back': 'Back', Rhomboids: 'Back', 'Upper Traps': 'Back', 'Mid Traps': 'Back', 'Lower Traps': 'Back', 'Spinal Erectors': 'Back', 'Teres Major': 'Back',
  'Front Delts': 'Shoulders', 'Side Delts': 'Shoulders', 'Rear Delts': 'Shoulders', 'Rotator Cuff': 'Shoulders',
  Biceps: 'Biceps', Brachialis: 'Biceps',
  Triceps: 'Triceps',
  Brachioradialis: 'Forearms', 'Wrist Flexors': 'Forearms', 'Wrist Extensors': 'Forearms', 'Deep Finger Flexors': 'Forearms',
  Quadriceps: 'Quads', Adductors: 'Quads',
  Hamstrings: 'Hamstrings',
  'Glute Max': 'Glutes', Abductors: 'Glutes',
  Gastrocnemius: 'Calves', Soleus: 'Calves',
  'Rectus Abdominis': 'Abs', 'Transverse Abdominis': 'Abs', Obliques: 'Abs', 'Hip Flexors': 'Abs',
}

// ---- Weekly volume landmarks (effective sets per muscle group) -------------
// Rough guidance for a productive weekly range — a floor worth clearing and a
// ceiling past which more is usually junk. Guidance only; the app never forces
// deloads (fatigue is managed by trimming volume — see app thesis).
export const VOLUME_LANDMARKS = {
  default: { low: 10, high: 20 },
  Abs: { low: 6, high: 16 },
  Calves: { low: 8, high: 16 },
  Forearms: { low: 4, high: 12 },
}

export function landmarksFor(muscle) {
  return VOLUME_LANDMARKS[muscle] || VOLUME_LANDMARKS.default
}

// ---- Advisor (engine v3) ------------------------------------------------------
// Rule thresholds for the fatigue-management advisor. House philosophy: NEVER
// a deload — high fatigue gets managed by trimming volume from the specific
// exercises/muscles driving it, while everything else trains on.
export const SFR_RANK = { excellent: 4, good: 3, average: 2, poor: 1 } // higher = more worth keeping
export const ADVISOR_MIN_SESSIONS = 4 // history needed before any advice
export const ADVISOR_BLOCK_SLACK = 1.25 // specialization-focus muscles may exceed the ceiling by this
export const ADVISOR_UNDERRECOVERED_MIN = 3 // trained under-recovered in ≥ this…
export const ADVISOR_UNDERRECOVERED_WINDOW = 4 // …of the last this-many workings
export const ADVISOR_REGRESSION_STREAK = 3 // consecutive below-trend sessions
export const ADVISOR_REGRESSION_EPS = -0.005 // "below trend" = residual under this
export const ADVISOR_MAX_RECS = 3
