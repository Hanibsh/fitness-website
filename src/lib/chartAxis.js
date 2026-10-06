import { useLayoutEffect, useRef, useState } from 'react'

// Axis layout for the hand-rolled line charts (ProgressChart, CompareChart).
// They draw in one 560×200 viewBox scaled to the width of their box — right
// for the lines and dots, but it scaled the labels too: a 9-unit label was
// ~10px on a desktop card and ~4px on a phone. This measures the drawn width
// and sizes the labels, and the margins they sit in, in screen pixels.

export const W = 560
export const H = 200

const LABEL_PX = 11
const GAP_PX = 6 // y labels ↔ plot
const EDGE_PX = 2 // y labels ↔ the chart's left edge
// Inter, in em: the text box above and below the baseline, and half a figure.
const ASCENT = 0.97
const DESCENT = 0.25
const MID = 0.36

// Rough glyph widths in em — Inter's figures run ~0.6em. Errs wide: a bad
// guess costs a few px of plot, never a clipped label.
const emWidth = (s) => [...s].reduce((w, c) => w + (c === ',' || c === '.' ? 0.3 : c === '%' ? 0.9 : 0.62), 0)

// viewBox units per screen pixel. Read before paint, so labels never flash
// at the wrong size.
function useUnitsPerPx(ref) {
  const [k, setK] = useState(1)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const read = () => {
      const w = el.getBoundingClientRect().width
      if (w > 0) setK(W / w)
    }
    read()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return k
}

// A round-number scale around [lo, hi]: the bounds snap out to a 1 / 2 / 2.5 /
// 5 × 10ⁿ step that gives about `target` gaps, and every gridline sits on that
// step — 85 · 90 · 95 · 100 · 105 for a lift, 15 · 16 · … · 20 for body fat.
// Labels carry only the decimals the step needs. Data never goes below zero,
// so neither does a scale that starts at or above it. `pad: false` keeps the
// bounds as given (a fixed 0–10 rating) and only picks the step.
// Returns { min, max, values, labels }.
export function niceScale(lo, hi, target = 4, { pad = true } = {}) {
  const floor = lo >= 0 ? 0 : -Infinity
  if (lo === hi) {
    const p = Math.max(1, Math.abs(lo) * 0.1)
    lo -= p
    hi += p
  } else if (pad) {
    const p = (hi - lo) * 0.05
    lo -= p
    hi += p
  }
  const raw = (hi - lo) / target
  const e = Math.floor(Math.log10(raw))
  const m = [1, 2, 2.5, 5, 10].find((x) => x * 10 ** e >= raw - 1e-9)
  const step = m * 10 ** e
  const decimals = Math.max(0, -e + (m === 2.5 ? 1 : 0) - (m === 10 ? 1 : 0))
  const round = (v) => Number(v.toFixed(decimals))
  const min = pad ? Math.max(floor, round(Math.floor(lo / step + 1e-9) * step)) : lo
  const max = pad ? round(Math.ceil(hi / step - 1e-9) * step) : hi
  const values = []
  for (let i = Math.ceil(min / step - 1e-9); i * step <= max + 1e-9; i++) values.push(round(i * step))
  return { min, max, values, labels: values.map((v) => v.toLocaleString('en-US', { maximumFractionDigits: decimals })) }
}

// Calendar gridlines between two dates — Mondays, the 1st of a month or of a
// year — at the finest step that fits `most` labels. Months read "Sep",
// January reads its year; weeks read "12 Sep". [{ date, label }], or null
// when fewer than two would show (a few days of data): the caller then
// labels just the two ends.
const TIME_STEPS = [
  ['week', 1], ['week', 2], ['month', 1], ['month', 2], ['month', 3], ['month', 6], ['year', 1], ['year', 2], ['year', 5],
]
export function timeTicks(minDate, maxDate, most) {
  if (!(maxDate > minDate) || most < 2) return null
  for (const [kind, n] of TIME_STEPS) {
    const d = new Date(minDate)
    d.setHours(0, 0, 0, 0)
    if (kind === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    else if (kind === 'month') d.setMonth(d.getMonth() - (d.getMonth() % n), 1)
    else d.setFullYear(d.getFullYear() - (d.getFullYear() % n), 0, 1)
    const ticks = []
    while (d.getTime() <= maxDate && ticks.length <= most) {
      if (d.getTime() >= minDate) ticks.push(d.getTime())
      if (kind === 'week') d.setDate(d.getDate() + 7 * n)
      else if (kind === 'month') d.setMonth(d.getMonth() + n)
      else d.setFullYear(d.getFullYear() + n)
    }
    if (ticks.length > most) continue
    if (ticks.length < 2) return null
    return ticks.map((t) => {
      const day = new Date(t)
      const label =
        kind === 'week'
          ? day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
          : kind === 'year' || day.getMonth() === 0
            ? String(day.getFullYear())
            : day.toLocaleDateString('en-GB', { month: 'short' })
      return { date: t, label }
    })
  }
  return null
}

// A label's rough width in viewBox units, at `fontSize`.
export const labelWidth = (s, fontSize) => emWidth(s) * fontSize

// `yLabels`: the y tick strings, so the left margin fits the widest. Put the
// returned ref on the <svg>, with a viewBox of W × the returned `h`.
// `heightPx`: a fixed on-screen height instead of the 560×200 shape — the
// Compare chart's stacked strips stay readable on a phone that way.
// `dates: false` leaves out the date row (every strip but the last).
export function useChartAxis(yLabels, { heightPx = null, dates = true } = {}) {
  const ref = useRef(null)
  const k = useUnitsPerPx(ref)
  const h = heightPx ? heightPx * k : H
  const fontSize = LABEL_PX * k
  const widest = Math.max(0, ...yLabels.map(emWidth)) * fontSize
  const pad = {
    l: Math.ceil(widest + (GAP_PX + EDGE_PX) * k),
    r: 14,
    // room for half the top label above the top gridline
    t: Math.max(16, (ASCENT - MID) * fontSize + k),
    // the date row, 4px clear of the plot and 2px clear of the bottom edge —
    // or, without one, half the bottom label
    b: dates ? Math.max(26, (ASCENT + DESCENT) * fontSize + 6 * k) : Math.max(8, (MID + DESCENT) * fontSize + 2 * k),
  }
  return {
    ref,
    k, // viewBox units per screen pixel
    h,
    fontSize,
    pad,
    plotW: W - pad.l - pad.r,
    plotH: h - pad.t - pad.b,
    yLabelX: pad.l - GAP_PX * k,
    yLabelDy: MID * fontSize, // centres a y label's figures on its gridline
    dateY: h - DESCENT * fontSize - 2 * k,
  }
}
