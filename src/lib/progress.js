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
