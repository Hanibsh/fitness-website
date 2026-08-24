// The dot/square styles the calendar grid draws, and the legend explains.
//
// Their own module because two components need them (WorkoutCalendar draws
// them, CalendarPage's legend labels them) and the legend used to keep a
// hand-copied duplicate that could drift out of step with the grid.

// Split colours, in series-slot order. The order isn't cosmetic: it's what keeps
// the splits that actually land next to each other — push/pull/legs, upper/lower —
// on the widest separations, including under colour blindness. `match` is the
// substring we look for in the workout name.
//
// These live here rather than in the grid because they now need a legend too:
// the dot is small and the name isn't on the cell, so hue was carrying the whole
// meaning by itself.
export const SPLIT_COLOR = [
  { match: 'push', label: 'Push', fill: 'bg-series-1', border: 'border-series-1' },
  { match: 'pull', label: 'Pull', fill: 'bg-series-2', border: 'border-series-2' },
  { match: 'leg', label: 'Legs', fill: 'bg-series-3', border: 'border-series-3' },
  { match: 'upper', label: 'Upper', fill: 'bg-series-4', border: 'border-series-4' },
  { match: 'lower', label: 'Lower', fill: 'bg-series-5', border: 'border-series-5' },
  { match: 'cardio', label: 'Cardio', fill: 'bg-series-6', border: 'border-series-6' },
]

// Anything we can't name gets a neutral rather than a sixth-and-a-bit hue.
export const SPLIT_FALLBACK = { fill: 'bg-text-primary', border: 'border-text-muted' }

// Colour a day by the (first) workout's split.
export function splitColor(name) {
  const n = (name || '').toLowerCase()
  return (SPLIT_COLOR.find(s => n.includes(s.match)) || SPLIT_FALLBACK).fill
}

// Border twin of splitColor, for the planned (not-yet-done) outline circles.
export function splitBorderColor(name) {
  const n = (name || '').toLowerCase()
  return (SPLIT_COLOR.find(s => n.includes(s.match)) || SPLIT_FALLBACK).border
}

// Square markers (not circles) so a day you marked off reads distinctly from a
// workout dot even when both appear on the same day.
export const REASON_COLOR = {
  sick: 'bg-amber-400',
  injury: 'bg-rose-600',
  travel: 'bg-sky-400',
  rest: 'bg-slate-400',
  other: 'bg-stone-400',
}

// Injuries are BANDS, not markers, and that's the whole point of them. A dot
// says "something happened here"; an injury didn't happen on a day, it ran
// through one. Drawing it as a bar that carries across cells is the only shape
// that says so — and it's why an injury needed to stop being a day annotation.
//
// Three colours so concurrent injuries stay apart, assigned by onset order and
// held stable for the whole month (see bandColors in WorkoutCalendar). Raw
// palette colours rather than themed tokens, matching REASON_COLOR above: these
// have to stay legible against both the cream and the dark surface, and a token
// that flips with the theme would lose the hue that identifies the injury.
export const INJURY_BAND = ['bg-rose-500', 'bg-violet-500', 'bg-amber-500']

// Past the third concurrent injury we stop drawing and start counting.
export const INJURY_BAND_MAX = 2

// A managed injury is still open but no longer the emergency, so it recedes to
// a neutral rather than keeping a hot colour for weeks on end.
export const INJURY_BAND_MANAGING = 'bg-slate-400'

// The schedule-derived markers, in themed tokens so they follow dark mode
// (never an /opacity modifier — iOS 15.8 is the support floor). Deliberately the
// quietest things on the grid: with past months now fully marked, these should
// recede behind the workout dots rather than compete with them.
//
// Three distinct shapes, because these say three different things and the
// difference matters:
//   rest     — a filled dot: recovery you planned, and it happened.
//   skipped  — a hollow SQUARE: a session was due here and didn't happen.
//   unlogged — a hollow dot: a day away from training that we can't attribute
//              to either. Softer than `skipped` on purpose — calling a day a
//              failure on no evidence is worse than admitting we don't know.
export const STATUS_MARKER = {
  rest: 'rounded-full bg-border-hover',
  skipped: 'border border-text-light',
  unlogged: 'rounded-full border border-border-hover',
}
