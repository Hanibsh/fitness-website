// Clickable-region geometry for the anatomy map (see
// components/InteractiveAnatomy.jsx). Each anatomy image holds a front figure
// and a back figure side by side, with muscle labels drawn into the art itself.
// Every image declares a tight bounding BOX per view (measured from the actual
// art), and the SVG overlay crops to that box via viewBox.
//
// The labels ARE the zones: each zone is a rectangle around one label's text, so
// tapping "Inner Thighs" opens the adductors hub. The muscle outlines are not
// traced — the art's own leader lines already connect each label to its muscle.
// Coordinates are normalized (0..1) WITHIN that view's box, so they stay aligned
// at any render size.
//
// The rects below are GENERATED — run `node scripts/anatomy-zones.mjs
// public/images/anatomy-male.webp male` (and female) after any art change and
// paste the output here. The script declares the expected label list per view
// and refuses to emit if the art's labels don't match it. `?anatomy-debug`
// on /exercises logs click coordinates in the image's pixel space for nudging.
import { ENGINE_MUSCLE_TO_SLUG, SUBCATEGORIES } from './muscleInfo'

// Boxes are natural-pixel {x,y,w,h} of each figure (plus its labels) within its
// image. The two figures are separated by an empty gutter, so each box covers one
// figure and only the labels that point at it.
export const ANATOMY_SOURCES = {
  male: {
    src: 'images/anatomy-male.webp',
    w: 1137,
    h: 561,
    front: { x: 38, y: 20, w: 530, h: 521 },
    back: { x: 568, y: 20, w: 484, h: 521 },
  },
  female: {
    src: 'images/anatomy-female.webp',
    w: 1318,
    h: 652,
    front: { x: 86, y: 26, w: 570, h: 602 },
    back: { x: 664, y: 26, w: 515, h: 601 },
  },
}

export const SEXES = [
  { id: 'female', label: 'Female' },
  { id: 'male', label: 'Male' },
]

const SEX_KEY = 'leon_anatomy_sex'

// An explicit toggle choice, or null if the user has never picked one. Null means
// callers are free to fall back to the profile's sex (see InteractiveAnatomy).
export function readAnatomySexChoice() {
  try {
    const s = localStorage.getItem(SEX_KEY)
    if (s === 'male' || s === 'female') return s
  } catch { /* ignore */ }
  return null
}

export function writeAnatomySex(id) {
  try { localStorage.setItem(SEX_KEY, id) } catch { /* ignore */ }
}

// Label zones: sex → view → [{ slug, label, rect }], where rect is
// [nx, ny, nw, nh] normalized within the view's box. `label` is the wording as
// drawn in the art, which is plainer than the hub titles it links to (the art
// says "Inner Thighs", the hub is "Adductors") — that's deliberate.
export const ANATOMY_ZONES = {
  female: {
    front: [
      { slug: 'traps', label: 'Neck and Trapezius', rect: [0.0018, 0.0781, 0.3439, 0.0449] },
      { slug: 'shoulders', label: 'Shoulders', rect: [0.1825, 0.1877, 0.1877, 0.0382] },
      { slug: 'chest', label: 'Chest', rect: [0.2737, 0.2724, 0.1158, 0.0399] },
      { slug: 'biceps', label: 'Biceps', rect: [0.2351, 0.3704, 0.1298, 0.0432] },
      { slug: 'forearms', label: 'Forearms', rect: [0.0561, 0.4817, 0.1772, 0.0365] },
      { slug: 'core', label: 'Core', rect: [0.2526, 0.5581, 0.0965, 0.0382] },
      { slug: 'adductors', label: 'Inner Thighs', rect: [0.0404, 0.6977, 0.2175, 0.0449] },
      { slug: 'quads', label: 'Quadriceps', rect: [0.1316, 0.8206, 0.214, 0.0449] },
      { slug: 'tibialis', label: 'Tibialis Anterior', rect: [0.1351, 0.9153, 0.2807, 0.0399] },
    ],
    back: [
      { slug: 'traps', label: 'Neck and Trapezius', rect: [0.6039, 0.03, 0.3748, 0.0449] },
      { slug: 'shoulders', label: 'Shoulders', rect: [0.7282, 0.1364, 0.2097, 0.0399] },
      { slug: 'triceps', label: 'Triceps', rect: [0.7379, 0.2463, 0.1553, 0.0449] },
      { slug: 'lats', label: 'Lats', rect: [0.7612, 0.3344, 0.0971, 0.0383] },
      { slug: 'spinal-erectors', label: 'Lower Back', rect: [0.6796, 0.4243, 0.2369, 0.0399] },
      { slug: 'forearms', label: 'Forearms', rect: [0.7398, 0.5391, 0.1961, 0.0383] },
      { slug: 'glutes', label: 'Glutes', rect: [0.7301, 0.6206, 0.1417, 0.0399] },
      { slug: 'abductors', label: 'Outer Thighs', rect: [0.732, 0.6955, 0.2641, 0.0466] },
      { slug: 'hamstrings', label: 'Hamstrings', rect: [0.7204, 0.8037, 0.2369, 0.0449] },
      { slug: 'calves', label: 'Calves', rect: [0.701, 0.8968, 0.1417, 0.0383] },
    ],
  },
  male: {
    front: [
      { slug: 'traps', label: 'Neck and Trapezius', rect: [0.0038, 0.0729, 0.3038, 0.048] },
      { slug: 'shoulders', label: 'Shoulders', rect: [0.2623, 0.1478, 0.1774, 0.0422] },
      { slug: 'chest', label: 'Chest', rect: [0.2132, 0.2054, 0.1113, 0.0422] },
      { slug: 'biceps', label: 'Biceps', rect: [0.3094, 0.2726, 0.1245, 0.0461] },
      { slug: 'core', label: 'Core', rect: [0.2491, 0.3839, 0.0717, 0.0345] },
      { slug: 'forearms', label: 'Forearms', rect: [0.2698, 0.4434, 0.1491, 0.0403] },
      { slug: 'quads', label: 'Quadriceps', rect: [0.1189, 0.547, 0.1849, 0.048] },
      { slug: 'adductors', label: 'Inner Thighs', rect: [0.2226, 0.7083, 0.2057, 0.0441] },
      { slug: 'tibialis', label: 'Tibialis Anterior', rect: [0.2358, 0.8004, 0.2491, 0.0403] },
    ],
    back: [
      { slug: 'traps', label: 'Neck and Trapezius', rect: [0.6508, 0.0518, 0.3471, 0.0422] },
      { slug: 'shoulders', label: 'Shoulders', rect: [0.5165, 0.1689, 0.1942, 0.0422] },
      { slug: 'triceps', label: 'Triceps', rect: [0.7417, 0.2131, 0.1302, 0.0461] },
      { slug: 'lats', label: 'Lats', rect: [0.7707, 0.2898, 0.0764, 0.0403] },
      { slug: 'spinal-erectors', label: 'Lower Back', rect: [0.5062, 0.3512, 0.2169, 0.0422] },
      { slug: 'forearms', label: 'Forearms', rect: [0.7459, 0.4587, 0.1632, 0.0403] },
      { slug: 'glutes', label: 'Glutes', rect: [0.5723, 0.5317, 0.1322, 0.0403] },
      { slug: 'abductors', label: 'Outer Thighs', rect: [0.6818, 0.5854, 0.2459, 0.0461] },
      { slug: 'hamstrings', label: 'Hamstrings', rect: [0.5331, 0.6814, 0.2004, 0.0461] },
      { slug: 'calves', label: 'Calves', rect: [0.5041, 0.7793, 0.1322, 0.0403] },
    ],
  },
}

// Label zones for a given sex + view.
export function zonesFor(sex, view) {
  return ANATOMY_ZONES[sex]?.[view] || []
}

// Every slug the art actually has a label for.
const ZONE_SLUGS = new Set(
  Object.values(ANATOMY_ZONES).flatMap((views) => Object.values(views)).flatMap((zs) => zs.map((z) => z.slug))
)

// Which label zone an engine muscle (engineConfig.js ENGINE_MUSCLES) lands on,
// or null when the art has no label for it.
//
// The art is coarser than the engine, so this is deliberately many-to-one: the
// three delts all land on "Shoulders", and Abs + Obliques both land on "Core" —
// resolved by walking up to the parent hub when the muscle's own slug has no
// label. "Upper Back" has no label at all (it'd fall back to the `back` hub,
// which isn't a zone) so it returns null and stays off the map; the dashboard's
// volume and recovery lists still report it in full.
export function zoneSlugForEngineMuscle(engineMuscle) {
  const slug = ENGINE_MUSCLE_TO_SLUG[engineMuscle]
  if (!slug) return null
  if (ZONE_SLUGS.has(slug)) return slug
  const parent = SUBCATEGORIES[slug]?.parent
  return parent && ZONE_SLUGS.has(parent) ? parent : null
}

// Convert a normalized rect to SVG attrs in the box's pixel space (which is also
// the overlay's viewBox), so zones line up with the art at any render size.
export function rectAttrs(rect, box) {
  const [nx, ny, nw, nh] = rect
  return {
    x: box.x + nx * box.w,
    y: box.y + ny * box.h,
    width: nw * box.w,
    height: nh * box.h,
  }
}
