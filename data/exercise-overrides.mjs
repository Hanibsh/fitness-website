// Approved corrections applied ON TOP of the raw CSV by the linter.
//
// The source CSV (data/professional_hypertrophy_db_v3.csv) is never edited —
// this keeps the original data intact and every change auditable. Each entry
// is keyed by the exercise's stable id (slug) and carries a `_reason`.
//
// A `muscles` override REPLACES the computed contribution map; every other key
// patches that single field. Keys beginning with `_` are documentation only.

export const OVERRIDES = {
  // --- Equipment: "Highly Technical" is a skill level, not equipment. These
  //     are bodyweight movements. (Also clears the 4 blockers.) ---
  'weighted-muscle-up': { equipment: 'bodyweight', _reason: 'CSV equipment "Highly Technical" is a skill level; movement is bodyweight (loadable).' },
  'band-assisted-muscle-up': { equipment: 'bodyweight', _reason: 'CSV equipment "Highly Technical" is a skill level; bodyweight (band-assisted).' },
  'dragon-flag': { equipment: 'bodyweight', _reason: 'CSV equipment "Highly Technical" is a skill level; bodyweight.' },
  'toes-to-bar': { equipment: 'bodyweight', _reason: 'CSV equipment "Highly Technical" is a skill level; bodyweight.' },

  // --- Equipment: machines mislabeled as free weight. ---
  'lat-pulldown': { equipment: 'machine', _reason: 'Selectorized machine, mislabeled free weight.' },
  'leg-press': { equipment: 'machine', _reason: 'Plate-loaded machine, mislabeled free weight.' },
  'lying-leg-curl': { equipment: 'machine', _reason: 'Machine, mislabeled free weight.' },
  'seated-leg-curl': { equipment: 'machine', _reason: 'Machine, mislabeled free weight.' },
  'leg-extension': { equipment: 'machine', _reason: 'Machine, mislabeled free weight.' },
  'single-leg-extension': { equipment: 'machine', _reason: 'Machine, mislabeled free weight.' },
  'leg-press-calf-raise': { equipment: 'machine', _reason: 'Machine, mislabeled free weight.' },

  // --- Hack Squat Calf Raise: fatigue 5 is a copy-paste from the squat row
  //     (a calf raise is not max-fatigue), note is the wrong squat cue, and
  //     it's a machine. Recovery window follows fatigue back down. ---
  'hack-squat-calf-raise': {
    fatigueScore: 1, recoveryWindowHours: [24, 48], equipment: 'machine', notes: null,
    _reason: 'Fatigue 5 + squat note copy-pasted from Hack Squat; calf raise is low-fatigue machine work.',
  },

  // --- Laterality: name says one-leg but marked bilateral. ---
  'hack-machine-one-leg-calf-raise': { laterality: 'unilateral', _reason: 'Name is "One-Leg" but laterality was bilateral.' },

  // --- Forearm anatomy: wrist curls target the wrist flexors/extensors, not
  //     the brachioradialis. ---
  'barbell-reverse-wrist-curl': { muscles: { 'Wrist Extensors': 1.0, Brachioradialis: 0.25 }, _reason: 'Reverse wrist curl trains wrist extensors, not brachioradialis.' },
  'dumbbell-wrist-curl': { muscles: { 'Wrist Flexors': 1.0 }, _reason: 'Wrist curl trains wrist flexors, not brachioradialis.' },
  'wrist-curl': { muscles: { 'Wrist Flexors': 1.0 }, _reason: 'Wrist curl trains wrist flexors, not brachioradialis.' },

  // --- Fatigue too low vs. long rest: these are loaded compound elbow moves,
  //     not isolation. Bump fatigue to match the 3.5-5 min rest. ---
  'barbell-jm-press': { fatigueScore: 2, _reason: 'Loaded compound triceps press; fatigue 1 too low for 3.5-5 min rest.' },
  'triceps-dips': { fatigueScore: 2, _reason: 'Loaded compound dip; fatigue 1 too low for 3.5-5 min rest.' },
  'assisted-triceps-dips': { fatigueScore: 2, _reason: 'Compound dip; fatigue 1 too low for 3.5-5 min rest.' },

  // --- Rest too short vs. fatigue 4: these are the same hip-hinge/lunge
  //     fatigue tier as Smith Machine Hip Thrust, which already carries a
  //     3-4 min rest at fatigue 4. Bumped to match (data/recovery-rubric.md
  //     §4/§5 R2, data/audit-recovery-report.md). ---
  'barbell-hip-thrusts': { restSeconds: [180, 240], _reason: 'Fatigue 4 but rest was 2-3 min; matches Smith Machine Hip Thrust (fatigue 4, 3-4 min) once bumped.' },
  'dumbbell-walking-lunge': { restSeconds: [180, 240], _reason: 'Fatigue 4 but rest was 2-3 min; bumped to the fatigue-4 tier (3-4 min).' },
  'single-leg-dumbbell-hip-thrust': { restSeconds: [180, 240], _reason: 'Fatigue 4 but rest was 2-3 min; bumped to the fatigue-4 tier (3-4 min).' },
  'dumbbell-lunge': { restSeconds: [180, 240], _reason: 'Fatigue 4 but rest was 2-3 min; bumped to the fatigue-4 tier (3-4 min).' },
}
