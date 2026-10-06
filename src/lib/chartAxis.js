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

// `yLabels`: the y tick strings, so the left margin fits the widest. Put the
// returned ref on the <svg>.
export function useChartAxis(yLabels) {
  const ref = useRef(null)
  const k = useUnitsPerPx(ref)
  const fontSize = LABEL_PX * k
  const widest = Math.max(0, ...yLabels.map(emWidth)) * fontSize
  const pad = {
    l: Math.ceil(widest + (GAP_PX + EDGE_PX) * k),
    r: 14,
    // room for half the top label above the top gridline
    t: Math.max(16, (ASCENT - MID) * fontSize + k),
    // the date row, 4px clear of the plot and 2px clear of the bottom edge
    b: Math.max(26, (ASCENT + DESCENT) * fontSize + 6 * k),
  }
  return {
    ref,
    fontSize,
    pad,
    plotW: W - pad.l - pad.r,
    plotH: H - pad.t - pad.b,
    yLabelX: pad.l - GAP_PX * k,
    yLabelDy: MID * fontSize, // centres a y label's figures on its gridline
    dateY: H - DESCENT * fontSize - 2 * k,
  }
}
