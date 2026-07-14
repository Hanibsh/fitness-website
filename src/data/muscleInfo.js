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
// COPY NOTE (Leon): the blurbs are a scientific first draft — rewrite in your
// own voice before leaning on them publicly.

// Home categories in landing order. A category either:
//   - `subs`   → splits into subcategory hubs (genuinely different muscles), or
//   - `source` → lists exercises from that stored `category` directly, or
//   - `atoms`  → is a derived tile pulled by primary mover across all categories
//                (used for Glutes, promoted out of Legs).
export const CATEGORIES = [
  { slug: 'chest', name: 'Chest', source: 'Chest' },
  { slug: 'back', name: 'Back', source: 'Back' },
  { slug: 'shoulders', name: 'Shoulders', source: 'Shoulders', subs: ['front-delts', 'side-delts', 'rear-delts'] },
  { slug: 'arms', name: 'Arms', source: 'Arms', subs: ['biceps', 'triceps', 'forearms'] },
  { slug: 'legs', name: 'Legs', source: 'Legs', subs: ['glutes', 'quads', 'hamstrings', 'calves', 'adductors'] },
  { slug: 'traps', name: 'Neck and Traps', source: 'Neck and Traps' },
  { slug: 'core', name: 'Core', source: 'Core' },
]

// Subcategory slug → { name, parent, value|atoms }. Two membership modes:
//   - `value` → matches the row's stored `subCategory` column exactly (Arms and
//     Legs are split in the data itself — the source of truth).
//   - `atoms` → derived: an exercise falls in the subcategory when one of these
//     atoms is among its PRIMARY (highest-weight) movers. Used where the data
//     carries no explicit subCategory (the three shoulder delt heads).
export const SUBCATEGORIES = {
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
}

// Educational copy, keyed by category OR subcategory slug.
//   teaser → one-liner for the landing tile (≤6 words)
//   blurb  → 2-sentence scientific explanation shown at the top of the hub
//   size   → the "how much muscle is this, really" line the user asked for
export const MUSCLE_INFO = {
  // ---- Categories ----
  chest: {
    teaser: 'One fan-shaped pressing muscle',
    blurb:
      'The pectoralis major is a single fan-shaped muscle that pulls your upper arm across and in front of your body. Its clavicular (upper), sternal (mid) and costal (lower) regions bias to different pressing angles.',
    size: 'One muscle — you bias regions with incline, flat and decline, not separate muscles.',
  },
  back: {
    teaser: 'Lats, rhomboids and erectors together',
    blurb:
      'Your back stacks several muscles: the lats (a large fan from spine to upper arm), the rhomboids and mid-traps that squeeze the shoulder blades together, and the spinal erectors that hold you upright. Rows and pulldowns train most of them at once.',
    size: 'Collectively one of the largest muscular areas in the body.',
  },
  shoulders: {
    teaser: 'One muscle, three heads',
    blurb:
      'The deltoid is one muscle with three heads — front, side and rear — that raise and rotate the arm. Because each head responds to different exercises, all three are worth training directly; the rotator cuff underneath keeps the joint stable.',
    size: 'Small overall, but the three heads each need their own work.',
  },
  arms: {
    teaser: 'Biceps in front, triceps behind',
    blurb:
      'The upper arm is two muscle groups pulling against each other: the biceps (and the brachialis beneath) on the front bend the elbow, and the triceps on the back straighten it.',
    size: 'The triceps is about two-thirds of your arm — bigger than the biceps.',
  },
  forearms: {
    teaser: 'Inner flexors vs outer extensors',
    blurb:
      'The forearm has two opposing sides. The flexors on the inner side curl the wrist and drive your grip; the extensors on the outer side lift the wrist and power reverse and hammer curls.',
    size: 'Small, high-endurance muscles that respond to frequent, higher-rep work.',
  },
  traps: {
    teaser: 'One diamond, neck to mid-back',
    blurb:
      'The trapezius is one large diamond-shaped muscle from the neck to the mid-back. Its upper fibers shrug, the mid fibers retract the shoulder blades, and the lower fibers pull them down.',
    size: 'One muscle — upper/mid/lower are regions, not separate muscles.',
  },
  core: {
    teaser: 'Abs, obliques and deep bracing',
    blurb:
      "Your core wraps the trunk: the rectus abdominis (the 'six-pack') flexes the spine, the obliques rotate and side-bend it, and the deeper transverse abdominis braces like a belt.",
    size: 'Built more for bracing and endurance than for heavy load.',
  },
  legs: {
    teaser: 'Your biggest muscle mass',
    blurb:
      'The legs hold your largest muscles: the glutes driving the hips, the quads on the front of the thigh, the hamstrings behind them, the adductors on the inner thigh and the calves below.',
    size: 'The largest muscle mass in the body, by far.',
  },
  glutes: {
    teaser: 'The single biggest muscle you have',
    blurb:
      'The gluteus maximus is the single largest muscle in the human body. It extends the hip to drive you up out of a squat, lock out a hinge, and propel you forward when you sprint — built by hip thrusts, hinges and squats.',
    size: 'The biggest muscle in your body by volume.',
  },

  // ---- Subcategories ----
  'front-delts': {
    blurb:
      'The anterior (front) deltoid raises the arm to the front and assists on every press. It already gets heavy indirect work from chest pressing, so most people need little extra direct volume.',
    size: 'Usually the most-developed delt head, thanks to all your pressing.',
  },
  'side-delts': {
    blurb:
      'The lateral (side) deltoid lifts the arm out to the side and is what gives the shoulders their width. Lateral raises are the staple, and it responds well to high frequency.',
    size: 'The head that builds shoulder width — often worth extra volume.',
  },
  'rear-delts': {
    blurb:
      'The posterior (rear) deltoid pulls the arm backward and rotates it outward, working with the rotator cuff. It is commonly underdeveloped, so direct rows and reverse flyes pay off.',
    size: 'The most-neglected head; key for posture and balanced shoulders.',
  },
  biceps: {
    blurb:
      'The biceps brachii and the brachialis beneath it bend the elbow, and the biceps also turns the palm up. Curl variations and chin-ups are the staples.',
    size: 'About a third of your upper-arm mass — smaller than the triceps.',
  },
  triceps: {
    blurb:
      'The triceps has three heads and straightens the elbow; its long head also crosses the shoulder, so it stretches hard under overhead work. Presses and extensions grow it.',
    size: 'About two-thirds of your upper-arm size — the bigger arm muscle.',
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
  quads: {
    blurb:
      'The quadriceps are four muscles on the front of the thigh that straighten the knee — the largest single muscle group in the lower body. Squats, presses and leg extensions build them.',
    size: 'The biggest muscle group in your legs.',
  },
  hamstrings: {
    blurb:
      'The hamstrings run down the back of the thigh, bending the knee and extending the hip. Because they do two jobs, they need both a curl (knee) and a hinge (hip) to train fully.',
    size: 'Two jobs — train them with both curls and hinges.',
  },
  calves: {
    blurb:
      'The calves are the gastrocnemius (the visible bulge, worked with a straight leg) and the soleus beneath it (worked with a bent knee). Both extend the ankle to push you off the ground.',
    size: 'High-endurance muscles that respond to frequent, full-range work.',
  },
  adductors: {
    blurb:
      'The adductors on the inner thigh pull the leg toward your midline and assist the squat and hinge; the abductors on the outside move it away. Wide stances and dedicated machines hit them.',
    size: 'A surprisingly large share of total thigh mass.',
  },
}

// ---- Dashboard deep-links --------------------------------------------------
// The dashboard reports volume/recovery per ENGINE_MUSCLE (engineConfig.js).
// Map each of those labels to its explainer hub so a "?" next to "Quads" can
// answer "what even is that?" — the exact gap a beginner hit.
const ENGINE_MUSCLE_TO_SLUG = {
  Chest: 'chest',
  Back: 'back',
  Shoulders: 'shoulders',
  Biceps: 'biceps',
  Triceps: 'triceps',
  Forearms: 'forearms',
  Quads: 'quads',
  Hamstrings: 'hamstrings',
  Glutes: 'glutes',
  Calves: 'calves',
  Abs: 'core',
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
