// The exercise library that backs the workout-log picker.
//
// The source of truth is the cleaned, ID'd exercise database
// (`src/data/exercises.json`) — 147 resistance movements each carrying a stable
// `id`, laterality, muscles, and equipment. Picking one of these carries its
// `id` through to the logged exercise, so downstream features (routine builder,
// hypertrophy engine) look movements up by id instead of re-guessing from the
// name. Anything the user types that isn't in the DB is still added as a custom
// exercise (no id), and laterality/bodyweight fall back to name inference.
//
// The DB is resistance-only, so cardio (and a few Olympic / full-body lifts it
// doesn't cover) are supplemented from the legacy movement list. Those have no
// id — they're names only, like custom entries.

import exercisesDb from '../data/exercises.json'
import { MOVEMENTS } from './movements'
import { withAliases } from '../data/exerciseAliases'

// ---- Search vocabulary -----------------------------------------------------

// Whole-word query abbreviations, expanded before searching. Expansions are
// chosen to hit the DB's naming (e.g. "ohp" → the shoulder-press synonyms).
const ABBREVIATIONS = {
  db: 'dumbbell',
  bb: 'barbell',
  ohp: 'overhead press',
  rdl: 'romanian deadlift',
  sldl: 'stiff leg deadlift',
  bss: 'bulgarian split squat',
  cgbp: 'close grip bench press',
}

// The DB's anatomical muscle names → the everyday words people actually search
// ("quads" not "quadriceps"). Anything unmapped falls back to its own name.
const MUSCLE_ALIASES = {
  Quadriceps: 'quads quadriceps',
  Hamstrings: 'hamstrings hams',
  'Glute Max': 'glutes glute',
  Abductors: 'abductors',
  Adductors: 'adductors inner thigh',
  Gastrocnemius: 'calves calf',
  Soleus: 'calves calf soleus',
  'Front Delts': 'front delts shoulders',
  'Side Delts': 'side delts shoulders lateral',
  'Rear Delts': 'rear delts shoulders',
  'Upper Chest': 'upper chest pecs',
  'Middle Chest': 'chest pecs',
  'Lower Chest': 'lower chest pecs',
  Lats: 'lats back',
  'Mid Back': 'mid back',
  Rhomboids: 'rhomboids upper back',
  'Teres Major': 'teres major upper back lats',
  'Upper Traps': 'traps',
  'Lower Traps': 'traps',
  Biceps: 'biceps bicep',
  Triceps: 'triceps tricep',
  Brachialis: 'brachialis',
  Brachioradialis: 'forearms',
  'Wrist Flexors': 'forearms',
  'Wrist Extensors': 'forearms',
  'Rectus Abdominis': 'abs core',
  'Transverse Abdominis': 'abs core',
  Obliques: 'obliques abs core',
  'Hip Flexors': 'hip flexors',
  'Spinal Erectors': 'lower back erectors',
  'Rotator Cuff': 'rotator cuff',
}

// Extra search terms inferred from an exercise's name — the DB has no keyword
// field, so this bridges the common gaps between what people type and how the
// DB names things (e.g. its shoulder presses never say "overhead").
function nameSynonyms(name) {
  const n = name.toLowerCase()
  const out = []
  if (/shoulder press|behind the neck press/.test(n)) out.push('overhead press', 'ohp', 'military press')
  if (/lateral raise|side lateral/.test(n)) out.push('side raise', 'lateral raise', 'side delts')
  if (/rear (delt|lateral)/.test(n)) out.push('reverse fly', 'rear delt fly')
  if (/romanian deadlift/.test(n)) out.push('rdl')
  if (/bulgarian/.test(n)) out.push('bss', 'split squat')
  if (/pulldown/.test(n)) out.push('lat pulldown')
  if (/pull-?up|chin-?up|muscle-?up|dip|push-?up|inverted row/.test(n)) out.push('bodyweight')
  if (/push-?down/.test(n)) out.push('tricep pushdown', 'pressdown')
  return out
}

// Bodyweight-loaded movements (pull-ups, dips, push-ups…): the log treats
// bodyweight as the base load. Mirrors the rule in movements.js but works off
// the DB row we already have in hand.
const BODYWEIGHT_RE = /\b(pull-?up|chin-?up|push-?up|muscle-?up|dip|inverted row|pistol|sissy squat|nordic|dragon flag)\b/i
function isBodyweight(equipment, name) {
  if (equipment === 'bodyweight') return true
  if (/\b(machine|lever|cable|smith)\b/i.test(name)) return false
  return BODYWEIGHT_RE.test(name)
}

// ---- Build the pool --------------------------------------------------------

// Normalise a string for searching: lowercase and treat hyphens as spaces, so
// "push-down" and "push down" both match. We also append a compacted copy (all
// non-alphanumerics stripped) so a one-word query like "pushdown" still hits.
function buildHaystack(parts) {
  const base = parts.filter(Boolean).join(' ').toLowerCase().replace(/-/g, ' ')
  const compact = base.replace(/[^a-z0-9]/g, '')
  return `${base} ${compact}`
}

// Library entries from the DB — the real, ID'd movements. Compounds sort ahead
// of isolation (nice empty-state suggestions), then alphabetical.
const LIBRARY = (exercisesDb.exercises || [])
  .map((e) => {
    // Only the primary (highest-contribution) muscle(s) feed search. Secondary
    // movers would otherwise make e.g. bench press match "shoulder" (front
    // delts) or a front raise match "lateral" (side delts).
    const entries = Object.entries(e.muscles || {})
    const maxWeight = entries.reduce((m, [, w]) => Math.max(m, w), 0)
    const primary = entries.filter(([, w]) => w === maxWeight).map(([m]) => m)
    const item = {
      id: e.id,
      name: e.name,
      category: e.category,
      laterality: e.laterality || 'both',
      bodyweight: isBodyweight(e.equipment, e.name),
      type: e.type,
    }
    item._hay = buildHaystack([
      e.name,
      e.category,
      e.type,
      e.equipment,
      ...primary.map((m) => MUSCLE_ALIASES[m] || m),
      ...nameSynonyms(e.name),
    ])
    return item
  })
  .sort((a, b) => (a.type === 'compound' ? 0 : 1) - (b.type === 'compound' ? 0 : 1) || a.name.localeCompare(b.name))

// Supplements the DB doesn't cover — cardio, Olympic lifts, loaded carries.
// Names only, no id, so they behave like custom entries.
const SUPPLEMENT_CATEGORIES = new Set(['Cardio', 'Olympic', 'Full Body'])
const SUPPLEMENTAL = MOVEMENTS.filter((m) => SUPPLEMENT_CATEGORIES.has(m.category)).map((m) => {
  const item = { id: null, name: m.name, category: m.category, laterality: 'both', bodyweight: false }
  item._hay = buildHaystack([m.name, m.category, ...(m.keywords || [])])
  return item
})

const POOL = [...LIBRARY, ...SUPPLEMENTAL]
const BY_ID = withAliases(new Map(LIBRARY.map((e) => [e.id, e])))
const BY_NAME = new Map(POOL.map((e) => [e.name.trim().toLowerCase(), e]))

// ---- Public lookups --------------------------------------------------------

// The full DB entry (laterality, bodyweight, muscles…) for a picked id, or null
// for custom / supplemental exercises.
export function getExercise(id) {
  return id ? BY_ID.get(id) || null : null
}

// Reconcile a bare exercise name back to a DB id when it matches one exactly
// (case-insensitive) — used to backfill ids on older logged exercises.
export function exerciseIdForName(name) {
  const entry = BY_NAME.get((name || '').trim().toLowerCase())
  return entry?.id || null
}

// ---- Search ----------------------------------------------------------------

function tokenize(q) {
  return q
    .split(/\s+/)
    .map((t) => ABBREVIATIONS[t] || t)
    .join(' ')
    .split(/\s+/)
    .map((t) => t.replace(/-/g, ''))
    .filter(Boolean)
}

// The searchable set for a user: their previously-logged movements first
// (most-recent first, reconciled to a library entry so they keep their
// id/category), then the full pool — deduped by name. Only picking from this
// list is allowed (no free-text custom exercises — the effective-volume engine
// can't score anything outside the library), so a recent name that doesn't
// resolve to a real entry (an old custom exercise from before this rule, or a
// stale name) is silently dropped rather than resurfacing as pickable.
export function exercisePool(recentNames = []) {
  const seen = new Set()
  const pool = []
  const push = (item) => {
    const key = item.name.trim().toLowerCase()
    if (!key || seen.has(key)) return
    seen.add(key)
    pool.push(item)
  }
  for (const name of recentNames) {
    const known = BY_NAME.get(name.trim().toLowerCase())
    if (known) push(known)
  }
  for (const m of POOL) push(m)
  return pool
}

// The gym staples people search for most — boosted so the canonical version
// leads a generic query ("squat" → Barbell Squat, not Belt Squat; "curl" →
// Barbell/Dumbbell Curl, not a lever variant). A specific query still wins on
// its own name match, so this only decides otherwise-weak/tied results.
const PRIORITY = new Set([
  'bench-press', 'incline-barbell-bench-press', 'dumbbell-bench-press',
  'barbell-squat', 'deadlift', 'romanian-deadlift', 'sumo-deadlift', 'leg-press', 'leg-extension', 'lying-leg-curl',
  'seated-barbell-shoulder-press', 'dumbbell-shoulder-press',
  'barbell-bent-over-row', 'seated-cable-row', 'lat-pulldown', 'pull-up', 'chin-up',
  'barbell-curl', 'dumbbell-curl', 'hammer-curl', 'push-down', 'barbell-hip-thrusts',
])

// Whole-word queries that read as "show me this group" — boost members of that
// category so browsing by body part surfaces the real thing (e.g. "back" lists
// rows/pulldowns, not "Cable Kickbacks" whose name merely contains "back").
// The distinct category VALUES here must stay in sync with HOME_CATEGORIES in
// scripts/muscle-taxonomy.mjs (the CSV linter warns on any Home Category not
// in that list) — add a value in both places together.
const CATEGORY_WORDS = {
  chest: 'Chest', back: 'Back', legs: 'Legs', leg: 'Legs', arms: 'Arms', arm: 'Arms',
  shoulders: 'Shoulders', shoulder: 'Shoulders', core: 'Core', abs: 'Core',
  traps: 'Neck and Traps', trap: 'Neck and Traps', neck: 'Neck and Traps',
  forearms: 'Arms', forearm: 'Arms', grip: 'Arms',
}

// How well an item answers the query. The key idea: matches in the exercise's
// NAME beat matches that only came from its muscles/synonyms, so the exercise
// someone actually typed surfaces first (e.g. "shoulder press" leads with the
// shoulder presses, not a bench press that happens to hit front delts).
function relevance(item, q, qCompact, tokens, isRecent) {
  const name = item.name.toLowerCase()
  const nameCompact = name.replace(/[^a-z0-9]/g, '')
  let s = 0
  if (name === q) s += 1000
  else if (name.startsWith(q)) s += 600
  else if (name.includes(q) || (qCompact && nameCompact.includes(qCompact))) s += 300
  let inName = 0
  for (const t of tokens) if (name.includes(t) || nameCompact.includes(t)) inName += 1
  s += inName * 40
  if (inName === tokens.length) s += 120 // every query word is in the name itself
  if (isRecent) s += 250 // the user's own logged exercises come first
  if (PRIORITY.has(item.id)) s += 200 // canonical staples lead generic searches
  if (CATEGORY_WORDS[q] === item.category) s += 700 // body-part browse leads with that group
  if (item.id) s += 6 // prefer real DB entries over name-only supplements
  if (item.type === 'compound') s += 4
  s -= name.length * 0.15 // gently favour the concise, canonical name
  return s
}

// Token search over the pool: every query word must appear in the movement's
// searchable text (name/category/primary muscles/equipment/synonyms). Empty
// query returns the whole pool (recents first). Non-empty queries are ranked by
// relevance so the best (name) match leads.
export function searchExercises(query, recentNames = []) {
  const pool = exercisePool(recentNames)
  const q = (query || '').trim().toLowerCase()
  if (!q) return pool
  const recentSet = new Set(recentNames.map((n) => n.trim().toLowerCase()))
  const qCompact = q.replace(/[^a-z0-9]/g, '')
  const tokens = tokenize(q)
  return pool
    .filter((m) => tokens.every((t) => m._hay.includes(t)))
    .map((m) => ({ m, score: relevance(m, q, qCompact, tokens, recentSet.has(m.name.toLowerCase())) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.m)
}
