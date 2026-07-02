// Hand-rolled SVG line chart. No dependency — draws a clean line of points
// scaled by date (x) and value (y), with a hover/tap highlight driven from
// the parent via hoveredIndex / onHover.

const W = 560
const H = 200
const PAD = { l: 46, r: 14, t: 16, b: 26 }
const PLOT_W = W - PAD.l - PAD.r
const PLOT_H = H - PAD.t - PAD.b

function axisDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
}

export default function ProgressChart({ points, hoveredIndex, onHover }) {
  const values = points.map((p) => p.value)
  let min = Math.min(...values)
  let max = Math.max(...values)

  if (min === max) {
    // Flat line — pad so it sits in the middle instead of on an edge.
    const pad = Math.max(1, Math.abs(min) * 0.1)
    min -= pad
    max += pad
  } else {
    const range = max - min
    min -= range * 0.1
    max += range * 0.1
  }
  min = Math.max(0, min)

  const minDate = points[0].date
  const maxDate = points[points.length - 1].date

  const xFor = (d) =>
    points.length === 1 ? PAD.l + PLOT_W / 2 : PAD.l + (PLOT_W * (d - minDate)) / (maxDate - minDate)
  const yFor = (v) => PAD.t + PLOT_H * (1 - (v - min) / (max - min))

  const coords = points.map((p) => ({ x: xFor(p.date), y: yFor(p.value), p }))
  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ')
  const areaPath =
    coords.length > 1
      ? `${linePath} L ${coords[coords.length - 1].x} ${PAD.t + PLOT_H} L ${coords[0].x} ${PAD.t + PLOT_H} Z`
      : ''

  const gridValues = [0, 1, 2, 3].map((i) => min + ((max - min) * i) / 3)
  const active = hoveredIndex != null && coords[hoveredIndex] ? coords[hoveredIndex] : null

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto select-none" onMouseLeave={() => onHover(null)}>
      {/* horizontal gridlines + y labels */}
      {gridValues.map((v, i) => {
        const y = yFor(v)
        return (
          <g key={i}>
            <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="currentColor" className="text-border" strokeWidth="1" />
            <text x={PAD.l - 8} y={y + 3} textAnchor="end" fontSize="9" fill="currentColor" className="text-text-light">
              {Math.round(v).toLocaleString()}
            </text>
          </g>
        )
      })}

      {/* x labels */}
      <text x={PAD.l} y={H - 8} textAnchor="start" fontSize="9" fill="currentColor" className="text-text-light">
        {axisDate(minDate)}
      </text>
      {points.length > 1 && (
        <text x={W - PAD.r} y={H - 8} textAnchor="end" fontSize="9" fill="currentColor" className="text-text-light">
          {axisDate(maxDate)}
        </text>
      )}

      {/* hover guide */}
      {active && (
        <line x1={active.x} y1={PAD.t} x2={active.x} y2={PAD.t + PLOT_H} stroke="currentColor" className="text-border-hover" strokeWidth="1" strokeDasharray="3 3" />
      )}

      {areaPath && <path d={areaPath} fill="currentColor" className="text-text-primary" opacity="0.06" />}
      <path d={linePath} fill="none" stroke="currentColor" className="text-text-primary" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />

      {/* points */}
      {coords.map((c, i) => (
        <circle
          key={i}
          cx={c.x}
          cy={c.y}
          r={active === c ? 4.5 : 3}
          fill={c.p.provisional ? 'var(--color-white)' : 'currentColor'}
          stroke="currentColor"
          strokeWidth={c.p.provisional ? 1.5 : 0}
          className="text-text-primary"
        />
      ))}

      {/* invisible hit targets for hover/tap */}
      {coords.map((c, i) => (
        <circle
          key={`hit-${i}`}
          cx={c.x}
          cy={c.y}
          r="16"
          fill="transparent"
          onMouseEnter={() => onHover(i)}
          onClick={() => onHover(i)}
          style={{ cursor: 'pointer' }}
        />
      ))}
    </svg>
  )
}
