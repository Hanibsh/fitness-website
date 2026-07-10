# Incoming exercise batches

Staging area for importing new exercises into the mother file
(`../professional_hypertrophy_db_v3.csv`). Kept for provenance — the raw
sources here were AI-generated on a free tier and full of errors; the pipeline
below is what turned them into mother-file-quality rows.

## Batch 1 — 2026-07-10 (117 raw → 108 merged, DB 148 → 256)

Sources: `new_exercises.csv` (shoulders/chest), `new_exercises1.csv` (arms),
`new_exercises2.csv` (legs — glutes/hams), `new_exercises3.csv` (legs —
squats/lunges/calves/adductors). Added at-home coverage: 27 bodyweight + 8
resistance-band movements.

Two-stage pipeline (both scripts are re-runnable and idempotent on the sources):

1. `node scripts/combine-incoming.mjs` — combines the 4 files and does the
   **deterministic** cleanup: repairs 3 kinds of CSV corruption (unquoted comma
   in the name, stray empty muscle cell, missing Quaternary column) by anchoring
   on the Home Category + recovery-window landmarks; maps muscle names to the
   canonical taxonomy (Glutes→Glute Max, Quads→Quadriceps, Core→Rectus Abdominis,
   Calves→Gastrocnemius, triceps heads→Triceps, …); applies the single-limb rule
   (drop the single-arm/leg row when a two-limb sibling exists, set the survivor
   to Can Be Both); drops exact dups of the mother file; `Minor` axial → No.
   Writes `_combined_staging.csv` + `_cleaning_report.md`.
2. `node scripts/calibrate-incoming.mjs` — drops the 3 Hani-confirmed redundant
   rows (Barbell Back Squat, Adduction Machine, Seated Single Leg Curl Machine),
   fixes the enum-vocabulary errors the source AIs introduced (Hypertrophy
   "Good"→High, SFR "Moderate"→Average / "Low"→Poor, Stability "Low"→Unstable),
   and **recalibrates the engine-critical judgment columns** (Fatigue / Recovery
   Window / Rest Time) + re-rates Resistance Profile (their Ascending/Descending/
   Ballistic/Isometric → our Balanced/Shortened/Lengthened) against the mother
   file's rubric. Writes `_calibrated_staging.csv`.

Then: append `_calibrated_staging.csv` (minus header) to the mother file,
`npm run build:exercises`, and run all three audits
(`audit-recovery.mjs` / `audit-sfr.mjs` / `audit-hp-stretch.mjs`) — result was
0 lint blockers and no genuine contradiction flags (only the known coarse
near-duplicate grouping noise). Two new enum values were approved and added to
`scripts/lint-exercises.mjs`: equipment `resistance band`, type `isometric`.

Calibration is rule-based (archetype → fatigue → window/rest), so it's a
consistent starting point, not gospel — same caveat as every other engine
coefficient. Spot-check anything that looks off and edit the mother CSV directly.
