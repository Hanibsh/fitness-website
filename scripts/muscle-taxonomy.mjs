// Canonical muscle taxonomy for the hypertrophy engine.
//
// This is the single source of truth for which muscles exist and how the
// free-text terms in the source CSV map onto them. Every downstream
// calculation (effective volume, per-muscle recovery %, weekly hard sets)
// keys off these canonical names, so ambiguity has to be resolved HERE, once.
//
// Design rules:
//  - An atom is a muscle we track independently because exercises can
//    meaningfully bias toward it (e.g. the three delt heads, the three chest
//    regions). We do NOT split where the data carries no bias signal.
//  - The three triceps heads collapse to a single "Triceps": every triceps
//    movement in the CSV lists all three heads equally, so there's no bias to
//    preserve — and keeping them separate triple-counts triceps volume.
//  - "Calves" is treated as the gastrocnemius; the soleus is its own atom
//    (trained by bent-knee work), matching how the CSV already uses them.

export const MUSCLE_GROUPS = {
  Shoulders: ['Front Delts', 'Side Delts', 'Rear Delts', 'Rotator Cuff'],
  Chest: ['Upper Chest', 'Middle Chest', 'Lower Chest'],
  Back: ['Lats', 'Mid Back', 'Rhomboids', 'Upper Traps', 'Mid Traps', 'Lower Traps', 'Spinal Erectors', 'Teres Major'],
  Arms: ['Biceps', 'Brachialis', 'Triceps'],
  Forearms: ['Brachioradialis', 'Wrist Flexors', 'Wrist Extensors', 'Deep Finger Flexors'],
  Core: ['Rectus Abdominis', 'Obliques', 'Transverse Abdominis', 'Hip Flexors'],
  Legs: ['Quadriceps', 'Glute Max', 'Hamstrings', 'Adductors', 'Abductors', 'Gastrocnemius', 'Soleus'],
}

// Flat set of every canonical atom.
export const MUSCLES = new Set(Object.values(MUSCLE_GROUPS).flat())

// Home Category values the app actually has code for (search boost in
// exerciseLibrary.js CATEGORY_WORDS, specialization-block options in
// dashboard.js MUSCLE_GROUPS, etc). NOT the same list as MUSCLE_GROUPS' keys
// above — Home Category is about how exercises are browsed/organized, not
// muscle-volume rollup (e.g. "Traps" is its own browsing category even though
// traps atoms live under the "Back" muscle family for volume purposes). Home
// Category itself is free text — an unrecognized value doesn't break the
// build — but the linter flags it as a WARNING so a genuinely new category
// (e.g. "Neck") gets surfaced for a deliberate decision instead of silently
// sitting inert with no app support. Keep in sync with exerciseLibrary.js's
// CATEGORY_WORDS values by hand — see the note there.
export const HOME_CATEGORIES = new Set(['Shoulders', 'Back', 'Chest', 'Arms', 'Forearms', 'Core', 'Legs', 'Traps'])

// The group a canonical atom belongs to (for roll-up displays).
export const GROUP_OF = Object.fromEntries(
  Object.entries(MUSCLE_GROUPS).flatMap(([group, list]) => list.map((m) => [m, group]))
)

// Simple 1:1 renames — the source term means exactly one canonical atom.
// Each of these is a taxonomy DECISION worth surfacing in the report.
export const ALIASES = {
  'Long Head Triceps': 'Triceps',
  'Lateral Head Triceps': 'Triceps',
  'Medial Head Triceps': 'Triceps',
  Calves: 'Gastrocnemius',
}

// Composite terms that are not a single muscle. They expand to a set of atoms
// with ABSOLUTE contribution weights (0..1), independent of the tier they were
// listed in. Only used where a real muscle can't be named directly.
//   "Full Back" (deadlift) → erectors do the isometric brunt, lats + traps assist.
export const EXPANSIONS = {
  'Full Back': [
    ['Spinal Erectors', 1.0],
    ['Lats', 0.5],
    ['Upper Traps', 0.5],
  ],
}

// Resolve one source term (already trimmed) at a given tier weight into a list
// of [canonicalMuscle, contribution] pairs, plus a `kind` describing what
// happened so the linter can report it.
//   tierWeight is 1.0 / 0.5 / 0.25 for primary / secondary / tertiary.
export function resolveMuscleTerm(term, tierWeight) {
  const t = term.trim()
  if (!t) return { pairs: [], kind: 'empty' }

  if (EXPANSIONS[t]) {
    // Expansion weights are absolute; scale by tier so a non-primary listing
    // would still shrink proportionally.
    const pairs = EXPANSIONS[t].map(([m, w]) => [m, round2(w * tierWeight)])
    return { pairs, kind: 'expanded' }
  }

  const canonical = ALIASES[t] || t
  if (!MUSCLES.has(canonical)) {
    return { pairs: [], kind: 'unknown', term: t }
  }
  return { pairs: [[canonical, tierWeight]], kind: canonical !== t ? 'aliased' : 'direct', from: t, to: canonical }
}

function round2(n) {
  return Math.round(n * 100) / 100
}
