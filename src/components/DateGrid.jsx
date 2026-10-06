import { W, timeTicks, labelWidth } from '../lib/chartAxis'

// Room each date label gets along the bottom, in screen pixels.
const LABEL_SLOT_PX = 56

const dayLabel = (ts) => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

// The time axis of the hand-rolled charts (ProgressChart, CompareChart): a
// faint dashed line at each calendar tick — weeks, months or years, as many
// as fit (lib/chartAxis.js timeTicks) — and, with `labels`, each tick's date
// under the plot. With fewer than two ticks (a few days of data) it labels
// the first and last date at the ends instead. `axis` is useChartAxis's
// return; `xFor` maps a date to x.
export default function DateGrid({ minDate, maxDate, xFor, axis, labels = true }) {
  const { k, fontSize, pad, plotW, plotH, dateY } = axis
  const ticks = timeTicks(minDate, maxDate, Math.min(6, Math.floor(plotW / k / LABEL_SLOT_PX)))
  const text = (x, anchor, s) => (
    <text key={`${x}-${s}`} x={x} y={dateY} textAnchor={anchor} fontSize={fontSize} fill="currentColor" className="text-text-light">
      {s}
    </text>
  )

  if (!ticks) {
    if (!labels) return null
    return (
      <>
        {text(pad.l, 'start', dayLabel(minDate))}
        {maxDate > minDate && text(W - pad.r, 'end', dayLabel(maxDate))}
      </>
    )
  }
  return ticks.map((t) => {
    const x = xFor(t.date)
    const half = labelWidth(t.label, fontSize) / 2
    return (
      <g key={t.date}>
        <line x1={x} y1={pad.t} x2={x} y2={pad.t + plotH} stroke="currentColor" className="text-border" strokeWidth="1" strokeDasharray="2 3" />
        {/* A label that would run off either edge is left out; its line stays. */}
        {labels && x - half >= 0 && x + half <= W && text(x, 'middle', t.label)}
      </g>
    )
  })
}
