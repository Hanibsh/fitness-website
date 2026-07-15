// ARCHIVED 2026-07-15: one-off, already run — its corrections are long since
// applied and merged (v3 → v4). Still hardcoded to the retired v3 CSV path
// ON PURPOSE — do not repoint at v4; its row-specific logic assumes the exact
// pre-fact-check v3 state and would misapply against current data. Kept for
// reference only.
//
// ONE-OFF follow-up to import-newstuff.mjs: apply the Hani-approved 2026-07-11
// double-check corrections to the 51 newly-imported back rows, IN the mother
// CSV (the sole source of truth). Four decision groups:
//  1. Muscles — keep the rich lists but damp with :weight syntax so each row's
//     Back-group total lands near the mother file's calibration (~1.25-2.0),
//     and rename Rhomboids -> Mid Back in horizontal rows (mother's 9 existing
//     rows all use Mid Back; Rhomboids stays as-is on vertical pulls).
//  2. SFR — Excellent -> Good on 22 rows (mother's fact-checked precedent for
//     these movement classes is Good); keep Excellent only on Machine
//     Supported Pull Ups + Standing Cable Pullovers (fatigue-2 + stable +
//     direct target isolation, the Braced Single Arm Cable Pulldown profile).
//  3. Stability — bent-over rows Unstable -> Moderate (mother BOR precedent);
//     chest-supported barbell/DB rows Very Stable -> Stable (Very Stable is
//     the machine tier).
//  4. Overload/stretch — weighted pull-ups High -> Moderate (mother Weighted
//     Pull-Up); cable pulldowns stretch Yes -> Partial (trust the fact-checked
//     mother Lat Pulldown direction).
// Run:  node scripts/refine-newstuff.mjs   (idempotent; writes the mother CSV
// + data/incoming/_newstuff_refine_report.md)

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CSV = join(ROOT, 'data', 'professional_hypertrophy_db_v3.csv')

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
const ser = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }

// ---- muscle-cell patches: name -> { p, s, t, q } (only listed tiers change) ----
// Back-group per-set totals after patch are noted; mother anchors: Lat Pulldown
// 1.0 · Seated Cable Row 1.25 · Barbell Bent Over Row 1.75 (+0.25 when we keep
// the erectors credit mother lacks).
const MUSCLES = {
  'TRX Row, Neutral Grip':           { p: 'Lats, Mid Back:0.5', s: 'Biceps, Upper Traps:0.25', t: 'Rear Delts, Rectus Abdominis' }, // 1.75
  'TRX Row, Underhand Grip':         { s: 'Biceps, Mid Back' }, // 1.75
  'TRX Row, Overhand Grip':          { p: 'Mid Back, Upper Traps:0.25' }, // 1.75
  'Bent Over Row With Bands':        { p: 'Lats, Mid Back:0.5', s: 'Biceps, Upper Traps:0.25' }, // 2.0
  'Seated Row With Bands':           { p: 'Lats, Mid Back:0.5', s: 'Biceps, Upper Traps:0.25' }, // 1.75
  'Bent Over Barbell Row, Underhand Grip': { s: 'Biceps, Mid Back' }, // 2.0
  'T-Bar Row':                       { p: 'Mid Back, Lats:0.5', s: 'Upper Traps:0.25, Rear Delts' }, // 2.0
  'Bent Over Dumbbell Row, Overhand Grip': { p: 'Mid Back, Lats:0.5', s: 'Upper Traps:0.25, Rear Delts' }, // 2.0
  'Bent Over Dumbbell Row, Neutral Grip':  { p: 'Lats, Mid Back:0.5', s: 'Biceps, Upper Traps:0.25' }, // 2.0
  'Kettlebell Bent Over Row':        { p: 'Lats, Mid Back:0.5', s: 'Biceps, Upper Traps:0.25' }, // 2.0
  'Single Arm Dumbbell Row':         { p: 'Lats, Mid Back:0.5', s: 'Biceps, Upper Traps:0.25' }, // 1.75
  'Single Arm Landmine Row':         { p: 'Lats, Mid Back:0.5', s: 'Biceps, Upper Traps:0.25' }, // 1.75
  'Chest Supported Barbell Row, Overhand Grip': { p: 'Mid Back, Upper Traps:0.25' }, // 1.75
  'Chest Supported Barbell Row, Underhand Grip': { s: 'Biceps, Mid Back' }, // 1.75
  'Chest Supported Dumbbell Row':    { p: 'Lats, Mid Back:0.5', s: 'Biceps, Upper Traps:0.25' }, // 1.75
  'Seated Cable Row, Underhand Grip': { s: 'Biceps, Mid Back' }, // 1.75
  'Seated Cable Row, Wide Grip':     { p: 'Rear Delts, Mid Back', s: 'Upper Traps:0.25' }, // 1.25
  'Selector Chest Supported Row Machine, Overhand Grip': { p: 'Mid Back, Upper Traps:0.25' }, // 1.75
  'Selector Chest Supported Row Machine, Neutral Grip, Narrow': { s: 'Mid Back, Biceps' }, // 1.75
  'Selector Chest Supported Row Machine, Underhand Grip': { s: 'Biceps, Mid Back' }, // 1.75
  'Selector Chest Supported Row Machine, Wide Grip': { p: 'Rear Delts, Mid Back', s: 'Upper Traps:0.25' }, // 1.25
  'Selector Chest Supported Row Machine, Single Arm': { p: 'Lats, Mid Back:0.5', s: 'Biceps, Upper Traps:0.25' }, // 1.75
  'Plate Loaded Chest Supported Row Machine, Overhand Grip': { p: 'Mid Back, Upper Traps:0.25' }, // 1.75
  'Plate Loaded Chest Supported Row Machine, Overhand, Wide': { p: 'Rear Delts, Mid Back', s: 'Upper Traps:0.25' }, // 1.25
  'Plate Loaded Chest Supported Row Machine, Neutral Grip, Narrow': { s: 'Mid Back, Biceps' }, // 1.75
  'Plate Loaded Single Arm Chest Supported Row Machine, Overhand Grip, Narrow': { p: 'Mid Back, Lats:0.5', s: 'Upper Traps:0.25, Biceps' }, // 1.75
  'Inverted Row, Overhand Grip':     { p: 'Mid Back, Upper Traps:0.25' }, // 1.75
  'Inverted Row, Underhand Grip':    { s: 'Biceps, Mid Back' }, // 1.75
  // vertical pulls: Rhomboids stays Rhomboids, damped to tertiary-equivalent;
  // Upper Traps -> 0.125; Teres Major -> 0.5; pull-up core credit -> 0.125
  'Wide Grip Lat Pulldown':          { p: 'Lats, Teres Major:0.5', s: 'Rhomboids:0.25, Biceps', t: 'Rear Delts, Upper Traps:0.125' }, // 1.875
  'Neutral Grip Lat Pulldown':       { s: 'Biceps, Rhomboids:0.25', t: 'Upper Traps:0.125, Rear Delts' }, // 1.375
  'Underhand Grip Lat Pulldown':     { s: 'Biceps, Rhomboids:0.25', t: 'Upper Traps:0.125, Rear Delts' }, // 1.375
  'Behind The Neck Lat Pulldown':    { p: 'Lats, Rhomboids:0.5', s: 'Upper Traps:0.125, Rear Delts' }, // 1.625 (retraction-biased, keeps the higher rhomboid credit)
  'Overhand Grip Plate Loaded Lat Pulldown': { s: 'Biceps, Rhomboids:0.25', t: 'Upper Traps:0.125, Rear Delts' }, // 1.375
  'Neutral Grip Plate Loaded Lat Pulldown': { s: 'Biceps, Rhomboids:0.25', t: 'Upper Traps:0.125' }, // 1.375
  'Underhand Grip Plate Loaded Lat Pulldown': { t: 'Rhomboids, Upper Traps:0.125' }, // 1.375
  'Wide Grip Pull Up':               { p: 'Lats, Teres Major:0.5', s: 'Rhomboids:0.25, Biceps', t: 'Rear Delts, Rectus Abdominis:0.125' }, // 1.75
  'Wide Grip Pull Up, Weighted':     { p: 'Lats, Teres Major:0.5', s: 'Rhomboids:0.25, Biceps', t: 'Rear Delts, Rectus Abdominis:0.125' }, // 1.75
  'Neutral Grip Pull Up':            { s: 'Biceps, Rhomboids:0.25', t: 'Upper Traps:0.125, Rectus Abdominis:0.125' }, // 1.375
  'Neutral Grip Pull Up, Weighted':  { s: 'Biceps, Rhomboids:0.25', t: 'Upper Traps:0.125, Rectus Abdominis:0.125' }, // 1.375
  'Underhand Grip Pull Up, Weighted': { t: 'Rhomboids, Rectus Abdominis:0.125' }, // 1.25
  'Machine Supported Pull Ups, Overhand Grip': { s: 'Biceps, Rhomboids:0.25', t: 'Upper Traps:0.125' }, // 1.375
  'Machine Supported Pull Ups, Wide Grip': { p: 'Lats, Teres Major:0.5', s: 'Rhomboids:0.25, Biceps' }, // 1.75
  'Machine Supported Pull Ups, Neutral Grip': { s: 'Biceps, Rhomboids:0.25', t: 'Upper Traps:0.125' }, // 1.375
  'Overhand Grip Pull Up, With Band': { s: 'Biceps, Rhomboids:0.25', t: 'Upper Traps:0.125, Rectus Abdominis:0.125' }, // 1.375
  'Neutral Grip Pull Up, With Band': { s: 'Biceps, Rhomboids:0.25', t: 'Upper Traps:0.125, Rectus Abdominis:0.125' }, // 1.375
  'Underhand Grip Pull Up, With Band': { t: 'Rhomboids, Rectus Abdominis:0.125' }, // 1.25
  // pullovers: Back total is already 1.0 (Lats only) — untouched
}

// ---- SFR: Excellent -> Good (mother's fact-checked tier for these classes) ----
const SFR_TO_GOOD = new Set([
  'Single Arm Dumbbell Row',
  'Chest Supported Barbell Row, Overhand Grip', 'Chest Supported Barbell Row, Underhand Grip',
  'Chest Supported Dumbbell Row',
  'Seated Cable Row, Underhand Grip', 'Seated Cable Row, Wide Grip',
  'Selector Chest Supported Row Machine, Overhand Grip', 'Selector Chest Supported Row Machine, Neutral Grip, Narrow',
  'Selector Chest Supported Row Machine, Underhand Grip', 'Selector Chest Supported Row Machine, Wide Grip',
  'Selector Chest Supported Row Machine, Single Arm',
  'Plate Loaded Chest Supported Row Machine, Overhand Grip', 'Plate Loaded Chest Supported Row Machine, Overhand, Wide',
  'Plate Loaded Chest Supported Row Machine, Neutral Grip, Narrow',
  'Plate Loaded Single Arm Chest Supported Row Machine, Overhand Grip, Narrow',
  'Wide Grip Lat Pulldown', 'Neutral Grip Lat Pulldown', 'Underhand Grip Lat Pulldown',
  'Overhand Grip Plate Loaded Lat Pulldown', 'Neutral Grip Plate Loaded Lat Pulldown', 'Underhand Grip Plate Loaded Lat Pulldown',
  'Decline Dumbbell Pullover',
])

// ---- stability harmonization ----
const STAB_TO_MODERATE = new Set([ // mother Barbell Bent Over Row = Moderate
  'Bent Over Barbell Row, Underhand Grip', 'T-Bar Row',
  'Bent Over Dumbbell Row, Overhand Grip', 'Bent Over Dumbbell Row, Neutral Grip',
  'Kettlebell Bent Over Row',
])
const STAB_TO_STABLE = new Set([ // mother Chest Supported T-Bar Row = Stable
  'Chest Supported Barbell Row, Overhand Grip', 'Chest Supported Barbell Row, Underhand Grip',
  'Chest Supported Dumbbell Row',
])

// ---- overload + stretch harmonization ----
const OVERLOAD_TO_MODERATE = new Set([ // mother Weighted Pull-Up = Moderate
  'Wide Grip Pull Up, Weighted', 'Neutral Grip Pull Up, Weighted', 'Underhand Grip Pull Up, Weighted',
])
const STRETCH_TO_PARTIAL = new Set([ // mother Lat Pulldown direction (No); Partial sits between
  'Wide Grip Lat Pulldown', 'Neutral Grip Lat Pulldown', 'Underhand Grip Lat Pulldown', 'Behind The Neck Lat Pulldown',
])

const rows = parseCSV(readFileSync(CSV, 'utf8'))
const H = rows[0]
const idx = (re) => H.findIndex((h) => re.test(h.trim()))
const COL = {
  name: idx(/^exercise name$/i), p: idx(/primary/i), s: idx(/secondary/i), t: idx(/tertiary/i), q: idx(/quaternary/i),
  stab: idx(/^stability$/i), sfr: idx(/sfr|stimulus/i), overload: idx(/progressive overload/i), stretch: idx(/stretch-mediated/i),
}

const touched = { muscles: [], sfr: [], stab: [], overload: [], stretch: [] }
for (const r of rows.slice(1)) {
  const name = r[COL.name].trim()
  const m = MUSCLES[name]
  if (m) {
    if (m.p != null) r[COL.p] = m.p
    if (m.s != null) r[COL.s] = m.s
    if (m.t != null) r[COL.t] = m.t
    if (m.q != null) r[COL.q] = m.q
    touched.muscles.push(name)
  }
  if (SFR_TO_GOOD.has(name) && r[COL.sfr].trim() === 'Excellent') { r[COL.sfr] = 'Good'; touched.sfr.push(name) }
  if (STAB_TO_MODERATE.has(name) && r[COL.stab].trim() === 'Unstable') { r[COL.stab] = 'Moderate'; touched.stab.push(name) }
  if (STAB_TO_STABLE.has(name) && r[COL.stab].trim() === 'Very Stable') { r[COL.stab] = 'Stable'; touched.stab.push(name) }
  if (OVERLOAD_TO_MODERATE.has(name) && r[COL.overload].trim() === 'High') { r[COL.overload] = 'Moderate'; touched.overload.push(name) }
  if (STRETCH_TO_PARTIAL.has(name) && r[COL.stretch].trim() === 'Yes') { r[COL.stretch] = 'Partial'; touched.stretch.push(name) }
}

writeFileSync(CSV, rows.map((r) => r.map(ser).join(',')).join('\n') + '\n')

const L = []
L.push('# newstuff batch — double-check refinements (2026-07-11, Hani-approved)', '')
L.push('Applied to the mother CSV directly. Decisions: damp rich muscle lists with')
L.push(':weight syntax toward mother Back-group calibration; Rhomboids -> Mid Back in')
L.push('horizontal rows; SFR Excellent -> Good except Machine Supported Pull Ups +')
L.push('Standing Cable Pullovers; stability/overload/stretch harmonized to mother precedent.', '')
L.push(`## Muscle cells re-tiered — ${touched.muscles.length}`)
for (const n of touched.muscles) L.push(`- ${n}`)
L.push('', `## SFR Excellent -> Good — ${touched.sfr.length}`)
for (const n of touched.sfr) L.push(`- ${n}`)
L.push('', `## Stability harmonized — ${touched.stab.length}`)
for (const n of touched.stab) L.push(`- ${n}`)
L.push('', `## Overload High -> Moderate — ${touched.overload.length}`)
for (const n of touched.overload) L.push(`- ${n}`)
L.push('', `## Stretch Yes -> Partial — ${touched.stretch.length}`)
for (const n of touched.stretch) L.push(`- ${n}`)
writeFileSync(join(ROOT, 'data', 'incoming', '_newstuff_refine_report.md'), L.join('\n') + '\n')

console.log(`muscles:${touched.muscles.length} sfr:${touched.sfr.length} stab:${touched.stab.length} overload:${touched.overload.length} stretch:${touched.stretch.length}`)
const expect = { muscles: Object.keys(MUSCLES).length, sfr: SFR_TO_GOOD.size, stab: STAB_TO_MODERATE.size + STAB_TO_STABLE.size, overload: OVERLOAD_TO_MODERATE.size, stretch: STRETCH_TO_PARTIAL.size }
for (const [k, v] of Object.entries(expect)) if (touched[k].length !== v) console.log(`WARNING: ${k} expected ${v}, applied ${touched[k].length}`)
