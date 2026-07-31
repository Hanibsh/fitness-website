// The dot/square styles the calendar grid draws, and the legend explains.
//
// Their own module because two components need them (WorkoutCalendar draws
// them, CalendarPage's legend labels them) and the legend used to keep a
// hand-copied duplicate that could drift out of step with the grid.

// Square markers (not circles) so a day you marked off reads distinctly from a
// workout dot even when both appear on the same day.
export const REASON_COLOR = {
  sick: 'bg-amber-400',
  injury: 'bg-rose-600',
  travel: 'bg-sky-400',
  rest: 'bg-slate-400',
  other: 'bg-stone-400',
}

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
