// Corrections applied ON TOP of the raw CSV by the linter, for cases where
// you don't want to touch a cell in data/professional_hypertrophy_db_v4.csv
// directly (e.g. a fix still under discussion, or something you want undone
// easily). Each entry is keyed by the exercise's stable id (slug) and
// carries a `_reason`. Keys beginning with `_` are documentation only.
//
// Prefer editing the CSV directly for anything settled — see data/README.md.
// This file is normally EMPTY: every correction made so far (equipment
// relabels, fatigue/rest fixes, wrist-curl anatomy, etc.) lives in the CSV
// itself, since Hani actively edits and extends that file and a hidden
// second source of truth he can't see risks masking real state from him.
//
// A `muscles` override REPLACES the computed contribution map; every other key
// patches that single field.

export const OVERRIDES = {}
