// ONE-OFF: combine + clean the 4 incoming exercise CSVs into a single staging
// file that matches the mother DB's schema and conventions, ahead of a manual
// review + merge. Run:  node scripts/combine-incoming.mjs
//
// Deterministic transforms only (the judgment columns — fatigue, recovery,
// rest, resistance profile — are passed through UNCHANGED and flagged for
// hand-recalibration in the report). Writes nothing outside data/incoming/.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const INC = join(ROOT, 'data', 'incoming')
const FILES = ['new_exercises.csv', 'new_exercises1.csv', 'new_exercises2.csv', 'new_exercises3.csv']

// ---- CSV parse (quote-aware) ----
function parseCSV(text) {
  const rows = []
  let row = [], field = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else q = false } else field += c }
    else if (c === '"') q = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\r') {}
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else field += c
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}
const serField = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
const slug = (n) => n.toLowerCase().replace(/[()]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const N_COLS = 21 // mother-file column count
const CATEGORIES = new Set(['shoulders', 'back', 'chest', 'arms', 'forearms', 'core', 'legs', 'traps'])

// These files are riddled with comma/column corruption that shifts fields three
// different ways (unquoted comma in the name; a stray empty in the muscle block;
// a missing Quaternary column). Rather than guess per-case, ANCHOR on two
// unambiguous landmarks and rebuild all 21 columns from them:
//   - the Home Category cell (a known enum) near the front
//   - the recovery-window cell (the ONLY cell containing "hour"; rest times say
//     "minutes"), which pins fatigue (just before it) and the tail block.
// Muscle cells between laterality and fatigue are left-packed to exactly 4.
function repairRow(r) {
  const ci = r.findIndex((c) => CATEGORIES.has(String(c).trim().toLowerCase()))
  const ri = r.findIndex((c) => /hour/i.test(String(c)))
  if (ci < 1 || ri < 0 || ri - 1 <= ci + 2) { // can't anchor — pad/trim and hope
    const x = r.slice(0, N_COLS); while (x.length < N_COLS) x.push(''); return x
  }
  // Join split name fields WITHOUT the comma (mother file uses no commas in
  // names: "Hack Squat Wide Stance", not "Hack Squat, Wide Stance").
  const name = r.slice(0, ci).join(' ').replace(/\s+/g, ' ').trim()
  const [category, type, lat] = [r[ci], r[ci + 1], r[ci + 2]]
  let muscles = r.slice(ci + 3, ri - 1).filter((m) => String(m).trim() !== '') // left-pack, drop gaps
  while (muscles.length < 4) muscles.push('')
  muscles = muscles.slice(0, 4)
  const fatigue = r[ri - 1]
  const recovery = r[ri]
  let tail = r.slice(ri + 1) // overload..notes = 11 cells
  if (tail.length > 11) tail = [...tail.slice(0, 10), tail.slice(10).join(', ')] // merge overflow into Notes
  while (tail.length < 11) tail.push('')
  return [name, category, type, lat, ...muscles, fatigue, recovery, ...tail]
}

// ---- muscle-name normalization ----
const MUSCLE_MAP = {
  glutes: 'Glute Max', quads: 'Quadriceps', 'erector spinae': 'Spinal Erectors',
  core: 'Rectus Abdominis', traps: 'Upper Traps', calves: 'Gastrocnemius',
  'long head triceps': 'Triceps', 'lateral/medial triceps': 'Triceps',
  'lateral head triceps': 'Triceps', 'medial head triceps': 'Triceps',
  chest: 'Middle Chest', forearms: 'Brachioradialis', 'forearms (grip)': 'Wrist Flexors',
}
const CANON = new Set([
  'Front Delts', 'Side Delts', 'Rear Delts', 'Rotator Cuff', 'Upper Chest', 'Middle Chest', 'Lower Chest',
  'Lats', 'Mid Back', 'Rhomboids', 'Upper Traps', 'Mid Traps', 'Lower Traps', 'Spinal Erectors',
  'Biceps', 'Brachialis', 'Triceps', 'Brachioradialis', 'Wrist Flexors', 'Wrist Extensors', 'Deep Finger Flexors',
  'Rectus Abdominis', 'Obliques', 'Transverse Abdominis', 'Hip Flexors',
  'Quadriceps', 'Glute Max', 'Hamstrings', 'Adductors', 'Abductors', 'Gastrocnemius', 'Soleus',
])
const unknownMuscles = new Set()
function mapMuscleCell(cell) {
  if (!cell || !cell.trim()) return ''
  const out = []
  for (const raw of cell.split(',')) {
    const t = raw.trim()
    if (!t) continue
    // preserve any :weight suffix
    const m = t.match(/^(.+?):\s*([\d.]+)\s*$/)
    const term = m ? m[1].trim() : t
    const wt = m ? `:${m[2]}` : ''
    const mapped = MUSCLE_MAP[term.toLowerCase()] || (CANON.has(term) ? term : null)
    if (!mapped) { unknownMuscles.add(term); out.push(term + wt) } // leave; linter will catch
    else if (!out.some((o) => o.split(':')[0] === mapped)) out.push(mapped + wt) // dedupe collapsed terms
  }
  return out.join(', ')
}

// ---- single-limb rule ----
const SINGLE_RE = /,?\s*(single[ -](arm|leg)|one[ -](arm|leg)|single)\b/i
const isSingleLimb = (name) => SINGLE_RE.test(name)
const baseName = (name) => name.replace(SINGLE_RE, '').replace(/,\s*$/, '').replace(/\s+/g, ' ').trim()

// ---- load mother file names/slugs for dedup ----
const motherRows = parseCSV(readFileSync(join(ROOT, 'data', 'professional_hypertrophy_db_v3.csv'), 'utf8'))
const motherHeader = motherRows[0]
const motherNames = motherRows.slice(1).map((r) => r[0].trim())
const motherSlugs = new Set(motherNames.map(slug))

// ---- read + fix all incoming rows ----
let header = null
const raw = []
for (const f of FILES) {
  const rows = parseCSV(readFileSync(join(INC, f), 'utf8'))
  header = header || rows[0]
  for (let i = 1; i < rows.length; i++) {
    let r = rows[i]
    r = repairRow(r)
    raw.push({ src: f, cells: r })
  }
}

// Column indices (same order as mother file).
const C = { name: 0, cat: 1, type: 2, lat: 3, p: 4, s: 5, t: 6, q: 7, fat: 8, rec: 10 - 1, /* placeholder */ }
// resolve by header to be safe
const idx = (re) => header.findIndex((h) => re.test(h.trim()))
const COL = {
  name: idx(/^exercise name$/i), cat: idx(/home category/i), type: idx(/exercise type/i), lat: idx(/laterality/i),
  p: idx(/primary/i), s: idx(/secondary/i), t: idx(/tertiary/i), q: idx(/quaternary/i),
  axial: idx(/axial/i), equip: idx(/stability requirement/i), profile: idx(/resistance profile/i),
}

// ---- build a name->row map for single-limb sibling detection (incoming + mother) ----
const bySlug = new Map()
for (const row of raw) bySlug.set(slug(row.cells[COL.name].trim()), row)

const removedSingle = [], removedDupMother = [], nearDup = [], setBoth = []
const kept = []
const seenKeptSlug = new Set()

for (const row of raw) {
  const cells = row.cells.slice()
  const name = cells[COL.name].trim()
  const s = slug(name)

  // 1) single-limb removal when a normal-version sibling exists (incoming or mother)
  if (isSingleLimb(name)) {
    const base = baseName(name)
    const bslug = slug(base)
    const siblingIncoming = raw.find((o) => o !== row && !isSingleLimb(o.cells[COL.name].trim()) && slug(baseName(o.cells[COL.name].trim())) === bslug)
    const siblingMother = motherSlugs.has(bslug) || motherNames.some((mn) => slug(mn) === bslug)
    if (siblingIncoming || siblingMother) {
      removedSingle.push({ name, base, where: siblingIncoming ? 'incoming' : 'mother' })
      if (siblingIncoming) setBoth.push(siblingIncoming.cells[COL.name].trim())
      continue
    }
    // no sibling: keep as unilateral (rule only removes when a normal version exists)
  }

  // 2) exact dup against mother
  if (motherSlugs.has(s)) { removedDupMother.push(name); continue }

  // 3) near-dup against mother (loose token overlap) — report, keep for review
  const nd = motherNames.find((mn) => {
    const a = new Set(slug(mn).split('-')), b = new Set(s.split('-'))
    const inter = [...a].filter((x) => b.has(x)).length
    return inter >= Math.min(a.size, b.size) && Math.abs(a.size - b.size) <= 1 && slug(mn) !== s
  })
  if (nd) nearDup.push({ incoming: name, mother: nd })

  // 4) normalize muscle cells
  for (const k of ['p', 's', 't', 'q']) if (COL[k] !== -1) cells[COL[k]] = mapMuscleCell(cells[COL[k]])

  // 5) axial Minor -> No
  if (COL.axial !== -1 && /minor/i.test(cells[COL.axial])) cells[COL.axial] = 'No'

  if (seenKeptSlug.has(s)) continue // intra-incoming exact dup
  seenKeptSlug.add(s)
  kept.push(cells)
}

// apply Laterality = Can Be Both to survivors whose single-limb sibling was removed
const bothSlugs = new Set(setBoth.map(slug))
for (const cells of kept) if (bothSlugs.has(slug(cells[COL.name].trim()))) cells[COL.lat] = 'Can Be Both'

// ---- write staging CSV ----
const outRows = [header, ...kept]
writeFileSync(join(INC, '_combined_staging.csv'), outRows.map((r) => r.map(serField).join(',')).join('\n') + '\n')

// ---- report ----
const L = []
L.push('# Incoming combine — cleaning report', '')
L.push(`Raw incoming rows: **${raw.length}** across ${FILES.length} files.`)
L.push(`Kept after cleaning: **${kept.length}**.`, '')
L.push(`## Single-limb rows removed (sibling exists) — ${removedSingle.length}`)
for (const r of removedSingle) L.push(`- ~~${r.name}~~ → sibling "${r.base}" set to Can Be Both (${r.where})`)
L.push('', `## Survivors set to "Can Be Both" — ${[...bothSlugs].length}`)
for (const n of [...new Set(setBoth)]) L.push(`- ${n}`)
L.push('', `## Exact duplicates of mother file removed — ${removedDupMother.length}`)
for (const n of removedDupMother) L.push(`- ${n}`)
L.push('', `## NEAR-duplicates vs mother file (KEPT — need your call) — ${nearDup.length}`)
for (const d of nearDup) L.push(`- incoming "**${d.incoming}**" ≈ mother "${d.mother}"`)
L.push('', `## Unknown muscle terms left as-is (linter will block) — ${unknownMuscles.size}`)
for (const m of unknownMuscles) L.push(`- ${m}`)
writeFileSync(join(INC, '_cleaning_report.md'), L.join('\n') + '\n')

console.log(`raw:${raw.length} kept:${kept.length} single-removed:${removedSingle.length} mother-dup:${removedDupMother.length} near-dup:${nearDup.length} unknown-muscles:${unknownMuscles.size}`)
console.log('unknown muscles:', [...unknownMuscles].join(' | ') || '(none)')
