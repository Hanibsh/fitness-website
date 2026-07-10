# Recovery/fatigue/rest consistency audit — Step 2

Run via `node scripts/audit-recovery.mjs` against the 8 cross-column rules in
`recovery-rubric.md` §5 (147 exercises with valid data, 1 unnamed blank row).
16 unique exercises flagged across 8 rule categories, 22 flag instances total.

## Applied (4 exercises, 1 field each — `data/exercise-overrides.mjs`)

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

## Flagged for review — NOT applied (12 exercises, judgment calls)

These have more than one plausible resolution (which field is "wrong" isn't
mechanically derivable from the other columns), so per the agreed Step 3 plan
they're surfaced for a decision rather than auto-fixed.

### Smith Machine Good Morning — fatigue vs. window disagree
Fatigue 3, but window 72-96h (that window is otherwise reserved for fatigue-5
axial hinges). The near-identical free-weight version, **Stiff Leg Deadlift**,
has the *same* 72-96h window with fatigue **5**, axial **Yes**, rest **4-7min**
— Smith Good Morning sits at fatigue 3 / axial No / rest 3-4min despite an
identical target-muscle set and window. This was already named as a known
problem row in project memory before this audit.
**My read:** the Smith machine likely doesn't cut fatigue this much for a
hip-hinge pattern (it removes balance demand, not spinal/hamstring loading) —
lean toward raising fatigue (3→4), axial (No→Yes), and rest (3-4min→4-6min)
to match the window, rather than shortening the window. Your call.

### Barbell Shrug — axial flag disagrees with everything else
Axial Loading = Yes, but fatigue 1 / window 24-48h / rest 2-3min (all
isolation-tier). Fatigue/window/rest all agree with *each other* — it's the
axial flag that's the outlier.
**My read:** "Axial Loading" here may be over-literal — the column is meant
to flag exercises with real spinal-compression risk (squat/deadlift-style),
and a shrug's small-ROM, arms-at-sides hold doesn't carry that risk despite
technically loading the spine. Lean toward changing Axial Loading to **No**
rather than raising fatigue/window/rest. Your call.

### Smith Machine Squat / Hack Squats Machine — fatigue 5 on machines
Rule R5 assumes stable equipment lowers systemic fatigue, but squat-pattern
movements are mass/joint-driven, not balance-driven — removing the balance
demand often lets you load them *heavier*, which can offset or exceed the
stability discount.
**My read:** likely fine as-is (false positive on Rule 5) — no change
recommended, but flagging since the rule fired.

### Dragon Flag (fatigue 1) vs. Toes to Bar (fatigue 3)
Both isolation, bodyweight, rectus-abdominis-primary. Dragon Flag has
Skill = Very High and is widely regarded as one of the more demanding
core moves (full-body lever), which sits oddly next to a fatigue score of 1.
**My read:** Dragon Flag's fatigue may be understated — worth a second look,
possibly 2. No change applied.

### Face Pull (fatigue 3) vs. Cable Rear Delt Fly (fatigue 1)
Both isolation, cable, rear-delt-primary. A 3-point spread for two fairly
similar rear-delt cable exercises looks wide. Face Pull's rotator-cuff/upper-trap
involvement and multi-directional pull plausibly justify *some* premium over
a straight fly, but 3x on a 1-5 scale looks like a stretch.
**My read:** consider trimming Face Pull to fatigue 2. No change applied.

### Glute Max free-weight group (Sumo Deadlift 5, Trap Bar Deadlift 5, Barbell Hip Thrusts 4, Single-Leg DB Hip Thrust 4, Barbell Glute Bridge 3)
Reviewed and **dismissed as a false positive** — this groups by primary
muscle only, which conflates genuinely different movement patterns (maximal
axial deadlifts vs. non-axial hip-extension work). The spread is justified by
movement pattern, not a data error.

### Quadriceps machine group (Smith Machine Squat 5, Hack Squats Machine 5, Leg Press 3)
Reviewed, **likely fine** — Leg Press removes torso-stabilization demand
(back supported on a pad) that squat-pattern machines still require, which
plausibly justifies the gap. No change recommended.

## Next step

Awaiting your decisions on the 6 flagged items above (Smith Good Morning,
Barbell Shrug, Dragon Flag, Face Pull — the other two are "likely fine, no
action"). Once resolved, rebuild (`npm run build:exercises`) and re-run this
script to confirm zero flags, then move to Step 4 (document column semantics
+ re-anchor `engineConfig.js`'s RIR curve per `recovery-rubric.md` §0).

SFR / Hypertrophy Potential / Stretch-Mediated Hypertrophy remain out of
scope for this pass (deferred to a later session per Hani's instruction).
