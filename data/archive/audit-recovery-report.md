# Recovery/fatigue/rest consistency audit — Step 2

Run via `node scripts/audit-recovery.mjs` against the 8 cross-column rules in
`recovery-rubric.md` §5 (147 exercises with valid data, 1 unnamed blank row).
16 unique exercises flagged across 8 rule categories, 22 flag instances total.

## Applied (4 exercises, 1 field each — directly in the CSV)

Same fix pattern already approved once (JM Press / Triceps Dips: fatigue too
low for the stated rest). Here the mismatch runs the other way: **rest too
short for the stated fatigue score**, and the DB already contains the correct
pairing on an equivalent exercise (Smith Machine Hip Thrust: fatigue 4 →
3-4 min rest), so the fix direction was unambiguous.

| Exercise | Column | Before | After | Why |
|---|---|---|---|---|
| Barbell Hip Thrusts | Recommended Rest Time | 2-3 minutes | **3-4 minutes** | Fatigue 4, matches Smith Machine Hip Thrust's fatigue-4/3-4min pairing already in the DB |
| Dumbbell Walking Lunge | Recommended Rest Time | 2-3 minutes | **3-4 minutes** | Fatigue 4, same tier as above |
| Single-Leg Dumbbell Hip Thrust | Recommended Rest Time | 2-3 minutes | **3-4 minutes** | Fatigue 4, same tier as above |
| Dumbbell Lunge | Recommended Rest Time | 2-3 minutes | **3-4 minutes** | Fatigue 4, same tier as above |

Fatigue Score and Estimated Recovery Window were **not** touched on these 4 —
only Recommended Rest Time moved, since that was the one field out of step
with the other two.

## Judgment calls — resolved 2026-07-10 (Hani approved all 4 recommendations)

| Exercise | Field(s) | Before | After |
|---|---|---|---|
| Smith Machine Good Morning | Fatigue / Axial / Rest | 3 / No / 3-4min | **4 / Yes / 4-6min** — brought in line with its own 72-96h window and near-identical Stiff Leg Deadlift (fatigue 5, axial Yes, same window) |
| Barbell Shrug | Axial Loading | Yes | **No** — small-ROM, arms-at-sides hold doesn't carry squat/deadlift-style spinal-compression risk; fatigue/window/rest already agreed with each other |
| Dragon Flag | Fatigue | 1 | **2** — full-body-lever hold with Skill = Very High was understated at 1; kept below Toes to Bar (3) |
| Face Pull | Fatigue | 3 | **2** — trimmed the 3x spread vs. near-identical Cable Rear Delt Fly (1), kept a small premium for rotator-cuff/upper-trap involvement |

Applied directly to `data/professional_hypertrophy_db_v3.csv`. Re-running the
audit after these fixes: flags dropped from 18 → 10, and the remaining 10 are
exactly the two groups below (already reviewed, no action needed).

### Reviewed, no change — Smith Machine Squat / Hack Squats Machine (fatigue 5 on machines)
Rule R5 assumes stable equipment lowers systemic fatigue, but squat-pattern
movements are mass/joint-driven, not balance-driven — removing the balance
demand often lets you load them *heavier*, which can offset or exceed the
stability discount. Likely fine as-is (false positive on Rule 5).

### Reviewed, no change — Glute Max free-weight group (Sumo Deadlift 5, Trap Bar Deadlift 5, Barbell Hip Thrusts 4, Single-Leg DB Hip Thrust 4, Barbell Glute Bridge 3)
Dismissed as a false positive — this groups by primary muscle only, which
conflates genuinely different movement patterns (maximal axial deadlifts vs.
non-axial hip-extension work). The spread is justified by movement pattern.

### Reviewed, no change — Quadriceps machine group (Smith Machine Squat 5, Hack Squats Machine 5, Leg Press 3)
Leg Press removes torso-stabilization demand (back supported on a pad) that
squat-pattern machines still require, which plausibly justifies the gap.

## Next step

Step 2 complete — 0 outstanding flags requiring action. Move to Step 4
(document column semantics + re-anchor `engineConfig.js`'s RIR curve per
`recovery-rubric.md` §0).

SFR / Hypertrophy Potential / Stretch-Mediated Hypertrophy remain out of
scope for this pass (deferred to a later session per Hani's instruction).
