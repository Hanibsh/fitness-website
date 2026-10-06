// The weekly food log (schema.sql weekly_log): one entry per week, keyed by
// its Monday like the check-ins — the week's average calories and protein a
// day, and body fat when it was measured. Weigh-ins stay daily
// (bodyweight_log). Pure, so scripts/test-weekly.mjs can check it.
//
//   entry: { weekStart: 'YYYY-MM-DD', calories, protein, bodyFat } — each
//          number or null.
import { CALORIE_FLOOR } from './calorieTargets'
import { weekStart } from './checkins'

const DAY = 86400000

export const INTAKE_BOUNDS = {
  calories: { min: 0, max: 20000 },
  protein: { min: 0, max: 1000 },
  bodyFat: { min: 4, max: 65 },
}

// The Monday before `key`'s week — "last week".
export function previousWeek(key) {
  const [y, m, d] = key.split('-').map(Number)
  return weekStart(new Date(y, m - 1, d - 7, 12).getTime())
}

// A week's Monday, noon local, as a timestamp.
export function weekTime(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d, 12).getTime()
}

const has = (v) => v != null && Number.isFinite(Number(v))

export function hasIntake(entry) {
  return !!entry && (has(entry.calories) || has(entry.protein) || has(entry.bodyFat))
}

// A saved week as the three fields' text (components/FoodFields.jsx).
export function foodForm(entry) {
  const t = (v) => (v == null ? '' : String(v))
  return { calories: t(entry?.calories), protein: t(entry?.protein), bodyFat: t(entry?.bodyFat) }
}

// What was typed into the three fields, made ready to save: blanks are null,
// whole calories and grams, body fat to one decimal. `error` names the first
// field out of bounds.
export function parseIntake({ calories = '', protein = '', bodyFat = '' } = {}) {
  const out = {}
  const fields = { calories, protein, bodyFat }
  for (const [key, raw] of Object.entries(fields)) {
    const text = String(raw ?? '').trim().replace(',', '.')
    if (!text) {
      out[key] = null
      continue
    }
    const n = Number(text)
    const { min, max } = INTAKE_BOUNDS[key]
    if (!Number.isFinite(n) || n < min || n > max) return { entry: null, error: key }
    out[key] = key === 'bodyFat' ? Math.round(n * 10) / 10 : Math.round(n)
  }
  return { entry: out, error: null }
}

// Weeks that reach into the range: any part of the week on or after `cutoff`.
const inRange = (entries, cutoff) => entries.filter((e) => weekTime(e.weekStart) + 6 * DAY >= cutoff)

// The average a day across the weeks that have a number — a blank week
// isn't a week of zero.
export function intakeAverages(entries = [], cutoff = 0) {
  const weeks = inRange(entries, cutoff)
  const avg = (key) => {
    const vals = weeks.map((e) => e[key]).filter(has).map(Number)
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
  }
  return { calories: avg('calories'), protein: avg('protein') }
}

// The newest body fat in range and how far it moved since the first.
export function bodyFatTrend(entries = [], cutoff = 0) {
  const points = inRange(entries, cutoff)
    .filter((e) => has(e.bodyFat))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
  if (!points.length) return { latest: null, change: null }
  const latest = Number(points[points.length - 1].bodyFat)
  const change = points.length > 1 ? Math.round((latest - Number(points[0].bodyFat)) * 10) / 10 : null
  return { latest, change }
}

// Eating under the calorie floor — the line where moving more beats eating
// less. Without a sex on file, the lower of the two floors.
export function underFloor(entry, sex) {
  if (!entry || !has(entry.calories) || Number(entry.calories) <= 0) return false
  const floor = CALORIE_FLOOR[sex] ?? Math.min(CALORIE_FLOOR.male, CALORIE_FLOOR.female)
  return Number(entry.calories) < floor
}

// "2,200 cal · 150 g protein a day · 18% bf" — whatever the week has.
export function intakeLine(entry) {
  if (!entry) return ''
  const food = [
    has(entry.calories) && `${Number(entry.calories).toLocaleString('en-US')} cal`,
    has(entry.protein) && `${entry.protein} g protein`,
  ].filter(Boolean)
  const parts = food.length ? [`${food.join(' · ')} a day`] : []
  if (has(entry.bodyFat)) parts.push(`${entry.bodyFat}% bf`)
  return parts.join(' · ')
}
