// ARCHIVED 2026-07-15: one-off, already run — its output was merged into the
// mother CSV long ago. Kept for reference only; paths below assume this
// file's archived location (scripts/archive/).
//
// ONE-OFF: clean + calibrate the newstuff.csv back-exercise batch ahead of a
// manual append to the mother file. Deterministic + explicit per-row
// calibration (not a blind heuristic) — see data/incoming/_newstuff_cleaning_report.md
// for the full reasoning trail. Run:  node scripts/import-newstuff.mjs
// Writes only data/incoming/_newstuff_staging.csv + the report — never touches
// the mother CSV.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const INC = join(ROOT, 'data', 'incoming')
const SRC = join(INC, 'new_exercises_back2.csv')

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

const rows = parseCSV(readFileSync(SRC, 'utf8'))
const header = rows[0]
const idx = (re) => header.findIndex((h) => re.test(h.trim()))
const COL = {
  name: idx(/^exercise name$/i), lat: idx(/laterality/i),
  p: idx(/primary/i), s: idx(/secondary/i), t: idx(/tertiary/i), q: idx(/quaternary/i),
  fat: idx(/fatigue score/i), rec: idx(/recovery window/i),
  hyp: idx(/hypertrophy potential/i), sfr: idx(/sfr|stimulus/i), stab: idx(/^stability$/i),
  profile: idx(/resistance profile/i), axial: idx(/axial/i), rest: idx(/rest time/i),
}

// ---- muscle-term normalization (same aliasing precedent as batch 1) ----
const MUSCLE_MAP = { Traps: 'Upper Traps', Core: 'Rectus Abdominis', 'Lower Back': 'Spinal Erectors' }
function mapMuscleCell(cell) {
  if (!cell || !cell.trim()) return cell
  return cell.split(',').map((raw) => {
    const t = raw.trim()
    return MUSCLE_MAP[t] || t // Teres Major, Lats, Rhomboids, Biceps, Rear Delts, Lower Chest, Triceps pass through unchanged
  }).join(', ')
}

// ---- drop list: name -> reason ----
const DROP = {
  'Bent Over Barbell Row, Overhand Grip': 'dup of mother\'s "Barbell Bent Over Row"',
  'Seated Cable Row, Overhand Grip': 'dup of mother\'s "Seated Cable Row"',
  'Seated Cable Row, Neutral Grip': 'dup of mother\'s "Close Grip Cable Row"',
  'Seated Cable Row, Single Arm': 'mother\'s "Seated Cable Row" is already Laterality=Can Be Both',
  'Plate Loaded Chest Supported Row Machine, Wide Grip': 'intra-file dup of "...Overhand, Wide" (identical muscles); that row survives (has a confirmed single-arm sibling)',
  'Plate Loaded Chest Supported Row Machine, Overhand, Wide, Single Arm': 'merges into "...Overhand, Wide" (exact bilateral sibling)',
  'Plate Loaded Single Arm Chest Supported Low Row Machine, Neutral Grip, Narrow': '"Low" naming slip; merges into "Plate Loaded Chest Supported Row Machine, Neutral Grip, Narrow"',
  'Overhand Grip Lat Pulldown': 'dup of mother\'s "Lat Pulldown"',
  'Lat Pulldown, Single Arm': 'mother already has "Cable One Arm Lat Pulldown" + "Braced Single Arm Cable Pulldown"',
  'Neutral Grip Plate Loaded Lat Pulldown, Single Arm': 'merges into "Neutral Grip Plate Loaded Lat Pulldown" (exact bilateral sibling)',
  'Underhand Grip Plate Loaded Lat Pulldown, Single Arm': 'merges into "Underhand Grip Plate Loaded Lat Pulldown" (exact bilateral sibling)',
  'Overhand Grip Pull Up': 'dup of mother\'s "Pull-Up"',
  'Overhand Grip Pull Up, Weighted': 'dup of mother\'s "Weighted Pull-Up"',
  'Underhand Grip Pull Up': 'dup of mother\'s "Reverse Grip Pull-Up"',
  'Flat Dumbbell Pullover': 'dup of mother\'s "Dumbbell Pullover" (stays filed under Chest/Hybrid)',
}

// ---- laterality overrides: survivor -> Can Be Both (single-arm sibling dropped) ----
const SET_BOTH = new Set([
  'Plate Loaded Chest Supported Row Machine, Overhand, Wide',
  'Plate Loaded Chest Supported Row Machine, Neutral Grip, Narrow',
  'Neutral Grip Plate Loaded Lat Pulldown',
  'Underhand Grip Plate Loaded Lat Pulldown',
])

// ---- explicit, row-by-row calibration for every surviving row ----
// A = standard/heavy compound row-family baseline (matches Pull-Up / Lat Pulldown /
//     Barbell Bent Over Row / Seated Cable Row precedent): 3 / 48-72 hours / 3.5-5 minutes
// B = light/assistance-tool (TRX, bands): 1-2 / 24-48 hours / 2-3 minutes
// C = machine-assisted or isolation-leaning single-limb/cable-pullover: 2 / 24-48 hours / 2-3 or 3-4 minutes
// Resistance Profile: horizontal free-weight bent-over rows -> Shortened Bias (matches
// Barbell Bent Over Row / Chest Supported T-Bar Row); everything else row/pulldown/pull-up
// -> Balanced (matches Seated Cable Row / Lat Pulldown / Pull-Up); pullovers -> Lengthened
// Bias (matches Dumbbell Pullover). Axial Loading -> No for every row in this family (the
// mother file rates every existing row/pulldown/pull-up/pullover axial=No, including the
// heaviest ones — axial here means vertical spine-compression as in squats/OHP, not
// horizontal pulling).
const CAL = {
  'TRX Row, Neutral Grip': [2, '24-48 hours', '2-3 minutes', 'Balanced'],
  'TRX Row, Underhand Grip': [2, '24-48 hours', '2-3 minutes', 'Balanced'],
  'TRX Row, Overhand Grip': [2, '24-48 hours', '2-3 minutes', 'Balanced'],
  'Bent Over Row With Bands': [1, '24-48 hours', '2-3 minutes', 'Balanced'],
  'Seated Row With Bands': [1, '24-48 hours', '2-3 minutes', 'Balanced'],
  'Bent Over Barbell Row, Underhand Grip': [3, '48-72 hours', '3.5-5 minutes', 'Shortened Bias'],
  'T-Bar Row': [3, '48-72 hours', '3.5-5 minutes', 'Shortened Bias'],
  'Bent Over Dumbbell Row, Overhand Grip': [3, '48-72 hours', '3.5-5 minutes', 'Shortened Bias'],
  'Bent Over Dumbbell Row, Neutral Grip': [3, '48-72 hours', '3.5-5 minutes', 'Shortened Bias'],
  'Kettlebell Bent Over Row': [3, '48-72 hours', '3.5-5 minutes', 'Shortened Bias'],
  'Single Arm Dumbbell Row': [3, '48-72 hours', '3.5-5 minutes', 'Shortened Bias'],
  'Single Arm Landmine Row': [2, '24-48 hours', '2-3 minutes', 'Shortened Bias'],
  'Chest Supported Barbell Row, Overhand Grip': [3, '48-72 hours', '3.5-5 minutes', 'Shortened Bias'],
  'Chest Supported Barbell Row, Underhand Grip': [3, '48-72 hours', '3.5-5 minutes', 'Shortened Bias'],
  'Chest Supported Dumbbell Row': [3, '48-72 hours', '3.5-5 minutes', 'Shortened Bias'],
  'Seated Cable Row, Underhand Grip': [3, '48-72 hours', '3.5-5 minutes', 'Balanced'],
  'Seated Cable Row, Wide Grip': [3, '48-72 hours', '3.5-5 minutes', 'Balanced'],
  'Selector Chest Supported Row Machine, Overhand Grip': [3, '48-72 hours', '3.5-5 minutes', 'Balanced'],
  'Selector Chest Supported Row Machine, Neutral Grip, Narrow': [3, '48-72 hours', '3.5-5 minutes', 'Balanced'],
  'Selector Chest Supported Row Machine, Underhand Grip': [3, '48-72 hours', '3.5-5 minutes', 'Balanced'],
  'Selector Chest Supported Row Machine, Wide Grip': [3, '48-72 hours', '3.5-5 minutes', 'Balanced'],
  'Selector Chest Supported Row Machine, Single Arm': [3, '48-72 hours', '3.5-5 minutes', 'Balanced'],
  'Plate Loaded Chest Supported Row Machine, Overhand Grip': [3, '48-72 hours', '3.5-5 minutes', 'Balanced'],
  'Plate Loaded Chest Supported Row Machine, Overhand, Wide': [3, '48-72 hours', '3.5-5 minutes', 'Balanced'],
  'Plate Loaded Chest Supported Row Machine, Neutral Grip, Narrow': [3, '48-72 hours', '3.5-5 minutes', 'Balanced'],
  'Plate Loaded Single Arm Chest Supported Row Machine, Overhand Grip, Narrow': [3, '48-72 hours', '3.5-5 minutes', 'Balanced'],
  'Inverted Row, Overhand Grip': [2, '24-48 hours', '2-3 minutes', 'Balanced'],
  'Inverted Row, Underhand Grip': [2, '24-48 hours', '2-3 minutes', 'Balanced'],
  'Wide Grip Lat Pulldown': [3, '48-72 hours', '3.5-5 minutes', 'Balanced'],
  'Neutral Grip Lat Pulldown': [3, '48-72 hours', '3.5-5 minutes', 'Balanced'],
  'Underhand Grip Lat Pulldown': [3, '48-72 hours', '3.5-5 minutes', 'Balanced'],
  'Behind The Neck Lat Pulldown': [3, '48-72 hours', '3.5-5 minutes', 'Balanced'],
  'Overhand Grip Plate Loaded Lat Pulldown': [3, '48-72 hours', '3.5-5 minutes', 'Balanced'],
  'Neutral Grip Plate Loaded Lat Pulldown': [3, '48-72 hours', '3.5-5 minutes', 'Balanced'],
  'Underhand Grip Plate Loaded Lat Pulldown': [3, '48-72 hours', '3.5-5 minutes', 'Balanced'],
  'Wide Grip Pull Up': [3, '48-72 hours', '3.5-5 minutes', 'Balanced'],
  'Wide Grip Pull Up, Weighted': [3, '48-72 hours', '3.5-5 minutes', 'Balanced'],
  'Neutral Grip Pull Up': [3, '48-72 hours', '3.5-5 minutes', 'Balanced'],
  'Neutral Grip Pull Up, Weighted': [3, '48-72 hours', '3.5-5 minutes', 'Balanced'],
  'Underhand Grip Pull Up, Weighted': [3, '48-72 hours', '3.5-5 minutes', 'Balanced'],
  'Machine Supported Pull Ups, Overhand Grip': [2, '24-48 hours', '3-4 minutes', 'Balanced'],
  'Machine Supported Pull Ups, Wide Grip': [2, '24-48 hours', '3-4 minutes', 'Balanced'],
  'Machine Supported Pull Ups, Neutral Grip': [2, '24-48 hours', '3-4 minutes', 'Balanced'],
  'Overhand Grip Pull Up, With Band': [1, '24-48 hours', '2-3 minutes', 'Balanced'],
  'Neutral Grip Pull Up, With Band': [1, '24-48 hours', '2-3 minutes', 'Balanced'],
  'Underhand Grip Pull Up, With Band': [1, '24-48 hours', '2-3 minutes', 'Balanced'],
  'Human Pullover': [2, '24-48 hours', '2-3 minutes', 'Lengthened Bias'],
  'Decline Dumbbell Pullover': [3, '48-72 hours', '2-3 minutes', 'Lengthened Bias'],
  'Standing Cable Pullover Bar': [2, '24-48 hours', '2-3 minutes', 'Lengthened Bias'],
  'Standing Cable Pullover Rope': [2, '24-48 hours', '2-3 minutes', 'Lengthened Bias'],
  'Standing Cable Pullover, Single Arm': [2, '24-48 hours', '2-3 minutes', 'Lengthened Bias'],
}

const out = [header]
const report = { dropped: [], both: [], calibrated: [], vocabFixed: [], uncalibrated: [] }

for (const r0 of rows.slice(1)) {
  const r = r0.slice()
  const name = r[COL.name].trim()

  if (DROP[name]) { report.dropped.push([name, DROP[name]]); continue }

  for (const k of ['p', 's', 't', 'q']) r[COL[k]] = mapMuscleCell(r[COL[k]])

  // vocabulary fixes
  const before = { hyp: r[COL.hyp], sfr: r[COL.sfr], stab: r[COL.stab], axial: r[COL.axial] }
  if (r[COL.hyp].trim() === 'Good') r[COL.hyp] = 'High'
  if (r[COL.sfr].trim() === 'Moderate') r[COL.sfr] = 'Average'
  if (r[COL.stab].trim() === 'Low') r[COL.stab] = 'Unstable'
  if (r[COL.axial].trim() === 'Minor') r[COL.axial] = 'No'
  if (before.hyp !== r[COL.hyp] || before.sfr !== r[COL.sfr] || before.stab !== r[COL.stab] || before.axial !== r[COL.axial]) {
    report.vocabFixed.push(name)
  }

  // laterality -> Can Be Both for merge survivors
  if (SET_BOTH.has(name)) { r[COL.lat] = 'Can Be Both'; report.both.push(name) }

  // row-family axial normalization: every row/pulldown/pull-up/pullover in the
  // mother file is axial=No, including the heaviest free-weight variants
  if (r[COL.axial].trim() !== 'No') r[COL.axial] = 'No'

  // explicit calibration
  const cal = CAL[name]
  if (cal) {
    const [fat, rec, rest, profile] = cal
    r[COL.fat] = String(fat)
    r[COL.rec] = rec
    r[COL.rest] = rest
    r[COL.profile] = profile
    report.calibrated.push(name)
  } else {
    report.uncalibrated.push(name)
  }

  out.push(r)
}

writeFileSync(join(INC, '_newstuff_staging.csv'), out.map((r) => r.map(ser).join(',')).join('\n') + '\n')

const L = []
L.push('# newstuff.csv import — cleaning + calibration report', '')
L.push(`Raw rows: **${rows.length - 1}**. Kept: **${out.length - 1}**. Dropped: **${report.dropped.length}**.`, '')
L.push(`## Dropped rows — ${report.dropped.length}`)
for (const [n, why] of report.dropped) L.push(`- **${n}** — ${why}`)
L.push('', `## Laterality set to "Can Be Both" — ${report.both.length}`)
for (const n of report.both) L.push(`- ${n}`)
L.push('', `## Enum vocabulary fixed (Good->High / Moderate->Average / Low->Unstable / Minor->No) — ${report.vocabFixed.length}`)
for (const n of report.vocabFixed) L.push(`- ${n}`)
L.push('', `## Fatigue/Recovery/Rest/Profile explicitly calibrated — ${report.calibrated.length}`)
L.push('', `## NOT calibrated (unexpected — should be 0) — ${report.uncalibrated.length}`)
for (const n of report.uncalibrated) L.push(`- ${n}`)
writeFileSync(join(INC, '_newstuff_cleaning_report.md'), L.join('\n') + '\n')

console.log(`raw:${rows.length - 1} kept:${out.length - 1} dropped:${report.dropped.length} both:${report.both.length} calibrated:${report.calibrated.length} uncalibrated:${report.uncalibrated.length}`)
if (report.uncalibrated.length) console.log('UNCALIBRATED:', report.uncalibrated.join(' | '))
