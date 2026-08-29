// Donut of hard sets per muscle group — hand-rolled inline SVG, same
// convention as ProgressChart (no chart library). Colors are entity-anchored
// through the --color-muscle-* theme tokens (each theme's steps are validated
// for CVD separation and contrast in index.css), slices are separated by a
// 2px card-surface gap, and the legend carries name + sets + share for every
// slice, so identity never rests on color alone.

const MUSCLE_COLOR = {
  Chest: 'var(--color-muscle-chest)',
  Back: 'var(--color-muscle-back)',
  Shoulders: 'var(--color-muscle-shoulders)',
  Biceps: 'var(--color-muscle-biceps)',
  Triceps: 'var(--color-muscle-triceps)',
  Forearms: 'var(--color-muscle-forearms)',
  Quads: 'var(--color-muscle-quads)',
  Hamstrings: 'var(--color-muscle-hamstrings)',
  Glutes: 'var(--color-muscle-glutes)',
  Adductors: 'var(--color-muscle-adductors)',
  Calves: 'var(--color-muscle-calves)',
  Abs: 'var(--color-muscle-abs)',
}

const CX = 100
const CY = 100
const R_OUT = 80
const R_IN = 50

// Angle 0 = 12 o'clock, increasing clockwise.
function polar(r, angle) {
  return [CX + r * Math.sin(angle), CY - r * Math.cos(angle)]
}

function segmentPath(a0, a1) {
  const large = a1 - a0 > Math.PI ? 1 : 0
  const [x0, y0] = polar(R_OUT, a0)
  const [x1, y1] = polar(R_OUT, a1)
  const [x2, y2] = polar(R_IN, a1)
  const [x3, y3] = polar(R_IN, a0)
  return `M ${x0} ${y0} A ${R_OUT} ${R_OUT} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${R_IN} ${R_IN} 0 ${large} 0 ${x3} ${y3} Z`
}

// items: [{ muscle, label, value }], pre-sorted biggest-first, values > 0.
// `muscle` is the internal group name (keys of MUSCLE_COLOR); `label` is the
// display name (e.g. Abs shown as Core).
// `compact` is for the places several of these sit on one screen — the split
// designer draws one per training day. Smaller ring, legend cut to the slices
// that carry the day, the rest folded into one line. The full form is unchanged.
const COMPACT_LEGEND_ROWS = 4

export default function MuscleDonut({ items, unitLabel = 'hard sets', compact = false }) {
  // Rounded for display: plan volumes are CONTRIBUTION-WEIGHTED, so they carry
  // decimals and their sum carries float error — the dashboard only ever fed
  // this whole numbers, so "53.39999999999999 sets" first showed up when the
  // split designer started drawing weighted rows.
  const raw = items.reduce((a, x) => a + x.value, 0)
  const total = Math.round(raw * 10) / 10
  if (!raw) return null
  const pct = (v) => Math.round((v / raw) * 100)
  let acc = 0
  const segs = items.map((x) => {
    const a0 = (acc / total) * 2 * Math.PI
    acc += x.value
    const a1 = (acc / total) * 2 * Math.PI
    return { ...x, a0, a1 }
  })
  // The legend is trimmed, never the chart: every slice is still drawn and still
  // in the aria-label, so nothing disappears from the picture or from a screen
  // reader — only the written-out list gets shorter.
  const legend = compact ? items.slice(0, COMPACT_LEGEND_ROWS) : items
  const rest = items.length - legend.length
  const restValue = items.slice(legend.length).reduce((a, x) => a + x.value, 0)

  return (
    <div className={compact ? 'flex items-center gap-3' : 'flex flex-col sm:flex-row sm:items-center gap-5'}>
      <svg
        viewBox="0 0 200 200"
        role="img"
        aria-label={`${total} ${unitLabel}: ${items.map((x) => `${x.label} ${pct(x.value)}%`).join(', ')}`}
        className={compact ? 'w-20 h-20 shrink-0' : 'w-40 h-40 mx-auto sm:mx-0 shrink-0'}
      >
        {items.length === 1 ? (
          // A single slice degenerates the 360° arc math — draw a plain ring.
          <circle cx={CX} cy={CY} r={(R_OUT + R_IN) / 2} fill="none" stroke={MUSCLE_COLOR[items[0].muscle]} strokeWidth={R_OUT - R_IN}>
            <title>{`${items[0].label} — ${items[0].value} ${unitLabel} · 100%`}</title>
          </circle>
        ) : (
          segs.map((s) => (
            <path key={s.muscle} d={segmentPath(s.a0, s.a1)} fill={MUSCLE_COLOR[s.muscle]} stroke="var(--color-white)" strokeWidth="2" strokeLinejoin="round">
              <title>{`${s.label} — ${s.value} ${unitLabel} · ${pct(s.value)}%`}</title>
            </path>
          ))
        )}
        {/* The viewBox is fixed, so type inside it scales with the rendered
            size: at the compact 80px the unit caption would come out around
            4px. Drop it and size the number up instead — the legend beside it
            already says what the unit is. */}
        <text
          x={CX}
          y={compact ? CY + 12 : CY - 2}
          textAnchor="middle"
          fill="var(--color-text-primary)"
          style={{ font: `500 ${compact ? 40 : 26}px var(--font-heading)` }}
        >
          {total}
        </text>
        {!compact && (
          <text x={CX} y={CY + 16} textAnchor="middle" fill="var(--color-text-light)" style={{ font: '10px var(--font-body)' }}>
            {unitLabel}
          </text>
        )}
      </svg>
      <ul className={`flex-1 min-w-0 list-none p-0 m-0 ${compact ? 'space-y-0.5' : 'space-y-1.5'}`}>
        {legend.map((x) => (
          <li key={x.muscle} className={`flex items-center gap-2 ${compact ? 'text-[11px]' : 'text-[12px]'}`}>
            <span className="w-2.5 h-2.5 shrink-0 rounded-[3px]" style={{ background: MUSCLE_COLOR[x.muscle] }} />
            <span className="text-text-secondary flex-1 min-w-0 truncate">{x.label}</span>
            <span className="text-text-muted tabular-nums">
              {x.value} · {pct(x.value)}%
            </span>
          </li>
        ))}
        {rest > 0 && (
          <li className="flex items-center gap-2 text-[11px] text-text-light">
            <span className="w-2.5 h-2.5 shrink-0" />
            <span className="flex-1 min-w-0 truncate">+{rest} more</span>
            <span className="tabular-nums">
              {Math.round(restValue * 10) / 10} · {pct(restValue)}%
            </span>
          </li>
        )}
      </ul>
    </div>
  )
}
