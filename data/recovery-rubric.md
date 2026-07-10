# Recovery / Fatigue / Rest rubric — evidence base for the engine's core inputs

This is the justification layer for three CSV columns that drive the hypertrophy engine
(`professional_hypertrophy_db_v3.csv` → `Fatigue Score`, `Estimated Recovery Window`,
`Recommended Rest Time`). These feed `engine.js` recovery% + the advisor (roadmap goals 11–12).

Per-exercise numbers can't be individually verified against studies — there is no trial on
"the recovery window of the Lever Preacher Curl." What the literature **can** anchor is:
(1) what each column *means*, (2) plausible value ranges per exercise archetype, and
(3) how the columns must relate to each other. Step 2 (the audit script) checks every row
against the rules below; Step 4 re-anchors `engineConfig.js` to match the semantics fixed here.

Built 2026-07-10. Scope: fatigue / recovery / rest only. SFR, Hypertrophy Potential, and
Stretch-Mediated are a **separate later pass** (deliberately out of scope here).

---

## 0. The key semantic decision: what does "Estimated Recovery Window" mean?

**Decision: the window = time from a *typical hard hypertrophy set* (taken to roughly 0–2 RIR)
until the muscle has recovered enough to train hard again.** It is anchored at near-failure
training, NOT at an arbitrary submaximal effort. Hani's instinct ("it's for when you train to
~0 RIR") is essentially correct.

Why this matters for the engine (settled by the failure evidence in §1):

- Training to true failure roughly **doubles acute neuromuscular fatigue** vs stopping 1–3 short
  (velocity loss 4 min post-set: **−25% at failure vs −13% at 1-RIR vs −8% at 3-RIR**;
  Pareja-Blanco / Refalo line of work), but the **difference in *full* recovery time is small** —
  for a moderate-volume upper-body compound (6 sets bench), *all* conditions were back to baseline
  by 48 h, with only ~−3% left at 24 h even for the failure group.
- So proximity to failure changes the **depth** of the pit far more than its **width**.

**Consequence for `engineConfig.js` (Step 4):** the current v2 model treats the window as the
baseline for a *typical* set and lets 0-RIR push recovery *beyond* the window. That over-weights
failure. Re-anchor so the RIR-fatigue multiplier is ≈ **1.0 at 0–2 RIR** (the window already
assumes this) and **tapers below 1.0** as RIR climbs (3+ RIR = genuinely less fatigue, faster
recovery). Failure may sit slightly above 1.0 to capture the extra depth, but the window stays the
reference point for a hard set — don't double-count failure.

---

## 1. Proximity to failure (RIR) → fatigue and recovery

- Failure vs 1–3 RIR produces **equivalent hypertrophy** in trained lifters (Refalo 2024 meta),
  so extra fatigue from failure buys little growth — the engine is right to penalize it, mildly.
- Acute fatigue is dose-responsive to proximity to failure: velocity loss at 4 min post-exercise
  **−25% (failure) / −13% (1-RIR) / −8% (3-RIR)**; within-session velocity loss followed the same
  order (−22 / −9 / −6%).
- **Full** neuromuscular recovery: ~complete by **48 h** for 6-set bench regardless of proximity to
  failure; only ~−3% remained at 24 h for failure/1-RIR. Lower-body / higher-damage protocols
  (CMJ after high-effort squats) stayed depressed to 48 h, while low-effort recovered by ~6 h.

→ RIR belongs in the fatigue term (accelerating toward failure) but its effect on the *width* of
the recovery window is modest. The engine's RIR curve should be gentle, anchored at 0–2 RIR = normal.

## 2. Recovery window by exercise archetype

General timecourse: MPS peaks ~24 h and can stay elevated >48 h (longer in less-trained lifters);
force/CK/soreness markers can persist to 48–72 h after heavy work. Trained lifters recover faster
as muscle damage attenuates after ~3 weeks (repeated-bout effect — supports the engine's novelty
term). Practical frequency reviews land on **~48 h for low volume, 72 h+ for high volume**, i.e.
each muscle every 2–3.5 days.

Recommended window bands (midpoint drives the engine's decay τ):

| Archetype | Example | Window |
|---|---|---|
| Small-muscle isolation, low damage | curls, pushdowns, lateral raises, calf raises | **24–48 h** |
| Larger isolation / low-axial compound | machine press, cable row, leg extension, pec deck | **36–60 h** |
| Multi-joint free-weight compound | bench, OHP, pull-up, barbell row | **48–72 h** |
| Heavy axial / large-mass compound | back/front squat, RDL, hip thrust | **48–96 h** |
| Maximal axial hinge | conventional/sumo/trap-bar deadlift | **72–120 h** |

## 3. Fatigue Score (1–5) — what should drive it

Fatigue Score should track **systemic + local disruption**, which scales with: muscle mass involved,
axial/spinal loading, external stability demand (free vs machine), and eccentric stress at long
muscle length. It should move **together with** the recovery window and rest time — a fatigue-5 lift
with a 24 h window or 2 min rest is internally contradictory (a real defect class we've already hit:
Hack Squat Calf Raise was fatigue-5 by copy-paste error).

| Score | Meaning | Typical archetype |
|---|---|---|
| 1 | Trivial systemic cost | isolation, machine/cable, no axial load |
| 2 | Light | harder isolation or stable small compound (dips, hanging leg raise) |
| 3 | Moderate | free-weight compound, non-axial or supported (bench, rows, pulldown) |
| 4 | High | loaded compound w/ real systemic draw (hip thrust, walking lunge) |
| 5 | Very high | heavy axial compound (squat, deadlift, RDL, split squat) |

## 4. Rest time between sets

- Bayesian meta (2024): a **small** hypertrophy benefit to >60 s vs ≤60 s (SMD ~0.13–0.17 for
  arms/thighs), with **no appreciable extra benefit beyond ~90 s** in the pooled data.
- Schoenfeld 2016 (trained men): **3 min beat 1 min** for size and strength — longer rest lets you
  keep reps/load up, which matters more for experienced lifters.
- Practical synthesis used by the DB: **isolation 2–3 min, free-weight compound 3–5 min,
  heavy axial 4–7 min.** Hani's "never recommend <2 min" floor is *more conservative* than the
  literature minimum (~90 s) but well within reason for a strength-quality-first, low-RIR approach —
  keep the floor. Rest time should rise monotonically with fatigue score / axial loading.

---

## 5. Cross-column consistency rules (for the Step-2 audit script)

Flag a row when any holds:

1. **Fatigue ↔ window:** fatigue 1 with window > 48 h; fatigue 5 with window < 48 h;
   fatigue ≥ 4 with window ≤ 24–48 h.
2. **Fatigue ↔ rest:** fatigue ≥ 4 with rest < 3 min; fatigue 1 with rest ≥ 3.5 min.
3. **Window ↔ rest:** window ≥ 72 h but rest < 3 min (or vice-versa — big-lift signals disagree).
4. **Axial ↔ everything:** `Axial Loading = Yes` but fatigue < 3, or window < 48 h, or rest < 3 min.
5. **Equipment ↔ fatigue:** `Machine`/`Cable` with fatigue 5 (stability lowers systemic cost —
   suspect a copy-paste error).
6. **Type ↔ fatigue:** `Isolation` with fatigue ≥ 4 (needs a specific reason, e.g. sissy squat).
7. **Near-duplicate divergence:** exercises with near-identical muscle maps + type + equipment whose
   fatigue/window/rest differ by more than one band (e.g. the JM Press / dips / Face Pull /
   Smith Good Morning inconsistencies flagged earlier).
8. **Band membership:** window not one of the standard strings, or fatigue outside its archetype
   band from §2–3.

Output of Step 2 = a table `exercise | column | current → proposed | rule fired | reason`,
for Hani to approve in one pass (Step 3).

---

## Sources

- Refalo et al. 2024 — proximity-to-failure & hypertrophy meta-regression: https://link.springer.com/article/10.1007/s40279-024-02069-2
- Proximity-to-failure & neuromuscular fatigue (velocity-loss dose-response, 24/48 h recovery): https://pmc.ncbi.nlm.nih.gov/articles/PMC9908800/
- Proximity-to-failure & hypertrophy systematic review/meta: https://pmc.ncbi.nlm.nih.gov/articles/PMC9935748/
- Failure vs RIR, 8-week trained (equal hypertrophy): https://www.tandfonline.com/doi/full/10.1080/02640414.2024.2321021
- Time course of recovery, leading or not to failure (Pareja-Blanco): https://pubmed.ncbi.nlm.nih.gov/26667923/
- Recovery after heavy resistance exercise (48–72 h force/CK/soreness): https://journals.lww.com/nsca-jscr/fulltext/2011/03000/recovery_after_heavy_resistance_exercise_and.26.aspx
- Recovery by loading magnitude & velocity loss (higher velocity loss = slower recovery): https://pmc.ncbi.nlm.nih.gov/articles/PMC6473797/
- Damas et al. — MPS related to hypertrophy only after damage attenuates (repeated-bout / trained-state recovery): https://pmc.ncbi.nlm.nih.gov/articles/PMC5023708/
- Training-frequency evidence review (volume → 48 h low / 72 h+ high; every 2–3.5 days): https://weightology.net/the-members-area/evidence-based-guides/training-frequency-for-hypertrophy-the-evidence-based-bible/
- Rest interval Bayesian meta-analysis 2024 (>60 s small benefit, plateau ~90 s): https://pmc.ncbi.nlm.nih.gov/articles/PMC11349676/
- Grgic & Schoenfeld rest-interval review (trained benefit from longer rest): https://pubmed.ncbi.nlm.nih.gov/39205815/
