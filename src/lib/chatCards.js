// Things from the app shared into the chat (messages.card). Each is a
// snapshot, so a card reads the same later, even after the split is edited or
// the workout deleted. Pure, so scripts/test-chat.mjs can check them.
//
//   exercise — { type, id, name, category }
//   split    — { type, program: { id, name, days, settings }, sent }
//              `sent`: the coach sent it as the client's locked program, so
//              it's already in their splits.
//   workout  — { type, session, prs } — the PRs worked out on the sender's
//              side, against their whole log (the other person doesn't have it).
//   checkin  — { type, week_start, answers, updated, food } — `food`: the
//              week's { calories, protein, bodyFat } (lib/weeklyLog.js) or null.
import { sessionPRs } from './workoutStats'
import { emptyProgram } from './program'

export const CARD_TYPES = ['exercise', 'split', 'workout', 'checkin']

export function isCard(card) {
  return !!card && typeof card === 'object' && CARD_TYPES.includes(card.type)
}

export function exerciseCard({ id, name, category = '' }) {
  return { type: 'exercise', id: id || null, name: String(name || '').slice(0, 80), category: category || '' }
}

export function splitCard(program, { sent = false } = {}) {
  const { id, name, days = [], settings } = program
  return {
    type: 'split',
    sent: !!sent,
    program: JSON.parse(JSON.stringify({ id, name: name || 'Split', days, ...(settings ? { settings } : {}) })),
  }
}

export function workoutCard(session, history = [], unit = 'kg') {
  return {
    type: 'workout',
    session: JSON.parse(JSON.stringify(session)),
    prs: sessionPRs(session, history, session.unit || unit),
  }
}

export function checkinCard(row, { updated = false, food = null } = {}) {
  const keep = food && ['calories', 'protein', 'bodyFat'].some((k) => food[k] != null)
  return {
    type: 'checkin',
    week_start: row.week_start,
    answers: row.answers || {},
    updated: !!updated,
    food: keep ? { calories: food.calories ?? null, protein: food.protein ?? null, bodyFat: food.bodyFat ?? null } : null,
  }
}

// One line for a card: reply quotes and the chat's empty-text fallbacks.
export function cardLabel(card) {
  if (!isCard(card)) return 'Shared item'
  if (card.type === 'exercise') return `Exercise: ${card.name}`
  if (card.type === 'split') return `Split: ${card.program?.name || 'Split'}`
  if (card.type === 'workout') return `Workout: ${card.session?.name || 'Workout'}`
  return card.updated ? 'Check-in updated' : 'Weekly check-in'
}

// How many training days a shared split has, and how long its cycle is.
export function splitShape(program) {
  const days = program?.days || []
  return { train: days.filter((d) => d.kind !== 'rest').length, total: days.length }
}

// A shared split kept by the reader: a new split of their own, same days —
// like "Make my own copy".
export function copyOfSharedSplit(program) {
  const copy = emptyProgram(program.name || 'Split')
  copy.days = JSON.parse(JSON.stringify(program.days || []))
  if (program.settings) copy.settings = JSON.parse(JSON.stringify(program.settings))
  return copy
}

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
