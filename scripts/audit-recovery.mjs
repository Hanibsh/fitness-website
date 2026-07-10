// Consistency audit for the engine's core columns: Fatigue Score,
// Estimated Recovery Window, Recommended Rest Time.
//
//   node scripts/audit-recovery.mjs
//
// Reads the built data/exercises.candidate.json (run `npm run build:exercises`
// first so overrides are applied) and checks every row against the 8
// cross-column consistency rules from data/recovery-rubric.md §5. Reports
// every violation; does not write anything. Step 2 of the fact-check plan
// (see memory: data-factcheck).

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CANDIDATE = join(ROOT, 'data', 'exercises.candidate.json')

const { exercises } = JSON.parse(readFileSync(CANDIDATE, 'utf8'))

const STANDARD_WINDOWS = new Set(['24,48', '36,60', '48,72', '48,96', '72,96', '72,120'])
const mins = (sec) => sec / 60

const flags = []
const flag = (ex, rule, detail) => flags.push({ id: ex.id, name: ex.name, rule, detail })

for (const ex of exercises) {
  const [wLo, wHi] = ex.recoveryWindowHours
  const [rLo, rHi] = ex.restSeconds
  const f = ex.fatigueScore

  // R1 — fatigue <-> window
  if (f === 1 && wHi > 48) flag(ex, 'R1 fatigue↔window', `fatigue 1 but window ${wLo}-${wHi}h (expect ≤48h)`)
  if (f === 5 && wHi < 48) flag(ex, 'R1 fatigue↔window', `fatigue 5 but window ${wLo}-${wHi}h (expect ≥48h)`)
  if (f >= 4 && wHi <= 48) flag(ex, 'R1 fatigue↔window', `fatigue ${f} but window ${wLo}-${wHi}h (expect >48h)`)
  if (f <= 3 && wLo >= 72) flag(ex, 'R1 fatigue↔window', `fatigue ${f} but window ${wLo}-${wHi}h (that window implies fatigue ≥4)`)

  // R2 — fatigue <-> rest
  if (f >= 4 && rLo < 180) flag(ex, 'R2 fatigue↔rest', `fatigue ${f} but rest ${mins(rLo)}-${mins(rHi)}min (expect ≥3min)`)
  if (f === 1 && rLo >= 210) flag(ex, 'R2 fatigue↔rest', `fatigue 1 but rest ${mins(rLo)}-${mins(rHi)}min (expect <3.5min)`)

  // R3 — window <-> rest
  if (wLo >= 72 && rLo < 180) flag(ex, 'R3 window↔rest', `window ${wLo}-${wHi}h but rest ${mins(rLo)}-${mins(rHi)}min (big-lift window, short rest)`)
  if (rLo >= 240 && wHi <= 48) flag(ex, 'R3 window↔rest', `rest ${mins(rLo)}-${mins(rHi)}min but window ${wLo}-${wHi}h (long rest, short window)`)

  // R4 — axial loading <-> everything
  if (ex.axialLoading) {
    if (f < 3) flag(ex, 'R4 axial↔fatigue', `axial loading but fatigue ${f} (expect ≥3)`)
    if (wHi <= 48) flag(ex, 'R4 axial↔window', `axial loading but window ${wLo}-${wHi}h (expect >48h)`)
    if (rLo < 180) flag(ex, 'R4 axial↔rest', `axial loading but rest ${mins(rLo)}-${mins(rHi)}min (expect ≥3min)`)
  }

  // R5 — equipment <-> fatigue (stability should lower systemic cost)
  if ((ex.equipment === 'machine' || ex.equipment === 'cable') && f === 5) {
    flag(ex, 'R5 equipment↔fatigue', `${ex.equipment} equipment but fatigue 5 (suspect copy-paste)`)
  }

  // R6 — type <-> fatigue
  if (ex.type === 'isolation' && f >= 4 && !ex.axialLoading) {
    flag(ex, 'R6 type↔fatigue', `isolation, non-axial, but fatigue ${f} (needs a specific reason)`)
  }

  // R8 — window is one of the standard archetype bands
  if (!STANDARD_WINDOWS.has(`${wLo},${wHi}`)) {
    flag(ex, 'R8 non-standard window', `window ${wLo}-${wHi}h isn't a recognized archetype band`)
  }
}

// R7 — near-duplicate divergence: group by (primary muscle, type, equipment),
// flag groups whose fatigue score spans more than 1 point.
const groups = new Map()
for (const ex of exercises) {
  const primary = Object.entries(ex.muscles).sort((a, b) => b[1] - a[1])[0]?.[0] || '?'
  const key = `${primary}|${ex.type}|${ex.equipment}`
  if (!groups.has(key)) groups.set(key, [])
  groups.get(key).push(ex)
}
for (const [key, group] of groups) {
  if (group.length < 2) continue
  const scores = group.map((e) => e.fatigueScore)
  if (Math.max(...scores) - Math.min(...scores) >= 2) {
    for (const ex of group) {
      flag(ex, 'R7 near-duplicate divergence', `group [${key}] fatigue spans ${Math.min(...scores)}-${Math.max(...scores)} (${group.map((e) => `${e.name}:${e.fatigueScore}`).join(', ')})`)
    }
  }
}

console.log(`${exercises.length} exercises checked, ${flags.length} flags raised.\n`)
const byRule = new Map()
for (const fl of flags) { if (!byRule.has(fl.rule)) byRule.set(fl.rule, []); byRule.get(fl.rule).push(fl) }
for (const [rule, list] of [...byRule.entries()].sort()) {
  console.log(`\n=== ${rule} (${list.length}) ===`)
  for (const fl of list) console.log(`  ${fl.name} [${fl.id}] — ${fl.detail}`)
}
