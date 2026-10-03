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

// ---- A/B emphasis -------------------------------------------------------------
// Hani's rule (2026-10-03): when a split trains the same body part on two days,
// the two days are NOT the same workout twice — one leg day is a quad day, the
// other a glute and hamstring day; one push day is chest and front delts, the
// other side delts and triceps; one pull day is lats, the other upper back and
// biceps. That's the default, before anyone names a muscle to bring up.
//
// A day says so with `emphasis`: those muscles open it (they lead its list),
// every movement it gives them is one they're the main mover of, and they take
// EMPHASIS_WEIGHT's share of their weekly sets there — about 60/40 against their
// other day, as far as the per-session cap lets it (at 12 sets over two days it
// doesn't, and the emphasis is the order and the movements). A muscle another
// day emphasises gets one movement here; its second angle lives on its own day.
// `leadPaths` pins the path the day's first movement for a muscle comes down: a
// lats day opens on a pulldown, the quad day's hamstrings on a leg curl.
//
// These days are sized in their own order, not as the neutral one (`sizedAs`,
// which Upper B uses): measured quads-first, a glute day needs no hip thrust
// because the split squat already paid the glutes, and the real day then had
// no room left for its calves.
//
// The second day of each pair is built from the same muscles in a different
// order, so the two always cover the same muscles.
const LOWER_GLUTES = ['Glutes', 'Hamstrings', 'Quads', 'Calves', 'Abs']
const PUSH_SHOULDERS = ['Side Delts', 'Triceps', 'Chest', 'Front Delts']
const PULL_BACK = ['Upper Back', 'Biceps', 'Rear Delts', 'Lats']
// The quad day's hamstring work is a leg curl, so the hinge lives on the glute
// and hamstring day and the week trains the hamstrings both ways.
const QUAD_DAY = { muscles: LOWER, emphasis: ['Quads'], leadPaths: { Hamstrings: ['knee-flexion'] } }
const GLUTE_DAY = { muscles: LOWER_GLUTES, emphasis: ['Glutes', 'Hamstrings'] }
const CHEST_PUSH = { muscles: PUSH, emphasis: ['Chest', 'Front Delts'] }
const SHOULDER_PUSH = { muscles: PUSH_SHOULDERS, emphasis: ['Side Delts', 'Triceps'] }
const LAT_PULL = { muscles: PULL, emphasis: ['Lats'], leadPaths: { Lats: ['vertical-pull'] } }
const BACK_PULL = { muscles: PULL_BACK, emphasis: ['Upper Back', 'Biceps'] }
export const EMPHASIS_WEIGHT = 1.5 // vs 1 on the muscle's other day: a 60/40 split of its week
// ...as long as the other day keeps at least two slots' worth (2 × MIN_SLOT_SETS).
export const EMPHASIS_MIN_SHARE = 3.2

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
// The Arnold days' A/B emphasis: one chest-and-back day opens on the chest, the
// other on the back; one shoulders-and-arms day on the delts, the other on the
// arms (above).
const BACK_CHEST = ['Lats', 'Upper Back', 'Chest', 'Rear Delts']
const ARMS_SHOULDERS = ['Biceps', 'Triceps', 'Forearms', 'Side Delts', 'Front Delts', 'Rear Delts']

// Days built around one body part, where a second movement down the same job is
// the point of the day rather than a repeat (SAME_JOB): a flat and an incline
// press on a chest day, two curls and two extensions on an arm day.
const ARM_DAY_REPEATS = ['elbow-flexion', 'elbow-extension']
const CHEST_DAY_REPEATS = ['horizontal-push']

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

// ---- One-off sessions (generateSession) ---------------------------------------
//
// The kinds of single session the session generator builds — each one of the
// split templates' days, so a generated Push is the same Push a PPL split
// would write. `perWeek` is how often a split normally trains that day's
// muscles, which sizes the session's share of each weekly target: twice for the
// usual days, once for the bro days (the whole week's work for that muscle in
// one go, capped per session like any other). `direct` is the DIRECT_WORK the
// session guarantees: a split places each guarantee on one day of the week,
// but a single session has no other day to leave it to.
export const SESSION_TYPES = [
  { id: 'full', label: 'Full body', muscles: FULL_A, perWeek: 2, direct: [] },
  { id: 'upper', label: 'Upper', muscles: UPPER, perWeek: 2, direct: [] },
  { id: 'lower', label: 'Lower', muscles: LOWER, perWeek: 2, direct: ['Calves'] },
  { id: 'push', label: 'Push', muscles: PUSH, perWeek: 2, direct: ['Triceps', 'Side Delts'] },
  { id: 'pull', label: 'Pull', muscles: PULL, perWeek: 2, direct: ['Biceps'] },
  { id: 'chest-back', label: 'Chest & back', muscles: CHEST_BACK, perWeek: 2, direct: [] },
  { id: 'shoulders-arms', label: 'Shoulders & arms', muscles: SHOULDERS_ARMS, perWeek: 2, direct: ['Side Delts', 'Biceps', 'Triceps'], repeatJobs: ARM_DAY_REPEATS },
  { id: 'arms', label: 'Arms', muscles: BRO_ARMS, perWeek: 1, direct: ['Biceps', 'Triceps'], repeatJobs: ARM_DAY_REPEATS },
  { id: 'chest', label: 'Chest', muscles: BRO_CHEST, perWeek: 1, direct: [], repeatJobs: CHEST_DAY_REPEATS },
  { id: 'back', label: 'Back', muscles: BRO_BACK, perWeek: 1, direct: [] },
  { id: 'shoulders', label: 'Shoulders', muscles: BRO_SHOULDERS, perWeek: 1, direct: ['Side Delts'] },
]

// What "Pick for me" chooses between: the broad sessions. The narrow ones are
// there to be asked for by name, not suggested.
export const SESSION_RECOMMENDABLE = ['full', 'upper', 'lower', 'push', 'pull']

// A one-off session doesn't know when each muscle is trained next, which the
// split generator uses to score heavy movements down before a short gap. Three
// days is the typical gap of a twice-a-week split, so a session plans as if it
// sat in one.
export const SESSION_GAP_HOURS = 72

// A muscle whose recovery is under this (the engine's recovery %, 0–100) gets
// only a token slot in a generated session — the recovery card would call it
// still recovering.
export const SESSION_FATIGUED_BELOW = 70

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
      note: 'Everything twice a week. One upper day leads with presses and rows, the other with shoulders and arms; one lower day is quads, the other glutes and hamstrings.',
      days: [
        { name: 'Upper · Chest & back', muscles: UPPER, emphasis: ['Chest', 'Lats', 'Upper Back'] },
        { name: 'Lower · Quads', ...QUAD_DAY },
        { name: 'Upper · Shoulders & arms', muscles: UPPER_B, sizedAs: UPPER, emphasis: ['Side Delts', 'Biceps', 'Triceps'] },
        { name: 'Lower · Glutes & hams', ...GLUTE_DAY },
      ],
    },
    {
      id: 'arnold-4',
      name: 'Arnold',
      note: 'Chest with back, delts with arms. Chest and back get two sessions — one opens on the chest, the other on the back.',
      days: [
        { name: 'Chest & Back A', muscles: CHEST_BACK, emphasis: ['Chest'] },
        { name: 'Shoulders & Arms', muscles: SHOULDERS_ARMS, repeatJobs: ARM_DAY_REPEATS },
        { name: 'Legs', muscles: LEGS },
        { name: 'Chest & Back B', muscles: BACK_CHEST, emphasis: ['Lats', 'Upper Back'] },
      ],
    },
    {
      id: 'bro-4',
      name: 'Bro split',
      note: 'One body part a day, once a week. Weekly volume lands lower for it.',
      days: [
        { name: 'Chest', muscles: BRO_CHEST, repeatJobs: CHEST_DAY_REPEATS },
        { name: 'Back', muscles: BRO_BACK },
        { name: 'Shoulders & Arms', muscles: [...BRO_SHOULDERS, ...BRO_ARMS], repeatJobs: ARM_DAY_REPEATS },
        { name: 'Legs', muscles: BRO_LEGS },
      ],
    },
  ],
  5: [
    {
      id: 'upper-lower-ppl',
      name: 'Upper / Lower + PPL',
      note: 'Most muscles twice a week. Upper and Lower lead with chest, lats and quads; Push, Pull and Legs with shoulders, arms, upper back and glutes.',
      days: [
        { name: 'Upper', muscles: UPPER, emphasis: ['Chest', 'Lats'] },
        { name: 'Lower · Quads', ...QUAD_DAY },
        { name: 'Push · Shoulders & triceps', ...SHOULDER_PUSH },
        { name: 'Pull · Upper back', ...BACK_PULL },
        { name: 'Legs · Glutes & hams', ...GLUTE_DAY },
      ],
    },
    {
      id: 'bro-5',
      name: 'Bro split',
      note: 'The classic five. One body part a day, once a week — volume lands lower.',
      days: [
        { name: 'Chest', muscles: BRO_CHEST, repeatJobs: CHEST_DAY_REPEATS },
        { name: 'Back', muscles: BRO_BACK },
        { name: 'Shoulders', muscles: BRO_SHOULDERS },
        { name: 'Arms', muscles: BRO_ARMS, repeatJobs: ARM_DAY_REPEATS },
        { name: 'Legs', muscles: BRO_LEGS },
      ],
    },
    {
      id: 'arnold-5',
      name: 'Arnold',
      note: 'Arnold pairing with a second legs day: one for quads, one for glutes and hamstrings.',
      days: [
        { name: 'Chest & Back A', muscles: CHEST_BACK, emphasis: ['Chest'] },
        { name: 'Shoulders & Arms', muscles: SHOULDERS_ARMS, repeatJobs: ARM_DAY_REPEATS },
        { name: 'Legs · Quads', ...QUAD_DAY },
        { name: 'Chest & Back B', muscles: BACK_CHEST, emphasis: ['Lats', 'Upper Back'] },
        { name: 'Legs · Glutes & hams', ...GLUTE_DAY },
      ],
    },
  ],
  6: [
    {
      id: 'ppl-x2',
      name: 'Push / Pull / Legs ×2',
      note: 'Everything twice a week, each pair of days with its own lead: chest or shoulders, lats or upper back, quads or glutes.',
      days: [
        { name: 'Push · Chest', ...CHEST_PUSH },
        { name: 'Pull · Lats', ...LAT_PULL },
        { name: 'Legs · Quads', ...QUAD_DAY },
        { name: 'Push · Shoulders & triceps', ...SHOULDER_PUSH },
        { name: 'Pull · Upper back', ...BACK_PULL },
        { name: 'Legs · Glutes & hams', ...GLUTE_DAY },
      ],
    },
    {
      id: 'arnold-6',
      name: 'Arnold ×2',
      note: 'The full Arnold split — every muscle twice a week.',
      days: [
        { name: 'Chest & Back A', muscles: CHEST_BACK, emphasis: ['Chest'] },
        { name: 'Shoulders & Arms A', muscles: SHOULDERS_ARMS, emphasis: ['Side Delts', 'Front Delts', 'Rear Delts'], repeatJobs: ARM_DAY_REPEATS },
        { name: 'Legs · Quads', ...QUAD_DAY },
        { name: 'Chest & Back B', muscles: BACK_CHEST, emphasis: ['Lats', 'Upper Back'] },
        { name: 'Shoulders & Arms B', muscles: ARMS_SHOULDERS, emphasis: ['Biceps', 'Triceps', 'Forearms'], repeatJobs: ARM_DAY_REPEATS },
        { name: 'Legs · Glutes & hams', ...GLUTE_DAY },
      ],
    },
    {
      id: 'bro-6',
      name: 'Bro + arms',
      note: 'One body part a day, with a second arms and delts session.',
      days: [
        { name: 'Chest', muscles: BRO_CHEST, repeatJobs: CHEST_DAY_REPEATS },
        { name: 'Back', muscles: BRO_BACK },
        { name: 'Shoulders', muscles: BRO_SHOULDERS },
        { name: 'Arms', muscles: BRO_ARMS, repeatJobs: ARM_DAY_REPEATS },
        { name: 'Legs', muscles: BRO_LEGS },
        // Not a second arm day for its own sake: arms and delts are the groups
        // that suffer most from once-a-week frequency, and a second exposure is
        // the only thing that lifts them inside this shape.
        { name: 'Arms & Delts', muscles: [...BRO_ARMS, ...BRO_SHOULDERS], repeatJobs: ARM_DAY_REPEATS },
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
  implement: 1.0,
}

// What you hold or sit in, ranked the way Hani programs a gym (2026-10-03):
// machines first, then barbells, then dumbbells — and an EZ or straight bar over
// the H-bar. A machine is braced, loads in small steps and takes the balance out
// of the set; a barbell still loads further than a pair of dumbbells. Weighted
// (`GYM_WEIGHTS.implement`) at about one rating step, so it decides between
// movements the database rates alike — a chest-supported row on a machine over
// the same row with dumbbells — without overruling one it rates clearly better.
// Gym only: at home there is nothing to rank. `implement` is derived from the
// name at build time (scripts/lint-exercises.mjs).
export const IMPLEMENT_SCORE = {
  machine: 1, cable: 0.9,
  barbell: 0.6, 'ez-bar': 0.6, weighted: 0.6,
  landmine: 0.5,
  dumbbell: 0.3, 'h-bar': 0.3, bodyweight: 0.3, other: 0.3,
  kettlebell: 0, band: 0,
}

// One movement per JOB per day (Hani, 2026-10-03): with a back squat in the day
// there's no need for a lunge, with a shoulder press no need for an upright row,
// with one chest-supported row no need for a second row. A job is a movement
// pattern, except these pairs, which do the same job down slightly different
// paths. The variation the day can't take is left for the week's other day.
// Days built around one muscle may repeat the jobs they list (`repeatJobs`).
export const SAME_JOB = {
  'split-squat': 'squat', // quad compound
  'upright-row': 'vertical-push', // shoulder press
  'incline-push': 'horizontal-push', // chest press
}
// When a day already has a movement for a job, a slot only takes a movement
// from another job if that one trains its muscle at least this directly — a
// secondary mover or better.
export const JOB_ALTERNATIVE_MIN = 0.5
// Failing that, its sets go onto what the day already has — but only if the day
// trains the muscle at least this hard already. A lat-biased row is half a set
// of upper back; that doesn't make a second row redundant for it.
export const JOB_COVERED_MIN = 0.75

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
  // A second movement for the same JOB in the same day (SAME_JOB) — a second
  // row, a lunge after a squat. The generator never writes one outside a day
  // built for it (`repeatJobs`), so this bites on those days and in swap
  // suggestions, where a second row is still offered, just ranked lower.
  sameJobInDay: 1.2,
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

// The path a muscle's first movement of the day comes down, on every day (a
// day's own `leadPaths` win). The back is two jobs: the lats get a vertical
// pull and the upper back a row. Left to the scorer, the lats took a
// lat-biased row, and with one row a day (SAME_JOB) the upper back was left
// with half a set of it — 2 sets a week on a bro split.
//
// `unlessShort`: the lats' pulldown only when the day still owes the upper
// back a movement of its own (two slots' worth). A tight day — two full-body
// sessions, a beginner on lower volume — has room for ONE back movement, and a
// row pays both muscles where a pulldown pays one.
export const LEAD_PATHS = {
  Lats: { paths: ['vertical-pull'], unlessShort: 'Upper Back' },
  'Upper Back': { paths: ['horizontal-pull'] },
}

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
