// The movement-pattern taxonomy, re-exported for the app.
//
// The definitions live one level up in data/movement-patterns.mjs because the
// exercise-database BUILD needs them too (scripts/lint-exercises.mjs derives
// every row's `pattern` from the rules in there, and node can't reach into
// src/). Re-exporting keeps app imports looking like every other one in
// src/data/ while leaving exactly one place where a pattern is defined — the
// same split scripts/muscle-taxonomy.mjs already has for muscles.
export * from '../../data/movement-patterns.mjs'
