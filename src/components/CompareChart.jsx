import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import ExerciseSelect from './ExerciseSelect'
import { compareLines, compareStoreKey, valueAt } from '../lib/progress'
import { W, niceTicks, useChartAxis } from '../lib/chartAxis'

// Two or more of the Progress lines on one chart — a lift's est. 1RM next to
// bodyweight, calories next to body fat. Chips pick the lines; the rows under
// the chart read them out (latest, or on the tapped date).
//
// Every line keeps its real values. Lines that share a unit share a scale;
// mixed units stack as strips, one per unit, on one timeline with one shared
// crosshair (lib/progress.js compareLines) — never two scales on one plot.
//
// Up to four lines: the first four chart-series colours, which every theme
// re-picks (index.css --color-series-*). A line keeps its colour until it's
// switched off, so removing one never repaints the others. The picks are
// remembered on this device, under `storeKey` (lib/progress.js compareStoreKey).

const MAX_LINES = 4
const SLOT_CLASS = ['text-series-1', 'text-series-2', 'text-series-3', 'text-series-4']
// Lines this dense are drawn without their dots — a year of weigh-ins would
// otherwise be a smear.
const DOTS_UP_TO = 30
// A stacked strip's height on screen, at any width; the last one adds its
// date row.
const STRIP_PX = 116
const DATE_ROW_PX = 20

const round1 = (v) => Math.round(v * 10) / 10
const signed = (v) => `${v > 0 ? '+' : ''}${v.toLocaleString('en-US')}`
const withUnit = (v, unit) => `${round1(v).toLocaleString('en-US')}${unit === '%' ? '%' : ` ${unit}`}`
const shortDate = (ts) => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
const axisDate = (ts) => new Date(ts).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
const liftId = (name) => `lift:${name}`

// One entry per colour slot: an id or null. null = never picked here.
function readPicks(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key))
    if (!Array.isArray(v)) return null
    return Array.from({ length: MAX_LINES }, (_, i) => (typeof v[i] === 'string' ? v[i] : null))
  } catch {
    return null
  }
}

// `metrics`: the body and food lines this person has ever logged,
// [{ id, label, unit, points }] for the chosen range. `lifts`: logged lift
// names, most-trained first. `liftSeries(name)`: that lift's est. 1RM points.
export default function CompareChart({ metrics, lifts, liftSeries, unit, storeKey = compareStoreKey() }) {
  const [stored, setStored] = useState(() => readPicks(storeKey))
  // Another client's page reuses this chart: their own picks, not the last one's.
  const [storedFor, setStoredFor] = useState(storeKey)
  if (storedFor !== storeKey) {
    setStoredFor(storeKey)
    setStored(readPicks(storeKey))
  }
  const [addingLift, setAddingLift] = useState(false)
  const [hovered, setHovered] = useState(null) // a date

  const known = useMemo(
    () => new Map([...metrics.map((m) => [m.id, m]), ...lifts.map((n) => [liftId(n), { id: liftId(n), label: n, unit, lift: n }])]),
    [metrics, lifts, unit]
  )

  // The picks, one per colour slot. Anything this person hasn't logged drops
  // out (a coach moving between clients); if that leaves nothing, the
  // defaults — the top lift and bodyweight, else the next lines with data.
  // Switching every line off is respected.
  const slots = useMemo(() => {
    const valid = (stored || []).map((id) => (id && known.has(id) ? id : null))
    if (stored && (stored.every((id) => id === null) || valid.some(Boolean))) return valid
    const defaults = [lifts[0] && liftId(lifts[0]), 'bw', 'cal', 'fat', 'protein', 'lean'].filter((id) => id && known.has(id)).slice(0, 2)
    return Array.from({ length: MAX_LINES }, (_, i) => defaults[i] || null)
  }, [stored, known, lifts])

  const picked = useMemo(() => slots.map((id, slot) => id && { ...known.get(id), slot }).filter(Boolean), [slots, known])
  const chart = useMemo(
    () => compareLines(picked.map((p) => ({ ...p, points: p.lift ? liftSeries(p.lift) : p.points }))),
    [picked, liftSeries]
  )
  useEffect(() => setHovered(null), [chart])

  const full = picked.length >= MAX_LINES
  const unpickedLifts = lifts.filter((n) => !slots.includes(liftId(n)))

  function toggle(id) {
    const next = [...slots]
    const at = next.indexOf(id)
    if (at !== -1) next[at] = null
    else {
      const free = next.indexOf(null)
      if (free === -1) return
      next[free] = id
    }
    setStored(next)
    try {
      localStorage.setItem(storeKey, JSON.stringify(next))
    } catch {
      // no storage — the picks just aren't remembered
    }
  }

  const chips = [...picked.filter((p) => p.lift), ...metrics]

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wider text-text-light">Compare</h3>
        {hovered != null && <p className="shrink-0 text-[12px] text-text-muted tabular-nums">{shortDate(hovered)}</p>}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {chips.map((c) => {
          const slot = slots.indexOf(c.id)
          const on = slot !== -1
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.id)}
              disabled={!on && full}
              aria-pressed={on}
              className={`inline-flex items-center gap-1.5 max-w-full px-2.5 py-1 text-[12px] border cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                on ? 'bg-white border-text-primary text-text-primary' : 'bg-cream border-border text-text-muted hover:text-text-primary'
              }`}
            >
              {on && <span className={`w-3 h-0.5 shrink-0 bg-current ${SLOT_CLASS[slot]}`} aria-hidden="true" />}
              <span className="truncate">{c.label}</span>
            </button>
          )
        })}
        {lifts.length > 0 && (
          <button
            type="button"
            onClick={() => setAddingLift((a) => !a)}
            disabled={full || !unpickedLifts.length}
            aria-expanded={addingLift}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[12px] bg-cream border border-dashed border-border text-text-muted hover:text-text-primary cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-3 h-3" /> Lift
          </button>
        )}
      </div>
      {addingLift && !full && (
        <ExerciseSelect
          value=""
          options={unpickedLifts}
          onChange={(name) => {
            toggle(liftId(name))
            setAddingLift(false)
          }}
          placeholder="Pick a lift"
          ariaLabel="Lift to compare"
          className="w-full mb-3"
        />
      )}
      {full && <p className="text-[11px] text-text-light -mt-1.5 mb-3">Up to 4 lines.</p>}

      {picked.length < 2 ? (
        <p className="text-[13px] text-text-muted py-8 text-center border border-dashed border-border">Pick 2 or more.</p>
      ) : !chart.lines.length ? (
        <p className="text-[13px] text-text-muted py-8 text-center border border-dashed border-border">Nothing logged in this range.</p>
      ) : (
        <Plot chart={chart} hovered={hovered} onHover={setHovered} />
      )}

      {picked.length >= 2 && (
        <ul className="list-none m-0 p-0 mt-2 space-y-1">
          {picked.map((p) => {
            const line = chart.lines.find((l) => l.id === p.id)
            const at = line && (hovered != null ? valueAt(line.plot, hovered) : line.plot[line.plot.length - 1])
            // The change over the range — not while reading one date.
            const delta = !line || hovered != null ? null : line.change
            const deltaUnit = p.unit === '%' ? '%' : ` ${p.unit}`
            return (
              <li key={p.id} className="flex items-baseline gap-2 text-[12px] min-w-0">
                <span className={`w-3.5 h-0.5 shrink-0 self-center bg-current ${SLOT_CLASS[p.slot]}`} aria-hidden="true" />
                <span className="shrink-0 font-medium text-text-primary tabular-nums">{at ? withUnit(at.value, p.unit) : '—'}</span>
                <span className="min-w-0 truncate text-text-muted">{p.label}</span>
                {line ? (
                  delta != null && delta !== 0 && <span className="ml-auto shrink-0 text-text-muted tabular-nums">{signed(delta)}{deltaUnit}</span>
                ) : (
                  <span className="ml-auto shrink-0 text-text-light">None in this range</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// The chart itself: a strip per unit (one, when every line shares it), all on
// one timeline, and a crosshair that snaps to the nearest date any line has
// and runs through every strip. Tap or hover to read a date; ←/→ step through
// them.
function Plot({ chart, hovered, onHover }) {
  const { strips, lines } = chart
  const stacked = strips.length > 1
  const dates = [...new Set(lines.flatMap((l) => l.plot.map((p) => p.date)))].sort((a, b) => a - b)
  const time = { dates, minDate: dates[0], span: dates[dates.length - 1] - dates[0] }

  // Each strip's own scale, padded a tenth either side and never below zero.
  const scales = strips.map((s) => {
    const values = s.lines.flatMap((l) => l.plot.map((p) => p.value))
    let min = Math.min(...values)
    let max = Math.max(...values)
    if (min === max) {
      const pad = Math.max(1, Math.abs(min) * 0.1)
      min -= pad
      max += pad
    } else {
      const range = max - min
      min -= range * 0.1
      max += range * 0.1
    }
    min = Math.max(0, min)
    const { values: grid, labels } = niceTicks(min, max, stacked ? 3 : 4)
    return { min, max, grid, labels }
  })
  // One left margin for every strip, so a date sits at the same x in each.
  const allLabels = scales.flatMap((s) => s.labels)

  function onKeyDown(e) {
    if (e.key === 'Escape') return onHover(null)
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const step = e.key === 'ArrowRight' ? 1 : -1
    const i = hovered == null ? (step > 0 ? -1 : dates.length) : dates.indexOf(hovered)
    onHover(dates[Math.min(dates.length - 1, Math.max(0, i + step))])
  }

  return (
    <div
      role="group"
      tabIndex={0}
      aria-label="Compare chart — arrow keys step through the dates"
      className="select-none outline-none focus-visible:ring-2 focus-visible:ring-text-primary"
      style={{ touchAction: 'pan-y' }}
      onKeyDown={onKeyDown}
      onPointerLeave={(e) => e.pointerType === 'mouse' && onHover(null)}
    >
      {strips.map((s, i) => {
        const last = i === strips.length - 1
        return (
          <div key={s.unit} className={i ? 'mt-2' : ''}>
            {stacked && (
              <p className="flex items-center gap-x-2.5 flex-wrap text-[11px] text-text-light mb-0.5">
                {s.lines.map((l) => (
                  <span key={l.id} className="inline-flex items-center gap-1 min-w-0">
                    <span className={`w-2.5 h-0.5 shrink-0 bg-current ${SLOT_CLASS[l.slot]}`} aria-hidden="true" />
                    <span className="truncate">{l.label}</span>
                  </span>
                ))}
                <span>· {s.unit}</span>
              </p>
            )}
            <Strip
              strip={s}
              scale={scales[i]}
              allLabels={allLabels}
              heightPx={stacked ? STRIP_PX + (last ? DATE_ROW_PX : 0) : null}
              showDates={last}
              time={time}
              hovered={hovered}
              onHover={onHover}
            />
          </div>
        )
      })}
    </div>
  )
}

// One unit's lines on their own scale.
function Strip({ strip, scale, allLabels, heightPx, showDates, time, hovered, onHover }) {
  const { ref, h, fontSize, pad, plotW, plotH, yLabelX, yLabelDy, dateY } = useChartAxis(allLabels, { heightPx, dates: showDates })
  const { dates, minDate, span } = time
  const { min, max, grid, labels } = scale
  const xFor = (d) => (span === 0 ? pad.l + plotW / 2 : pad.l + (plotW * (d - minDate)) / span)
  const yFor = (v) => pad.t + plotH * (1 - (v - min) / (max - min))

  function pick(e) {
    const box = e.currentTarget.getBoundingClientRect()
    const vx = ((e.clientX - box.left) / box.width) * W
    const d = span === 0 ? minDate : minDate + ((vx - pad.l) / plotW) * span
    let best = dates[0]
    for (const x of dates) if (Math.abs(x - d) < Math.abs(best - d)) best = x
    onHover(best)
  }

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${W} ${h}`}
      className="block w-full h-auto"
      aria-hidden="true"
      onPointerDown={pick}
      onPointerMove={(e) => e.pointerType === 'mouse' && pick(e)}
    >
      {grid.map((v, i) => {
        const y = yFor(v)
        return (
          <g key={i}>
            <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="currentColor" className="text-border" strokeWidth="1" />
            <text x={yLabelX} y={y + yLabelDy} textAnchor="end" fontSize={fontSize} fill="currentColor" className="text-text-light">
              {labels[i]}
            </text>
          </g>
        )
      })}

      {showDates && (
        <>
          <text x={pad.l} y={dateY} textAnchor="start" fontSize={fontSize} fill="currentColor" className="text-text-light">
            {axisDate(minDate)}
          </text>
          {span > 0 && (
            <text x={W - pad.r} y={dateY} textAnchor="end" fontSize={fontSize} fill="currentColor" className="text-text-light">
              {axisDate(minDate + span)}
            </text>
          )}
        </>
      )}

      {hovered != null && (
        <line x1={xFor(hovered)} y1={pad.t} x2={xFor(hovered)} y2={pad.t + plotH} stroke="currentColor" className="text-border-hover" strokeWidth="1" strokeDasharray="3 3" />
      )}

      {strip.lines.map((l) => {
        const coords = l.plot.map((p) => ({ x: xFor(p.date), y: yFor(p.value) }))
        const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ')
        const at = hovered != null ? valueAt(l.plot, hovered) : null
        return (
          <g key={l.id} className={SLOT_CLASS[l.slot]}>
            {coords.length > 1 && <path d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
            {(coords.length <= DOTS_UP_TO || coords.length === 1) &&
              coords.map((c, i) => <circle key={i} cx={c.x} cy={c.y} r="3" fill="currentColor" stroke="var(--color-white)" strokeWidth="1" />)}
            {at && <circle cx={xFor(at.date)} cy={yFor(at.value)} r="4.5" fill="currentColor" stroke="var(--color-white)" strokeWidth="1.5" />}
          </g>
        )
      })}
    </svg>
  )
}
