// Old exercise id → current id, for rows that were RENAMED or MERGED during the
// v4 database consolidation (grip-variant naming, chin-up/pull-up split, the
// "Overhead Press - …" shoulder rename, single-arm dedups, etc.). This lets any
// saved routine or workout log that still references a pre-v4 id keep resolving
// to the right exercise.
//
// Exercises that were genuinely DELETED with no equivalent (the goblet / landmine
// / cossack / kettlebell / jump squat + lunge family and the TRX variants removed
// in the legs consolidation) are deliberately NOT listed — there is nothing
// honest to point them at, so an old reference to one surfaces as "unknown"
// rather than silently becoming a different movement.
export const EXERCISE_ID_ALIASES = {
  // chest
  'bench-press': 'flat-bench-press',
  'mid-cable-fly': 'cable-crossover',
  // back
  'pull-up': 'pull-up-overhand-grip',
  'weighted-pull-up': 'pull-up-overhand-grip-weighted',
  'reverse-grip-pull-up': 'chin-up',
  'close-grip-chin-up': 'chin-up-close-grip',
  'lat-pulldown': 'lat-pulldown-overhand-grip',
  'one-arm-cable-row': 'seated-cable-row',
  'wide-grip-lat-pulldown': 'lat-pulldown-wide-grip',
  'neutral-grip-lat-pulldown': 'lat-pulldown-neutral-grip',
  'underhand-grip-lat-pulldown': 'lat-pulldown-underhand-grip',
  'behind-the-neck-lat-pulldown': 'lat-pulldown-behind-the-neck',
  'wide-grip-pull-up': 'pull-up-wide-grip',
  'wide-grip-pull-up-weighted': 'pull-up-wide-grip-weighted',
  'neutral-grip-pull-up': 'pull-up-neutral-grip',
  'neutral-grip-pull-up-weighted': 'pull-up-neutral-grip-weighted',
  'underhand-grip-pull-up-weighted': 'chin-up-weighted',
  'overhand-grip-pull-up-with-band': 'pull-up-overhand-grip-with-band',
  'neutral-grip-pull-up-with-band': 'pull-up-neutral-grip-with-band',
  'underhand-grip-pull-up-with-band': 'chin-up-with-band',
  'machine-supported-pull-ups-overhand-grip': 'machine-supported-pull-up-overhand-grip',
  'machine-supported-pull-ups-wide-grip': 'machine-supported-pull-up-wide-grip',
  'machine-supported-pull-ups-neutral-grip': 'machine-supported-pull-up-neutral-grip',
  'standing-cable-pullover-single-arm': 'standing-cable-pullover-bar',
  // shoulders (renamed to "Overhead Press - …"; some generic entries merged)
  'seated-barbell-shoulder-press': 'overhead-press-seated-barbell',
  'seated-barbell-overhead-press': 'overhead-press-seated-barbell',
  'smith-machine-shoulder-press': 'overhead-press-smith-machine',
  'lever-shoulder-press': 'overhead-press-lever',
  'dumbbell-shoulder-press': 'overhead-press-seated-dumbbell',
  'seated-dumbbell-overhead-press': 'overhead-press-seated-dumbbell',
  'standing-dumbbell-overhead-press': 'overhead-press-standing-dumbbell',
  'standing-barbell-overhead-press': 'overhead-press-standing-barbell',
  'seated-dumbbell-overhead-press-neutral-grip': 'overhead-press-seated-dumbbell-neutral-grip',
  'smith-machine-behind-the-neck-press': 'overhead-press-smith-machine-behind-the-neck',
  'seated-barbell-behind-the-neck-press': 'overhead-press-seated-barbell-behind-the-neck',
  'standing-barbell-behind-the-neck-press': 'overhead-press-standing-barbell-behind-the-neck',
  'standing-landmine-press': 'landmine-press-standing',
  'half-kneeling-landmine-press': 'landmine-press-half-kneeling',
  'machine-overhead-press-wide-grip': 'overhead-press-machine-wide-grip',
  'machine-overhead-press-narrow-grip': 'overhead-press-machine-narrow-grip',
  'two-arm-cable-front-raise': 'cable-front-raise',
  'two-arm-dumbbell-front-raise': 'dumbbell-front-raise',
  'standing-dumbbell-front-raise': 'dumbbell-front-raise',
  // neck and traps
  'prone-incline-shrug': 'kelso-shrug',
  // arms (single-arm dedups + generic wrist curl)
  'seated-one-arm-dumbbell-triceps-extension': 'seated-dumbbell-triceps-extension',
  'one-arm-cable-curl': 'cable-curl',
  'prone-tricep-kick-back-single-arm': 'dumbbell-tricep-kick-back-incline-prone',
  'seated-ez-bar-overhead-tricep-extensions': 'seated-ez-bar-overhead-triceps-extension',
  'wrist-curl': 'dumbbell-wrist-curl',
  // legs (weighted → base merges; deadlift abbreviation renames)
  'standing-calf-raise-weighted': 'standing-calf-raise',
  'copenhagen-adduction-weighted': 'copenhagen-adduction',
  'romanian-deadlift': 'romanian-deadlift-rdl',
  'stiff-leg-deadlift': 'stiff-leg-deadliftsldl',
}

// Add alias keys to a Map<id, exercise> so a lookup by an old id resolves to the
// current row. Mutates and returns the same map. Never overwrites a real id.
export function withAliases(byId) {
  for (const [oldId, newId] of Object.entries(EXERCISE_ID_ALIASES)) {
    const target = byId.get(newId)
    if (target && !byId.has(oldId)) byId.set(oldId, target)
  }
  return byId
}
