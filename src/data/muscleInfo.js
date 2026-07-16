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
// COPY NOTE (Leon): the blurbs and guide bullets are a scientific first draft —
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
  { slug: 'legs', name: 'Legs', source: 'Legs', subs: ['glutes', 'quads', 'hamstrings', 'calves', 'adductors', 'abductors'] },
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
}

// Educational copy, keyed by category OR subcategory slug.
//   teaser    → one-liner for the landing tile (≤6 words)
//   blurb     → 2-sentence scientific explanation shown at the top of the hub
//   size      → the "how much muscle is this, really" line the user asked for
//   anatomy   → optional bullets: what/where the muscle actually is
//   functions → optional bullets: what it does mechanically
//   training  → optional bullets: how to train it for growth (angles, reps,
//               stretch bias, common mistakes) — hypertrophy-first, no fluff
// The guide card renders whichever of the three arrays exist, so entries can be
// filled in gradually.
export const MUSCLE_INFO = {
  // ---- Categories ----
  chest: {
    teaser: 'One fan-shaped pressing muscle',
    blurb:
      'The pectoralis major is a single fan-shaped muscle that pulls your upper arm across and in front of your body. Its clavicular (upper), sternal (mid) and costal (lower) regions bias to different pressing angles.',
    size: 'One muscle — you bias regions with incline, flat and decline, not separate muscles.',
    anatomy: [
      'Three regions of one muscle: clavicular fibers from the collarbone (upper), sternal fibers from the breastbone (middle) and costal fibers from the ribs (lower) — all funnelling into one tendon on the upper arm.',
      'The fibers run in different directions per region, which is exactly why pressing angle changes what works hardest.',
      'Underneath sit the pec minor and serratus anterior, which anchor and move the shoulder blade so the pec has a stable base to press from.',
    ],
    functions: [
      'Pulls the upper arm across and in front of the body — the motion inside every press, flye and dip.',
      'Upper fibers help raise the arm; lower fibers help drive it down and forward.',
      'Internally rotates the shoulder.',
    ],
    training: [
      'Spread your sets across incline, flat and dip/decline angles — each biases a different region of the same muscle.',
      'Pair heavy pressing (5–10 reps) with a stretch-focused movement like flyes or deep push-ups (10–20 reps); the pec responds strongly to loaded stretch.',
      'Take presses through a full range — shoulder blades pulled back, a real stretch at the bottom.',
      'Most common gap: only flat pressing. The upper chest lags without dedicated incline work.',
    ],
  },
  back: {
    teaser: 'Lats, rhomboids and erectors together',
    blurb:
      'Your back stacks several muscles: the lats (a large fan from spine to upper arm), the rhomboids and mid-traps that squeeze the shoulder blades together, and the spinal erectors that hold you upright. Rows and pulldowns train most of them at once.',
    size: 'Collectively one of the largest muscular areas in the body.',
    anatomy: [
      'The lats: a huge fan from the lower spine and pelvis to the front of the upper arm — the width muscle.',
      'Between the shoulder blades: rhomboids, mid-traps and teres major — the thickness muscles.',
      'Along the spine: the erector columns that keep you upright and stiff under load.',
    ],
    functions: [
      'Lats pull the arm down and into the body (pull-ups, pulldowns, pullovers).',
      'Rhomboids and mid-traps squeeze the shoulder blades together (rows).',
      'Erectors extend the spine and brace it against rounding in hinges and squats.',
    ],
    training: [
      'Cover both pulling planes every week: a vertical pull (pulldown/pull-up) for lats and a horizontal row for the mid-back.',
      'Chest-supported rows remove momentum and let the back do the work — great stimulus-to-fatigue.',
      'Let the shoulder blades travel: full stretch at the bottom of a pulldown, full squeeze at the top of a row.',
      'The erectors mostly get trained by hinges (RDLs, good mornings) and heavy compound bracing — they rarely need much isolation.',
    ],
  },
  shoulders: {
    teaser: 'One muscle, three heads',
    blurb:
      'The deltoid is one muscle with three heads — front, side and rear — that raise and rotate the arm. Because each head responds to different exercises, all three are worth training directly; the rotator cuff underneath keeps the joint stable.',
    size: 'Small overall, but the three heads each need their own work.',
    anatomy: [
      'One muscle, three heads wrapping the shoulder like a cap: anterior (front), lateral (side) and posterior (rear).',
      'Each head has its own line of pull, so they behave like three small muscles in practice.',
      'The four rotator-cuff muscles sit underneath, centering the ball in the socket on every rep.',
    ],
    functions: [
      'Front delt raises the arm forward — heavily involved in all pressing.',
      'Side delt lifts the arm out to the side — this is what builds visual width.',
      'Rear delt pulls the arm backward and rotates it out — active in rows and reverse flyes.',
    ],
    training: [
      'Front delts usually need little direct work — presses already hammer them.',
      'Side delts are the priority for width: lateral raise variations, moderate-to-high reps (10–20+), and they tolerate high frequency well.',
      'Rear delts are chronically undertrained — give them direct reverse flyes or face pulls, not just rows.',
    ],
  },
  arms: {
    teaser: 'Biceps in front, triceps behind',
    blurb:
      'The upper arm is two muscle groups pulling against each other: the biceps (and the brachialis beneath) on the front bend the elbow, and the triceps on the back straighten it.',
    size: 'The triceps is about two-thirds of your arm — bigger than the biceps.',
    anatomy: [
      'Front of the arm: biceps brachii (two heads) with the thick brachialis hiding underneath it.',
      'Back of the arm: triceps brachii (three heads) — roughly two-thirds of upper-arm mass.',
      'The forearms continue the chain down to the grip.',
    ],
    functions: [
      'Biceps and brachialis bend the elbow; the biceps also turns the palm up.',
      'Triceps straightens the elbow and, through its long head, helps pull the arm down at the shoulder.',
    ],
    training: [
      'Arms grow from direct work — presses and pulls help, but curls and extensions drive most visible arm growth.',
      'Train both sides of the arm with similar volume; a lagging triceps caps how big an arm looks.',
      'Moderate loads and strict reps beat heaving heavy weights — elbows are the joint you least want to anger.',
    ],
  },
  forearms: {
    teaser: 'Inner flexors vs outer extensors',
    blurb:
      'The forearm has two opposing sides. The flexors on the inner side curl the wrist and drive your grip; the extensors on the outer side lift the wrist and power reverse and hammer curls.',
    size: 'Small, high-endurance muscles that respond to frequent, higher-rep work.',
    anatomy: [
      'Inner (palm) side: the wrist and finger flexors that close your grip.',
      'Outer side: the wrist extensors, plus the brachioradialis running up toward the elbow — the muscle hammer curls build.',
      'Dozens of small muscles rather than one big one — built for endurance.',
    ],
    functions: [
      'Flexors curl the wrist and squeeze the hand shut — every deadlift, row and carry uses them.',
      'Extensors lift the back of the hand and stabilize the wrist on curls and presses.',
      'Brachioradialis bends the elbow in neutral grip (hammer-curl position).',
    ],
    training: [
      'They already work in every pulling session — add direct work only if forearms lag or grip fails first.',
      'High reps (12–25) on wrist curls, reverse curls and hammer curls; they recover fast, so frequency can be high.',
      'Heavy holds and carries are honest grip work that doubles as forearm volume.',
    ],
  },
  traps: {
    teaser: 'One diamond, neck to mid-back',
    blurb:
      'The trapezius is one large diamond-shaped muscle from the neck to the mid-back. Its upper fibers shrug, the mid fibers retract the shoulder blades, and the lower fibers pull them down.',
    size: 'One muscle — upper/mid/lower are regions, not separate muscles.',
    anatomy: [
      'One diamond-shaped sheet from the base of the skull, out to both shoulders, down to the mid-back.',
      'Three fiber regions: upper (the visible neck-to-shoulder slope), middle (between the blades) and lower (pointing down the spine).',
      'The neck itself adds its own flexors (front) and extensors (back), which is why this category covers both.',
    ],
    functions: [
      'Upper fibers shrug the shoulders up and support the neck under load.',
      'Middle fibers pull the shoulder blades together; lower fibers pull them down and help rotate them upward on overhead work.',
      'Neck muscles flex, extend and turn the head — and stiffen it under heavy carries and deadlifts.',
    ],
    training: [
      'Upper traps: shrugs and heavy carries — they take heavy loads well; use a controlled squeeze rather than bouncing.',
      'Mid and lower traps get plenty from rows and face pulls; add prone Y-raises only if they visibly lag.',
      'Direct neck work (flexion/extension) pays off for contact-sport athletes and anyone whose neck visually lags — start light, high reps, slow progression.',
    ],
  },
  core: {
    teaser: 'Abs, obliques and deep bracing',
    blurb:
      "Your core wraps the trunk: the rectus abdominis (the 'six-pack') flexes the spine, the obliques rotate and side-bend it, and the deeper transverse abdominis braces like a belt.",
    size: 'Built more for bracing and endurance than for heavy load.',
    anatomy: [
      'Front: the rectus abdominis — one long muscle whose tendon lines create the six-pack segments.',
      'Sides: external and internal obliques layered diagonally for rotation and side-bending.',
      'Deepest layer: the transverse abdominis, wrapping the waist like a belt for bracing.',
    ],
    functions: [
      'Rectus abdominis curls the ribcage toward the pelvis (spine flexion).',
      'Obliques rotate and side-bend the trunk — and resist being rotated.',
      'The whole wall stiffens to transfer force in squats, deadlifts and presses.',
    ],
    training: [
      'Abs are muscle — they grow from resisted flexion (weighted crunch patterns, hanging knee/leg raises) in the 8–20 rep range, not from hundreds of free reps.',
      'Add one anti-movement drill (plank variations, ab-wheel) for the deep bracing layer.',
      'Visibility is body-fat, not rep count — training builds the blocks, nutrition reveals them.',
    ],
  },
  legs: {
    teaser: 'Your biggest muscle mass',
    blurb:
      'The legs hold your largest muscles: the glutes driving the hips, the quads on the front of the thigh, the hamstrings behind them, the adductors on the inner thigh and the calves below.',
    size: 'The largest muscle mass in the body, by far.',
    anatomy: [
      'Hips: the glutes — the biggest muscle group you own.',
      'Thigh: quads in front, hamstrings behind, adductors along the inner side.',
      'Below the knee: the calves (gastrocnemius and soleus).',
    ],
    functions: [
      'Glutes and hamstrings extend the hip; quads extend the knee — together they produce squats, hinges and lunges.',
      'Adductors pull the legs together and assist deep squatting.',
      'Calves point the foot and drive every step.',
    ],
    training: [
      'Build sessions around one squat pattern and one hinge pattern — that pair covers most of the leg.',
      'Isolation (extensions, curls, calf raises, adduction) then tops up what compounds under-stimulate.',
      'Legs tolerate and need hard sets close to failure — but they are also the most systemically fatiguing muscle group, so volume is the lever to manage.',
    ],
  },
  glutes: {
    teaser: 'The single biggest muscle you have',
    blurb:
      'The gluteus maximus is the single largest muscle in the human body. It extends the hip to drive you up out of a squat, lock out a hinge, and propel you forward when you sprint — built by hip thrusts, hinges and squats.',
    size: 'The biggest muscle in your body by volume.',
    anatomy: [
      'The gluteus maximus spans from the pelvis and sacrum to the upper thigh — the largest single muscle in the body.',
      'The gluteus medius and minimus sit above and to the side, stabilizing the pelvis (covered under Abductors).',
    ],
    functions: [
      'Extends the hip — standing up from a squat, locking out a deadlift, sprinting, climbing stairs.',
      'Rotates the thigh outward and posteriorly tilts the pelvis.',
      'Works hardest when the hip is deeply bent — depth matters.',
    ],
    training: [
      'Mix a stretch-position movement (deep squat, split squat, RDL) with a peak-contraction movement (hip thrust, kickback).',
      'Deep ranges are the growth signal: the glute max is most stretched — and most stimulated — near full hip flexion.',
      'It recovers well; glutes handle heavy loads and reasonable frequency without complaint.',
    ],
  },

  // ---- Subcategories: chest regions ----
  'upper-chest': {
    blurb:
      'The clavicular (upper) region of the pec major runs from the collarbone down to the upper arm. Its fibers pull the arm up and across the body, so incline pressing and low-to-high flyes load it most directly.',
    size: 'The smallest chest region — and the first to visibly lag.',
    anatomy: [
      'Fibers start on the inner half of the collarbone and run diagonally down to the upper arm.',
      'A region of the pec major, not a separate muscle — but with its own line of pull.',
    ],
    functions: [
      'Pulls the arm up and across the body — the top part of an incline press.',
      'Assists the front delt in raising the arm.',
    ],
    training: [
      'Incline presses at roughly 15–30° — steeper turns the exercise into a shoulder press.',
      'Low-to-high cable flyes isolate the fiber direction exactly.',
      'If your chest looks bottom-heavy, move a flat-press slot to incline rather than adding total volume.',
    ],
  },
  'middle-chest': {
    blurb:
      'The sternal (middle) region is the biggest slice of the pec major, running horizontally from the breastbone to the upper arm. Flat pressing and mid-height flyes load it most directly.',
    size: 'The bulk of the pec — most chest mass lives here.',
    anatomy: [
      'Fibers run nearly horizontally from the breastbone out to the upper arm.',
      'The largest of the three pec regions by a wide margin.',
    ],
    functions: [
      'Pulls the arm straight across the chest — the exact motion of a flat press or cable crossover at chest height.',
    ],
    training: [
      'Flat barbell, dumbbell and machine presses are the bread and butter.',
      'Flyes and crossovers at chest height keep tension on the pec without the triceps taking over.',
      'Dumbbells and deficit push-ups allow a deeper stretch than a barbell — worth a slot for that reason.',
    ],
  },
  'lower-chest': {
    blurb:
      'The costal (lower) region of the pec major rises from the ribs up to the arm, so it works hardest when you press down and forward. Dips, decline presses and high-to-low flyes hit it most directly.',
    size: 'A small slice that finishes the lower line of the chest.',
    anatomy: [
      'Fibers start on the ribs and the abdominal sheath and run upward to the arm — the mirror image of the upper chest.',
    ],
    functions: [
      'Drives the arm down and forward — the bottom-out motion of a dip.',
      'Assists everything the rest of the pec does when pressing.',
    ],
    training: [
      'Dips are the king here — lean the torso slightly forward and let the chest stretch at the bottom.',
      'High-to-low cable flyes match the fiber direction precisely.',
      'Flat pressing already trains it substantially — most people need little dedicated lower-chest volume.',
    ],
  },

  // ---- Subcategories: back muscles ----
  lats: {
    blurb:
      'The latissimus dorsi is a huge fan of muscle from the lower spine and pelvis to the front of the upper arm — the widest muscle in the body. Pulldowns, pull-ups, rows and pullovers all live here.',
    size: 'The widest muscle you have — this is the V-taper.',
    anatomy: [
      'Originates across the lower half of the spine, the pelvis and the lower ribs, then twists to attach on the front of the upper arm.',
      'That twist means the lat is fully stretched when the arm is overhead and slightly across the body.',
    ],
    functions: [
      'Pulls the arm down and into the body — pull-ups, pulldowns and pullovers.',
      'Drives the elbow back and down in rows.',
      'Internally rotates the shoulder and assists the spine in extension.',
    ],
    training: [
      'Vertical pulls (pull-ups, pulldowns) give the lat its biggest loaded stretch — let the arms go fully long at the top.',
      'In rows, keep the elbow closer to the body to bias lat over upper back.',
      'Half-kneeling or single-arm variations let you lean away and stretch the lat harder — an easy upgrade.',
    ],
  },
  'mid-back': {
    blurb:
      'The mid-back is the retraction team: the rhomboids and mid-traps pulling the shoulder blades together, plus the teres major — a "little lat" from shoulder blade to arm. Rows of every kind build it.',
    size: 'The thickness muscles — depth between the shoulder blades.',
    anatomy: [
      'Rhomboids run from the spine to the inner edge of each shoulder blade, under the traps.',
      'The mid fibers of the trapezius lie on top, pulling in the same direction.',
      'Teres major runs from the bottom tip of the shoulder blade to the front of the arm and works like a small lat.',
    ],
    functions: [
      'Squeezes the shoulder blades together — the finish of every row.',
      'Keeps the blades pinned so pressing and pulling have a stable base.',
      'Teres major pulls the arm down and back alongside the lat.',
    ],
    training: [
      'Rows with the elbow flared out ~45–60° shift work from lats to the mid-back.',
      'A deliberate squeeze and controlled return beat heavier weight with a shrugging bounce.',
      'Chest-supported and cable rows keep tension honest by removing body English.',
    ],
  },
  'spinal-erectors': {
    blurb:
      'The erector spinae are long columns of muscle running the full length of your spine. They straighten it, arch it, and — most of the time in the gym — hold it rigid while your hips do the moving.',
    size: 'Long endurance columns that thicken the entire lower back.',
    anatomy: [
      'Three parallel columns (iliocostalis, longissimus, spinalis) running from the pelvis up to the ribs, neck and skull.',
      'Thickest in the lower back, which is where you see and feel them most.',
    ],
    functions: [
      'Extend the spine — standing tall out of a hinge, arching in a back extension.',
      'Brace isometrically against rounding in squats, deadlifts and rows — their main job under load.',
    ],
    training: [
      'Hinges (RDLs, good mornings) and back extensions are the direct builders.',
      'They already work isometrically in every heavy compound — count that before adding volume.',
      'They are slow to recover when trained hard; a little direct work goes a long way.',
    ],
  },

  // ---- Subcategories: delt heads ----
  'front-delts': {
    blurb:
      'The anterior (front) deltoid raises the arm to the front and assists on every press. It already gets heavy indirect work from chest pressing, so most people need little extra direct volume.',
    size: 'Usually the most-developed delt head, thanks to all your pressing.',
    anatomy: [
      'The front third of the deltoid, running from the collarbone to the outer arm.',
    ],
    functions: [
      'Raises the arm forward and helps every incline and overhead press.',
      'Internally rotates the shoulder.',
    ],
    training: [
      'If you press (bench, incline, overhead), your front delts are already well trained.',
      'Overhead pressing is the best direct choice when you do want more.',
      'Front raises are rarely worth a slot — spend that set on side or rear delts instead.',
    ],
  },
  'side-delts': {
    blurb:
      'The lateral (side) deltoid lifts the arm out to the side and is what gives the shoulders their width. Lateral raises are the staple, and it responds well to high frequency.',
    size: 'The head that builds shoulder width — often worth extra volume.',
    anatomy: [
      'The middle third of the deltoid, sitting directly over the point of the shoulder.',
    ],
    functions: [
      'Lifts the arm out to the side (abduction) — the motion of a lateral raise.',
      'Contributes to overhead pressing once the arm is away from the body.',
    ],
    training: [
      'Lateral raise variations are the staple — dumbbells, cables or machines all work.',
      'Cables and lean-away variations keep tension at the bottom, where dumbbells give none.',
      'Moderate-to-high reps (10–20+) with strict form; they recover fast, so frequency can be high.',
    ],
  },
  'rear-delts': {
    blurb:
      'The posterior (rear) deltoid pulls the arm backward and rotates it outward, working with the rotator cuff. It is commonly underdeveloped, so direct rows and reverse flyes pay off.',
    size: 'The most-neglected head; key for posture and balanced shoulders.',
    anatomy: [
      'The back third of the deltoid, from the shoulder-blade ridge to the outer arm.',
      'The rotator cuff works underneath it, keeping the joint centered.',
    ],
    functions: [
      'Pulls the arm backward (horizontal abduction) — reverse flyes, face pulls, wide rows.',
      'Externally rotates the shoulder with the cuff.',
    ],
    training: [
      'Rows help but rarely suffice — give rear delts direct sets (reverse flyes, face pulls, rear-delt rows).',
      'Light weight, strict reps, higher volume: momentum steals rear-delt tension instantly.',
      'They tolerate a lot of frequency — easy to add at the end of any session.',
    ],
  },

  // ---- Subcategories: arms ----
  biceps: {
    blurb:
      'The biceps brachii and the brachialis beneath it bend the elbow, and the biceps also turns the palm up. Curl variations and chin-ups are the staples.',
    size: 'About a third of your upper-arm mass — smaller than the triceps.',
    anatomy: [
      'Two heads: the long head on the outside (crosses the shoulder), the short head on the inside.',
      'The brachialis lies underneath and pushes the biceps up as it grows.',
    ],
    functions: [
      'Bends the elbow and turns the palm upward (supination).',
      'The long head assists slightly at the shoulder.',
    ],
    training: [
      'Curl through a full range and control the lowering — the stretch half of the rep drives growth.',
      'Incline or behind-the-body curls stretch the long head; hammer and reverse curls hit the brachialis and brachioradialis.',
      'Chin-ups double as heavy biceps work; moderate reps (8–15) with strict form is the sweet spot.',
    ],
  },
  triceps: {
    blurb:
      'The triceps has three heads and straightens the elbow; its long head also crosses the shoulder, so it stretches hard under overhead work. Presses and extensions grow it.',
    size: 'About two-thirds of your upper-arm size — the bigger arm muscle.',
    anatomy: [
      'Three heads: the long head (crosses the shoulder), plus the lateral and medial heads on the outer and inner arm.',
      'The long head is the biggest — and the one most training misses.',
    ],
    functions: [
      'Straightens the elbow on every press and pushdown.',
      'The long head also pulls the arm down toward the body at the shoulder.',
    ],
    training: [
      'Overhead extensions put the long head under stretch — the highest-value triceps slot for most people.',
      'Pushdowns and close-grip pressing cover the lateral and medial heads.',
      'Presses provide heavy indirect volume; extensions are where the extra growth comes from.',
    ],
  },
  'forearm-flexors': {
    blurb:
      'The wrist and finger flexors on the palm side of the forearm close your grip and curl the wrist. Wrist curls and heavy holds train them.',
    size: 'These drive grip and crushing strength.',
  },
  'forearm-extensors': {
    blurb:
      'The extensors on the back of the forearm lift the wrist and are the prime movers in reverse and hammer curls. They are often weak relative to the flexors.',
    size: 'Balancing them protects the elbow and evens out the forearm.',
  },

  // ---- Subcategories: legs ----
  quads: {
    blurb:
      'The quadriceps are four muscles on the front of the thigh that straighten the knee — the largest single muscle group in the lower body. Squats, presses and leg extensions build them.',
    size: 'The biggest muscle group in your legs.',
    anatomy: [
      'Four muscles: vastus lateralis (outer sweep), vastus medialis (the teardrop), vastus intermedius (hidden underneath) and rectus femoris on top.',
      'The rectus femoris also crosses the hip, so it behaves differently from the other three.',
    ],
    functions: [
      'All four straighten the knee — squats, presses, lunges, extensions.',
      'The rectus femoris also flexes the hip (knee raises, sprinting).',
    ],
    training: [
      'Deep knee bend is the growth signal — full-depth squats, presses and split squats beat half reps.',
      'Leg extensions are the only movement that truly loads the rectus femoris at both joints — worth a slot.',
      'Quad training is systemically brutal; manage weekly hard sets rather than stacking more.',
    ],
  },
  hamstrings: {
    blurb:
      'The hamstrings run down the back of the thigh, bending the knee and extending the hip. Because they do two jobs, they need both a curl (knee) and a hinge (hip) to train fully.',
    size: 'Two jobs — train them with both curls and hinges.',
    anatomy: [
      'Three muscles: biceps femoris on the outside, semitendinosus and semimembranosus on the inside.',
      'All but the short head of biceps femoris cross BOTH the hip and the knee — the key to training them.',
    ],
    functions: [
      'Extend the hip (RDLs, good mornings) and bend the knee (leg curls).',
      'Decelerate the leg every stride — why sprinters tear them.',
    ],
    training: [
      'You need both patterns: a hinge (RDL) for the hip role and a curl for the knee role — neither alone trains everything.',
      'Seated curls beat lying curls: the flexed hip pre-stretches the hamstrings for more growth per set.',
      'In hinges, the stretch near the bottom is the money — deep, controlled, no bouncing.',
    ],
  },
  calves: {
    blurb:
      'The calves are the gastrocnemius (the visible bulge, worked with a straight leg) and the soleus beneath it (worked with a bent knee). Both extend the ankle to push you off the ground.',
    size: 'High-endurance muscles that respond to frequent, full-range work.',
    anatomy: [
      'The gastrocnemius is the visible two-headed bulge; it crosses the knee, so it only works fully with a straight leg.',
      'The soleus lies underneath, crossing only the ankle — bent-knee work is soleus work.',
    ],
    functions: [
      'Point the foot and push you off the ground — every step, jump and sprint.',
      'The soleus works constantly holding you upright.',
    ],
    training: [
      'Straight-leg raises for the gastroc, seated (bent-knee) raises for the soleus — both, not either.',
      'Pause deep in the stretch; bouncing lets the Achilles do the work instead of the muscle.',
      'They are endurance machines — they take high reps, high frequency, and slow visible progress. Patience.',
    ],
  },
  adductors: {
    blurb:
      'The adductors on the inner thigh pull the leg toward your midline and assist the squat and hinge. Wide stances, Copenhagen planks and the adduction machine hit them.',
    size: 'A surprisingly large share of total thigh mass.',
    anatomy: [
      'A group of five on the inner thigh, dominated by the adductor magnus — one of the biggest muscles in the body.',
    ],
    functions: [
      'Pull the leg toward the midline.',
      'The adductor magnus also extends the hip from deep positions — it works like a hamstring in a deep squat.',
    ],
    training: [
      'Deep, wider-stance squats already train them hard — most inner-thigh growth comes free.',
      'The adduction machine adds direct volume when the inner thigh visibly lags.',
      'Copenhagen planks build them isometrically and armor the groin against strains.',
    ],
  },
  abductors: {
    blurb:
      'The hip abductors — the gluteus medius and minimus on the outer hip — move the leg away from your midline and stabilise the pelvis on every step and single-leg movement. The abduction machine and banded work target them directly.',
    size: 'Small stabilisers, but key for hip health and a balanced hip.',
    anatomy: [
      'The gluteus medius and minimus sit on the outer hip, above and beneath the glute max.',
    ],
    functions: [
      'Lift the leg out to the side.',
      'Keep the pelvis level every time you stand on one leg — every step, lunge and split squat.',
    ],
    training: [
      'Single-leg work (split squats, lunges, step-ups) trains them as stabilizers automatically.',
      'The abduction machine or banded side-steps add direct volume for the outer-hip shape.',
      'Higher reps (12–20) with a deliberate pause beat heavy stack-slamming.',
    ],
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
