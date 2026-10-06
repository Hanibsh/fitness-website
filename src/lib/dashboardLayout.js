// Which dashboard cards show, and in what order — chosen on the profile page.
//
// A layout is { order, hidden }: `order` lists EVERY card id (shown or not), so
// a card switched off keeps its place and comes back where it was. The coaching
// banner, the session row and the coaching block at the bottom aren't cards:
// they're fixed, and never in this list (the bottom block is gone since
// 2026-10-03; only the banner remains).
//
// Stored on the device always, and on the account (profiles.dashboard_layout)
// when signed in, so it follows you between devices.

// `half` cards share a row on a wide screen whenever two sit next to each
// other. `defaultOn: false` cards start switched off. `splitFrom` marks a card
// carved out of another: a saved layout that predates it takes on that
// card's on/off state.
export const DASHBOARD_CARDS = [
  { id: 'today', label: 'Today', sub: 'Streak, last workout, today and tomorrow' },
  { id: 'progressSummary', label: 'Progress', sub: 'Strength, body fat and food over time' },
  { id: 'calendar', label: 'Workout calendar', sub: 'Your training days, month by month' },
  { id: 'month', label: 'This month', sub: 'Workouts, volume, PRs and muscle focus', splitFrom: 'calendar' },
  { id: 'adherence', label: 'Plan adherence', sub: 'Sessions done vs planned', defaultOn: false },
  { id: 'injuries', label: 'Injuries', sub: 'Pain trend from your check-ins', defaultOn: false },
  { id: 'volume', label: 'Muscle volume', sub: 'Effective sets per muscle' },
  { id: 'recovery', label: 'Recovery', sub: 'How fresh each muscle is' },
  { id: 'advisor', label: 'Advisor', sub: 'What to change this week' },
  { id: 'effort', label: 'Effort', sub: 'How close to failure you train', defaultOn: false },
  { id: 'rest', label: 'Rest times', sub: 'Your rest vs the recommended rest', defaultOn: false },
  { id: 'block', label: 'Specialization block', sub: 'A muscle you’re bringing up' },
  { id: 'progress', label: 'Exercise progress', sub: 'One lift over time' },
  { id: 'stalled', label: 'Stalled lifts', sub: 'Which lifts are moving and which aren’t', defaultOn: false },
  { id: 'strength', label: 'Strength level', sub: 'Your lifts, Beginner to Elite', defaultOn: false },
  { id: 'goals', label: 'Goals', sub: 'Your targets', half: true },
  { id: 'records', label: 'Personal records', sub: 'Your bests', half: true },
  { id: 'recentPrs', label: 'Recent PRs', sub: 'Your latest records' },
  { id: 'split', label: 'Split distribution', sub: 'Which sessions you do most' },
  { id: 'splitAge', label: 'Split progress', sub: 'Weeks on your current split', defaultOn: false },
  { id: 'lifetime', label: 'Lifetime statistics', sub: 'Everything you’ve logged' },
  { id: 'time', label: 'Training time', sub: 'Hours a week and session length', defaultOn: false },
  { id: 'cardio', label: 'Cardio', sub: 'This week vs your plan', defaultOn: false },
  { id: 'activity', label: 'Recent activity', sub: 'Your last sessions' },
  { id: 'throwback', label: 'This day in history', sub: 'What you trained a year ago' },
  { id: 'bodyweight', label: 'Weight & food', sub: 'Weigh-ins and weekly food' },
  { id: 'targets', label: 'Daily targets', sub: 'Calories and protein for your goal', defaultOn: false },
]

const CARD_BY_ID = new Map(DASHBOARD_CARDS.map((c) => [c.id, c]))

export function dashboardCard(id) {
  return CARD_BY_ID.get(id) || null
}

// Any stored value in, a complete layout out: unknown ids dropped, duplicates
// removed, and cards it has never seen (new in an update) slotted in right
// after the card they follow in DASHBOARD_CARDS — beside their relatives
// rather than at the bottom — switched on or off as the card itself defaults,
// or as the card it was split from was.
export function normalizeLayout(saved) {
  const order = []
  for (const id of Array.isArray(saved?.order) ? saved.order : []) {
    if (CARD_BY_ID.has(id) && !order.includes(id)) order.push(id)
  }
  const hidden = new Set(Array.isArray(saved?.hidden) ? saved.hidden.filter((id) => CARD_BY_ID.has(id)) : [])
  DASHBOARD_CARDS.forEach((card, i) => {
    if (order.includes(card.id)) return
    const before = DASHBOARD_CARDS.slice(0, i).reverse().find((c) => order.includes(c.id))
    order.splice(before ? order.indexOf(before.id) + 1 : 0, 0, card.id)
    if (card.splitFrom && order.includes(card.splitFrom) && saved?.order) {
      if (hidden.has(card.splitFrom)) hidden.add(card.id)
    } else if (card.defaultOn === false) {
      hidden.add(card.id)
    }
  })
  return { order, hidden: order.filter((id) => hidden.has(id)) }
}

export function defaultLayout() {
  return normalizeLayout(null)
}

export function isDefaultLayout(layout) {
  const d = defaultLayout()
  return JSON.stringify(normalizeLayout(layout)) === JSON.stringify(d)
}

export function toggleCard(layout, id, on) {
  const hidden = layout.hidden.filter((h) => h !== id)
  return normalizeLayout({ order: layout.order, hidden: on ? hidden : [...hidden, id] })
}

// Move the card at `from` to `to` among ALL cards, shown or not — the list on
// the profile page shows every card, so that's the order it moves in.
export function moveCardTo(layout, from, to) {
  const order = [...layout.order]
  if (from < 0 || from >= order.length || to < 0 || to >= order.length) return layout
  const [id] = order.splice(from, 1)
  order.splice(to, 0, id)
  return normalizeLayout({ order, hidden: layout.hidden })
}

// The shown cards, grouped into rows: two `half` cards side by side become one
// row, everything else is a row of its own. `present` filters out cards with
// nothing to show right now, so a half card never pairs with an empty slot.
export function layoutRows(layout, present = () => true) {
  const hidden = new Set(layout.hidden)
  const shown = layout.order.filter((id) => !hidden.has(id) && present(id))
  const rows = []
  for (let i = 0; i < shown.length; i++) {
    const id = shown[i]
    const next = shown[i + 1]
    if (CARD_BY_ID.get(id)?.half && next && CARD_BY_ID.get(next)?.half) {
      rows.push([id, next])
      i++
    } else {
      rows.push([id])
    }
  }
  return rows
}

const LOCAL_KEY = 'leon_dashboard_layout'

export function getLocalLayout() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveLocalLayout(layout) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(layout))
  } catch {
    // Storage full or unavailable — the layout just won't survive a reload.
  }
}
