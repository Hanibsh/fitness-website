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

// y tick strings with the fewest decimals (from `minDecimals`, up to 2) that
// keep them distinct — a 16–18% body fat axis otherwise reads 16 | 17 | 18 | 18.
// `format` gets each tick already rounded; Number() drops a trailing ".0".
export function tickLabels(values, format = (r) => r.toLocaleString(), minDecimals = 0) {
  let labels = []
  for (let d = minDecimals; d <= Math.max(minDecimals, 2); d++) {
    labels = values.map((v) => format(Number(v.toFixed(d))))
    if (new Set(labels).size === labels.length) break
  }
  return labels
}

// Round-number gridlines inside [min, max]: the smallest 1 / 2 / 2.5 / 5 × 10ⁿ
// step that fits at most `most` of them, each labelled with only the decimals
// that step needs — 16 | 18 for body fat, 90 | 95 | 100 for a lift.
export function niceTicks(min, max, most = 4) {
  const range = max - min
  if (!(range > 0)) return { values: [min], labels: [min.toLocaleString('en-US')] }
  for (let e = Math.floor(Math.log10(range / most)); ; e++) {
    for (const m of [1, 2, 2.5, 5]) {
      const step = m * 10 ** e
      const first = Math.ceil(min / step - 1e-9)
      const last = Math.floor(max / step + 1e-9)
      if (last - first + 1 > most) continue
      const decimals = Math.max(0, -e + (m === 2.5 ? 1 : 0))
      const values = []
      for (let i = first; i <= last; i++) values.push(Number((i * step).toFixed(decimals)))
      return { values, labels: values.map((v) => v.toLocaleString('en-US', { maximumFractionDigits: decimals })) }
    }
  }
}

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
    b: dates ? Math.max(26, (ASCENT + DESCENT) * fontSize + 6 * k) : Math.max(8, MID * fontSize + 2 * k),
  }
  return {
    ref,
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
