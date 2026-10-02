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
// The second upper day of the week leads with what the first one left for last:
// the shoulders (an overhead press or a raise), then the arms while they're
// fresh, then back and chest. Same reasoning as the rotating full-body leads
// below — the muscle that always comes last always gets the scraps — and it
// gives the arms a day where their direct work isn't squeezed in after
// everything else. Front and rear delts stay at the back, as on Upper A: by then
// the presses and rows have paid most of their bill, and a front-delt slot ahead
// of the chest press only writes a second overhead press.
//
// The day is SIZED as the compound-led order (`sizedAs`): opening on isolation
// work gives up the debt relief a press or a row brings, so left alone the same
// muscles would take more sets — and the reorder is about what's fresh, not
// about adding volume.
const UPPER_B = ['Side Delts', 'Biceps', 'Triceps', 'Lats', 'Chest', 'Upper Back', 'Front Delts', 'Rear Delts']
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

// Arnold's pairing: the chest and back trained together as antagonists, then
// the delts with the arms, then legs. Rear delts ride with the back day because
// every row already credits them — the shoulder day is there for the side and
// front heads.
const CHEST_BACK = ['Chest', 'Lats', 'Upper Back', 'Rear Delts']
const SHOULDERS_ARMS = ['Side Delts', 'Front Delts', 'Rear Delts', 'Biceps', 'Triceps', 'Forearms']

// One body part a day. The lists are deliberately NARROW — a chest day asks for
// chest and nothing else — because the generator credits every muscle a movement
// touches, not just the one whose slot asked for it (see `charge` in
// generator.js). So a chest day still banks most of a day's triceps volume
// without a triceps slot competing for the session's fatigue budget, which is
// how these splits are actually run.
const BRO_CHEST = ['Chest']
const BRO_BACK = ['Lats', 'Upper Back']
const BRO_SHOULDERS = ['Side Delts', 'Rear Delts', 'Front Delts']
const BRO_ARMS = ['Biceps', 'Triceps', 'Forearms']
const BRO_LEGS = ['Quads', 'Hamstrings', 'Glutes', 'Calves', 'Abs']

// daysPerWeek → the shapes on offer, each a named set of training days in order.
//
// The FIRST shape at each count is the recommended one and what "Pick for me"
// takes. The rest are there because people ask for them by name, and a split
// somebody will actually run beats a better one they abandon.
//
// `note` is the one-line consequence shown in the picker. The bro shapes say
// what they cost outright: with a muscle trained once a week, `allocate` caps
// the session at MAX_SETS_PER_MUSCLE_PER_SESSION and the weekly total lands
// well under what the same person would get training it twice. That is the
// volume model working as designed, not a fault to hide — but it is the
// user's decision to make, so it is stated before they make it.
export const TEMPLATES = {
  2: [
    {
      id: 'full-body',
      name: 'Full body',
      note: 'Everything, twice a week. The most volume two sessions can carry.',
      days: [
        { name: 'Full body A', muscles: FULL_A },
        { name: 'Full body B', muscles: FULL_B },
      ],
    },
  ],
  3: [
    {
      id: 'full-body',
      name: 'Full body',
      note: 'Every muscle three times a week — the best frequency at this count.',
      days: [
        { name: 'Full body A', muscles: FULL_A },
        { name: 'Full body B', muscles: FULL_B },
        { name: 'Full body C', muscles: FULL_C },
      ],
    },
    {
      id: 'ppl',
      name: 'Push / Pull / Legs',
      note: 'Shorter, more focused days — but each muscle only once a week.',
      days: [
        { name: 'Push', muscles: PUSH },
        { name: 'Pull', muscles: PULL },
        { name: 'Legs', muscles: LEGS },
      ],
    },
  ],
  4: [
    {
      id: 'upper-lower',
      name: 'Upper / Lower',
      note: 'Everything twice a week. Upper A leads with presses and rows, Upper B with shoulders and arms.',
      days: [
        { name: 'Upper A', muscles: UPPER },
        { name: 'Lower A', muscles: LOWER },
        { name: 'Upper B', muscles: UPPER_B, sizedAs: UPPER },
        { name: 'Lower B', muscles: LOWER },
      ],
    },
    {
      id: 'arnold-4',
      name: 'Arnold',
      note: 'Chest with back, delts with arms. Chest and back get two sessions.',
      days: [
        { name: 'Chest & Back A', muscles: CHEST_BACK },
        { name: 'Shoulders & Arms', muscles: SHOULDERS_ARMS },
        { name: 'Legs', muscles: LEGS },
        { name: 'Chest & Back B', muscles: CHEST_BACK },
      ],
    },
    {
      id: 'bro-4',
      name: 'Bro split',
      note: 'One body part a day, once a week. Weekly volume lands lower for it.',
      days: [
        { name: 'Chest', muscles: BRO_CHEST },
        { name: 'Back', muscles: BRO_BACK },
        { name: 'Shoulders & Arms', muscles: [...BRO_SHOULDERS, ...BRO_ARMS] },
        { name: 'Legs', muscles: BRO_LEGS },
      ],
    },
  ],
  5: [
    {
      id: 'upper-lower-ppl',
      name: 'Upper / Lower + PPL',
      note: 'Most muscles twice a week, with the extra day spent on the split.',
      days: [
        { name: 'Upper', muscles: UPPER },
        { name: 'Lower', muscles: LOWER },
        { name: 'Push', muscles: PUSH },
        { name: 'Pull', muscles: PULL },
        { name: 'Legs', muscles: LEGS },
      ],
    },
    {
      id: 'bro-5',
      name: 'Bro split',
      note: 'The classic five. One body part a day, once a week — volume lands lower.',
      days: [
        { name: 'Chest', muscles: BRO_CHEST },
        { name: 'Back', muscles: BRO_BACK },
        { name: 'Shoulders', muscles: BRO_SHOULDERS },
        { name: 'Arms', muscles: BRO_ARMS },
        { name: 'Legs', muscles: BRO_LEGS },
      ],
    },
    {
      id: 'arnold-5',
      name: 'Arnold',
      note: 'Arnold pairing with a second legs day.',
      days: [
        { name: 'Chest & Back A', muscles: CHEST_BACK },
        { name: 'Shoulders & Arms', muscles: SHOULDERS_ARMS },
        { name: 'Legs A', muscles: LEGS },
        { name: 'Chest & Back B', muscles: CHEST_BACK },
        { name: 'Legs B', muscles: LEGS },
      ],
    },
  ],
  6: [
    {
      id: 'ppl-x2',
      name: 'Push / Pull / Legs ×2',
      note: 'Everything twice a week across six shorter sessions.',
      days: [
        { name: 'Push A', muscles: PUSH },
        { name: 'Pull A', muscles: PULL },
        { name: 'Legs A', muscles: LEGS },
        { name: 'Push B', muscles: PUSH },
        { name: 'Pull B', muscles: PULL },
        { name: 'Legs B', muscles: LEGS },
      ],
    },
    {
      id: 'arnold-6',
      name: 'Arnold ×2',
      note: 'The full Arnold split — every muscle twice a week.',
      days: [
        { name: 'Chest & Back A', muscles: CHEST_BACK },
        { name: 'Shoulders & Arms A', muscles: SHOULDERS_ARMS },
        { name: 'Legs A', muscles: LEGS },
        { name: 'Chest & Back B', muscles: CHEST_BACK },
        { name: 'Shoulders & Arms B', muscles: SHOULDERS_ARMS },
        { name: 'Legs B', muscles: LEGS },
      ],
    },
    {
      id: 'bro-6',
      name: 'Bro + arms',
      note: 'One body part a day, with a second arms and delts session.',
      days: [
        { name: 'Chest', muscles: BRO_CHEST },
        { name: 'Back', muscles: BRO_BACK },
        { name: 'Shoulders', muscles: BRO_SHOULDERS },
        { name: 'Arms', muscles: BRO_ARMS },
        { name: 'Legs', muscles: BRO_LEGS },
        // Not a second arm day for its own sake: arms and delts are the groups
        // that suffer most from once-a-week frequency, and a second exposure is
        // the only thing that lifts them inside this shape.
        { name: 'Arms & Delts', muscles: [...BRO_ARMS, ...BRO_SHOULDERS] },
      ],
    },
  ],
}

// The shapes on offer at a day count, and the one taken by default.
export function shapesFor(daysPerWeek) {
  return TEMPLATES[daysPerWeek] || TEMPLATES[DEFAULT_DAYS_PER_WEEK]
}

// A shape by its id, at whatever day count it lives — 'full-body' is the same
// shape at two days and three. Null for an id no template has (or none at all).
export function shapeById(id) {
  for (const shapes of Object.values(TEMPLATES)) {
    const shape = shapes.find((sh) => sh.id === id)
    if (shape) return shape
  }
  return null
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
// Hani's rule (2026-10-02): a muscle is brought up by training it FIRST and MORE
// OFTEN, not by piling sets onto one day — "from 2 sets in a day to 4 sets in
// the same day" is fatigue, not progress. So a focus muscle gets:
//
//   1. the front of every day it's in, opened by a movement it's the main mover
//      of (a lateral raise for side delts, never an overhead press);
//   2. extra weekly sessions where the template has room, up to
//      FOCUS_TARGET_FREQUENCY;
//   3. never more sets in a session than it would get without the focus — its
//      only extra volume is FOCUS_EXTRA_SESSION_SETS for the added session, or
//      FOCUS_NO_ROOM_SETS where the week already trains it as often as it can
//      (a 3-day full body);
//   4. and the week's total doesn't grow: the other muscles give those sets
//      back evenly, none below its minimum (generateProgram).
//
// Which half of the body a muscle belongs to. Used to decide whether a training
// day can host a focus muscle it wasn't built for: raising a lagging muscle to
// three sessions a week is only worth doing if the extra sessions make sense,
// and quads on an upper day never do.
//
// Covers all of ENGINE_MUSCLES. Abs and Obliques are listed for completeness but
// are portable below, so their region never decides anything.
export const MUSCLE_REGION = {
  Chest: 'upper', Lats: 'upper', 'Upper Back': 'upper', 'Neck & Traps': 'upper',
  'Front Delts': 'upper', 'Side Delts': 'upper', 'Rear Delts': 'upper',
  Biceps: 'upper', Triceps: 'upper', Forearms: 'upper',
  Abs: 'upper', Obliques: 'upper',
  'Lower Back': 'lower', Quads: 'lower', Hamstrings: 'lower', Glutes: 'lower',
  Adductors: 'lower', Abductors: 'lower', Calves: 'lower', Tibialis: 'lower',
}

// Muscles that can be tacked onto any day regardless of region: small, cheap to
// recover from, and genuinely trained anywhere in practice — calves at the end
// of a push day is ordinary programming, quads on a push day is not.
export const PORTABLE_MUSCLES = new Set(['Calves', 'Tibialis', 'Abs', 'Obliques', 'Forearms', 'Neck & Traps'])
// ...and, once someone has asked for them to be brought up, the small upper-body
// muscles too: a few lateral raises or curls at the start of a leg day are the
// only way an upper/lower week gives them a third session, and specialising a
// lagging small muscle that way is ordinary bodybuilding practice. The big ones
// (chest, back, quads, hamstrings, glutes) stay on their own days.
export const FOCUS_PORTABLE_MUSCLES = new Set([...PORTABLE_MUSCLES, 'Side Delts', 'Rear Delts', 'Biceps', 'Triceps'])

export const MAX_FOCUS_MUSCLES = 3
export const FOCUS_TARGET_FREQUENCY = 3 // sessions/wk to lift a focus muscle to
export const FOCUS_EXTRA_SESSION_SETS = 2 // weekly sets added when it gains a session
export const FOCUS_NO_ROOM_SETS = 1 // ...or when the week has no session to give it
// A focus muscle is deliberately fresh territory — someone naming it is asking
// for it to be brought up, not for more of what already wasn't enough. So their
// own habitual movements count for less when filling a focus slot.
export const FAMILIARITY_FOCUS_DAMP = 0.5

// ---- How long a split runs --------------------------------------------------
// A generated split is built to be run for three to four months (Hani's rule).
// Past the start of that window the wizard says so — how long it's been and
// what the split brought up — so the next one can bring up something else. A
// note, never a nudge: nothing is picked for them, and the old focus is simply
// not carried over (splitRefresh and withoutStaleFocus in program.js).
export const SPLIT_REFRESH_WEEKS = 12

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

// ---- Volume preference --------------------------------------------------------
// How much work the person wants a session to hold — a separate choice from
// experience, on purpose. "Less volume, closer to failure" is a legitimate way
// to train at any training age (it suits strong lifters, whose sets cost more
// fatigue each), but the studies don't show advanced lifters needing LESS
// volume — if anything the reverse — so it's offered, never imposed.
//
// `targetMult` scales the weekly per-muscle targets (still clamped to the
// engine's landmarks); `setCap` is the most hard sets a single day may hold.
// The cap is about the QUALITY of the work, not the clock: past ~16–20 hard
// sets, systemic fatigue degrades every set that follows, and Pelland's tiers
// put the best return per set at 4–10 weekly sets a muscle — so trimming a long
// day costs little growth. The numbers are coaching judgement, not findings.
export const VOLUME_PREFERENCES = [
  {
    value: 'lower', label: 'Lower', sub: '≤ 12 sets/day', setCap: 12, targetMult: 0.75, rirShift: 0,
    failureSetsPerDay: 2,
    note: 'Fewer sets, up to two last sets a day to failure. The least fatigue.',
  },
  {
    value: 'standard', label: 'Standard', sub: '≤ 16 sets/day', setCap: 16, targetMult: 1, rirShift: 0,
    failureSetsPerDay: 1,
    note: 'Steady growth, no slog days. One last set a day to failure.',
  },
  {
    value: 'higher', label: 'Higher', sub: '≤ 20 sets/day', setCap: 20, targetMult: 1.25, rirShift: 1,
    failureSetsPerDay: 0,
    note: 'More sets, further from failure. A bit more growth, noticeably more fatigue.',
  },
]
export const DEFAULT_VOLUME_PREFERENCE = 'standard'

// ---- Core work --------------------------------------------------------------
// Hani's rule (2026-10-02): ab sets don't count toward the day's set cap or the
// week's total. A crunch or a leg raise costs next to nothing in systemic
// fatigue, so a 12-set day with three sets of abs paired in is still a 12-set
// day — and counting them meant a tight week dropped abs altogether to make
// room. Their own weekly volume is still graded against its minimum, like any
// other muscle's.
//
// Which rows are core is the database's call, not a list kept here: every
// movement whose category is CORE_CATEGORY (crunches, leg raises, planks,
// twists). A day carries at most one, its extra sets go on that one row, and
// the user picks where it goes: paired with the day's least fatiguing movement,
// or after everything else.
export const CORE_CATEGORY = 'Core'
// The muscles only a core movement trains, and the only ones a core movement is
// picked for (candidates). Without the first half, a day that already had its
// one ab movement handed its spare ab sets to whatever brushed the abs on
// multi-muscle credit — a Copenhagen adduction, a weighted chin-up on leg day.
// Without the second, toes-to-bar got picked for the lats.
export const CORE_MUSCLES = ['Abs', 'Obliques']
// The heaviest compound an ab movement may be supersetted with (supersetPartnerOk
// in generator.js): below this fatigue score, and never axially loaded.
export const SUPERSET_MAX_COMPOUND_FATIGUE = 3
export const CORE_PLACEMENTS = [
  { value: 'superset', label: 'Superset', sub: 'With the lightest movement' },
  { value: 'end', label: 'At the end', sub: 'After everything else' },
]
export const DEFAULT_CORE_PLACEMENT = 'superset'
export function corePlacement(value) {
  return CORE_PLACEMENTS.some((p) => p.value === value) ? value : DEFAULT_CORE_PLACEMENT
}

// ---- Effort (RIR) targets ---------------------------------------------------
// How close to failure a generated row's WORKING sets should go, by training
// age and by whether the movement is a compound. Beginners aim further off:
// they misjudge RIR badly (a "2" is often really a 4–5), and solid reps while a
// movement is still being learned matter more than the last rep.
//
// Failure is avoided, for everyone. No working-set range goes below
// MIN_WORKING_RIR: failure builds about the same muscle as 1–2 RIR (Refalo
// 2023/2025) but costs noticeably more recovery — exactly the fatigue this app
// manages through volume. What's left is a finisher: the LAST set of at most
// `failureSetsPerDay` movements a day (by volume preference, above), placed on
// the day's last SAFE movements — an isolation, or a machine/cable compound —
// never a free-weight or bodyweight compound, and never a heavy one (fatigue
// score ≥ FAILURE_MAX_FATIGUE_SCORE) even on a machine: a Smith-machine good
// morning to failure is all risk. Going last means the extra fatigue lands
// where nothing else in the session pays for it, and a failure set now and
// then teaches what 0 RIR feels like, which sharpens every other estimate.
// Higher volume shifts the range one rep further off (`rirShift`).
// Coaching judgement grounded in that literature, not a measured table.
export const RIR_TARGETS = {
  beginner: { compound: { low: 2, high: 3 }, isolation: { low: 2, high: 3 } },
  intermediate: { compound: { low: 1, high: 3 }, isolation: { low: 1, high: 2 } },
  advanced: { compound: { low: 1, high: 2 }, isolation: { low: 1, high: 2 } },
}
export const MIN_WORKING_RIR = 1
export const FAILURE_MAX_FATIGUE_SCORE = 4 // this score and above: no failure set

// When the cap binds, a day's first this-many muscles keep their place; the
// rest are reordered most-owed-first so the cap rotates across the week.
export const CAPPED_LEAD_SLOTS = 3
export function volumePreference(value) {
  return VOLUME_PREFERENCES.find((p) => p.value === value) || VOLUME_PREFERENCES.find((p) => p.value === DEFAULT_VOLUME_PREFERENCE)
}

export const SKILL_RANK = { low: 1, moderate: 2, high: 3, 'very high': 4 }

// ---- What limits a day ------------------------------------------------------
// Not the clock. The generator used to ask how long a session was and cap the
// day at minutes ÷ 3, which made time the thing deciding how much work a muscle
// got — a session isn't better for being longer, and it isn't worse for it
// either. What actually limits a productive day is how much volume the muscles
// in it can still use (the weekly targets) and how much fatigue it can carry
// (DAY_LOAD_MAX), with the exercise cap keeping the movement count learnable —
// plus the volume preference's hard-set cap (VOLUME_PREFERENCES), which counts
// sets because set quality is what decays over a long day. None of them is a
// stopwatch.
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
// How little the movement asks of you technically. Distinct from
// PENALTIES.skillOverreach below, which only fires ABOVE the user's cap: this
// separates movements that are all within reach, where the harder one buys
// nothing for its difficulty. Spaced rather than derived from SKILL_RANK so the
// gap between tiers can be tuned without touching the ordering — most of the
// database is "low" or "moderate", and that is the distinction that matters.
export const SIMPLICITY_SCORE = { low: 1, moderate: 0.6, high: 0.25, 'very high': 0 }

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

// What ends the set. The DB's `Limiting Factor` column says what gives out
// first for a strong lifter: the target muscle, or their grip (a kettlebell held
// for a leg movement), their balance (a free-weight lunge), or the equipment's
// load cap (a kettlebell, bodyweight, a band). A set that ends on anything but
// the target muscle stops short of the stimulus it's there for — and the
// stronger the lifter, the further short. A beginner's legs give out holding
// two kettlebells; an advanced lifter's hands give out long before the legs that
// squat twice their bodyweight are anywhere near failure. Straps are assumed
// for barbells and dumbbells, never kettlebells (Hani's rule), so a dumbbell
// split squat is rated on what gives out once the hands are strapped in.
//
// Gym only, like GYM_WEIGHTS: at home there is nothing more loadable to swap in,
// so penalising the pool for being what it is would only reshuffle it.
// Intermediates pay a penalty (still pickable when nothing better fits);
// advanced lifters never get one at all.
export const LIMITER_PENALTY = { beginner: 0, intermediate: 1.5, advanced: 0 }
export const LIMITER_EXCLUDED = { beginner: false, intermediate: false, advanced: true }

export const WEIGHTS = {
  contribution: 4.0, // how much of the set actually lands on the target muscle
  hypertrophy: 2.0,
  sfr: 1.5,
  stretch: 1.0,
  profile: 0.6,
  overload: 0.8,
  stability: 0.5,
  // Between two movements that train the same thing equally well, the one that
  // is simpler to set up and execute wins. Deliberately small: it should break
  // ties, not outrank a real difference in stimulus. Before this, skill was
  // scored only when it EXCEEDED the user's cap, so a low-skill and a high-skill
  // movement they could both do were indistinguishable — which is how a lever
  // triceps extension (very stable, low skill) ended up behind a skull crusher
  // that beat it on neither.
  simplicity: 0.6,
  familiarity: 1.2, // they already train it — the hybrid rule, a nudge not a filter
  // How much of the REST of the day's outstanding volume this movement also
  // pays off. Without it the picker compares movements one muscle at a time and
  // a cable fly beats a bench press on the chest column alone — true as far as
  // it goes, and the wrong pick, because the press is also most of the day's
  // triceps and front-delt work. This is the term that makes the generator
  // write a workout rather than a list of body parts.
  debtRelief: 0.9,
  // A region of muscle the week hasn't trained yet — upper chest after two flat
  // presses, the soleus after two straight-leg calf raises, the brachialis
  // after two preacher curls. Paid once per movement however many new regions
  // it brings (capped at one region's worth), so it steers each later day
  // toward the angle the earlier days missed without rewarding a movement just
  // for listing more muscles. Hani's rule: the days of a week complement each
  // other, so the week as a whole covers as much as it can. It adds no sets.
  coverage: 0.8,
}
// How heavily a region must be trained to count as covered (and to earn the
// coverage bonus): a secondary mover or better.
export const COVERAGE_MIN_WEIGHT = 0.5

// One heavy movement per muscle per day. Two movements at or above this fatigue
// score whose main muscle is the same — hack squat and leg press, RDL and a
// good morning — never share a day: the second one is trained on what the first
// left, at the highest systemic cost in the session. A light movement for the
// same muscle (a leg extension after the hack squat) is unaffected.
export const HEAVY_FATIGUE_SCORE = 4

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
  // The generator itself never repeats a movement or a family across the week
  // while the pool has anything else (candidates, `noWeekRepeats`), so these two
  // bite only where it runs out — at home — and in swap suggestions.
  sameFamily: 1.6, // another variant of this movement is already in the week
  sameSignature: 1.0, // a near-identical movement is already in the week
  // A second movement down the SAME PATH in the same day — a second row after a
  // pulldown, a second press after a bench. Soft on purpose, and much softer
  // than the week-level penalties above: a back day genuinely wants two rows,
  // and a hard block here would leave the day unable to spend its volume. This
  // only has to lose ties, so a day reaches for a second angle before it
  // reaches for the same one twice.
  samePatternInDay: 1.2,
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
  // vs "Hack Squat - Wide Stance") whose columns are, correctly, almost the same —
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
// The DIRECT_WORK muscles below skip it on their guaranteed day.
export const COMPOUND_LEAD_MIN_CONTRIBUTION = 0.75

// Main muscles that get their OWN movement at least once a week, and the paths
// that count as one. Everything else is trained well enough by the compounds:
// chest, lats, upper back, quads, hamstrings and glutes lead their own days, and
// presses and rows already load the front and rear delts as near-prime movers.
// These four are the ones the compounds can't stand in for — nothing presses or
// pulls the side delts or calves as a prime mover, a row hands the biceps half a
// set, and a press works the triceps with the shoulder flexed, which leaves the
// long head short of the stretch an extension gives it. Without this the
// generator filled the triceps slot with a close-grip press, so a split almost
// never had a real triceps exercise in it.
//
// Once a week each of them gets a guaranteed slot whose movement comes down
// these paths — on a day that already trains it that way if the week has one,
// else on the day that ranks it earliest (assignDirectWork). The rest of the
// week picks for them as before. The sets for it are moved, not added: the
// week holds no more than it would have without the guarantee, unless every
// set left to take back would drop some muscle under its minimum (see
// generateProgram). Every day stays inside the volume setting's cap.
export const DIRECT_WORK = {
  Biceps: ['elbow-flexion'],
  Triceps: ['elbow-extension'],
  'Side Delts': ['lateral-raise', 'upright-row'],
  Calves: ['calf-straight-leg', 'calf-bent-leg'],
}
// How far over its weekly target a DIRECT_WORK muscle may land before
// trimOvershoot takes sets back. A guaranteed slot spends a muscle's sets on its
// own movement; it must not quietly raise what the volume setting asked for.
export const DIRECT_WORK_TARGET_SLACK = 0.5

// A suggested SWAP has to be a real stand-in, so it must land at least this
// share of what the movement it's replacing landed on the target muscle. Without
// it, swapping an overhead press offers bench presses: the database agrees a
// bench press trains the front delts, and it does, but someone replacing their
// shoulder press did not ask to stop pressing overhead.
// How many movements the pattern picker offers before it stops. The big paths
// hold 25-29 movements; a phone list that long is a wall, and past the first
// dozen the scorer is separating near-identical grip variants anyway.
export const PATTERN_OPTION_LIMIT = 12

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
// Double-progression targets by movement shape. Hani's rule (2026-10-02): never
// suggest more than 12 reps, and keep most of the week within 6–10 — so the
// compounds, which are most of a week, sit there, and every isolation (calves
// and abs included) gets 8–12. A returning user's own logged range for a
// movement wins over these (see repRangeFor in splitFromHistory.js), held under
// the same ceiling.
export const REP_RANGES = {
  heavyCompound: { low: 6, high: 8 }, // fatigueScore ≥ 4 — the big axial lifts
  compound: { low: 6, high: 10 },
  isolation: { low: 8, high: 12 },
}
export const MAX_REPS = 12
// A range needs room to progress into (see repRangeFor): at least this many reps
// between its ends after it's been brought under MAX_REPS.
export const MIN_REP_SPAN = 2
