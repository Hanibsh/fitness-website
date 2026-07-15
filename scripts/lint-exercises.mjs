// Exercise database lint + build.
//
//   node scripts/lint-exercises.mjs
//
// Reads data/professional_hypertrophy_db_v4.csv, applies the approved
// corrections in data/exercise-overrides.mjs (the raw CSV is never edited),
// validates every row against the canonical taxonomy and a set of consistency
// rules, writes a human report to data/lint-report.md, and emits a normalized,
// ID-stamped data/exercises.candidate.json for review.
//
// Columns are matched by HEADER NAME (see resolveColumns), so the CSV can be
// safely re-ordered or extended. Muscle contributions are read from the
// Primary/Secondary/Tertiary/Quaternary columns at weights 1 / .5 / .25 / .125
// (Quaternary is optional) — a term can override its column's default weight
// with "Muscle:0.75" syntax (see parseTermWeight). See data/README.md.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { resolveMuscleTerm, HOME_CATEGORIES } from './muscle-taxonomy.mjs'
import { OVERRIDES } from '../data/exercise-overrides.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC_CSV = join(ROOT, 'data', 'professional_hypertrophy_db_v4.csv')
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
  type: { compound: 'compound', isolation: 'isolation', hybrid: 'hybrid', isometric: 'isometric' },
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
  equipment: { 'free weight': 'free weight', machine: 'machine', cable: 'cable', bodyweight: 'bodyweight', 'resistance band': 'resistance band' },
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

// A muscle term in any tier column normally just uses that column's default
// weight (Primary 1.0, Secondary 0.5, ...). Optionally, write "Muscle:0.75" to
// give THAT muscle a custom weight instead — any value in (0, 1] — without
// touching the column's default for every other muscle in the cell.
function parseTermWeight(rawTerm, defaultWeight) {
  const trimmed = rawTerm.trim()
  const m = trimmed.match(/^(.+?):\s*([\d.]+)\s*$/)
  if (!m) return { term: trimmed, weight: defaultWeight, overridden: false }
  return { term: m[1].trim(), weight: parseFloat(m[2]), overridden: true, raw: m[2] }
}

// ---- report accumulator ----------------------------------------------------
const findings = { BLOCKER: [], DECISION: [], WARNING: [], NOTICE: [], APPLIED: [] }
const add = (sev, exercise, msg) => findings[sev].push({ exercise, msg })

const MACHINE_HINTS = /\b(machine|lever|smith|pec deck|leg press|leg curl|leg extension|lat pulldown|hack)\b/i
const CABLE_HINTS = /\bcable|pushdown|push-down|crossover|face pull\b/i
const BODYWEIGHT_HINTS = /\b(pull-up|chin-up|push-up|dip|muscle-up|dragon flag|toes to bar|hanging|leg raise|russian twist|sissy)\b/i
const UNILATERAL_HINTS = /\b(one[ -]arm|single[ -]arm|one[ -]leg|single[ -]leg|1[ -]arm|unilateral)\b/i

// Resolve columns by HEADER NAME, not fixed position, so editing the CSV
// (adding a Quaternary column, reordering, renaming) can't silently misalign
// the parse. Required columns throw a clear error if missing; optional ones
// resolve to -1.
function resolveColumns(header) {
  const idx = (re) => header.findIndex((h) => re.test(h.trim()))
  const need = (re, label) => {
    const i = idx(re)
    if (i === -1) throw new Error(`CSV is missing a required column: ${label}`)
    return i
  }
  return {
    name: need(/^exercise name$/i, 'Exercise Name'),
    category: need(/^(home )?category$/i, 'Home Category'),
    subCategory: idx(/^sub ?category$/i), // optional — -1 when absent
    type: need(/exercise type/i, 'Exercise Type'),
    laterality: need(/laterality/i, 'Laterality'),
    primary: need(/primary muscle/i, 'Primary Muscles'),
    secondary: need(/secondary muscle/i, 'Secondary Muscles'),
    tertiary: need(/tertiary muscle/i, 'Tertiary Muscles'),
    quaternary: idx(/quaternary muscle/i), // optional — -1 when absent
    fatigue: need(/fatigue score/i, 'Fatigue Score'),
    recovery: need(/recovery window/i, 'Estimated Recovery Window'),
    overload: need(/progressive overload/i, 'Progressive Overload Potential'),
    stability: need(/^stability$/i, 'Stability'),
    hypertrophy: need(/hypertrophy potential/i, 'Hypertrophy Potential'),
    sfr: need(/sfr|stimulus-to-fatigue/i, 'Stimulus-to-Fatigue Ratio'),
    stretch: need(/stretch-mediated/i, 'Stretch-Mediated Hypertrophy'),
    resistance: need(/resistance profile/i, 'Resistance Profile'),
    equipment: need(/^equipment$|stability requirement/i, 'Equipment'),
    axial: need(/axial/i, 'Axial Loading'),
    skill: need(/skill/i, 'Skill Requirement'),
    rest: need(/rest time/i, 'Recommended Rest Time'),
    notes: idx(/notes/i), // optional
    // Optional media columns — reserved for the exercise bank's future movement
    // clips / thumbnails (Leon's own recordings). Absent for now; a filled cell
    // flows straight to the JSON with no schema change.
    video: idx(/video( url)?/i),
    thumbnail: idx(/thumbnail/i),
  }
}

function main() {
  const rows = parseCSV(readFileSync(SRC_CSV, 'utf8')).filter((r) => r.some((c) => c.trim() !== ''))
  const header = rows[0]
  const COL = resolveColumns(header)
  if (/stability requirement/i.test(header[COL.equipment] || '')) add('WARNING', '(schema)', `Column "${header[COL.equipment].trim()}" holds equipment values — read as \`equipment\` and renamed in the output.`)
  add('NOTICE', '(schema)', 'CSV has no "Recovery Impact" column (design doc lists one). Recovery windows kept as PRIORS; a recovery-impact coefficient will live in engine config (fatigue + axial + equipment).')

  const exercises = []
  const seenIds = new Map()
  const usedOverrides = new Set()

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const name = (r[COL.name] || '').trim()
    if (!name) continue

    let id = slugify(name)
    if (seenIds.has(id)) { const n = seenIds.get(id) + 1; seenIds.set(id, n); id = `${id}-${n}` } else seenIds.set(id, 1)
    const ov = OVERRIDES[id] || null

    // ---- muscle contributions (primary/secondary/tertiary/quaternary = 1 / .5 / .25 / .125) ----
    const muscles = {}
    let collapsed = false
    const tiers = [[r[COL.primary], 1.0], [r[COL.secondary], 0.5], [r[COL.tertiary], 0.25]]
    if (COL.quaternary !== -1) tiers.push([r[COL.quaternary], 0.125])
    for (const [cell, tw] of tiers) {
      if (!cell) continue
      for (const rawTerm of cell.split(',')) {
        if (!rawTerm.trim()) continue
        const { term, weight, overridden, raw } = parseTermWeight(rawTerm, tw)
        if (overridden && !(weight > 0 && weight <= 1)) {
          if (!ov?.muscles) add('BLOCKER', name, `Invalid custom weight "${raw}" for "${term}" — must be greater than 0 and at most 1.`)
          continue
        }
        const res = resolveMuscleTerm(term, weight)
        if (res.kind === 'unknown') { if (!ov?.muscles) add('BLOCKER', name, `Unknown muscle "${res.term}".`); continue }
        if (res.kind === 'expanded' && !ov?.muscles) add('DECISION', name, `"${term}" expanded → ${res.pairs.map(([m, w]) => `${m}:${w}`).join(', ')}.`)
        if (overridden && !ov?.muscles) add('DECISION', name, `"${term}" given custom weight ${weight} (column default ${tw}).`)
        for (const [m, w] of res.pairs) {
          if (muscles[m] != null && res.from && res.to && res.from !== res.to) collapsed = true
          muscles[m] = Math.max(muscles[m] || 0, w)
        }
      }
    }
    if (collapsed && !ov?.muscles) add('DECISION', name, `Triceps heads collapsed to a single "Triceps" contribution.`)

    // ---- raw → normalized draft ----
    const rawByField = {
      type: r[COL.type], laterality: r[COL.laterality], progressiveOverload: r[COL.overload], stability: r[COL.stability],
      hypertrophyPotential: r[COL.hypertrophy], sfr: r[COL.sfr], stretchMediated: r[COL.stretch], resistanceProfile: r[COL.resistance],
      equipment: r[COL.equipment], axialLoading: r[COL.axial], skill: r[COL.skill],
    }
    const ex = {
      id, name, category: (r[COL.category] || '').trim(),
      subCategory: (COL.subCategory !== -1 ? (r[COL.subCategory] || '').trim() : '') || null,
      type: normEnum('type', r[COL.type]),
      laterality: normEnum('laterality', r[COL.laterality]),
      muscles,
      fatigueScore: parseInt(r[COL.fatigue], 10),
      recoveryWindowHours: parseRange(r[COL.recovery], 'hours'),
      restSeconds: parseRange(r[COL.rest], 'min'),
      progressiveOverload: normEnum('level', r[COL.overload]),
      stability: normEnum('stability', r[COL.stability]),
      hypertrophyPotential: normEnum('hypertrophy', r[COL.hypertrophy]),
      sfr: normEnum('sfr', r[COL.sfr]),
      stretchMediated: normEnum('stretch', r[COL.stretch]),
      resistanceProfile: normEnum('resistance', r[COL.resistance]),
      equipment: normEnum('equipment', r[COL.equipment]),
      axialLoading: normEnum('axial', r[COL.axial]),
      skill: normEnum('level', r[COL.skill]),
      notes: (COL.notes !== -1 ? (r[COL.notes] || '').trim() : '') || null,
      video: (COL.video !== -1 ? (r[COL.video] || '').trim() : '') || null,
      thumbnail: (COL.thumbnail !== -1 ? (r[COL.thumbnail] || '').trim() : '') || null,
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
    if (ex.fatigueScore <= 1 && ex.restSeconds && ex.restSeconds[0] >= 210) add('WARNING', name, `Fatigue ${ex.fatigueScore} but rest ${r[COL.rest]} — they disagree.`)
    if (ex.fatigueScore >= 5 && ex.type === 'isolation') add('WARNING', name, `Isolation with max fatigue (5) — check.`)
    if (/wrist curl/i.test(name) && ex.muscles['Brachioradialis'] && !ex.muscles['Wrist Flexors'] && !ex.muscles['Wrist Extensors']) add('WARNING', name, `Wrist-curl mapped to Brachioradialis — should be wrist flexors/extensors.`)
    if (BODYWEIGHT_HINTS.test(name) && ex.equipment === 'free weight') add('NOTICE', name, `Bodyweight-pattern movement stored as "free weight".`)
    if (ex.category && !HOME_CATEGORIES.has(ex.category)) add('WARNING', name, `Home Category "${ex.category}" isn't recognized by the app yet (no search boost, can't be a specialization-block focus). Ask Claude to add code support for it if this is intentional.`)

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
