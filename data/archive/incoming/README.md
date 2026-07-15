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

## Batch 2 — 2026-07-11 (66 raw → 51 merged, DB 256 → 307)

Source: `new_exercises_back2.csv` (back — rows, pulldowns, pull-ups, pullovers).
Single already-well-formed file (no CSV corruption to repair, unlike Batch 1).

One script this time (`node scripts/import-newstuff.mjs`), since there was
nothing to combine and the judgment-column recalibration was done as an
explicit per-row lookup table (anchored to this exact exercise family's
existing mother-file precedents — every row/pulldown/pull-up sits at Fatigue
3 / 48-72h / 3.5-5min, e.g. `Pull-Up`, `Lat Pulldown`, `Barbell Bent Over Row`,
`Seated Cable Row`) rather than the generic leg/chest-tuned heuristic from
Batch 1, which would have under-rated this family. Writes
`_newstuff_staging.csv` + `_newstuff_cleaning_report.md`.

15 rows dropped: 8 were near-duplicates of an exercise the mother file already
had under a different name (e.g. new "Overhand Grip Lat Pulldown" vs mother's
"Lat Pulldown"; new "Overhand/Underhand Grip Pull Up" vs mother's
"Pull-Up"/"Reverse Grip Pull-Up"); 6 were single-arm rows merged into an
existing bilateral sibling (laterality set to `Can Be Both`); 1 was an
intra-file duplicate (two rows for the same plate-loaded chest-supported row,
one with a redundant "Wide Grip" name). Muscle terms `Traps`/`Core`/`Lower
Back` mapped to `Upper Traps`/`Rectus Abdominis`/`Spinal Erectors` (same
aliasing precedent as Batch 1). `Teres Major` was a genuinely new muscle
(used by Wide Grip Lat Pulldown + 3 pull-up variants) — added to the Back
group in the taxonomy (approved by Hani), threading through the 5 usual sync
points: `muscle-taxonomy.mjs`, `engineConfig.js` `ATOM_TO_GROUP`,
`dashboard.js`'s muscle→group map, `exerciseLibrary.js` search-boost map,
`data/README.md`'s muscle list.

Then: append `_newstuff_staging.csv` (minus header) to the mother file,
`npm run build:exercises` (0 lint blockers), and all three audits — 0 flags
on the recovery audit; the SFR and HP/Stretch audits together flagged 2 minor
items, both reviewed: `Behind The Neck Lat Pulldown`'s SFR ("average") sits
below its grip-variant siblings' "excellent", but that's a deliberate,
Face-Pull-style safety/risk discount for a controversial movement, not an
error — kept as-is. The banded row variants (`Stretch-Mediated Hypertrophy`
= "none") vs. the banded pull-up variants ("yes") is a genuine inherited
source-data judgment call neither script touched — flagged to Hani, not
auto-changed (Stretch-Mediated isn't read by any app code yet, so it's data
hygiene, not urgent).

**Double-check refinement (same day, Hani-approved decisions):**
`node scripts/refine-newstuff.mjs` applied a second pass over the 51 merged
rows after a 5-dimension review (muscles / SFR / category / recovery / rest) —
see `_newstuff_refine_report.md` for the row list. Key corrections: (1) the
rich AI muscle lists were double-to-triple counting Back-group volume vs the
mother file's calibration (engine.js SUMS same-group atoms — a new pulldown
credited 2.75 Back sets/set vs mother Lat Pulldown's 1.0), fixed by damping
with `:weight` syntax (Teres Major:0.5, Rhomboids:0.25, Upper Traps:0.125-0.25)
while keeping every muscle listed; (2) `Rhomboids` renamed to `Mid Back` in the
horizontal rows so all ~35 row movements share mother's atom (Rhomboids stays
on vertical pulls); (3) SFR demoted Excellent→Good on 22 rows to match the
fact-checked precedent tier (Lat Pulldown/Seated Cable Row/Seated Row Machine
= Good), keeping Excellent only on Machine Supported Pull Ups + Standing Cable
Pullovers (the Braced Single Arm Cable Pulldown profile: fatigue 2 + stable +
direct isolation); (4) bent-over rows Unstable→Moderate and chest-supported
barbell/DB rows Very Stable→Stable per mother precedent; weighted pull-ups
overload High→Moderate (mother Weighted Pull-Up); cable pulldowns stretch
Yes→Partial. Recovery windows and rest times needed no changes (0 audit flags).
Known-open: the Stretch-Mediated column is still internally mixed across the
wider lat family (mother rows Partial vs new rows No/Yes; band rows None vs
band pull-ups Yes) — surfaced to Hani, awaiting a call.
