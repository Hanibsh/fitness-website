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
// The muscles the engine reports volume for. These are actual MUSCLES, not body
// regions: "Back" and "Shoulders" are regions the way "Legs" is — lats, traps
// and erectors are no more one muscle than quads and calves are. Regions that
// belong to the SAME muscle (upper/mid/lower chest; upper/mid/lower traps) stay
// as atoms underneath and never become their own group.
//
// Sub-muscle atoms from the exercise DB roll up into these; the drill-down shows
// the atoms. See ../../scripts/muscle-taxonomy.mjs for the atom list itself —
// atoms exist to capture which region an exercise BIASES toward, which is why
// effectiveWeeklyVolume takes their max and never their sum.
export const ENGINE_MUSCLES = [
  'Chest',
  'Lats', 'Upper Back', 'Lower Back', 'Neck & Traps',
  'Front Delts', 'Side Delts', 'Rear Delts',
  'Biceps', 'Triceps', 'Forearms',
  'Abs', 'Obliques',
  'Quads', 'Hamstrings', 'Glutes', 'Adductors', 'Abductors', 'Calves',
]

// Exercise-DB muscle atom → engine muscle. Judgement calls worth knowing about:
//   - Teres Major → Upper Back, matching the 'mid-back' explainer hub, which
//     already groups it with Mid Back + Rhomboids (muscleInfo.js SUBCATEGORIES).
//   - Rotator Cuff → Rear Delts (the external rotators are trained by the same
//     face-pull/rotation work, and it's never a primary — its own group would
//     read "below minimum" forever). Matches the 'rear-delts' hub's atoms.
//   - Hip Flexors → Abs (leg raises drive both; never primary on its own).
// Adductors/Abductors are now their OWN muscles rather than being folded into
// Quads/Glutes — an adduction machine crediting a full quad set was nonsense.
export const ATOM_TO_GROUP = {
  'Upper Chest': 'Chest', 'Middle Chest': 'Chest', 'Lower Chest': 'Chest', 'Serratus Anterior': 'Chest',
  Lats: 'Lats',
  'Mid Back': 'Upper Back', Rhomboids: 'Upper Back', 'Teres Major': 'Upper Back',
  'Spinal Erectors': 'Lower Back',
  'Upper Traps': 'Neck & Traps', 'Mid Traps': 'Neck & Traps', 'Lower Traps': 'Neck & Traps',
  'Front Delts': 'Front Delts', 'Side Delts': 'Side Delts',
  'Rear Delts': 'Rear Delts', 'Rotator Cuff': 'Rear Delts',
  Biceps: 'Biceps', Brachialis: 'Biceps',
  Triceps: 'Triceps',
  Brachioradialis: 'Forearms', 'Wrist Flexors': 'Forearms', 'Wrist Extensors': 'Forearms',
  'Deep Finger Flexors': 'Forearms', Pronators: 'Forearms', Supinator: 'Forearms',
  'Rectus Abdominis': 'Abs', 'Transverse Abdominis': 'Abs', 'Hip Flexors': 'Abs',
  Obliques: 'Obliques',
  Quadriceps: 'Quads',
  Hamstrings: 'Hamstrings',
  'Glute Max': 'Glutes',
  Adductors: 'Adductors',
  Abductors: 'Abductors',
  Gastrocnemius: 'Calves', Soleus: 'Calves',
}

// Custom / typed exercises have no DB entry, so there are no atoms to roll up —
// guess the engine muscle from the name instead. dashboard.js has a similar
// matcher, but it resolves to that module's COARSER groups ('Back',
// 'Shoulders'), which are no longer engine muscles; reusing it here would drop
// the set entirely, and mapping its output onto a single fine muscle would make
// every shrug a lat and every lateral raise a front delt. Hence a separate list.
//
// Ordered specific → general, FIRST MATCH WINS. The ordering carries real
// meaning — 'upright row' must beat 'row', 'reverse fly' must beat 'fly',
// 'leg curl' must beat 'curl' — so add new patterns at the right depth, not the
// end. Note 'grip' is deliberately absent: it would capture every "wide-grip
// pulldown" as forearm work.
export const FALLBACK_MUSCLE_PATTERNS = [
  ['Hamstrings', ['leg curl', 'lying curl', 'ham curl', 'nordic', 'hamstring', 'rdl', 'romanian', 'good morning', 'stiff leg', 'stiff-leg']],
  ['Glutes', ['hip thrust', 'glute', 'bridge', 'pull-through', 'pull through']],
  ['Abductors', ['abduction', 'abductor']],
  ['Adductors', ['adduction', 'adductor', 'copenhagen']],
  ['Calves', ['calf', 'soleus']],
  ['Quads', ['squat', 'lunge', 'leg extension', 'leg press', 'step up', 'step-up', 'hack', 'sissy']],
  ['Triceps', ['pushdown', 'pressdown', 'tricep', 'skull', 'overhead extension', 'close-grip', 'close grip']],
  ['Forearms', ['wrist curl', 'forearm', 'reverse curl', 'brachioradialis', 'farmer', 'gripper']],
  ['Biceps', ['curl', 'biceps', 'bicep', 'brachialis']],
  ['Neck & Traps', ['shrug', 'trap', 'neck']],
  ['Lower Back', ['back extension', 'hyperextension', 'erector', 'deadlift']],
  ['Rear Delts', ['rear delt', 'rear-delt', 'reverse fly', 'reverse flye', 'rear fly', 'face pull']],
  ['Side Delts', ['lateral raise', 'side raise', 'side delt', 'upright row']],
  ['Front Delts', ['front raise', 'front delt', 'overhead press', 'shoulder press', 'ohp', 'arnold', 'military press']],
  ['Upper Back', ['row', 'rhomboid', 'mid back', 'mid-back', 'retraction']],
  ['Lats', ['pulldown', 'pull-up', 'pullup', 'pull up', 'chin', 'pullover', 'lat ']],
  ['Chest', ['bench', 'chest', 'fly', 'flye', 'push-up', 'pushup', 'press up', 'pec', 'dip']],
  ['Obliques', ['oblique', 'woodchop', 'russian twist', 'side bend']],
  ['Abs', ['crunch', 'plank', 'sit-up', 'situp', 'leg raise', 'rollout', 'ab ', 'abs', 'core']],
]

// Engine muscle for an exercise we have no DB entry for, or null if unrecognised
// (in which case the set is left out rather than guessed at).
export function fallbackMuscle(name) {
  const raw = (name || '').trim().toLowerCase()
  if (!raw) return null
  for (const [muscle, words] of FALLBACK_MUSCLE_PATTERNS) {
    if (words.some((w) => raw.includes(w))) return muscle
  }
  return null
}

// ---- Weekly volume model (effective sets per muscle per week) ---------------
// Pelland et al. (Sports Medicine, 2026) meta-regressed 67 studies / 2058
// participants and found hypertrophy keeps rising as volume rises — with
// accelerating diminishing returns, but NO plateau and NO inverted-U. So volume
// is not pass/fail against a floor; it's a position on an efficiency curve. A
// hard "you need 10+ sets" threshold invents a cliff the data doesn't have —
// 6 hard sets isn't under-training, it's the best return you'll ever get.
//
// Units matter: ONE hard set of a muscle's own work = 1.0, never more (see the
// max-rollup in effectiveWeeklyVolume), so these are directly comparable to the
// "sets per muscle per week" the literature reports.
//
// Bands are Pelland's reported efficiency tiers: minimum effective dose at ~4
// sets, then each further DETECTABLE increment costs progressively more sets
// (~6 → ~8.5 → ~10.75 → ~12.5).
// Listed high→low so the first match in volumeTier() wins. `from` is the
// INCLUSIVE weekly-set floor of the band, mirroring Pelland's tiers exactly
// (4 = minimum effective dose, 5–10, 11–18, 19–29, 30+).
export const VOLUME_TIERS = [
  { id: 'excess', from: 30, label: 'Heavily diminished', hint: 'Little evidence of further benefit for the fatigue it carries.' },
  { id: 'taxing', from: 19, label: 'Low efficiency', hint: 'Another detectable gain costs ~10+ more sets here. Fatigue-heavy.' },
  { id: 'solid', from: 11, label: 'Productive', hint: 'Still growing, but each extra set buys noticeably less than the last.' },
  { id: 'prime', from: 4, label: 'High efficiency', hint: 'The best return per set — most growth for the least fatigue.' },
  { id: 'under', from: 0, label: 'Below minimum', hint: 'Under the ~4 weekly sets that reliably produce measurable growth.' },
]

// Minimum effective dose, and the point past which sets stop paying for their
// recovery cost (top of 'solid' — where the advisor starts suggesting trims).
export const VOLUME_MEV = 4
export const VOLUME_CEILING = 18

// Scales the tier boundaries for small/accessory muscles nobody trains to the
// same absolute set counts. IMPORTANT: the literature has no good per-muscle
// volume data — Pelland's tiers are generic across muscles — so these are
// deliberately conservative practice-based adjustments, NOT findings. They
// exist to stop small muscles reading "below minimum" forever. Tune freely.
export const VOLUME_SCALE = {
  Forearms: 0.6,
  Obliques: 0.5,
  'Lower Back': 0.5,
  Adductors: 0.5,
  Abductors: 0.5,
  'Neck & Traps': 0.75,
  'Rear Delts': 0.75,
}
export function volumeScale(muscle) {
  return VOLUME_SCALE[muscle] ?? 1
}

// Weekly `sets` → its efficiency tier. Pass the WEEKLY rate, not a window total.
export function volumeTier(sets, muscle) {
  const s = volumeScale(muscle)
  return VOLUME_TIERS.find((t) => sets >= t.from * s) || VOLUME_TIERS[VOLUME_TIERS.length - 1]
}

export function mevFor(muscle) {
  return VOLUME_MEV * volumeScale(muscle)
}
export function ceilingFor(muscle) {
  return VOLUME_CEILING * volumeScale(muscle)
}
export function landmarksFor(muscle) {
  return { low: mevFor(muscle), high: ceilingFor(muscle) }
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
export const ADVISOR_LAYOFF_MIN_DAYS = 7 // a gap this long (or an ongoing one) is worth flagging
export const ADVISOR_LAYOFF_RETURN_WINDOW_DAYS = 10 // "just back" stays relevant for this long after
export const ADVISOR_MAX_RECS = 3
