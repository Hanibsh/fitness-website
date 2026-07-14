// Data accessor for the public exercise bank (`/exercises`).
//
// The bank needs the FULL exercise rows — muscles, fatigue, recovery, rest,
// SFR, resistance profile, etc. — which `exerciseLibrary.js`'s search entries
// deliberately strip out (they only carry id/name/category/laterality/type).
// So the bank reads `src/data/exercises.json` directly. Search itself is still
// delegated to `searchExercises` in exerciseLibrary.js.

import exercisesDb from '../data/exercises.json'
import { CATEGORIES, SUBCATEGORIES, categoryBySlug } from '../data/muscleInfo'
import { withAliases } from '../data/exerciseAliases'

// Display order for the browse page's category sections.
// Keep the VALUES in sync with HOME_CATEGORIES in scripts/muscle-taxonomy.mjs.
export const CATEGORY_ORDER = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Neck and Traps', 'Core']

const ALL = exercisesDb.exercises || []
const BY_ID = withAliases(new Map(ALL.map((e) => [e.id, e])))

export const EXERCISE_COUNT = ALL.length

// The full DB row for a detail page, or null for an unknown id.
export function getFullExercise(id) {
  return id ? BY_ID.get(id) || null : null
}

// Compounds first, then alphabetical — a nice reading order within a group.
function byTypeThenName(a, b) {
  return (a.type === 'compound' ? 0 : 1) - (b.type === 'compound' ? 0 : 1) || a.name.localeCompare(b.name)
}

// All exercises grouped by Home Category in CATEGORY_ORDER. Returns
// [category, rows][] with empty categories dropped. Any category not in the
// order list (shouldn't happen given the linter) is appended at the end.
export function allByCategory() {
  const groups = new Map(CATEGORY_ORDER.map((c) => [c, []]))
  for (const e of ALL) {
    if (!groups.has(e.category)) groups.set(e.category, [])
    groups.get(e.category).push(e)
  }
  for (const list of groups.values()) list.sort(byTypeThenName)
  return [...groups.entries()].filter(([, list]) => list.length)
}

// ---- Bank hub taxonomy (browse-only, derived from the muscles map) ---------
//
// The public bank is navigated as home-category hubs → optional subcategory
// hubs. Membership is derived from each row's PRIMARY movers, so nothing is
// re-tagged in the data (see src/data/muscleInfo.js for the taxonomy + copy).

// Primary (highest-weight) atom name(s) for an exercise — its main movers.
function primaryAtoms(e) {
  const entries = Object.entries(e.muscles || {})
  if (!entries.length) return []
  const max = Math.max(...entries.map(([, w]) => w))
  return entries.filter(([, w]) => w === max).map(([m]) => m)
}

// Exercises for a subcategory slug: rows in the parent's source category whose
// primary movers include one of the subcategory's atoms.
export function subcategoryExercises(subSlug) {
  const sub = SUBCATEGORIES[subSlug]
  if (!sub) return []
  const parent = categoryBySlug(sub.parent)
  // Explicit split (Arms/Legs): match the row's stored subCategory column.
  if (sub.value) {
    return ALL.filter(
      (e) => e.category === parent?.source && e.subCategory === sub.value
    ).sort(byTypeThenName)
  }
  // Derived split (shoulder delt heads): match by primary mover.
  const atoms = new Set(sub.atoms)
  return ALL.filter(
    (e) => e.category === parent?.source && primaryAtoms(e).some((a) => atoms.has(a))
  ).sort(byTypeThenName)
}

// Exercises for a leaf category slug (non-split `source` categories, or a
// derived `atoms` tile like Glutes). Split categories return [] here — they
// render subcategory tiles, not a flat list.
export function categoryExercises(catSlug) {
  const cat = categoryBySlug(catSlug)
  if (!cat) return []
  if (cat.atoms) {
    const atoms = new Set(cat.atoms)
    return ALL.filter((e) => primaryAtoms(e).some((a) => atoms.has(a))).sort(byTypeThenName)
  }
  if (cat.subs) return []
  return ALL.filter((e) => e.category === cat.source).sort(byTypeThenName)
}

// How many exercises a category tile represents (source total for split
// categories; derived count for atom tiles).
export function categoryCount(catSlug) {
  const cat = categoryBySlug(catSlug)
  if (!cat) return 0
  if (cat.atoms) {
    const atoms = new Set(cat.atoms)
    return ALL.filter((e) => primaryAtoms(e).some((a) => atoms.has(a))).length
  }
  return ALL.filter((e) => e.category === cat.source).length
}

// Landing tiles: every home category with its display count.
export function bankCategories() {
  return CATEGORIES.map((c) => ({ slug: c.slug, name: c.name, count: categoryCount(c.slug) }))
}

// Subcategory tiles for a split category, each with its display count.
export function subcategoryTiles(catSlug) {
  const cat = categoryBySlug(catSlug)
  if (!cat?.subs) return []
  return cat.subs.map((slug) => ({
    slug,
    name: SUBCATEGORIES[slug].name,
    count: subcategoryExercises(slug).length,
  }))
}

// Filter option lists, derived from the data so they never drift from the DB.
// Stored lowercase in the JSON ("free weight", "compound") — display-cased in the UI.
export const EQUIPMENT = [...new Set(ALL.map((e) => e.equipment))].filter(Boolean).sort()
export const TYPES = [...new Set(ALL.map((e) => e.type))].filter(Boolean).sort()

// The primary (highest-weight) muscle name(s) — used for card tags.
export function primaryMuscles(e) {
  const entries = Object.entries(e.muscles || {})
  if (!entries.length) return []
  const max = Math.max(...entries.map(([, w]) => w))
  return entries.filter(([, w]) => w === max).map(([m]) => m)
}

// ---- Display formatting ----------------------------------------------------

export function titleCase(s) {
  return (s || '').replace(/\b\w/g, (c) => c.toUpperCase())
}

// [24,48] -> "24–48h"; [72,72] -> "72h"
export function fmtRecovery(hours) {
  if (!Array.isArray(hours)) return '—'
  const [a, b] = hours
  return a === b ? `${a}h` : `${a}–${b}h`
}

// seconds -> minutes label: [120,180] -> "2–3 min"; [120,120] -> "2 min"
export function fmtRest(seconds) {
  if (!Array.isArray(seconds)) return '—'
  const toMin = (s) => {
    const m = s / 60
    return Number.isInteger(m) ? `${m}` : m.toFixed(1).replace(/\.0$/, '')
  }
  const [a, b] = seconds
  return a === b ? `${toMin(a)} min` : `${toMin(a)}–${toMin(b)} min`
}

// Muscle weight -> tier label (matches the CSV's four contribution columns).
export function tierLabel(weight) {
  if (weight >= 1) return 'Primary'
  if (weight >= 0.5) return 'Secondary'
  if (weight >= 0.25) return 'Tertiary'
  return 'Stabilizer'
}
