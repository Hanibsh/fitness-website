// Split generator — tunable coefficients and day templates.
//
// Same contract engineConfig.js has with engine.js: every categorical→number
// mapping and every hard-coded shape the generator uses lives HERE, so
// generator.js stays readable and the model can be dialled in without hunting
// through code. Evidence-informed starting points, not gospel.
//
// Nothing in this file imports the exercise DB — it's plain data, so the wizard
// can read the templates for its preview without pulling in 140KB of exercises.

import { ENGINE_MUSCLES, VOLUME_MEV, VOLUME_CEILING } from './engineConfig'

// ---- Which muscles get PROGRAMMED ------------------------------------------
// The engine reports volume for all 20 muscles, but a split doesn't put a slot
// on each of them. These 13 get direct work by default; the rest (Lower Back,
// Neck & Traps, Forearms, Obliques, Adductors, Abductors, Tibialis) are trained
// well enough by the compounds already in the plan and only earn their own slot
// when the user names them as a focus. The generator's summary still reports
// what they picked up incidentally, so nothing goes unaccounted for.
export const PROGRAMMED_MUSCLES = [
  'Chest', 'Lats', 'Upper Back',
  'Front Delts', 'Side Delts', 'Rear Delts',
  'Biceps', 'Triceps',
  'Quads', 'Hamstrings', 'Glutes', 'Calves',
  'Abs',
]

export const OPTIONAL_MUSCLES = ENGINE_MUSCLES.filter((m) => !PROGRAMMED_MUSCLES.includes(m))

// ---- Day templates ----------------------------------------------------------
// A template day is an ordered list of muscle slots. Order is training order:
// the day is filled slot by slot, so whatever leads this list leads the workout.
// Big, systemically expensive muscles first — that's also where the day's
// fatigue budget is cheapest (see PENALTIES.fatigueRamp).
//
// The shapes below all land every programmed muscle on 2–3 sessions a week,
// which is the frequency the app leans toward. Nothing here is a "program name"
// the user has to recognise; the names are just what the days get called.
const UPPER = ['Chest', 'Lats', 'Upper Back', 'Front Delts', 'Side Delts', 'Triceps', 'Biceps', 'Rear Delts']
const LOWER = ['Quads', 'Hamstrings', 'Glutes', 'Calves', 'Abs']
const PUSH = ['Chest', 'Front Delts', 'Side Delts', 'Triceps']
const PULL = ['Lats', 'Upper Back', 'Rear Delts', 'Biceps']
const LEGS = ['Quads', 'Hamstrings', 'Glutes', 'Calves', 'Abs']

// Full-body days must all cover the SAME muscles — at 2–3 sessions a week they
// are the only sessions there are, so anything missing from one of them is a
// muscle trained once a week or not at all. What rotates is the ORDER: the day
// is filled from the top down and the budget runs out at the bottom, so leading
// with a different muscle each time is what stops the same one always getting
// the freshest effort and the last one always getting the scraps.
//
// The base order below runs by how much of a muscle's work has to be DIRECT.
// The arms and front delts sit at the end not because they matter least but
// because the presses and rows above them have already paid most of their bill
// by the time the day gets there — while calves and abs get nothing from
// anything else in the list, so they have to sit above the muscles that do.
// Biceps and rear delts sit ahead of triceps and front delts because a row only
// credits the biceps about half a set while a press credits the triceps three
// quarters of one — the arms are not one item, and the pulling half of them
// needs the direct slot more.
const FULL_BASE = [
  'Quads', 'Chest', 'Lats', 'Hamstrings', 'Glutes', 'Upper Back',
  'Side Delts', 'Calves', 'Abs', 'Biceps', 'Rear Delts', 'Triceps', 'Front Delts',
]
const fullBody = (lead) => [...lead, ...FULL_BASE.filter((m) => !lead.includes(m))]
const FULL_A = fullBody(['Quads', 'Chest', 'Lats'])
const FULL_B = fullBody(['Chest', 'Lats', 'Hamstrings'])
const FULL_C = fullBody(['Lats', 'Glutes', 'Quads'])

// daysPerWeek → the training days of the week, in order.
export const TEMPLATES = {
  2: [
    { name: 'Full body A', muscles: FULL_A },
    { name: 'Full body B', muscles: FULL_B },
  ],
  3: [
    { name: 'Full body A', muscles: FULL_A },
    { name: 'Full body B', muscles: FULL_B },
    { name: 'Full body C', muscles: FULL_C },
  ],
  4: [
    { name: 'Upper A', muscles: UPPER },
    { name: 'Lower A', muscles: LOWER },
    { name: 'Upper B', muscles: UPPER },
    { name: 'Lower B', muscles: LOWER },
  ],
  5: [
    { name: 'Upper', muscles: UPPER },
    { name: 'Lower', muscles: LOWER },
    { name: 'Push', muscles: PUSH },
    { name: 'Pull', muscles: PULL },
    { name: 'Legs', muscles: LEGS },
  ],
  6: [
    { name: 'Push A', muscles: PUSH },
    { name: 'Pull A', muscles: PULL },
    { name: 'Legs A', muscles: LEGS },
    { name: 'Push B', muscles: PUSH },
    { name: 'Pull B', muscles: PULL },
    { name: 'Legs B', muscles: LEGS },
  ],
}

export const DAYS_PER_WEEK_OPTIONS = [2, 3, 4, 5, 6]
export const DEFAULT_DAYS_PER_WEEK = 4

// Which weekdays a fixed-week split defaults to (Mon=0 … Sun=6), spread so
// consecutive training days are minimised at every frequency.
export const DEFAULT_WEEKDAYS = {
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 3, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
}

// ---- Focus ------------------------------------------------------------------
// A focus muscle gets three things: more weekly volume, an extra weekly session
// where the template has room for one, and the front of every day it appears in.
export const MAX_FOCUS_MUSCLES = 3
export const FOCUS_VOLUME_MULT = 1.4
export const FOCUS_TARGET_FREQUENCY = 3 // sessions/wk to lift a focus muscle to
// A focus muscle is deliberately fresh territory — someone naming it is asking
// for it to be brought up, not for more of what already wasn't enough. So their
// own habitual movements count for less when filling a focus slot.
export const FAMILIARITY_FOCUS_DAMP = 0.5

// ---- Experience posture -----------------------------------------------------
// Weekly sets per muscle for a standard (unscaled) muscle, the per-session
// ceilings, and how much movement complexity the plan is allowed to hand out.
// Set counts are in the same currency as the engine's effective weekly volume
// (contribution-weighted), so they're directly comparable to VOLUME_TIERS.
export const EXPERIENCE_POSTURE = {
  beginner: { baseWeeklySets: 8, maxSetsPerExercise: 3, maxSkill: 'moderate', exerciseCap: 9 },
  intermediate: { baseWeeklySets: 12, maxSetsPerExercise: 4, maxSkill: 'high', exerciseCap: 10 },
  advanced: { baseWeeklySets: 14, maxSetsPerExercise: 4, maxSkill: 'very high', exerciseCap: 10 },
}
export const DEFAULT_EXPERIENCE = 'intermediate'

export const SKILL_RANK = { low: 1, moderate: 2, high: 3, 'very high': 4 }

// ---- What limits a day ------------------------------------------------------
// Not the clock. The generator used to ask how long a session was and cap the
// day at minutes ÷ 3, which made time the thing deciding how much work a muscle
// got — a session isn't better for being longer, and it isn't worse for it
// either. What actually limits a productive day is how much volume the muscles
// in it can still use (the weekly targets) and how much fatigue it can carry
// (DAY_LOAD_MAX), with the exercise cap keeping the movement count learnable.
// Those three do the whole job, and none of them is a stopwatch.
//
// Per-exercise and per-muscle-per-session bounds. The per-session muscle cap
// sits just above engineConfig's WITHIN_SESSION_FULL_SETS: past that the engine
// itself starts discounting the sets, so planning more is planning junk volume.
export const MIN_SETS_PER_EXERCISE = 2
export const MAX_SETS_PER_MUSCLE_PER_SESSION = 6
// A muscle with less than this left to give in a day doesn't get another
// exercise — two sets is the smallest slot worth writing down.
export const MIN_SLOT_SETS = 1.6

// ---- Weekly volume ----------------------------------------------------------
// Floor and ceiling for a generated target, before per-muscle scaling. Reuses
// the engine's own landmarks so the generator can never write a split the
// dashboard would immediately grade "below minimum" or "low efficiency".
export const TARGET_FLOOR = VOLUME_MEV
export const TARGET_CEILING = VOLUME_CEILING

// How far back to read a returning user's own volume, and the least history
// that makes it worth reading at all.
export const HISTORY_VOLUME_DAYS = 14
export const HISTORY_MIN_SESSIONS = 4
// How far back a movement still counts as one of theirs.
export const FAMILIARITY_DAYS = 56

// ---- Scoring ----------------------------------------------------------------
// Every DB column the picker reads, normalised to 0–1, then weighted. Positive
// weights are reasons to pick a movement; the penalties below are reasons not to.
export const HP_SCORE = { low: 0, moderate: 0.4, high: 0.75, excellent: 1 }
export const SFR_SCORE = { poor: 0, average: 0.35, good: 0.7, excellent: 1 }
export const STRETCH_SCORE = { none: 0, partial: 0.5, yes: 1 }
export const PROFILE_SCORE = { shortened: 0, balanced: 0.35, lengthened: 1 }
export const OVERLOAD_SCORE = { low: 0, moderate: 0.4, high: 0.75, 'very high': 1 }
export const STABILITY_SCORE = { 'highly unstable': 0, unstable: 0.25, moderate: 0.6, stable: 0.85, 'very stable': 1 }

// Full-gym overlay. Loadability and stability carry more weight when someone
// has racks, machines and cables: the point of the equipment is that you can
// keep adding weight to a movement you're braced against, and progressive
// overload on a stable movement is most of what drives hypertrophy. At home
// neither is really available, so leaning on them there just penalises the pool
// for being what it is. Merged over WEIGHTS when the preset is 'gym'.
export const GYM_WEIGHTS = {
  sfr: 2.2,
  overload: 1.8,
  stability: 1.2,
}

// What a full gym takes OFF the table. Bands are strictly redundant next to
// cables and dumbbells, and a movement the database rates `low` for progressive
// overload can't be loaded — which is the whole reason to be in a gym.
//
// Note this is a loadability rule, NOT an equipment one, and deliberately: the
// database tags Chin-Up, Pull Up, Chest Dips, Weighted Chest Dips, Hanging Knee
// Raise and Leg Raises as `bodyweight`, and they are gym staples. Excluding
// "bodyweight" would delete all of them while leaving banded work untouched.
// Excluding un-loadable movements removes exactly the push-ups, knee push-ups,
// TRX rows and inverted rows that a gym has better versions of.
export const GYM_EXCLUDED_EQUIPMENT = ['resistance band']
export const GYM_EXCLUDED_OVERLOAD = ['low']

export const WEIGHTS = {
  contribution: 4.0, // how much of the set actually lands on the target muscle
  hypertrophy: 2.0,
  sfr: 1.5,
  stretch: 1.0,
  profile: 0.6,
  overload: 0.8,
  stability: 0.5,
  familiarity: 1.2, // they already train it — the hybrid rule, a nudge not a filter
  // How much of the REST of the day's outstanding volume this movement also
  // pays off. Without it the picker compares movements one muscle at a time and
  // a cable fly beats a bench press on the chest column alone — true as far as
  // it goes, and the wrong pick, because the press is also most of the day's
  // triceps and front-delt work. This is the term that makes the generator
  // write a workout rather than a list of body parts.
  debtRelief: 0.9,
}

export const PENALTIES = {
  // Fatigue is charged against what's LEFT of the day, not in the abstract:
  // base + ramp × (fraction of the day's budget already spent). Early in a
  // session a hard compound is cheap; by the end of it, the same movement is
  // priced out and the ranking flips to low-fatigue, non-axial accessories.
  fatigueBase: 0.8,
  fatigueRamp: 2.0,
  axial: 1.2, // scaled by the same budget fraction — only bites late in a day
  recovery: 0.8, // per 24h its recovery window overruns the gap to the next session
  recoveryCap: 2.4,
  sameFamily: 1.6, // another variant of this movement is already in the week
  sameSignature: 1.0, // a near-identical movement is already in the week
  repeatExercise: 2.2, // this exact movement is already in the week
  skillOverreach: 1.0, // one tier above the user's cap (two tiers is a hard filter)
  // Scaled by the WEIGHTED injury risk (injuries.js): raw risk × how much the
  // injury currently counts, which folds in its status and your last pain
  // rating. So this full price is only paid by a movement that loads an active,
  // painful injury hard; a mild one you're managing costs about a quarter of it.
  //
  // 4.0 came out of a sweep over 2/3/4/6 against a 4-day gym split. The response
  // is smooth — no cliff — and the exercise count never moves off 33-34 at any
  // of them, so coverage is not what constrains this. Below 3 an elbow injury
  // changed nothing at all (every arm movement is equally implicated, so only
  // the equipment and stretch modifiers separate them); above 5 the split starts
  // churning over injuries that barely hurt. This is deliberately larger than
  // repeatExercise (2.2): at full weight you are in real pain, and that should
  // outrank not repeating yourself.
  injury: 4.0,
  // A single-limb movement is one logged set but two sets' worth of session
  // time. It has to earn that on its own merits, not win a tie.
  unilateral: 0.7,
  // The database carries whole families of near-identical variants ("Hack Squat"
  // vs "Hack Squat Wide Stance") whose columns are, correctly, almost the same —
  // so ties get broken by whichever happens to sort first, and a generated split
  // fills up with oddities nobody asked for. Nudging toward the shorter name
  // picks the canonical member of the family, which is the same tiebreak
  // searchExercises already applies in exerciseLibrary.js.
  perNameChar: 0.03,
}

// A muscle's first movement of the day is a compound whenever the database
// actually has one that trains it this directly. Structure, not a weighting:
// the columns rate a cable fly above a bench press per set — honestly, on
// stimulus-to-fatigue that's right — but a chest day still opens on the press.
// Muscles with no compound at this contribution (side delts, calves, abs, and
// the biceps) simply lead with their best isolation, which is correct for them.
export const COMPOUND_LEAD_MIN_CONTRIBUTION = 0.75

// A suggested SWAP has to be a real stand-in, so it must land at least this
// share of what the movement it's replacing landed on the target muscle. Without
// it, swapping an overhead press offers bench presses: the database agrees a
// bench press trains the front delts, and it does, but someone replacing their
// shoulder press did not ask to stop pressing overhead.
export const SWAP_MIN_CONTRIBUTION_RATIO = 0.9

// The share of a day's systemic budget the generator aims to leave unspent.
// dayStats grades a day against SYSTEMIC_CAPACITY; planning right up to the
// 'high' band every session is how you end up managing fatigue with a deload,
// which this app doesn't do. TARGET is where the scoring starts pricing fatigue
// as expensive; MAX is a hard stop — past it the day stops taking on work even
// if there's still time in the session, because what's run out is recovery, not
// minutes.
export const DAY_LOAD_TARGET = 0.6
export const DAY_LOAD_MAX = 0.8

// ---- Rep ranges -------------------------------------------------------------
// Double-progression targets by movement shape. A returning user's own logged
// range for a movement wins over these (see repRangeFor in splitFromHistory.js).
export const REP_RANGES = {
  heavyCompound: { low: 5, high: 8 }, // fatigueScore ≥ 4 — the big axial lifts
  compound: { low: 6, high: 10 },
  lengthened: { low: 8, high: 12 }, // stretch-mediated / lengthened-biased isolation
  isolation: { low: 10, high: 15 },
  shortened: { low: 12, high: 18 }, // peak-contraction work wants the higher end
}

// Muscles that read better at higher reps regardless of the movement's profile.
export const HIGH_REP_MUSCLES = new Set(['Calves', 'Abs', 'Obliques', 'Forearms', 'Tibialis'])
