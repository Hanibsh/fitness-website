// The at-a-glance numbers the coach reads about a client — on their page and on
// each row of the client list. Pure, so scripts/test-coach.mjs can check them.
import { convertWeight } from './workoutStats'

const DAY = 86400000

// "No training" gets flagged once a client has gone this many days without a
// logged session.
export const NO_TRAINING_DAYS = 5
// The weight trend compares the weigh-ins inside this window.
export const TREND_DAYS = 14

function startOfDay(ts) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// Whole calendar days since the newest session (0 = today), or null with none.
// Rounded rather than floored so a daylight-saving 23/25-hour day still counts
// as one.
export function daysSinceLastWorkout(sessions, now = Date.now()) {
  let last = -Infinity
  for (const s of sessions) if (s.date <= now && s.date > last) last = s.date
  if (!Number.isFinite(last)) return null
  return Math.max(0, Math.round((startOfDay(now) - startOfDay(last)) / DAY))
}

export function noTrainingFlag(sessions, now = Date.now()) {
  const days = daysSinceLastWorkout(sessions, now)
  return days != null && days >= NO_TRAINING_DAYS ? days : null
}

// "Today", "Yesterday", "3 days ago", or null.
export function lastWorkoutLabel(sessions, now = Date.now()) {
  const days = daysSinceLastWorkout(sessions, now)
  if (days == null) return null
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

// The latest weigh-in, and the change across the last TREND_DAYS (newest minus
// the oldest weigh-in inside the window), both in `unit`. `dir` is null with
// fewer than two weigh-ins in the window; 'flat' when the change rounds to
// under 0.3 of a unit — day-to-day water noise, not a trend.
export function weightTrend(entries, unit = 'kg', { days = TREND_DAYS, now = Date.now() } = {}) {
  const inUnit = (e) => convertWeight(Number(e.weight), e.unit || 'kg', unit)
  const sorted = [...entries].filter((e) => e.date <= now).sort((a, b) => a.date - b.date)
  const latest = sorted.length ? Math.round(inUnit(sorted[sorted.length - 1]) * 10) / 10 : null
  const since = startOfDay(now) - days * DAY
  const window = sorted.filter((e) => e.date >= since)
  if (window.length < 2) return { latest, change: null, dir: null }
  const change = Math.round((inUnit(window[window.length - 1]) - inUnit(window[0])) * 10) / 10
  const dir = Math.abs(change) < 0.3 ? 'flat' : change > 0 ? 'up' : 'down'
  return { latest, change, dir }
}
