// The weekly check-in a coached client fills in: six 1–5 taps and a note,
// one per week (Monday-first, like the dashboard's weeks). Pure, so
// scripts/test-coach.mjs can check it.

// `low`/`high` label the ends of the 1–5 scale. Stress and hunger read
// higher-is-more, not higher-is-better — the coach reads them as numbers.
export const CHECKIN_QUESTIONS = [
  { key: 'sleep', label: 'Sleep', low: 'Poor', high: 'Great' },
  { key: 'energy', label: 'Energy', low: 'Low', high: 'High' },
  { key: 'stress', label: 'Stress', low: 'Low', high: 'High' },
  { key: 'training', label: 'Training', low: 'Rough', high: 'Great' },
  { key: 'hunger', label: 'Hunger', low: 'Low', high: 'High' },
  { key: 'diet', label: 'Diet on track', low: 'Not at all', high: 'Fully' },
]

export const CHECKIN_NOTE_MAX = 1000

const pad = (n) => String(n).padStart(2, '0')

// The week's Monday as a local 'YYYY-MM-DD' — the check-in's key.
export function weekStart(ts = Date.now()) {
  const d = new Date(ts)
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function thisWeeksCheckin(checkins, now = Date.now()) {
  const week = weekStart(now)
  return checkins.find((c) => c.week_start === week) || null
}

export function checkinDue(checkins, now = Date.now()) {
  return !thisWeeksCheckin(checkins, now)
}

// "Week of 28 Sept"
export function weekLabel(weekStartIso) {
  const [y, m, d] = weekStartIso.split('-').map(Number)
  return `Week of ${new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
}

// Every question answered (the note is optional).
export function checkinComplete(answers) {
  return CHECKIN_QUESTIONS.every((q) => answers?.[q.key] >= 1 && answers?.[q.key] <= 5)
}
