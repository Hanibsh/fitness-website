---
name: update-exercise-db
description: Rebuild the exercise database after Hani edits the CSV in Excel. Triggers on phrases like "update the exercise", "I updated the exercise file/CSV", or similar. Runs the build pipeline, surfaces lint findings, flags any brand-new taxonomy value before adding code support for it, then commits and pushes.
---

# Update Exercise DB

**Trigger:** Hani says something like "update the exercise", "I edited the exercise CSV", or similar. This means he edited `data/professional_hypertrophy_db_v4.csv` directly in Excel himself. Don't ask what changed — just run the steps below. This covers any column (muscles, laterality, fatigue score, equipment, rest time, etc.), not just muscle data.

1. Run `npm run build:exercises`. This parses the CSV, regenerates `data/exercises.candidate.json` and `data/lint-report.md`, and copies the result to `src/data/exercises.json`.
2. Read `data/lint-report.md` in full — both blockers and warnings, not just blockers. Report anything found back to Hani specifically (which exercise, which cell, what it means) rather than silently fixing or ignoring it.
3. **Flag-and-ask rule:** Hani does not extend the app's fixed lists himself (muscle taxonomy, Home Category, or any other column's accepted values) — that's a code change, not a spreadsheet edit. If the CSV introduces a value the code doesn't recognize (an unknown muscle name, a Home Category not in `HOME_CATEGORIES` in `scripts/muscle-taxonomy.mjs`, etc.), stop and ask him before adding code support for it. Never silently extend `MUSCLES`, `HOME_CATEGORIES`, `ENUMS`, `ATOM_TO_GROUP`, `MUSCLE_GROUPS`, `CATEGORY_WORDS`, `DB_MUSCLE_TO_GROUP`, `PATTERNS` (`data/movement-patterns.mjs`), or similar lists.
4. **Movement patterns are derived, and the report is the review.** Every row gets a `pattern` from the rules in `data/movement-patterns.mjs`. After a rebuild, read the report's pattern sections: a 🔴 blocker means a row matched no rule at all; a *placed by muscle profile* entry means the name rules missed it and it was guessed; a driver-mismatch warning means the row's heaviest muscle isn't one the pattern claims to train, which is nearly always a misclassification. Surface all three to Hani rather than accepting them silently. A row the rules will never get right is pinned with `{ pattern: '…' }` in `data/exercise-overrides.mjs`; a whole new pattern is a flag-and-ask, per the rule above.
5. If steps 2-4 found nothing that needs his decision, commit and push automatically — no need to ask first.

**Not this skill:** a brand-new batch of exercises being folded into the mother file (rather than an edit to existing rows) is a bigger, separate job — see `data/incoming/README.md` for that pipeline instead.
