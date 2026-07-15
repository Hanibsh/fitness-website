// Clickable-region geometry for the interactive anatomy map (see
// components/InteractiveAnatomy.jsx). Each anatomy image holds a front figure
// and a back figure side by side, with different pixel positions and scales
// per sex — so each source declares a tight bounding BOX per view (measured
// from the actual PNGs), and the SVG overlay crops to that box via viewBox.
//
// Region polygons are declared ONCE in NORMALIZED coordinates (0..1 within a
// view's box), not raw pixels — so the same shapes drape over both the male
// and female figures, since both are centered standing figures with the same
// anatomical layout. They're approximate hotspots (generous blobs), not
// surgical outlines. Add `?anatomy-debug` on /exercises in dev to see them
// drawn over the art and to log click coordinates for tuning.
import { SUBCATEGORIES } from './muscleInfo'

// Boxes are natural-pixel {x,y,w,h} of each figure within its image.
export const ANATOMY_SOURCES = {
  male: {
    src: 'images/anatomy-male.webp',
    w: 1111,
    h: 768,
    front: { x: 4, y: 30, w: 410, h: 712 },
    back: { x: 700, y: 30, w: 404, h: 712 },
  },
  female: {
    src: 'images/anatomy-female.webp',
    w: 869,
    h: 768,
    front: { x: 100, y: 38, w: 322, h: 700 },
    back: { x: 430, y: 38, w: 314, h: 700 },
  },
}

export const SEXES = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
]

// A rectangle helper keeps the region list readable (most hotspots are blobs).
const rect = (x0, y0, x1, y1) => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
]

// Each region: id, the hub slug it links to (deepest sensible hub), a label,
// the view it lives on, and one or more normalized polygons (left/right pairs
// light up together). Order matters where hotspots overlap — later regions win
// the click (e.g. adductors sit on top of the inner quad edges).
export const ANATOMY_REGIONS = [
  // ---- Front view ----
  { id: 'f-traps', slug: 'traps', label: 'Neck & Traps', view: 'front', shapes: [rect(0.44, 0.115, 0.56, 0.16)] },
  {
    id: 'f-shoulders', slug: 'shoulders', label: 'Shoulders', view: 'front',
    shapes: [rect(0.29, 0.15, 0.42, 0.23), rect(0.58, 0.15, 0.71, 0.23)],
  },
  { id: 'f-chest', slug: 'chest', label: 'Chest', view: 'front', shapes: [rect(0.35, 0.17, 0.65, 0.28)] },
  {
    id: 'f-biceps', slug: 'biceps', label: 'Biceps', view: 'front',
    shapes: [rect(0.26, 0.22, 0.37, 0.33), rect(0.63, 0.22, 0.74, 0.33)],
  },
  {
    id: 'f-forearms', slug: 'forearms', label: 'Forearms', view: 'front',
    shapes: [rect(0.19, 0.34, 0.31, 0.46), rect(0.69, 0.34, 0.81, 0.46)],
  },
  { id: 'f-core', slug: 'core', label: 'Core', view: 'front', shapes: [rect(0.40, 0.28, 0.60, 0.45)] },
  {
    id: 'f-quads', slug: 'quads', label: 'Quads', view: 'front',
    shapes: [rect(0.39, 0.50, 0.495, 0.69), rect(0.505, 0.50, 0.61, 0.69)],
  },
  { id: 'f-adductors', slug: 'adductors', label: 'Adductors', view: 'front', shapes: [rect(0.455, 0.51, 0.545, 0.64)] },

  // ---- Back view ----
  { id: 'b-traps', slug: 'traps', label: 'Neck & Traps', view: 'back', shapes: [rect(0.41, 0.13, 0.59, 0.24)] },
  {
    id: 'b-reardelts', slug: 'rear-delts', label: 'Rear Delts', view: 'back',
    shapes: [rect(0.29, 0.16, 0.40, 0.23), rect(0.60, 0.16, 0.71, 0.23)],
  },
  {
    id: 'b-triceps', slug: 'triceps', label: 'Triceps', view: 'back',
    shapes: [rect(0.26, 0.23, 0.37, 0.34), rect(0.63, 0.23, 0.74, 0.34)],
  },
  {
    id: 'b-forearms', slug: 'forearms', label: 'Forearms', view: 'back',
    shapes: [rect(0.19, 0.35, 0.31, 0.47), rect(0.69, 0.35, 0.81, 0.47)],
  },
  {
    id: 'b-lats', slug: 'lats', label: 'Lats', view: 'back',
    shapes: [rect(0.35, 0.24, 0.46, 0.35), rect(0.54, 0.24, 0.65, 0.35)],
  },
  { id: 'b-midback', slug: 'mid-back', label: 'Mid Back', view: 'back', shapes: [rect(0.45, 0.20, 0.55, 0.30)] },
  { id: 'b-erectors', slug: 'spinal-erectors', label: 'Spinal Erectors', view: 'back', shapes: [rect(0.45, 0.30, 0.55, 0.40)] },
  {
    id: 'b-glutes', slug: 'glutes', label: 'Glutes', view: 'back',
    shapes: [rect(0.38, 0.40, 0.50, 0.51), rect(0.50, 0.40, 0.62, 0.51)],
  },
  {
    id: 'b-hamstrings', slug: 'hamstrings', label: 'Hamstrings', view: 'back',
    shapes: [rect(0.40, 0.52, 0.495, 0.67), rect(0.505, 0.52, 0.60, 0.67)],
  },
  {
    id: 'b-calves', slug: 'calves', label: 'Calves', view: 'back',
    shapes: [rect(0.41, 0.72, 0.495, 0.87), rect(0.505, 0.72, 0.59, 0.87)],
  },
]

export function regionsForView(view) {
  return ANATOMY_REGIONS.filter((r) => r.view === view)
}

// Regions that belong to a hub slug — the region's own slug, or a region whose
// slug is a subcategory of the hub (so the Arms hub highlights biceps/triceps/
// forearms, Legs highlights quads/glutes/etc.).
export function regionsForHub(slug) {
  return ANATOMY_REGIONS.filter((r) => r.slug === slug || SUBCATEGORIES[r.slug]?.parent === slug)
}

// Which views a hub's regions occupy — so a hub with only back-view muscles
// (e.g. Lats) shows just the back figure. Falls back to both.
export function viewsFor(slug) {
  const views = new Set(regionsForHub(slug).map((r) => r.view))
  if (views.size === 1) return [...views]
  return ['front', 'back']
}

// Convert a normalized polygon to an SVG points string in the box's pixel
// space (which is also the overlay's viewBox), so shapes line up with the art.
export function polygonPoints(shape, box) {
  return shape.map(([nx, ny]) => `${box.x + nx * box.w},${box.y + ny * box.h}`).join(' ')
}
