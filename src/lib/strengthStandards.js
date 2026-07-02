// Strength standards data.
//
// Three sources, labelled honestly per lift:
//  - Big 3 (squat/bench/deadlift): Jeff Nippard's "Noob to Freak" 5-tier scale.
//  - The original 8: Strength Level community data, 6-tier scale.
//  - The rest: best-estimate 6-tier standards from general lifting knowledge.
//    These are approximate benchmarks, not exact Strength Level figures.
//
// "floor" is the estimated-1RM ÷ bodyweight ratio at which a tier begins.

const T5 = ['Beginner', 'Intermediate', 'Advanced', 'Elite', 'Freak']
const T6 = ['Below beginner', 'Beginner', 'Novice', 'Intermediate', 'Advanced', 'Elite+']

function tiers(labels, floors) {
  return floors.map((floor, i) => ({ label: labels[i], floor }))
}

const NIPPARD = "Jeff Nippard's \"Noob to Freak\" standards"
const STRENGTH_LEVEL = 'Strength Level community data'
const ESTIMATE = 'Estimated from general strength standards'

export const lifts = {
  // ---- Big 3 — Jeff Nippard 5-tier ----------------------------------------
  squat: {
    name: 'Squat', category: 'Legs', source: NIPPARD,
    male: tiers(T5, [0, 1.25, 1.75, 2.5, 3.0]),
    female: tiers(T5, [0, 1.0, 1.5, 1.75, 2.25]),
  },
  bench: {
    name: 'Bench press', category: 'Chest', source: NIPPARD,
    male: tiers(T5, [0, 1.0, 1.5, 2.0, 2.25]),
    female: tiers(T5, [0, 0.5, 0.75, 1.0, 1.25]),
  },
  deadlift: {
    name: 'Deadlift', category: 'Back', source: NIPPARD,
    male: tiers(T5, [0, 1.5, 2.25, 3.0, 3.5]),
    female: tiers(T5, [0, 1.25, 1.75, 2.25, 3.0]),
  },

  // ---- Original 8 — Strength Level community data --------------------------
  hackSquat: {
    name: 'Hack squat', category: 'Legs', source: STRENGTH_LEVEL,
    male: tiers(T6, [0, 0.75, 1.25, 2.0, 2.75, 4.0]),
    female: tiers(T6, [0, 0.25, 0.75, 1.5, 2.25, 3.25]),
  },
  rdl: {
    name: 'Romanian deadlift', category: 'Legs', source: STRENGTH_LEVEL,
    male: tiers(T6, [0, 0.75, 1.0, 1.5, 2.0, 2.75]),
    female: tiers(T6, [0, 0.5, 0.75, 1.0, 1.5, 1.75]),
  },
  bicepCurl: {
    name: 'Bicep curl (dumbbell)', category: 'Arms', source: STRENGTH_LEVEL,
    male: tiers(T6, [0, 0.1, 0.15, 0.3, 0.5, 0.65]),
    female: tiers(T6, [0, 0.05, 0.1, 0.2, 0.35, 0.45]),
  },
  skullCrusher: {
    name: 'Skull crusher', category: 'Arms', source: STRENGTH_LEVEL,
    male: tiers(T6, [0, 0.2, 0.35, 0.55, 0.8, 1.1]),
    female: tiers(T6, [0, 0.1, 0.2, 0.35, 0.55, 0.75]),
  },
  tBarRow: {
    name: 'T-bar row', category: 'Back', source: STRENGTH_LEVEL,
    male: tiers(T6, [0, 0.5, 0.75, 1.0, 1.5, 2.0]),
    female: tiers(T6, [0, 0.25, 0.45, 0.75, 1.05, 1.45]),
  },
  smithSquat: {
    name: 'Smith machine squat', category: 'Legs', source: STRENGTH_LEVEL,
    male: tiers(T6, [0, 0.75, 1.0, 1.5, 2.25, 3.0]),
    female: tiers(T6, [0, 0.25, 0.75, 1.0, 1.5, 2.25]),
  },
  legExtension: {
    name: 'Leg extension', category: 'Legs', source: STRENGTH_LEVEL,
    male: tiers(T6, [0, 0.5, 0.75, 1.25, 1.75, 2.5]),
    female: tiers(T6, [0, 0.25, 0.5, 1.0, 1.25, 2.0]),
  },
  legCurl: {
    name: 'Leg curl', category: 'Legs', source: STRENGTH_LEVEL,
    male: tiers(T6, [0, 0.5, 0.75, 1.0, 1.5, 2.0]),
    female: tiers(T6, [0, 0.25, 0.45, 0.75, 1.05, 1.45]),
  },

  // ---- Estimated 6-tier standards (approximate benchmarks) ----------------
  // Chest
  inclineBench: {
    name: 'Incline bench press', category: 'Chest', source: ESTIMATE,
    male: tiers(T6, [0, 0.5, 0.75, 1.1, 1.5, 2.0]),
    female: tiers(T6, [0, 0.25, 0.4, 0.6, 0.85, 1.15]),
  },
  closeGripBench: {
    name: 'Close-grip bench press', category: 'Chest', source: ESTIMATE,
    male: tiers(T6, [0, 0.5, 0.75, 1.05, 1.45, 1.9]),
    female: tiers(T6, [0, 0.25, 0.4, 0.6, 0.8, 1.1]),
  },
  machineChestPress: {
    name: 'Machine chest press', category: 'Chest', source: ESTIMATE,
    male: tiers(T6, [0, 0.5, 0.8, 1.25, 1.75, 2.25]),
    female: tiers(T6, [0, 0.3, 0.5, 0.8, 1.1, 1.5]),
  },
  // Back
  latPulldown: {
    name: 'Lat pulldown', category: 'Back', source: ESTIMATE,
    male: tiers(T6, [0, 0.5, 0.75, 1.1, 1.5, 2.0]),
    female: tiers(T6, [0, 0.3, 0.45, 0.7, 1.0, 1.4]),
  },
  seatedCableRow: {
    name: 'Seated cable row', category: 'Back', source: ESTIMATE,
    male: tiers(T6, [0, 0.5, 0.75, 1.1, 1.5, 2.0]),
    female: tiers(T6, [0, 0.3, 0.45, 0.7, 1.0, 1.4]),
  },
  pendlayRow: {
    name: 'Pendlay row', category: 'Back', source: ESTIMATE,
    male: tiers(T6, [0, 0.5, 0.75, 1.0, 1.4, 1.9]),
    female: tiers(T6, [0, 0.25, 0.4, 0.65, 0.95, 1.3]),
  },
  machineRow: {
    name: 'Machine row', category: 'Back', source: ESTIMATE,
    male: tiers(T6, [0, 0.5, 0.8, 1.25, 1.75, 2.25]),
    female: tiers(T6, [0, 0.3, 0.5, 0.8, 1.1, 1.5]),
  },
  shrug: {
    name: 'Barbell shrug', category: 'Back', source: ESTIMATE,
    male: tiers(T6, [0, 0.75, 1.25, 1.75, 2.5, 3.25]),
    female: tiers(T6, [0, 0.4, 0.7, 1.1, 1.6, 2.2]),
  },
  // Shoulders
  machineShoulderPress: {
    name: 'Machine shoulder press', category: 'Shoulders', source: ESTIMATE,
    male: tiers(T6, [0, 0.4, 0.65, 1.0, 1.4, 1.85]),
    female: tiers(T6, [0, 0.2, 0.35, 0.55, 0.8, 1.1]),
  },
  lateralRaise: {
    name: 'Lateral raise (dumbbell)', category: 'Shoulders', source: ESTIMATE,
    male: tiers(T6, [0, 0.05, 0.1, 0.2, 0.35, 0.5]),
    female: tiers(T6, [0, 0.03, 0.06, 0.12, 0.2, 0.3]),
  },
  uprightRow: {
    name: 'Upright row', category: 'Shoulders', source: ESTIMATE,
    male: tiers(T6, [0, 0.35, 0.55, 0.85, 1.2, 1.6]),
    female: tiers(T6, [0, 0.2, 0.3, 0.5, 0.7, 0.95]),
  },
  facePull: {
    name: 'Face pull', category: 'Shoulders', source: ESTIMATE,
    male: tiers(T6, [0, 0.3, 0.5, 0.75, 1.05, 1.4]),
    female: tiers(T6, [0, 0.2, 0.3, 0.5, 0.7, 0.95]),
  },
  // Legs
  frontSquat: {
    name: 'Front squat', category: 'Legs', source: ESTIMATE,
    male: tiers(T6, [0, 0.75, 1.0, 1.5, 2.0, 2.75]),
    female: tiers(T6, [0, 0.4, 0.6, 1.0, 1.4, 1.9]),
  },
  legPress: {
    name: 'Leg press', category: 'Legs', source: ESTIMATE,
    male: tiers(T6, [0, 1.0, 1.75, 2.75, 4.0, 5.5]),
    female: tiers(T6, [0, 0.6, 1.1, 1.9, 2.9, 4.0]),
  },
  bulgarianSplitSquat: {
    name: 'Bulgarian split squat (dumbbell)', category: 'Legs', source: ESTIMATE,
    male: tiers(T6, [0, 0.15, 0.25, 0.45, 0.7, 1.0]),
    female: tiers(T6, [0, 0.1, 0.15, 0.3, 0.5, 0.7]),
  },
  sumoDeadlift: {
    name: 'Sumo deadlift', category: 'Legs', source: ESTIMATE,
    male: tiers(T6, [0, 1.0, 1.5, 2.25, 3.0, 3.75]),
    female: tiers(T6, [0, 0.75, 1.1, 1.6, 2.25, 3.0]),
  },
  hipThrust: {
    name: 'Hip thrust', category: 'Legs', source: ESTIMATE,
    male: tiers(T6, [0, 0.75, 1.25, 2.0, 2.75, 3.75]),
    female: tiers(T6, [0, 0.5, 0.9, 1.5, 2.25, 3.0]),
  },
  calfRaise: {
    name: 'Standing calf raise', category: 'Legs', source: ESTIMATE,
    male: tiers(T6, [0, 0.75, 1.25, 2.0, 2.75, 3.75]),
    female: tiers(T6, [0, 0.5, 0.9, 1.5, 2.1, 2.9]),
  },
  // Arms
  barbellCurl: {
    name: 'Barbell curl', category: 'Arms', source: ESTIMATE,
    male: tiers(T6, [0, 0.25, 0.4, 0.6, 0.85, 1.15]),
    female: tiers(T6, [0, 0.15, 0.25, 0.4, 0.55, 0.75]),
  },
  preacherCurl: {
    name: 'Preacher curl', category: 'Arms', source: ESTIMATE,
    male: tiers(T6, [0, 0.2, 0.35, 0.55, 0.8, 1.05]),
    female: tiers(T6, [0, 0.12, 0.2, 0.35, 0.5, 0.7]),
  },
  hammerCurl: {
    name: 'Hammer curl (dumbbell)', category: 'Arms', source: ESTIMATE,
    male: tiers(T6, [0, 0.1, 0.15, 0.3, 0.45, 0.6]),
    female: tiers(T6, [0, 0.05, 0.1, 0.2, 0.3, 0.4]),
  },
  tricepPushdown: {
    name: 'Tricep pushdown (cable)', category: 'Arms', source: ESTIMATE,
    male: tiers(T6, [0, 0.25, 0.45, 0.7, 1.0, 1.35]),
    female: tiers(T6, [0, 0.15, 0.25, 0.45, 0.65, 0.9]),
  },
  overheadExtension: {
    name: 'Overhead tricep extension', category: 'Arms', source: ESTIMATE,
    male: tiers(T6, [0, 0.2, 0.35, 0.55, 0.8, 1.05]),
    female: tiers(T6, [0, 0.12, 0.2, 0.35, 0.5, 0.7]),
  },
}

export const CATEGORY_ORDER = ['Chest', 'Back', 'Shoulders', 'Legs', 'Arms']

export const zoneColors6 = ['bg-border-hover', 'bg-blue-400', 'bg-teal-400', 'bg-green-500', 'bg-yellow-500', 'bg-red-600']
export const zoneColors5 = ['bg-blue-400', 'bg-teal-400', 'bg-green-500', 'bg-yellow-500', 'bg-red-600']

export function matchTier(tierList, ratio) {
  let result = tierList[0].label
  for (const t of tierList) {
    if (ratio >= t.floor) result = t.label
  }
  return result
}
