// Exercise database lint + build.
//
//   node scripts/lint-exercises.mjs
//
// Reads data/professional_hypertrophy_db_v3.csv, applies the approved
// corrections in data/exercise-overrides.mjs (the raw CSV is never edited),
// validates every row against the canonical taxonomy and a set of consistency
// rules, writes a human report to data/lint-report.md, and emits a normalized,
// ID-stamped data/exercises.candidate.json for review.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { resolveMuscleTerm } from './muscle-taxonomy.mjs'
import { OVERRIDES } from '../data/exercise-overrides.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC_CSV = join(ROOT, 'data', 'professional_hypertrophy_db_v3.csv')
const OUT_JSON = join(ROOT, 'data', 'exercises.candidate.json')
const OUT_REPORT = join(ROOT, 'data', 'lint-report.md')

// ---- tiny CSV parser (handles quoted fields with commas) -------------------
function parseCSV(text) {
  const rows = []
  let row = [], field = '', inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else inQuotes = false }
      else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\r') { /* ignore */ }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else field += c
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows
}

// ---- enum normalization ----------------------------------------------------
const ENUMS = {
  type: { compound: 'compound', isolation: 'isolation', hybrid: 'hybrid' },
  laterality: { bilateral: 'bilateral', unilateral: 'unilateral', 'can be both': 'both' },
  level: { low: 'low', moderate: 'moderate', high: 'high', 'very high': 'very high' },
  stability: {
    'highly unstable': 'highly unstable', unstable: 'unstable', moderate: 'moderate',
    stable: 'stable', 'very stable': 'very stable',
  },
  hypertrophy: { low: 'low', moderate: 'moderate', high: 'high', excellent: 'excellent' },
  sfr: { poor: 'poor', average: 'average', good: 'good', excellent: 'excellent' },
  stretch: { no: 'none', partial: 'partial', yes: 'yes' },
  resistance: { balanced: 'balanced', 'shortened bias': 'shortened', 'lengthened bias': 'lengthened' },
  equipment: { 'free weight': 'free weight', machine: 'machine', cable: 'cable', bodyweight: 'bodyweight' },
  axial: { no: false, yes: true },
}
function normEnum(kind, raw) {
  const key = String(raw || '').trim().toLowerCase()
  return key in ENUMS[kind] ? ENUMS[kind][key] : undefined
}
function parseRange(raw, unit) {
  const nums = String(raw || '').match(/[\d.]+/g)
  if (!nums) return null
  const lo = parseFloat(nums[0]); const hi = nums[1] != null ? parseFloat(nums[1]) : lo
  return unit === 'min' ? [Math.round(lo * 60), Math.round(hi * 60)] : [lo, hi]
}
function slugify(name) {
  return name.toLowerCase().replace(/[()]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// ---- report accumulator ----------------------------------------------------
const findings = { BLOCKER: [], DECISION: [], WARNING: [], NOTICE: [], APPLIED: [] }
const add = (sev, exercise, msg) => findings[sev].push({ exercise, msg })

const MACHINE_HINTS = /\b(machine|lever|smith|pec deck|leg press|leg curl|leg extension|lat pulldown|hack)\b/i
const CABLE_HINTS = /\bcable|pushdown|push-down|crossover|face pull\b/i
const BODYWEIGHT_HINTS = /\b(pull-up|chin-up|push-up|dip|muscle-up|dragon flag|toes to bar|hanging|leg raise|russian twist|sissy)\b/i
const UNILATERAL_HINTS = /\b(one[ -]arm|single[ -]arm|one[ -]leg|single[ -]leg|1[ -]arm|unilateral)\b/i

function main() {
  const rows = parseCSV(readFileSync(SRC_CSV, 'utf8')).filter((r) => r.some((c) => c.trim() !== ''))
  const header = rows[0]
  const EQUIP_IDX = header.findIndex((h) => /stability requirement/i.test(h))
  if (EQUIP_IDX !== -1) add('WARNING', '(schema)', `Column "${header[EQUIP_IDX]}" holds equipment values — read as \`equipment\` and renamed in the output.`)
  add('NOTICE', '(schema)', 'CSV has no "Recovery Impact" column (design doc lists one). Recovery windows kept as PRIORS; a recovery-impact coefficient will live in engine config (fatigue + axial + equipment).')

  const exercises = []
  const seenIds = new Map()
  const usedOverrides = new Set()

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const name = (r[0] || '').trim()
    if (!name) continue

    let id = slugify(name)
    if (seenIds.has(id)) { const n = seenIds.get(id) + 1; seenIds.set(id, n); id = `${id}-${n}` } else seenIds.set(id, 1)
    const ov = OVERRIDES[id] || null

    // ---- muscle contributions (primary/secondary/tertiary = 1 / .5 / .25) ----
    const muscles = {}
    let collapsed = false
    for (const [cell, tw] of [[r[4], 1.0], [r[5], 0.5], [r[6], 0.25]]) {
      if (!cell) continue
      for (const term of cell.split(',')) {
        if (!term.trim()) continue
        const res = resolveMuscleTerm(term, tw)
        if (res.kind === 'unknown') { if (!ov?.muscles) add('BLOCKER', name, `Unknown muscle "${res.term}".`); continue }
        if (res.kind === 'expanded' && !ov?.muscles) add('DECISION', name, `"${term.trim()}" expanded → ${res.pairs.map(([m, w]) => `${m}:${w}`).join(', ')}.`)
        for (const [m, w] of res.pairs) {
          if (muscles[m] != null && res.from && res.to && res.from !== res.to) collapsed = true
          muscles[m] = Math.max(muscles[m] || 0, w)
        }
      }
    }
    if (collapsed && !ov?.muscles) add('DECISION', name, `Triceps heads collapsed to a single "Triceps" contribution.`)

    // ---- raw → normalized draft ----
    const rawByField = {
      type: r[2], laterality: r[3], progressiveOverload: r[9], stability: r[10],
      hypertrophyPotential: r[11], sfr: r[12], stretchMediated: r[13], resistanceProfile: r[14],
      equipment: r[EQUIP_IDX], axialLoading: r[16], skill: r[17],
    }
    const ex = {
      id, name, category: (r[1] || '').trim(),
      type: normEnum('type', r[2]),
      laterality: normEnum('laterality', r[3]),
      muscles,
      fatigueScore: parseInt(r[7], 10),
      recoveryWindowHours: parseRange(r[8], 'hours'),
      restSeconds: parseRange(r[18], 'min'),
      progressiveOverload: normEnum('level', r[9]),
      stability: normEnum('stability', r[10]),
      hypertrophyPotential: normEnum('hypertrophy', r[11]),
      sfr: normEnum('sfr', r[12]),
      stretchMediated: normEnum('stretch', r[13]),
      resistanceProfile: normEnum('resistance', r[14]),
      equipment: normEnum('equipment', r[EQUIP_IDX]),
      axialLoading: normEnum('axial', r[16]),
      skill: normEnum('level', r[17]),
      notes: (r[19] || '').trim() || null,
    }

    // ---- apply approved override (raw CSV stays pristine) ----
    if (ov) {
      usedOverrides.add(id)
      for (const [k, v] of Object.entries(ov)) {
        if (k.startsWith('_')) continue
        ex[k] = v // `muscles` fully replaces; scalars patch
      }
      add('APPLIED', name, ov._reason || 'override applied')
    }

    // ---- validate FINAL object (post-override) ----
    for (const k of Object.keys(rawByField)) {
      if (ex[k] === undefined) add('BLOCKER', name, `Invalid ${k} value "${(rawByField[k] || '').trim()}".`)
    }
    if (!(ex.fatigueScore >= 1 && ex.fatigueScore <= 5)) add('BLOCKER', name, `Fatigue score out of range 1–5.`)
    if (!Object.keys(ex.muscles).length) add('BLOCKER', name, `No muscle contributions resolved.`)

    // ---- consistency / likely-error checks (on FINAL object) ----
    if (ex.equipment === 'free weight' && MACHINE_HINTS.test(name)) add('WARNING', name, `Equipment "free weight" but name looks like a machine.`)
    if (ex.equipment === 'free weight' && CABLE_HINTS.test(name) && !MACHINE_HINTS.test(name)) add('WARNING', name, `Equipment "free weight" but name looks cable-based.`)
    if (ex.laterality === 'bilateral' && UNILATERAL_HINTS.test(name)) add('WARNING', name, `Name implies single-limb but laterality is "bilateral".`)
    if (ex.fatigueScore <= 1 && ex.restSeconds && ex.restSeconds[0] >= 210) add('WARNING', name, `Fatigue ${ex.fatigueScore} but rest ${r[18]} — they disagree.`)
    if (ex.fatigueScore >= 5 && ex.type === 'isolation') add('WARNING', name, `Isolation with max fatigue (5) — check.`)
    if (/wrist curl/i.test(name) && ex.muscles['Brachioradialis'] && !ex.muscles['Wrist Flexors'] && !ex.muscles['Wrist Extensors']) add('WARNING', name, `Wrist-curl mapped to Brachioradialis — should be wrist flexors/extensors.`)
    if (BODYWEIGHT_HINTS.test(name) && ex.equipment === 'free weight') add('NOTICE', name, `Bodyweight-pattern movement stored as "free weight".`)

    exercises.push(ex)
  }

  for (const id of Object.keys(OVERRIDES)) if (!usedOverrides.has(id)) add('WARNING', '(overrides)', `Override for "${id}" matched no exercise — stale id?`)

  writeOutputs(exercises)
}

function writeOutputs(exercises) {
  const payload = { version: 1, generatedAt: new Date().toISOString().slice(0, 10), count: exercises.length, exercises }
  writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2) + '\n')

  const c = Object.fromEntries(Object.entries(findings).map(([k, v]) => [k, v.length]))
  const L = []
  L.push('# Exercise DB lint report', '')
  L.push(`Parsed **${exercises.length}** exercises. **${c.BLOCKER}** blockers · **${c.APPLIED}** fixes applied · **${c.DECISION}** decisions · **${c.WARNING}** warnings · **${c.NOTICE}** notices.`, '')
  const titles = {
    BLOCKER: '🔴 Blockers — data invalid until fixed',
    APPLIED: '🟢 Fixes applied (via data/exercise-overrides.mjs)',
    DECISION: '🟣 Taxonomy decisions (approved)',
    WARNING: '🟠 Warnings — remaining, worth a look',
    NOTICE: '⚪ Notices',
  }
  for (const sev of ['BLOCKER', 'APPLIED', 'DECISION', 'WARNING', 'NOTICE']) {
    L.push(`## ${titles[sev]}`, '')
    if (!findings[sev].length) { L.push('_None._', ''); continue }
    if (sev === 'DECISION' || sev === 'NOTICE') {
      const byMsg = new Map()
      for (const f of findings[sev]) { if (!byMsg.has(f.msg)) byMsg.set(f.msg, []); byMsg.get(f.msg).push(f.exercise) }
      for (const [msg, list] of byMsg) {
        const u = [...new Set(list)]
        L.push(u.length > 4 ? `- ${msg} _(${u.length}× — e.g. ${u.slice(0, 4).join(', ')}…)_` : `- ${msg} _(${u.join(', ')})_`)
      }
    } else {
      for (const f of findings[sev]) L.push(`- **${f.exercise}** — ${f.msg}`)
    }
    L.push('')
  }
  writeFileSync(OUT_REPORT, L.join('\n'))
  console.log(`Parsed ${exercises.length} exercises.`)
  console.log(`  blockers:${c.BLOCKER}  applied:${c.APPLIED}  decisions:${c.DECISION}  warnings:${c.WARNING}  notices:${c.NOTICE}`)
  console.log(`  → ${OUT_JSON}`)
  console.log(`  → ${OUT_REPORT}`)
}

main()
