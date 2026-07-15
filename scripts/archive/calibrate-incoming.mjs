// ARCHIVED 2026-07-15: one-off, already run — the 51-row back-exercise batch
// this staged is long since merged into the mother CSV. Kept for reference
// only; paths below assume this file's archived location (scripts/archive/).
//
// Stage 2 of the incoming merge: read data/incoming/_combined_staging.csv
// (deterministically cleaned by combine-incoming.mjs), drop the 3 confirmed
// redundant rows, fix the enum-vocabulary errors the source AIs introduced,
// and recalibrate the engine-critical judgment columns (Fatigue / Recovery /
// Rest) + re-rate Resistance Profile into our vocabulary — all anchored to the
// mother file's rubric (data/recovery-rubric.md, sfr-rubric.md). Writes
// data/incoming/_calibrated_staging.csv. Nothing is merged here.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const INC = join(ROOT, 'data', 'incoming')

function parseCSV(t) {
  const rows = []; let row = [], f = '', q = false
  for (let i = 0; i < t.length; i++) { const c = t[i]
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++ } else q = false } else f += c }
    else if (c === '"') q = true
    else if (c === ',') { row.push(f); f = '' }
    else if (c === '\r') {}
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = '' }
    else f += c }
  if (f.length || row.length) { row.push(f); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}
const ser = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
const has = (s, re) => re.test(String(s).toLowerCase())

const DROP = new Set(['Barbell Back Squat', 'Adduction Machine', 'Seated Single Leg Curl Machine'])

const rows = parseCSV(readFileSync(join(INC, '_combined_staging.csv'), 'utf8'))
const H = rows[0]
const col = (re) => H.findIndex((h) => re.test(h.trim()))
const I = {
  name: col(/^exercise name$/i), type: col(/exercise type/i), lat: col(/laterality/i),
  p: col(/primary/i), s: col(/secondary/i),
  fat: col(/fatigue score/i), rec: col(/recovery window/i), overload: col(/progressive overload/i),
  stab: col(/^stability$/i), hyp: col(/hypertrophy potential/i), sfr: col(/sfr|stimulus/i),
  stretch: col(/stretch-mediated/i), profile: col(/resistance profile/i), equip: col(/stability requirement/i),
  axial: col(/axial/i), skill: col(/skill/i), rest: col(/rest time/i), notes: col(/notes/i),
}

// ---- fatigue recalibration (our 1–5 scale, anchored to mother file) ----
function calcFatigue(name, type, equip, axial) {
  const n = name.toLowerCase()
  if (equip === 'Free Weight' && has(n, /deadlift|stiff leg|stiff-leg|good morning/)) return 5
  if (equip === 'Free Weight' && has(n, /back squat|front squat/)) return 5
  if (has(n, /bulgarian|split squat/)) return equip === 'Bodyweight' ? 3 : 5
  if (axial && equip === 'Free Weight') return 4 // other axial barbell squat/press/lunge patterns
  if (type === 'Isolation') return has(n, /skull crusher|overhead.*extension/) ? 2 : 1
  if (type === 'Isometric') return 1
  // compounds, non-axial
  if (equip === 'Bodyweight') return has(n, /pistol|jump|plyo|muscle-up/) ? 3 : has(n, /pull|dip/) ? 2 : 1
  if (equip === 'Resistance Band') return 1
  if (equip === 'Machine' || equip === 'Cable') return has(n, /squat|hack|pendulum|leg press/) ? 3 : 2
  // free-weight compound, non-axial (goblet/DB/kettlebell press/row/hinge, floor press…)
  return has(n, /squat|lunge|hip thrust|swing|clean|step up|good morning/) ? 3 : 2
}
// ---- recovery window band from fatigue + pattern (long windows gated behind
// fatigue ≥4 so a light machine "good morning" variant doesn't inherit a
// 72-96h heavy-hinge window) ----
function calcRecovery(fat, name, axial) {
  const n = name.toLowerCase()
  if (fat >= 5 && has(n, /deadlift|trap bar|sumo/)) return '72-120 hours'
  if (fat >= 4 && has(n, /romanian|stiff leg|good morning|deadlift/)) return '72-96 hours'
  return { 1: '24-48 hours', 2: '24-48 hours', 3: '48-72 hours', 4: '48-72 hours', 5: '48-72 hours' }[fat]
}
// ---- rest band from fatigue + axial ----
function calcRest(fat, axial, type) {
  if (fat >= 5) return '4-7 minutes'
  if (fat === 4) return axial ? '4-6 minutes' : '3-4 minutes'
  if (fat === 3) return '3-4 minutes'
  return '2-3 minutes'
}
// ---- resistance profile → our vocabulary (Balanced default) ----
function calcProfile(name, stretch) {
  const n = name.toLowerCase()
  if (has(n, /romanian|stiff leg|good morning|overhead.*(tricep|extension)|incline.*(curl|fly)|\bfly\b|sissy|pullover|cossack|copenhagen|bulgarian|split squat|deep|goblet|hack squat|pendulum|^landmine squat|barbell (back|front) squat|^squat|lunge/)) return 'Lengthened Bias'
  if (has(n, /kickback|kick back|front raise|lateral raise|shrug|hip thrust|glute bridge|concentration|upright row|y-raise|t-raise|calf raise/)) return 'Shortened Bias'
  return 'Balanced'
}

const out = [H]
let dropped = 0
for (const r0 of rows.slice(1)) {
  const r = r0.slice()
  const name = r[I.name].trim()
  if (DROP.has(name)) { dropped++; continue }

  // enum-vocabulary fixes (source AIs mixed column vocabularies)
  if (has(r[I.hyp], /^good$/)) r[I.hyp] = 'High'          // Hypertrophy has no "Good"
  if (has(r[I.sfr], /^moderate$/)) r[I.sfr] = 'Average'   // SFR has no "Moderate"
  if (has(r[I.sfr], /^low$/)) r[I.sfr] = 'Poor'           // SFR has no "Low"
  if (has(r[I.stab], /^low$/)) r[I.stab] = 'Unstable'     // Stability has no "Low"
  if (has(r[I.axial], /minor/)) r[I.axial] = 'No'

  const type = r[I.type].trim()
  const equip = r[I.equip].trim()
  const axial = has(r[I.axial], /yes/)

  // recalibrate engine-critical columns
  const fat = calcFatigue(name, type, equip, axial)
  r[I.fat] = String(fat)
  r[I.rec] = calcRecovery(fat, name, axial)
  r[I.rest] = calcRest(fat, axial, type)
  r[I.profile] = calcProfile(name, r[I.stretch])

  out.push(r)
}

writeFileSync(join(INC, '_calibrated_staging.csv'), out.map((r) => r.map(ser).join(',')).join('\n') + '\n')
console.log(`calibrated ${out.length - 1} rows (dropped ${dropped} confirmed-redundant).`)
