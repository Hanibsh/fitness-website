// Progress over time — the numbers the Progress page, its dashboard card and
// the chat profile panel share. Pure, so scripts/test-chat.mjs can check it.
import { buildSeries, metricById } from './workoutStats'

// Logged lift names (cardio left out), most-trained first: how many sessions
// each appears in, then the most recent. Picks the strength chart's default.
export function liftsByUse(sessions = []) {
  const seen = new Map() // key -> { name, count, last }
  for (const s of sessions) {
    const inSession = new Set()
    for (const ex of s.exercises || []) {
      if (ex.kind === 'cardio') continue
      const name = (ex.name || '').trim()
      const key = name.toLowerCase()
      if (!key || inSession.has(key)) continue
      inSession.add(key)
      const cur = seen.get(key) || { name, count: 0, last: 0 }
      cur.count++
      if (s.date > cur.last) {
        cur.last = s.date
        cur.name = name
      }
      seen.set(key, cur)
    }
  }
  return [...seen.values()].sort((a, b) => b.count - a.count || b.last - a.last).map((l) => l.name)
}

// How the most-trained lift's est. 1RM moved across a range: { name, pct }
// (first session in range vs the last), or null without two sessions of it.
export function topLiftChange(sessions = [], unit = 'kg', rangeId = '3m') {
  const name = liftsByUse(sessions)[0]
  if (!name) return null
  const series = buildSeries(sessions, name, metricById('e1rm'), rangeId, unit)
  if (series.length < 2 || !series[0].value) return { name, pct: null }
  return { name, pct: Math.round(((series[series.length - 1].value - series[0].value) / series[0].value) * 100) }
}

// ---- Compare: several lines on one chart -------------------------------------------
// Where Compare remembers its picks on this device: your own, or — given a
// client card's id — that client's, so each client keeps their own lines.
export const compareStoreKey = (cardId) => (cardId ? `leon_progress_compare:${cardId}` : 'leon_progress_compare')

// `lines`: [{ id, label, unit, points: [{ date, value }] }], points oldest first.
// Every line keeps its real values. Lines that share a unit share a scale; each
// other unit gets its own strip, all strips on one timeline — never two scales
// on one plot (where they'd cross would be an accident of the scales) and never
// % change. Lines with nothing to draw are left out (they're still picked).
//
// Returns { mode: 'value' | 'strips', unit, strips: [{ unit, lines }], lines }:
// one strip per unit, in the order the lines came in; `unit` only when there's
// one. Each line gains `plot` ([{ date, value }]) and `change` (the last point
// against the first, in its unit).
export function compareLines(lines = []) {
  const round1 = (v) => Math.round(v * 10) / 10
  const out = lines
    .filter((l) => l.points?.length)
    .map((line) => {
      const plot = line.points.map((p) => ({ date: p.date, value: p.value }))
      return { ...line, plot, change: plot.length >= 2 ? round1(plot[plot.length - 1].value - plot[0].value) : null }
    })
  const strips = []
  for (const line of out) {
    const strip = strips.find((s) => s.unit === line.unit)
    if (strip) strip.lines.push(line)
    else strips.push({ unit: line.unit, lines: [line] })
  }
  return { mode: strips.length > 1 ? 'strips' : 'value', unit: strips.length === 1 ? strips[0].unit : null, strips, lines: out }
}

// A line's reading on a date: its latest point on or before it, or null.
export function valueAt(points = [], date) {
  let hit = null
  for (const p of points) {
    if (p.date > date) break
    hit = p
  }
  return hit
}
