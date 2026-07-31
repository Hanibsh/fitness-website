// Day annotations — reasons + summary math. Storage lives in workoutStore.js
// (getDayAnnotations/saveDayAnnotation/deleteDayAnnotation) and workoutRemote.js
// for the Supabase mirror; this file is pure functions over the data, same
// split as workoutStats.js is for sessions.

import { dayStatusesForRange } from './program'

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

// Step n calendar days, landing on local midnight — `ts + n * DAY_MS` skips or
// repeats a day across a DST change. Twin of the helper in program.js.
function addDays(ts, n) {
  const d = new Date(ts)
  d.setDate(d.getDate() + n)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// The annotation covering this calendar day, or null. `date` can be any
// moment during that day.
export function annotationForDate(annotations, date) {
  const key = startOfDay(date)
  return annotations.find((a) => startOfDay(a.date) === key) || null
}

// Day counts over [start, end], capped at today — a rest day still ahead hasn't
// happened yet. Classification comes from the schedule (dayStatusesForRange), so
// these numbers always agree with what the calendar grid drew:
//
//   trained  — a session was logged
//   off      — every day you didn't train. The headline number, and exactly
//              rest + skipped + unlogged + noted, so the four below account for
//              it with nothing left over.
//   rest     — a rest slot in the split
//   skipped  — a training day you didn't do
//   unlogged — a past day the rotation can't place: a rest slot or a skip, no
//              way to tell. Counted apart rather than folded into `skipped`,
//              which would be blaming you for days that may have been rest.
//   noted    — marked off (sick/travel/…) with nothing logged. Also unplaceable
//              — a mark-off suppresses the projection — but it comes with a
//              reason, so it's worth counting apart from a plain `unlogged`.
//   untouched— days from before you had a program or a log; nothing to say.
//
//   annotated— any day carrying a mark-off, the source of `byReason`. Overlaps
//              everything above: a mark-off explains a day, it isn't another
//              kind of day. A day you trained THROUGH counts as trained, per the
//              status precedence — which is why this can't be the `off` total.
export function daySummary(sessions, annotations, { start, end, now = Date.now(), program = null } = {}) {
  const rangeStart = startOfDay(start)
  const rangeEnd = Math.min(startOfDay(end), startOfDay(now))
  const empty = { totalDays: 0, trained: 0, off: 0, rest: 0, skipped: 0, unlogged: 0, noted: 0, annotated: 0, untouched: 0, byReason: {} }
  if (rangeEnd < rangeStart) return empty

  const statuses = dayStatusesForRange(program, { start: rangeStart, end: rangeEnd, sessions, annotations, now })

  const counts = { trained: 0, rest: 0, skipped: 0, unlogged: 0, noted: 0, annotated: 0, untouched: 0 }
  const byReason = {}
  for (const state of statuses.values()) {
    if (state.annotation) {
      counts.annotated++
      byReason[state.annotation.reason] = (byReason[state.annotation.reason] || 0) + 1
    }
    if (state.status === 'done') counts.trained++
    else if (state.status === 'rest') counts.rest++
    else if (state.status === 'missed') counts.skipped++
    else if (state.status === 'unlogged') counts.unlogged++
    else if (state.status === 'off') counts.noted++
    else if (state.status === 'none') counts.untouched++
  }
  const off = counts.rest + counts.skipped + counts.unlogged + counts.noted
  return { totalDays: statuses.size, ...counts, off, byReason }
}

// How many consecutive days, counting back from today, you've been away from
// training — null if today isn't part of one. Training breaks the streak. So
// does a REST day: recovery inside your split isn't a layoff, it's the plan
// working. What counts is a day you skipped or marked off; `reasons` collects
// the mark-off reasons among them, and is empty when you just didn't go.
//
// `program` is optional so old callers still work — without it there's no way
// to tell a rest slot from a skip, and only marked-off days count (the original
// behaviour).
export function currentBreak(sessions, annotations, { now = Date.now(), program = null } = {}) {
  const trainedDays = new Set(sessions.map((s) => startOfDay(s.date)))
  const annotationByDay = new Map(annotations.map((a) => [startOfDay(a.date), a.reason]))
  // Bounded: 60 days is well past any break still worth a banner, and it keeps
  // the walk terminating on an account with no history behind it.
  const MAX_BREAK_DAYS = 60
  const today = startOfDay(now)
  const statuses = program
    ? dayStatusesForRange(program, { start: addDays(today, -MAX_BREAK_DAYS), end: today, sessions, annotations, now })
    : null

  let days = 0
  const reasons = new Set()
  for (let i = 0; i <= MAX_BREAK_DAYS; i++) {
    const d = addDays(today, -i)
    if (trainedDays.has(d)) break
    const reason = annotationByDay.get(d)
    if (statuses) {
      const status = statuses.get(d)?.status
      // A rest slot is the plan working, not a layoff. 'unlogged' might be one
      // too — no evidence either way, so don't build an "ease back in" nudge on
      // top of it.
      if (status === 'rest' || status === 'unlogged' || status === 'none') break
    } else if (!reason) {
      break // no schedule to prove a skip — only mark-offs count
    }
    days++
    if (reason) reasons.add(reason)
  }
  return days > 0 ? { days, reasons: [...reasons] } : null
}

function reasonsBetween(annotations, start, end) {
  const set = new Set()
  for (const a of annotations) {
    if (a.date > start && a.date < end) set.add(a.reason)
  }
  return [...set]
}

// Raw facts about a possible layoff around your training, for the advisor to
// apply its own thresholds to: how long since your last session (whether
// still ongoing or just ended), and the gap before that session if there was
// one — each with whatever annotation reasons fall inside it. Unlike
// currentBreak, this doesn't require every day to be annotated — a plain
// unexplained gap in sessions still counts; annotations just explain why.
export function layoffContext(sessions, annotations, { now = Date.now() } = {}) {
  if (!sessions.length) return null
  const sorted = [...sessions].sort((a, b) => b.date - a.date)
  const latest = sorted[0]
  const previous = sorted[1] || null
  return {
    sinceLatest: Math.floor((now - latest.date) / DAY_MS),
    ongoingReasons: reasonsBetween(annotations, latest.date, now),
    gapBeforeLatest: previous ? Math.floor((latest.date - previous.date) / DAY_MS) : null,
    priorReasons: previous ? reasonsBetween(annotations, previous.date, latest.date) : [],
  }
}
