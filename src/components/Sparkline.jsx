// A trend line small enough to sit inside a list row. No axes, no labels, no
// hover — if you need any of those you want ProgressChart, which is 560×200 and
// a different job entirely. This exists so the injuries overview can show the
// SHAPE of a pain history at a glance without opening it.
//
// Draws in `currentColor`, so it takes the tone of whatever row it sits in and
// needs no theme handling of its own.

const W = 88
const H = 24
const PAD = 3

export default function Sparkline({ points, domain = null, className = '' }) {
  // One point is a dot, not a line — and with an auto domain it would also be a
  // divide-by-zero. Nothing at all is nothing to draw.
  if (!points?.length) return null

  const values = points.map((p) => p.value)
  let min = domain ? domain[0] : Math.min(...values)
  let max = domain ? domain[1] : Math.max(...values)
  if (min === max) { min -= 1; max += 1 }

  const first = points[0].date
  const span = points[points.length - 1].date - first
  const x = (d) => (span === 0 ? W / 2 : PAD + (W - PAD * 2) * ((d - first) / span))
  const y = (v) => PAD + (H - PAD * 2) * (1 - (v - min) / (max - min))

  const last = points[points.length - 1]

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      className={`shrink-0 overflow-visible ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      {points.length > 1 && (
        <path
          d={points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.date)} ${y(p.value)}`).join(' ')}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {/* The latest reading, marked — with a single check-in it's the whole
          chart, and with twenty it's the one you actually came to read. */}
      <circle cx={x(last.date)} cy={y(last.value)} r="2" fill="currentColor" />
    </svg>
  )
}
