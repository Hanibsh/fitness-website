# Exercise database — how to edit it

This folder holds the **source of truth** for every exercise the app knows about.
The workout-log picker and (later) the hypertrophy engine are built from it.

## The one file you edit

**`data/professional_hypertrophy_db_v3.csv`** — this repo copy is the single
source of truth. Open it in Excel / Google Sheets, edit, and **save back as CSV**.

> ⚠️ There may be an older copy on your Desktop (`C:\Users\hanib\Desktop\data\`).
> That one is **not** used by the app — ignore it, or delete it, to avoid
> confusion. Only the file in this repo is built.

## The build pipeline

```
data/professional_hypertrophy_db_v3.csv     ← you edit this
        │   npm run build:exercises
        ▼
data/exercises.candidate.json  +  data/lint-report.md   ← validation output
        │   (same command copies it)
        ▼
src/data/exercises.json                     ← what the app actually uses
```

After any edit:

1. Run **`npm run build:exercises`**.
2. Read **`data/lint-report.md`** — it lists 🔴 blockers (must fix), fixes
   applied, taxonomy decisions, and ⚠️ warnings worth a look. Blockers mean the
   row didn't validate (e.g. an unknown muscle name or a bad enum value).
3. Commit the CSV **and** the regenerated `src/data/exercises.json` together.

Columns are matched by **header name**, not position, so you can reorder or add
columns without breaking the parser — but keep the header text recognizable.

**Trying a brand-new value the app doesn't know yet?** Muscle names are strict
(🔴 blocker if unrecognized). Home Category is looser — it won't block the
build, but the linter still ⚠️ **warns** if you use one the app has no code for
yet (e.g. `Neck`), since it just sits there inert (no search boost, can't be a
specialization-block focus) until code is added for it. That warning is your
cue to ask for it to be added — new values (a new muscle, a new category,
anything) always go through a flag-and-ask step before code changes, never
silently.

## Add / edit / remove an exercise

- **Add:** append a new row and fill every column (see reference below). The `id`
  is generated automatically from the name (e.g. `Barbell Curl` → `barbell-curl`).
- **Edit:** change the cells. Renaming an exercise changes its `id` — only do that
  if you're sure (progress history is keyed by the exercise *name*).
- **Remove:** delete the row.

Prefer editing the CSV for real content changes. For one-off *corrections* you
don't want to touch the raw CSV for, use `data/exercise-overrides.mjs` (keyed by
`id`); those are re-applied on top of the CSV on every build.

## Column reference

| Column | Meaning / accepted values |
|---|---|
| Exercise Name | Free text. Becomes the `id` (slugified). |
| Home Category | `Shoulders`, `Back`, `Chest`, `Arms`, `Forearms`, `Core`, `Legs`, `Traps` — free text, but these are the ones the app recognizes for search/browse and specialization blocks |
| Exercise Type | `Compound`, `Isolation`, `Hybrid` |
| Laterality | `Bilateral`, `Unilateral`, `Can be both` |
| Primary Muscles (1.00) | Muscle name(s), comma-separated. Weight ×1.0 |
| Secondary Muscles (0.50) | …weight ×0.5 |
| Tertiary Muscles (0.25) | …weight ×0.25 |
| **Quaternary Muscles (0.125)** | …weight ×0.125 *(optional, leave blank if unused)* |
| Fatigue Score | Integer `1`–`5` |
| Estimated Recovery Window | e.g. `48-72 hours` |
| Progressive Overload Potential | `Low`, `Moderate`, `High`, `Very High` |
| Stability | `Highly unstable`, `Unstable`, `Moderate`, `Stable`, `Very stable` |
| Hypertrophy Potential | `Low`, `Moderate`, `High`, `Excellent` |
| Stimulus-to-Fatigue Ratio (SFR) | `Poor`, `Average`, `Good`, `Excellent` |
| Stretch-Mediated Hypertrophy | `No`, `Partial`, `Yes` |
| Resistance Profile | `Balanced`, `Shortened bias`, `Lengthened bias` |
| Stability Requirement | Actually **equipment**: `Free weight`, `Machine`, `Cable`, `Bodyweight` |
| Axial Loading | `No`, `Yes` |
| Skill Requirement | `Low`, `Moderate`, `High`, `Very High` |
| Recommended Rest Time | e.g. `3.5-5 minutes` (stored as seconds) |
| Notes | Free text (optional) |

### Need a weight other than 1 / 0.5 / 0.25 / 0.125?

Every muscle normally uses its column's default weight. If one specific muscle
in a cell needs a different weight (say 0.75), write it right after the name
with a colon — no new column needed:

```
Front Delts, Side Delts:0.75
```

Here `Front Delts` still gets the column's normal weight, but `Side Delts` gets
exactly `0.75` instead. Works in any of the 4 muscle columns, for any number
in the cell (0 < weight ≤ 1). Leave the colon off (as you always have) and
nothing changes.

## Muscle names (must match exactly)

Muscle cells must use these canonical names (the taxonomy lives in
`scripts/muscle-taxonomy.mjs`). Unknown names become a 🔴 blocker in the report.

- **Shoulders:** Front Delts · Side Delts · Rear Delts · Rotator Cuff
- **Chest:** Upper Chest · Middle Chest · Lower Chest
- **Back:** Lats · Mid Back · Rhomboids · Upper Traps · Mid Traps · Lower Traps · Spinal Erectors
- **Arms:** Biceps · Brachialis · Triceps
- **Forearms:** Brachioradialis · Wrist Flexors · Wrist Extensors
- **Core:** Rectus Abdominis · Obliques · Transverse Abdominis · Hip Flexors
- **Legs:** Quadriceps · Glute Max · Hamstrings · Adductors · Abductors · Gastrocnemius · Soleus

Accepted shorthands: `Calves` → Gastrocnemius; the three triceps heads
(`Long/Lateral/Medial Head Triceps`) all collapse to `Triceps`. `Full Back`
expands to Spinal Erectors + Lats + Upper Traps. To track a genuinely new muscle,
add it to the taxonomy first.
