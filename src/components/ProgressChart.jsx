import { W, H, tickLabels, useChartAxis } from '../lib/chartAxis'

// Hand-rolled SVG line chart. No dependency — draws a clean line of points
// scaled by date (x) and value (y), with a hover/tap highlight driven from
// the parent via hoveredIndex / onHover. Axis labels stay 11px at any width
// (lib/chartAxis.js).

function axisDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
}

// `domain` fixes the y-axis instead of fitting it to the data. Weights want the
// auto fit — the interesting part of a bodyweight series is its shape, and 78-82
// tells you more than 0-82. A bounded rating does not: pain is a 0-10 scale, and
// auto-fitting it would draw a 4-then-5 week as a dramatic climb.
//
// `target` draws a dashed line at that value (calories or protein to aim for),
// and the auto fit stretches to keep it in view.
//
// No `onHover` (the injuries pain chart) = read-only.
export default function ProgressChart({ points, hoveredIndex, onHover = () => {}, domain = null, target = null }) {
  const values = points.map((p) => p.value)
  if (target != null && !domain) values.push(target)
  let min = domain ? domain[0] : Math.min(...values)
  let max = domain ? domain[1] : Math.max(...values)

  if (!domain) {
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
  }

  const gridValues = [0, 1, 2, 3].map((i) => min + ((max - min) * i) / 3)
  const gridLabels = tickLabels(gridValues)
  const { ref, fontSize, pad, plotW, plotH, yLabelX, yLabelDy, dateY } = useChartAxis(gridLabels)

  const minDate = points[0].date
  const maxDate = points[points.length - 1].date

  // Multiple sessions can share one date (e.g. backfilled days are all pinned
  // to noon) — a zero date span would divide by zero and NaN the whole chart.
  const dateSpan = maxDate - minDate
  const xFor = (d) =>
    dateSpan === 0 ? pad.l + plotW / 2 : pad.l + (plotW * (d - minDate)) / dateSpan
  const yFor = (v) => pad.t + plotH * (1 - (v - min) / (max - min))

  const coords = points.map((p) => ({ x: xFor(p.date), y: yFor(p.value), p }))
  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ')
  const areaPath =
    coords.length > 1
      ? `${linePath} L ${coords[coords.length - 1].x} ${pad.t + plotH} L ${coords[0].x} ${pad.t + plotH} Z`
      : ''

  const active = hoveredIndex != null && coords[hoveredIndex] ? coords[hoveredIndex] : null

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto select-none" onMouseLeave={() => onHover(null)}>
      {/* horizontal gridlines + y labels */}
      {gridValues.map((v, i) => {
        const y = yFor(v)
        return (
          <g key={i}>
            <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="currentColor" className="text-border" strokeWidth="1" />
            <text x={yLabelX} y={y + yLabelDy} textAnchor="end" fontSize={fontSize} fill="currentColor" className="text-text-light">
              {gridLabels[i]}
            </text>
          </g>
        )
      })}

      {/* x labels */}
      <text x={pad.l} y={dateY} textAnchor="start" fontSize={fontSize} fill="currentColor" className="text-text-light">
        {axisDate(minDate)}
      </text>
      {dateSpan > 0 && (
        <text x={W - pad.r} y={dateY} textAnchor="end" fontSize={fontSize} fill="currentColor" className="text-text-light">
          {axisDate(maxDate)}
        </text>
      )}

      {/* target */}
      {target != null && (
        <line
          x1={pad.l}
          y1={yFor(target)}
          x2={W - pad.r}
          y2={yFor(target)}
          stroke="currentColor"
          className="text-text-muted"
          strokeWidth="1.25"
          strokeDasharray="5 4"
        />
      )}

      {/* hover guide */}
      {active && (
        <line x1={active.x} y1={pad.t} x2={active.x} y2={pad.t + plotH} stroke="currentColor" className="text-border-hover" strokeWidth="1" strokeDasharray="3 3" />
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
