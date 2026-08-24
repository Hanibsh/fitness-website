// Injury tuning — the numbers behind "does this movement load the thing that
// hurts". Split out from injuries.js the same way engineConfig.js is split from
// engine.js: the logic there is stable, these coefficients are not.
//
// THE PROBLEM THIS FILE SOLVES
//
// The exercise database has no joint column. It knows which MUSCLES a movement
// trains and how hard (plus type, equipment, axial loading, stability), and
// nothing at all about the shoulder those muscles happen to hang off. So joint
// risk has to be inferred from muscle work, and that inference is a judgement
// call — which is exactly why it lives in one file you can argue with, and why
// a user verdict on a specific exercise always beats it (see injuries.js).
//
// Treat every number below as a first draft. They were set by reasoning about
// anatomy, not fitted to data. The verdicts people record are the data that
// should eventually replace them.

import { ENGINE_MUSCLES } from './engineConfig'

// ---- Joint & region areas ----------------------------------------------------
//
// The eight places people actually say hurt. Each `muscles` weight answers one
// question: if a movement trains this muscle hard, how hard does it load THIS
// joint? 1.0 means the joint takes the full force of the work; 0.3 means it's
// along for the ride.
//
// Read the entries as anatomy, not as a muscle list:
//   - `shoulder` weights Chest and Front Delts at the top because pressing is
//     what a cranky glenohumeral joint complains about first, and Lats/Upper
//     Back below them because pulling loads the same joint through a friendlier
//     path.
//   - `lower-back` keeps Lats and Upper Back LOW (0.3). They attach to the
//     thoracolumbar fascia so they aren't zero, but a lat pulldown is not a
//     deadlift and the tier it lands in shouldn't suggest otherwise.
//   - `wrist` gives Neck & Traps 0.5, which looks wrong until you remember
//     shrugs are a grip exercise.
//
// `compoundBoost` and `axialBoost` are MULTIPLICATIVE (see riskFor in
// injuries.js) so they scale a real risk rather than dragging an incidental one
// up into a scary tier.
export const JOINT_AREAS = {
  shoulder: {
    label: 'Shoulder',
    blurb: 'The ball-and-socket joint itself — pressing, overhead work and anything at end range.',
    muscles: {
      'Front Delts': 1, Chest: 0.95, 'Side Delts': 0.9, 'Rear Delts': 0.65, Lats: 0.6,
      'Upper Back': 0.4, 'Neck & Traps': 0.35, Triceps: 0.25, Biceps: 0.15,
    },
    compoundBoost: 0.15,
  },
  elbow: {
    label: 'Elbow',
    blurb: 'Tendon pain on the inside or outside — curls, extensions and heavy pulling.',
    muscles: {
      Triceps: 1, Biceps: 0.95, Forearms: 0.55, Lats: 0.4,
      Chest: 0.35, 'Upper Back': 0.35, 'Front Delts': 0.2, 'Rear Delts': 0.15,
    },
    compoundBoost: 0.12,
  },
  wrist: {
    label: 'Wrist & hand',
    blurb: 'Grip, wrist extension under load, and anything that bends the wrist back.',
    muscles: {
      Forearms: 1, 'Neck & Traps': 0.5, Lats: 0.45, 'Upper Back': 0.45,
      Biceps: 0.35, Chest: 0.3, Triceps: 0.3, 'Front Delts': 0.3,
    },
    compoundBoost: 0.1,
    equipmentRelief: { machine: 0.85 },
  },
  neck: {
    label: 'Neck',
    blurb: 'The cervical spine — direct neck work, shrugs, and heavy spinal loading.',
    muscles: {
      'Neck & Traps': 1, 'Upper Back': 0.4, 'Rear Delts': 0.3,
      'Side Delts': 0.3, 'Front Delts': 0.25,
    },
    axialBoost: 0.35,
    equipmentRelief: { machine: 0.85 },
  },
  'lower-back': {
    label: 'Lower back',
    blurb: 'The lumbar spine — hinging, bracing and anything that loads you top-down.',
    muscles: {
      'Lower Back': 1, Glutes: 0.65, Hamstrings: 0.6, Obliques: 0.4, Quads: 0.4,
      Abs: 0.35, 'Neck & Traps': 0.35, Adductors: 0.3, Lats: 0.2, 'Upper Back': 0.2,
    },
    compoundBoost: 0.15,
    axialBoost: 0.45,
    equipmentRelief: { machine: 0.8, cable: 0.95 },
  },
  hip: {
    label: 'Hip & groin',
    blurb: 'The hip joint, hip flexors and adductors — deep flexion, wide stances, hinging.',
    muscles: {
      Glutes: 1, Adductors: 0.95, Abductors: 0.8, Hamstrings: 0.7, Quads: 0.55,
      'Lower Back': 0.35, Abs: 0.3,
    },
    compoundBoost: 0.15,
  },
  knee: {
    label: 'Knee',
    blurb: 'Anything that bends the knee under load — squatting, lunging, extensions.',
    muscles: {
      Quads: 1, Hamstrings: 0.65, Glutes: 0.5, Adductors: 0.4, Calves: 0.3, Abductors: 0.3,
    },
    compoundBoost: 0.2,
  },
  ankle: {
    label: 'Ankle & foot',
    blurb: 'Calf and shin work, plus standing movements that load through the foot.',
    muscles: {
      Calves: 1, Tibialis: 1, Quads: 0.4, Glutes: 0.3, Hamstrings: 0.3, Adductors: 0.25,
    },
    compoundBoost: 0.15,
  },
}

export const JOINT_AREA_IDS = Object.keys(JOINT_AREAS)

// ---- Muscle strains ----------------------------------------------------------
//
// A pulled hamstring needs no inference layer: the implicated muscle IS the
// injury, so the area list is just the engine's own twenty. Reused rather than
// re-listed so a new muscle (Tibialis was the last one added) shows up here for
// free.
//
// The one thing a strain cares about that a joint doesn't is LENGTH. A muscle
// torn at long length hates being taken there again, and `stretchMediated` is
// exactly that column — so strains get a stretch boost where joints get a
// compound boost.
export const MUSCLE_AREA_IDS = ENGINE_MUSCLES

export const STRAIN_STRETCH_BOOST = { yes: 0.3, partial: 0.15, none: 0 }

// ---- Shared modifiers --------------------------------------------------------

// An unstable movement asks the joint to stabilise as well as move, which is the
// part that hurts. Joint areas only — a strained muscle doesn't care whether the
// bar wobbled. Values are multiplicative around 1.
export const STABILITY_FACTOR = {
  'highly unstable': 1.2,
  unstable: 1.1,
  moderate: 1,
  stable: 0.95,
  'very stable': 0.9,
}

// THE MODIFIERS BELOW ARE WHAT MAKE THE PENALTY DO ANYTHING.
//
// Worth understanding before touching them. The generator picks the best
// movement for a MUSCLE, so an injury penalty only changes the outcome if it
// separates candidates WITHIN that muscle. A shoulder injury that scores every
// chest exercise identically subtracts the same number from all of them and
// re-ranks nothing — the split comes out unchanged, which is exactly what
// happened the first time this was measured.
//
// The base area weight can't provide that separation: every chest movement
// trains chest at ~1.0. These per-exercise modifiers are the only thing that
// can, which is why a joint gets a stretch boost as well as a strain does —
// end-range load is what a cranky joint objects to, and it's the difference
// between a machine press and a deep dumbbell fly.
export const JOINT_STRETCH_BOOST = { yes: 0.2, partial: 0.1, none: 0 }

// A machine holds the path for you; a free weight makes the joint find it.
// Applies to every joint area, on top of any per-area `equipmentRelief`.
export const JOINT_EQUIPMENT_FACTOR = {
  machine: 0.85,
  cable: 0.92,
  'resistance band': 0.95,
  bodyweight: 1,
  'free weight': 1.06,
}

// ---- Turning risk into consequence -------------------------------------------

// How much an injury still counts, by where it is in its life. `managing` is the
// stage where you're training around it deliberately, so it should nudge rather
// than shout; `resolved` stops mattering entirely and never penalises anything.
export const STATUS_FACTOR = { active: 1, managing: 0.5, resolved: 0 }

// Latest pain check-in (0-10) → how much to weight the injury. Never reaches 0
// even at a reported 0, because "it didn't hurt today" isn't "it's healed" —
// that's what resolving is for.
export const PAIN_FACTOR = { floor: 0.4, perPoint: 0.06 }

// No check-in logged yet. Deliberately below a mid-pain report: an injury you
// haven't rated shouldn't outrank one you told us is a 7.
export const DEFAULT_PAIN_WEIGHT = 0.7

// Raw risk → the badge people see. `high` is "expect this to hurt", `moderate`
// is "worth watching", `low` is "it's in the neighbourhood".
//
// These were raised from a first draft of 0.7/0.4/0.01 after running the model
// over the whole database: the original cut flagged 197 of 279 exercises for a
// shoulder injury, 111 of them "high". A badge that appears on seven movements
// in ten is wallpaper. Re-tune by running the risk-check script, not by eye —
// the thing to watch is the tier COUNTS, not whether the ranking looks sensible
// (the ranking was already fine when the counts were absurd).
export const RISK_TIERS = { high: 0.75, moderate: 0.5, low: 0.3 }

// Below this, don't mention the exercise at all. Every movement grazes some
// neighbouring joint and flagging all of them is the same as flagging none.
export const RISK_FLOOR = 0.3

// NOTE: the size of the generator's penalty is NOT here — it's `PENALTIES.injury`
// in generatorConfig.js, beside the penalties it has to be balanced against.
// This file decides how risky a movement is; that one decides what risk costs.
