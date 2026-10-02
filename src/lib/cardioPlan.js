// The split generator's cardio planner: what the wizard's Cardio section asks
// for, written into the week as cardio rows.
//
//   plan = {
//     lifting: { on, activity, params, target, days },   // after lifting
//     rest:    { on, activity, params, target, days },   // on rest days
//   }
//
// `days` is how many of that kind of day get it — null means all of them. The
// halves are independent, so either can be off, both on is every day, and each
// has its own amount: more on rest days, or more on lifting days (Hani).
// `target` is per session, minutes or calories (lib/cardio.js).
//
// Pure. The rows it writes carry `cardio.plan` ('lifting' | 'rest') and a fixed
// id per day, so planning again — any answer changed — replaces exactly its own
// rows and leaves every other edit where it was, and React keeps its keys.

import { createPlannedExercise } from './program'
import { movementForCardio, sessionMinutes, sessionKcal } from './cardio'
import { dayStats } from './planStats'

export const DEFAULT_CARDIO_PLAN = {
  lifting: { on: false, activity: 'walk', params: { speedKmh: 5, gradePct: 10 }, target: { by: 'minutes', value: 20 }, days: null },
  rest: { on: false, activity: 'walk', params: { speedKmh: 5.5, gradePct: 0 }, target: { by: 'minutes', value: 40 }, days: null },
}

// A stored plan with anything missing filled from the defaults — so a split
// saved before a field existed still reopens the wizard cleanly.
export function cardioPlanFrom(saved) {
  const half = (k) => ({ ...DEFAULT_CARDIO_PLAN[k], ...(saved?.[k] || {}) })
  return { lifting: half('lifting'), rest: half('rest') }
}

export const cardioPlanOn = (plan) => !!(plan?.lifting?.on || plan?.rest?.on)

const planRowId = (dayId) => `${dayId}:cardio`

// The leg work in a day — walking, stairs, bikes and rowers are all leg work.
const LEG_MUSCLES = new Set(['Quads', 'Hamstrings', 'Glutes', 'Adductors', 'Abductors', 'Calves', 'Tibialis'])
const legSets = (day) => dayStats(day).muscles.reduce((n, m) => n + (LEG_MUSCLES.has(m.muscle) ? m.sets : 0), 0)

// Which lifting days get cardio when it isn't all of them: the ones with the
// least leg work first, so it lands after an upper day rather than on legs
// that are already spent (the interference between the two is local to the
// muscles both use). Ties go to the earlier day.
function pickLiftingDays(days, n) {
  const ranked = days.map((d, i) => ({ d, i, legs: legSets(d) })).sort((a, b) => a.legs - b.legs || a.i - b.i)
  return new Set(ranked.slice(0, n).map((x) => x.d.id))
}

// Which rest days, when it isn't all of them: spread as evenly as the week
// allows.
function pickSpread(days, n) {
  return new Set(Array.from({ length: n }, (_, k) => days[Math.floor(((k + 0.5) * days.length) / n)].id))
}

// How many of `available` days a half asks for.
export const plannedDayCount = (half, available) =>
  half?.days == null ? available : Math.max(0, Math.min(available, Math.round(Number(half.days)) || 0))

function planRow(dayId, half, kind) {
  const row = createPlannedExercise(movementForCardio(half.activity, half.params) || 'Walking', {
    kind: 'cardio',
    sets: 1,
    repRange: null,
    cardio: { activity: half.activity, params: { ...half.params }, target: { ...half.target }, plan: kind },
  })
  return { ...row, id: planRowId(dayId) }
}

const isPlanRow = (e) => e.kind === 'cardio' && !!e.cardio?.plan

// The program with the plan's cardio in it: last on the chosen lifting days,
// alone on the chosen rest days. Rows the planner wrote before are replaced;
// everything else — cardio you added yourself included — is left alone.
export function applyCardioPlan(program, plan) {
  const days = program.days.map((d) => {
    const kept = (d.exercises || []).filter((e) => !isPlanRow(e))
    return kept.length === (d.exercises || []).length ? d : { ...d, exercises: kept }
  })
  const chosen = { lifting: new Set(), rest: new Set() }
  const lifting = days.filter((d) => d.kind !== 'rest')
  const rest = days.filter((d) => d.kind === 'rest')
  if (plan?.lifting?.on) chosen.lifting = pickLiftingDays(lifting, plannedDayCount(plan.lifting, lifting.length))
  if (plan?.rest?.on && rest.length) chosen.rest = pickSpread(rest, plannedDayCount(plan.rest, rest.length))
  return {
    ...program,
    days: days.map((d) => {
      const kind = d.kind === 'rest' ? 'rest' : 'lifting'
      if (!chosen[kind].has(d.id)) return d
      return { ...d, exercises: [...d.exercises, planRow(d.id, plan[kind], kind)] }
    }),
    settings: { ...(program.settings || {}), cardio: cardioPlanFrom(plan) },
  }
}

// What the week's cardio adds up to, from the rows themselves — so a day
// edited by hand counts as edited. Minutes and calories are null where they
// can't be worked out (a calorie target without a bodyweight, say).
//
//   { lifting: { sessions, minutes, kcal }, rest: {...}, total: {...} }
export function weeklyCardio(program, weightKg) {
  const blank = () => ({ sessions: 0, minutes: 0, kcal: 0 })
  const out = { lifting: blank(), rest: blank(), total: blank() }
  const add = (acc, m, k) => {
    acc.sessions++
    acc.minutes = acc.minutes == null || m == null ? null : acc.minutes + m
    acc.kcal = acc.kcal == null || k == null ? null : acc.kcal + k
  }
  for (const d of program.days) {
    for (const e of d.exercises || []) {
      if (e.kind !== 'cardio' || !e.cardio) continue
      const m = sessionMinutes(e.cardio, weightKg)
      const k = sessionKcal(e.cardio, weightKg)
      add(d.kind === 'rest' ? out.rest : out.lifting, m, k)
      add(out.total, m, k)
    }
  }
  return out
}
