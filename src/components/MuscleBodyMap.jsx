import { useMemo } from 'react'
import InteractiveAnatomy from './InteractiveAnatomy'
import { zoneSlugForEngineMuscle } from '../data/anatomyRegions'

// The dashboard's body map: the same labelled anatomy art as the exercise bank,
// with each muscle's label tinted by how recovered it is, or how much volume
// it's getting. It's a glance, not a ledger — the lists under it stay the
// authoritative read (and are the only place "Upper Back" appears, since the art
// has no label for it).
//
// The art is coarser than the engine, so several muscles can share one label
// (the three delts → "Shoulders"; Abs + Obliques → "Core"). Where that happens
// we surface the WORST constituent rather than an average: a map that says
// "shoulders are fine" while your rear delts are shredded would be actively
// misleading. The tooltip always names the constituents so the merge is visible.

// Matches the Recovery list's own colours (bg-green-500 / bg-amber-400), so the
// map and the rows beneath it can't tell different stories. Alpha carries the
// magnitude: the more fatigued, the more solid the chip.
const READY = '34, 197, 94'
const RECOVERING = '251, 191, 36'

function recoveryFill(pct, ready) {
  if (ready) return `rgba(${READY}, 0.8)`
  // 89% recovered → barely there; 0% → full strength
  const alpha = 0.3 + 0.65 * (1 - Math.max(0, Math.min(100, pct)) / 100)
  return `rgba(${RECOVERING}, ${alpha.toFixed(2)})`
}

// Volume tiers, coloured like the volume list's bars (TIER_BAR in Dashboard).
// `rank` is how far a tier is from where you'd want to be, and drives the merge:
// the worst constituent wins the shared label.
const TIER_FILL = {
  prime: { fill: 'rgba(34, 197, 94, 0.8)', rank: 0 },
  solid: { fill: 'rgba(34, 197, 94, 0.55)', rank: 1 },
  taxing: { fill: 'rgba(251, 191, 36, 0.75)', rank: 2 },
  under: { fill: 'rgba(251, 191, 36, 0.9)', rank: 3 },
  excess: { fill: 'rgba(239, 68, 68, 0.85)', rank: 4 },
}

const NONE = 'rgba(120, 120, 130, 0.4)'

// Group engine-muscle rows by the label zone they land on, dropping the ones the
// art can't show.
function byZone(rows) {
  const out = {}
  for (const row of rows) {
    const slug = zoneSlugForEngineMuscle(row.muscle)
    if (!slug) continue
    ;(out[slug] ||= []).push(row)
  }
  return out
}

// `recovery.muscles` from lib/engine.js → { slug: { fill, title } }.
function recoveryValues(muscles) {
  const values = {}
  for (const [slug, group] of Object.entries(byZone(muscles))) {
    const worst = group.reduce((a, b) => (b.recoveryPct < a.recoveryPct ? b : a))
    const detail = group.map((m) => `${m.muscle} ${m.recoveryPct}%`).join(' · ')
    values[slug] = {
      fill: recoveryFill(worst.recoveryPct, worst.status === 'ready'),
      title: group.length > 1 ? `${detail} — showing the least recovered` : detail,
    }
  }
  return values
}

// `effectiveWeeklyVolume()` rows from lib/engine.js → { slug: { fill, title } }.
function volumeValues(rows) {
  const values = {}
  for (const [slug, group] of Object.entries(byZone(rows))) {
    const worst = group.reduce((a, b) =>
      (TIER_FILL[b.status]?.rank ?? 0) > (TIER_FILL[a.status]?.rank ?? 0) ? b : a
    )
    const detail = group.map((m) => `${m.muscle} ${m.sets} sets · ${m.tier?.label || '—'}`).join(' · ')
    const total = group.reduce((s, m) => s + m.sets, 0)
    values[slug] = {
      fill: total === 0 ? NONE : (TIER_FILL[worst.status]?.fill || NONE),
      title: group.length > 1 ? `${detail} — showing the most extreme` : detail,
    }
  }
  return values
}

const RECOVERY_KEY = [
  { fill: `rgba(${READY}, 0.8)`, label: 'Ready' },
  { fill: `rgba(${RECOVERING}, 0.45)`, label: 'Nearly there' },
  { fill: `rgba(${RECOVERING}, 0.9)`, label: 'Still recovering' },
]

const VOLUME_KEY = [
  { fill: TIER_FILL.prime.fill, label: 'High efficiency' },
  { fill: TIER_FILL.solid.fill, label: 'Productive' },
  { fill: TIER_FILL.under.fill, label: 'Below min / low efficiency' },
  { fill: TIER_FILL.excess.fill, label: 'Heavily diminished' },
]

function Key({ items }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 mt-3">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5 text-[11px] text-text-muted">
          <span className="w-3 h-3 border border-border" style={{ background: i.fill }} />
          {i.label}
        </span>
      ))}
    </div>
  )
}

export default function MuscleBodyMap({ mode, recovery, volume }) {
  const values = useMemo(
    () => (mode === 'volume' ? volumeValues(volume) : recoveryValues(recovery.muscles)),
    [mode, recovery, volume]
  )
  return (
    <div>
      <InteractiveAnatomy values={values} />
      <Key items={mode === 'volume' ? VOLUME_KEY : RECOVERY_KEY} />
    </div>
  )
}
