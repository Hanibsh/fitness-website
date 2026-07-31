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

// The two schedule-derived markers, in themed tokens so they follow dark mode
// (never an /opacity modifier — iOS 15.8 is the support floor). Deliberately the
// quietest things on the grid: with past months now fully marked, these should
// recede behind the workout dots rather than compete with them.
//
// A rest day is round like the other schedule markers; a skipped day is a
// hollow SQUARE, which reads as "something was due here" at a glance.
export const STATUS_MARKER = {
  rest: 'rounded-full bg-border-hover',
  skipped: 'border border-text-light',
}
