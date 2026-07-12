// Day annotations — reasons + summary math. Storage lives in workoutStore.js
// (getDayAnnotations/saveDayAnnotation/deleteDayAnnotation) and workoutRemote.js
// for the Supabase mirror; this file is pure functions over the data, same
// split as workoutStats.js is for sessions.

export const DAY_REASONS = [
  { id: 'sick', label: 'Sick' },
  { id: 'injury', label: 'Injury' },
  { id: 'travel', label: 'Travel' },
  { id: 'rest', label: 'Rest' },
  { id: 'other', label: 'Other' },
]

export function reasonLabel(id) {
  return DAY_REASONS.find((r) => r.id === id)?.label || 'Other'
}

const DAY_MS = 86400000

function startOfDay(ts) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// The annotation covering this calendar day, or null. `date` can be any
// moment during that day.
export function annotationForDate(annotations, date) {
  const key = startOfDay(date)
  return annotations.find((a) => startOfDay(a.date) === key) || null
}

// Trained / off (annotated) / untouched day counts over [start, end] plus a
// reason breakdown, capped at today — an upcoming rest day isn't "untouched"
// until it's actually passed. A day can be BOTH trained and annotated (you
// trained through it), so "trained" and "off" aren't mutually exclusive and
// don't have to sum to totalDays; "untouched" is neither.
export function daySummary(sessions, annotations, { start, end, now = Date.now() } = {}) {
  const rangeStart = startOfDay(start)
  const rangeEnd = Math.min(startOfDay(end), startOfDay(now))
  if (rangeEnd < rangeStart) return { totalDays: 0, trained: 0, off: 0, untouched: 0, byReason: {} }

  const trainedDays = new Set(sessions.map((s) => startOfDay(s.date)))
  const annotationByDay = new Map(annotations.map((a) => [startOfDay(a.date), a.reason]))

  let trained = 0
  let off = 0
  let untouched = 0
  const byReason = {}
  for (let d = rangeStart; d <= rangeEnd; d += DAY_MS) {
    const isTrained = trainedDays.has(d)
    const reason = annotationByDay.get(d)
    if (isTrained) trained++
    if (reason) {
      off++
      byReason[reason] = (byReason[reason] || 0) + 1
    }
    if (!isTrained && !reason) untouched++
  }
  return { totalDays: Math.round((rangeEnd - rangeStart) / DAY_MS) + 1, trained, off, untouched, byReason }
}

// How many consecutive days, counting back from today, you've been marked
// off without training — null if today isn't part of one. A day you trained
// through breaks the streak even if it's annotated (you didn't actually stop).
export function currentBreak(sessions, annotations, { now = Date.now() } = {}) {
  const trainedDays = new Set(sessions.map((s) => startOfDay(s.date)))
  const annotationByDay = new Map(annotations.map((a) => [startOfDay(a.date), a.reason]))
  let days = 0
  const reasons = new Set()
  for (let d = startOfDay(now); ; d -= DAY_MS) {
    const reason = annotationByDay.get(d)
    if (!reason || trainedDays.has(d)) break
    days++
    reasons.add(reason)
  }
  return days > 0 ? { days, reasons: [...reasons] } : null
}
