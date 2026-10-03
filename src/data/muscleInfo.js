// Presentation taxonomy + educational copy for the exercise-bank hubs.
//
// This is a BROWSE/DISPLAY layer only. It groups exercises by reading each
// row's `muscles` map (see exerciseBank.js) and NEVER touches the stored
// `category` field or the engine's volume math. The engine's own rollup
// (engineConfig.js `ATOM_TO_GROUP`) stays the single source of truth for
// effective-volume and recovery numbers — this file just decides how the bank
// is navigated and what each muscle group is explained as.
//
// Note the deliberate divergence from muscle-taxonomy.mjs `HOME_CATEGORIES`:
// "Glutes" is surfaced as its own top-level browse tile here (it's huge and
// people look for it directly), even though the engine still rolls Glute Max up
// under Legs for volume purposes. Slugs below also power the dashboard's
// "what is this muscle?" deep-links, so keep them stable.
//
// COPY NOTE (Leon): the guide bullets are a scientific first draft —
// rewrite in your own voice before leaning on them publicly.

// Home categories in landing order. A category either:
//   - `subs`   → splits into subcategory hubs (genuinely different muscles or
//                regions), or
//   - `source` → lists exercises from that stored `category` directly, or
//   - `atoms`  → is a derived tile pulled by primary mover across all categories
//                (used for Glutes, promoted out of Legs).
// Split categories still list their full `source` roster below the sub tiles.
export const CATEGORIES = [
  { slug: 'chest', name: 'Chest', source: 'Chest', subs: ['upper-chest', 'middle-chest', 'lower-chest'] },
  { slug: 'back', name: 'Back', source: 'Back', subs: ['lats', 'mid-back', 'spinal-erectors'] },
  { slug: 'shoulders', name: 'Shoulders', source: 'Shoulders', subs: ['front-delts', 'side-delts', 'rear-delts'] },
  { slug: 'arms', name: 'Arms', source: 'Arms', subs: ['biceps', 'triceps', 'forearms'] },
  { slug: 'legs', name: 'Legs', source: 'Legs', subs: ['glutes', 'quads', 'hamstrings', 'calves', 'adductors', 'abductors', 'tibialis'] },
  { slug: 'traps', name: 'Neck and Traps', source: 'Neck and Traps' },
  { slug: 'core', name: 'Core', source: 'Core' },
]

// Subcategory slug → { name, parent, value|atoms }. Two membership modes:
//   - `value` → matches the row's stored `subCategory` column exactly (Arms and
//     Legs are split in the data itself — the source of truth).
//   - `atoms` → derived: an exercise falls in the subcategory when one of these
//     atoms is among its PRIMARY (highest-weight) movers. Used where the data
//     carries no explicit subCategory (delt heads, chest regions, back muscles).
export const SUBCATEGORIES = {
  'upper-chest': { name: 'Upper Chest', parent: 'chest', atoms: ['Upper Chest'] },
  'middle-chest': { name: 'Middle Chest', parent: 'chest', atoms: ['Middle Chest'] },
  'lower-chest': { name: 'Lower Chest', parent: 'chest', atoms: ['Lower Chest'] },
  lats: { name: 'Lats', parent: 'back', atoms: ['Lats'] },
  'mid-back': { name: 'Mid Back', parent: 'back', atoms: ['Mid Back', 'Rhomboids', 'Teres Major'] },
  'spinal-erectors': { name: 'Spinal Erectors', parent: 'back', atoms: ['Spinal Erectors'] },
  'front-delts': { name: 'Front Delts', parent: 'shoulders', atoms: ['Front Delts'] },
  'side-delts': { name: 'Side Delts', parent: 'shoulders', atoms: ['Side Delts'] },
  'rear-delts': { name: 'Rear Delts', parent: 'shoulders', atoms: ['Rear Delts', 'Rotator Cuff'] },
  biceps: { name: 'Biceps', parent: 'arms', value: 'Biceps' },
  triceps: { name: 'Triceps', parent: 'arms', value: 'Triceps' },
  forearms: { name: 'Forearms', parent: 'arms', value: 'Forearms' },
  glutes: { name: 'Glutes', parent: 'legs', value: 'Glutes' },
  quads: { name: 'Quads', parent: 'legs', value: 'Quads' },
  hamstrings: { name: 'Hamstrings', parent: 'legs', value: 'Hamstrings' },
  calves: { name: 'Calves', parent: 'legs', value: 'Calves' },
  adductors: { name: 'Adductors', parent: 'legs', value: 'Adductors' },
  abductors: { name: 'Abductors', parent: 'legs', value: 'Abductors' },
  tibialis: { name: 'Tibialis', parent: 'legs', value: 'Tibialis' },
}

// Educational copy, keyed by category OR subcategory slug.
//   anatomy   → bullets: what/where the muscle actually is
//   functions → bullets: what it does mechanically
//   training  → bullets: how to train it for growth (angles, reps, stretch
//               bias, common mistakes) — hypertrophy-first, no fluff
//   size      → optional closing line: "how much muscle is this, really"
// Say each point once: the three lists sit on one card, so an idea repeated
// across them (or in `size`) reads as padding. Leave `size` out when the
// bullets already cover it.
export const MUSCLE_INFO = {
  // ---- Categories ----
  chest: {
    anatomy: [
      'Three regions of one muscle: upper fibers from the collarbone, middle from the breastbone, lower from the ribs — all meeting in one tendon on the upper arm.',
      'Each region’s fibers run a different way, which is why pressing angle changes what works hardest.',
      'The pec minor and serratus anterior sit underneath, steadying the shoulder blade so the pec has a base to press from.',
    ],
    functions: [
      'Pulls the upper arm across the body — the motion in every press, flye and dip.',
      'Upper fibers help raise the arm, lower fibers drive it down, and the whole muscle rotates the shoulder inward.',
    ],
    training: [
      'Cover incline, flat and dip/decline angles across the week. The most common gap is flat-only pressing, which leaves the upper chest behind.',
      'Pair heavy presses (5–10 reps) with a stretch-focused move like flyes or deep push-ups (10–20 reps).',
      'Press through a full range — shoulder blades back, a real stretch at the bottom.',
    ],
  },
  back: {
    anatomy: [
      'Lats: a huge fan from the lower spine and pelvis to the upper arm — the width muscle.',
      'Rhomboids, mid-traps and teres major between the shoulder blades — the thickness muscles.',
      'Erectors: long columns running up the spine.',
    ],
    functions: [
      'Lats pull the arm down and in (pull-ups, pulldowns, pullovers).',
      'Rhomboids and mid-traps squeeze the shoulder blades together (rows).',
      'Erectors straighten the spine and stop it rounding in hinges and squats.',
    ],
    training: [
      'Every week, do a vertical pull (pulldown, pull-up) for the lats and a row for the mid-back.',
      'Chest-supported rows take momentum out, so the back does the work.',
      'Let the shoulder blades move: full stretch at the bottom of a pulldown, full squeeze at the top of a row.',
      'Hinges (RDLs, good mornings) and heavy compounds cover the erectors — they rarely need isolation.',
    ],
    size: 'One of the largest muscle areas in the body.',
  },
  shoulders: {
    anatomy: [
      'Three heads capping the shoulder: front, side and rear. Each has its own line of pull, so they act like three small muscles.',
      'The four rotator-cuff muscles sit underneath, keeping the ball centered in the socket.',
    ],
    functions: [
      'Front raises the arm forward and works in all pressing.',
      'Side lifts the arm out to the side — this builds width.',
      'Rear pulls the arm back and rotates it out — rows and reverse flyes.',
    ],
    training: [
      'Front: presses already cover it — little direct work needed.',
      'Side: the priority. Lateral raises, 10–20+ reps, and they handle high frequency.',
      'Rear: chronically undertrained — give it direct reverse flyes or face pulls, not just rows.',
    ],
  },
  arms: {
    anatomy: [
      'Front: the biceps (two heads) with the thick brachialis underneath.',
      'Back: the triceps (three heads).',
      'The forearms continue down to the grip.',
    ],
    functions: [
      'Biceps and brachialis bend the elbow; the biceps also turns the palm up.',
      'Triceps straightens the elbow, and its long head helps pull the arm down at the shoulder.',
    ],
    training: [
      'Arms grow most from direct work — curls and extensions, not just presses and pulls.',
      'Give both sides similar volume; a lagging triceps caps how big the arm looks.',
      'Moderate loads and strict reps — elbows are the joint you least want to anger.',
    ],
    size: 'The triceps is about two-thirds of your arm — bigger than the biceps.',
  },
  forearms: {
    anatomy: [
      'Inner (palm) side: the wrist and finger flexors that close your grip.',
      'Outer side: the wrist extensors, plus the brachioradialis running up toward the elbow.',
      'Dozens of small muscles rather than one big one.',
    ],
    functions: [
      'Flexors curl the wrist and squeeze the hand shut — every deadlift, row and carry uses them.',
      'Extensors lift the back of the hand and steady the wrist on curls and presses.',
      'Brachioradialis bends the elbow in a neutral grip — the muscle hammer curls build.',
    ],
    training: [
      'Every pulling session already works them — add direct work only if they lag or your grip fails first.',
      'Wrist curls, reverse curls and hammer curls at 12–25 reps; they recover fast, so train them often.',
      'Heavy holds and carries count as both grip and forearm work.',
    ],
  },
  traps: {
    anatomy: [
      'One diamond-shaped sheet from the base of the skull out to both shoulders and down to the mid-back.',
      'Three regions, not separate muscles: upper (the neck-to-shoulder slope), middle (between the blades) and lower (down the spine).',
      'The neck adds its own flexors and extensors, so this group covers both.',
    ],
    functions: [
      'Upper fibers shrug the shoulders and support the neck under load.',
      'Middle fibers pull the shoulder blades together; lower fibers pull them down and help rotate them on overhead work.',
      'Neck muscles bend, straighten and turn the head, and stiffen it under heavy carries and deadlifts.',
    ],
    training: [
      'Upper traps: shrugs and heavy carries — a controlled squeeze, no bouncing.',
      'Mid and lower traps get plenty from rows and face pulls; add prone Y-raises only if they lag.',
      'Direct neck work pays off for contact sports or a neck that visually lags — start light, high reps, slow progression.',
    ],
  },
  core: {
    anatomy: [
      'Front: the rectus abdominis — one long muscle whose tendon lines make the six-pack.',
      'Sides: the external and internal obliques, layered diagonally.',
      'Deepest: the transverse abdominis, wrapping the waist like a belt.',
    ],
    functions: [
      'Rectus abdominis curls the ribcage toward the pelvis.',
      'Obliques rotate and side-bend the trunk — and resist being rotated.',
      'The whole wall braces to transfer force in squats, deadlifts and presses.',
    ],
    training: [
      'Abs grow from resisted flexion (weighted crunches, hanging knee/leg raises) at 8–20 reps, not from hundreds of free reps.',
      'Add one anti-movement drill (planks, ab wheel) for the deep bracing layer.',
      'Seeing them is about body fat, not reps — training builds them, nutrition reveals them.',
    ],
  },
  legs: {
    anatomy: [
      'Hips: the glutes.',
      'Thigh: quads in front, hamstrings behind, adductors on the inner side.',
      'Below the knee: the calves (gastrocnemius and soleus).',
    ],
    functions: [
      'Glutes and hamstrings extend the hip; quads straighten the knee — together they make squats, hinges and lunges.',
      'Adductors pull the legs together and help in deep squats.',
      'Calves point the foot and drive every step.',
    ],
    training: [
      'Build sessions around one squat and one hinge — that pair covers most of the leg.',
      'Isolation (extensions, curls, calf raises, adduction) tops up what compounds miss.',
      'Legs need hard sets close to failure, but they’re the most fatiguing to train — manage them through volume.',
    ],
    size: 'The largest muscle mass in the body, by far.',
  },
  glutes: {
    anatomy: [
      'The gluteus maximus runs from the pelvis and sacrum to the upper thigh.',
      'The gluteus medius and minimus sit above and to the side (see Abductors).',
    ],
    functions: [
      'Extends the hip — standing up from a squat, locking out a deadlift, sprinting, climbing stairs.',
      'Rotates the thigh outward and tilts the pelvis back.',
    ],
    training: [
      'Mix a stretch-position move (deep squat, split squat, RDL) with a peak-contraction move (hip thrust, kickback).',
      'Go deep: the glute max is most stretched — and most stimulated — near full hip flexion.',
      'It recovers well and handles heavy loads and frequent training.',
    ],
    size: 'The biggest muscle in your body by volume.',
  },

  // ---- Subcategories: chest regions ----
  'upper-chest': {
    anatomy: [
      'A region of the pec major, not a separate muscle: fibers run diagonally from the inner collarbone down to the upper arm.',
    ],
    functions: [
      'Pulls the arm up and across the body, and helps the front delt raise the arm.',
    ],
    training: [
      'Incline presses at about 15–30° — steeper turns it into a shoulder press.',
      'Low-to-high cable flyes follow the fiber direction exactly.',
      'If your chest looks bottom-heavy, swap a flat press for an incline instead of adding sets.',
    ],
    size: 'The smallest chest region — and the first to visibly lag.',
  },
  'middle-chest': {
    anatomy: [
      'Fibers run nearly horizontally from the breastbone to the upper arm.',
    ],
    functions: [
      'Pulls the arm straight across the chest — a flat press or a chest-height crossover.',
    ],
    training: [
      'Flat barbell, dumbbell and machine presses are the staples.',
      'Chest-height flyes and crossovers keep tension on the pec without the triceps taking over.',
      'Dumbbells and deficit push-ups stretch deeper than a barbell — worth a slot for that.',
    ],
    size: 'The bulk of the pec — most chest mass lives here.',
  },
  'lower-chest': {
    anatomy: [
      'Fibers run upward from the ribs and abdominal sheath to the arm — the mirror image of the upper chest.',
    ],
    functions: [
      'Drives the arm down and forward — the bottom of a dip.',
    ],
    training: [
      'Dips are king — lean slightly forward and let the chest stretch at the bottom.',
      'High-to-low cable flyes match the fiber direction.',
      'Flat pressing already trains it a lot — most people need little dedicated work.',
    ],
    size: 'A small slice that finishes the lower line of the chest.',
  },

  // ---- Subcategories: back muscles ----
  lats: {
    anatomy: [
      'Starts across the lower spine, pelvis and lower ribs, then twists to attach on the front of the upper arm.',
      'That twist means it’s fully stretched with the arm overhead and slightly across the body.',
    ],
    functions: [
      'Pulls the arm down and into the body — pull-ups, pulldowns, pullovers.',
      'Drives the elbow back and down in rows.',
      'Rotates the shoulder inward and helps extend the spine.',
    ],
    training: [
      'Vertical pulls give the biggest loaded stretch — let your arms go fully long at the top.',
      'In rows, keep the elbow close to the body to bias lats over upper back.',
      'Half-kneeling or single-arm versions let you lean away for a deeper stretch.',
    ],
    size: 'The widest muscle you have — this is the V-taper.',
  },
  'mid-back': {
    anatomy: [
      'Rhomboids run from the spine to the inner edge of each shoulder blade, under the mid-traps, which pull the same way.',
      'Teres major runs from the bottom of the shoulder blade to the front of the arm — a small lat.',
    ],
    functions: [
      'Squeezes the shoulder blades together — the finish of every row.',
      'Keeps the blades pinned so presses and pulls have a stable base.',
      'Teres major pulls the arm down and back with the lat.',
    ],
    training: [
      'Rows with the elbows flared ~45–60° shift work from the lats to the mid-back.',
      'A deliberate squeeze and controlled return beat heavier weight with a shrug.',
      'Chest-supported and cable rows take the body English out.',
    ],
    size: 'The thickness muscles — depth between the shoulder blades.',
  },
  'spinal-erectors': {
    anatomy: [
      'Three parallel columns (iliocostalis, longissimus, spinalis) from the pelvis up to the ribs, neck and skull — thickest in the lower back.',
    ],
    functions: [
      'Straighten the spine — standing tall out of a hinge, arching in a back extension.',
      'Their main job under load: holding the spine rigid in squats, deadlifts and rows.',
    ],
    training: [
      'Hinges (RDLs, good mornings) and back extensions train them directly.',
      'Every heavy compound already works them — count that before adding more.',
      'They recover slowly when trained hard; a little direct work goes a long way.',
    ],
  },

  // ---- Subcategories: delt heads ----
  'front-delts': {
    anatomy: [
      'The front third of the deltoid, from the collarbone to the outer arm.',
    ],
    functions: [
      'Raises the arm forward and rotates the shoulder inward.',
    ],
    training: [
      'Bench, incline and overhead pressing already train them well.',
      'When you want more, overhead pressing is the best direct choice.',
      'Front raises are rarely worth a slot — spend that set on side or rear delts.',
    ],
  },
  'side-delts': {
    anatomy: [
      'The middle third of the deltoid, right over the point of the shoulder.',
    ],
    functions: [
      'Lifts the arm out to the side — the motion of a lateral raise, and what builds shoulder width.',
      'Helps overhead pressing once the arm is away from the body.',
    ],
    training: [
      'Lateral raises are the staple — dumbbells, cables or machines.',
      'Cables and lean-away versions keep tension at the bottom, where dumbbells give none.',
      '10–20+ reps with strict form; they recover fast, so extra volume and frequency pay off.',
    ],
  },
  'rear-delts': {
    anatomy: [
      'The back third of the deltoid, from the shoulder-blade ridge to the outer arm, with the rotator cuff underneath.',
    ],
    functions: [
      'Pulls the arm back — reverse flyes, face pulls, wide rows.',
      'Rotates the shoulder outward with the cuff.',
    ],
    training: [
      'Rows help but rarely suffice — give them direct sets (reverse flyes, face pulls, rear-delt rows).',
      'Light weight, strict reps: momentum steals rear-delt tension instantly.',
      'They handle lots of frequency — easy to add at the end of any session.',
    ],
    size: 'Key for posture and balanced shoulders.',
  },

  // ---- Subcategories: arms ----
  biceps: {
    anatomy: [
      'Two heads: the long head on the outside (crosses the shoulder), the short head on the inside.',
      'The brachialis lies underneath and pushes the biceps up as it grows.',
    ],
    functions: [
      'Bends the elbow and turns the palm up; the long head helps slightly at the shoulder.',
    ],
    training: [
      'Full range, controlled lowering — the stretch half of the rep drives growth.',
      'Incline or behind-the-body curls stretch the long head; hammer and reverse curls hit the brachialis and brachioradialis.',
      'Chin-ups double as heavy biceps work. 8–15 strict reps is the sweet spot.',
    ],
    size: 'About a third of your upper-arm mass — smaller than the triceps.',
  },
  triceps: {
    anatomy: [
      'Three heads: the long head (crosses the shoulder, and the biggest), plus the lateral and medial heads.',
    ],
    functions: [
      'Straightens the elbow on every press and pushdown.',
      'The long head also pulls the arm down at the shoulder.',
    ],
    training: [
      'Overhead extensions stretch the long head — the highest-value triceps slot, and the one most training misses.',
      'Pushdowns and close-grip presses cover the lateral and medial heads.',
      'Presses give heavy indirect work; extensions drive the extra growth.',
    ],
    size: 'About two-thirds of your upper-arm size — the bigger arm muscle.',
  },

  // ---- Subcategories: legs ----
  quads: {
    anatomy: [
      'Four muscles: vastus lateralis (outer sweep), vastus medialis (the teardrop), vastus intermedius (underneath) and rectus femoris on top.',
      'The rectus femoris also crosses the hip, so it behaves differently from the other three.',
    ],
    functions: [
      'All four straighten the knee; the rectus femoris also lifts the thigh (knee raises, sprinting).',
    ],
    training: [
      'Deep knee bend is the growth signal — full-depth squats, leg presses and split squats beat half reps.',
      'Leg extensions are the only move that fully loads the rectus femoris — worth a slot.',
      'Quad work is very fatiguing; manage weekly hard sets rather than stacking more.',
    ],
    size: 'The biggest muscle group in your legs.',
  },
  hamstrings: {
    anatomy: [
      'Three muscles: biceps femoris on the outside, semitendinosus and semimembranosus on the inside.',
      'All but the short head of biceps femoris cross both the hip and the knee.',
    ],
    functions: [
      'Extend the hip and bend the knee.',
      'Slow the leg down every stride — why sprinters tear them.',
    ],
    training: [
      'Do both: a hinge (RDL, good morning) for the hip and a curl for the knee — neither alone trains everything.',
      'Seated curls beat lying curls: the bent hip pre-stretches the hamstrings.',
      'In hinges, the stretch near the bottom is what counts — deep, controlled, no bouncing.',
    ],
  },
  calves: {
    anatomy: [
      'The gastrocnemius is the visible two-headed bulge; it crosses the knee, so it only works fully with a straight leg.',
      'The soleus lies underneath and crosses only the ankle — bent-knee work is soleus work.',
    ],
    functions: [
      'Point the foot and push you off the ground — every step, jump and sprint.',
      'The soleus works constantly to hold you upright.',
    ],
    training: [
      'Straight-leg raises for the gastroc, seated raises for the soleus — do both.',
      'Pause deep in the stretch; bouncing lets the Achilles do the work.',
      'They take high reps and high frequency, and progress is slow. Be patient.',
    ],
  },
  adductors: {
    anatomy: [
      'A group of five on the inner thigh, led by the adductor magnus — one of the biggest muscles in the body.',
    ],
    functions: [
      'Pull the leg toward the midline.',
      'The adductor magnus also extends the hip from deep positions, like a hamstring in a deep squat.',
    ],
    training: [
      'Deep, wider-stance squats already train them hard.',
      'The adduction machine adds direct volume if the inner thigh lags.',
      'Copenhagen planks build them and protect the groin from strains.',
    ],
    size: 'A surprisingly large share of total thigh mass.',
  },
  abductors: {
    anatomy: [
      'The gluteus medius and minimus on the outer hip, above and beneath the glute max.',
    ],
    functions: [
      'Lift the leg out to the side.',
      'Keep the pelvis level whenever you stand on one leg — every step, lunge and split squat.',
    ],
    training: [
      'Single-leg work (split squats, lunges, step-ups) trains them automatically.',
      'The abduction machine or banded side-steps add direct volume for outer-hip shape.',
      '12–20 reps with a deliberate pause beat heavy stack-slamming.',
    ],
    size: 'Small stabilisers, but key for hip health.',
  },
  tibialis: {
    anatomy: [
      'Runs down the outer front of the shin bone, from just below the knee to the inside of the foot.',
    ],
    functions: [
      'Pulls the foot and toes up — the opposite of the calves. It controls every downhill step.',
      'Absorbs impact when the foot lands, which is why it matters for shin splints and knee-friendly running.',
    ],
    training: [
      'Toe raises are the whole menu: tib bar, dumbbell on the foot, cable over the forefoot, or heels-forward wall raises. Nothing else in a normal program trains it.',
      '15–25 reps, and it recovers fast — train it like the calves, just in the other direction.',
      'Control the lowering; letting the toes drop fast skips half the work.',
    ],
    size: 'Small, but it fills out the lower leg from the front.',
  },
}

// ---- Dashboard deep-links --------------------------------------------------
// The dashboard reports volume/recovery per ENGINE_MUSCLE (engineConfig.js).
// Map each of those labels to its explainer hub so a "?" next to "Quads" can
// answer "what even is that?" — the exact gap a beginner hit.
export const ENGINE_MUSCLE_TO_SLUG = {
  Chest: 'chest',
  Lats: 'lats',
  'Upper Back': 'mid-back',
  'Lower Back': 'spinal-erectors',
  'Neck & Traps': 'traps',
  'Front Delts': 'front-delts',
  'Side Delts': 'side-delts',
  'Rear Delts': 'rear-delts',
  Biceps: 'biceps',
  Triceps: 'triceps',
  Forearms: 'forearms',
  Abs: 'core',
  Obliques: 'core',
  Quads: 'quads',
  Hamstrings: 'hamstrings',
  Glutes: 'glutes',
  Adductors: 'adductors',
  Abductors: 'abductors',
  Calves: 'calves',
  Tibialis: 'tibialis',
}

// Path to a slug's hub, resolving subcategory slugs through their parent.
export function hubPath(slug) {
  const sub = SUBCATEGORIES[slug]
  return sub ? `/exercises/group/${sub.parent}/${slug}` : `/exercises/group/${slug}`
}

// Path to the explainer for a dashboard ENGINE_MUSCLE label, or null.
export function muscleHref(engineMuscle) {
  const slug = ENGINE_MUSCLE_TO_SLUG[engineMuscle]
  return slug ? hubPath(slug) : null
}

export function categoryBySlug(slug) {
  return CATEGORIES.find((c) => c.slug === slug) || null
}
