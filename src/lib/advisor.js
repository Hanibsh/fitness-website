// Fatigue-management advisor — engine v3.
//
// Turns the engine's outputs (weekly volume, recovery, e1RM residuals,
// systemic strain) into at most a few concrete, targeted recommendations.
// House philosophy (per Hani): NO deloads, ever — when fatigue outruns
// recovery, trim sets from the specific exercise or muscle driving it and
// keep training everything else. Pure function over session history, same as
// the rest of the engine.

import exercisesDb from '../data/exercises.json'
import { withAliases } from '../data/exerciseAliases'
import { effectiveWeeklyVolume, muscleRecovery, personalizedModel, primaryMusclesFor } from './engine'
import { activeBlock } from './blocks'
import { muscleForExercise } from './dashboard'
import { exerciseIdForName } from './exerciseLibrary'
import { layoffContext, reasonLabel } from './dayLog'
import {
  SFR_RANK, ADVISOR_MIN_SESSIONS, ADVISOR_BLOCK_SLACK,
  ADVISOR_UNDERRECOVERED_MIN, ADVISOR_UNDERRECOVERED_WINDOW,
  ADVISOR_REGRESSION_STREAK, ADVISOR_REGRESSION_EPS,
  ADVISOR_LAYOFF_MIN_DAYS, ADVISOR_LAYOFF_RETURN_WINDOW_DAYS, ADVISOR_MAX_RECS,
} from './engineConfig'

const DAY = 86400000
const DB_BY_ID = withAliases(new Map((exercisesDb.exercises || []).map((e) => [e.id, e])))
const dbFor = (ex) => {
  const id = ex.exerciseId || exerciseIdForName(ex.name)
  return id ? DB_BY_ID.get(id) : null
}

// The distinct resistance exercises logged in the last `days`, each with its
// DB entry (null for custom) and the engine muscles it primarily trains.
function recentExercises(sessions, days, now) {
  const cutoff = now - days * DAY
  const seen = new Map() // lower-cased name -> { name, db, muscles:Set }
  for (const s of sessions) {
    if (s.date < cutoff) continue
    for (const ex of s.exercises || []) {
      if (ex.kind === 'cardio') continue
      const key = ex.name.trim().toLowerCase()
      if (!seen.has(key)) seen.set(key, { name: ex.name.trim(), db: dbFor(ex), muscles: primaryMusclesFor(ex) })
    }
  }
  return [...seen.values()]
}

// Up to ADVISOR_MAX_RECS recommendations, worst first:
//   { id, severity: 'red'|'amber'|'green', title, detail }
// Empty array when there isn't enough history yet.
export function adviseTraining(sessions, { blocks = [], annotations = [], now = Date.now() } = {}) {
  if (!sessions || sessions.length < ADVISOR_MIN_SESSIONS) return []
  const model = personalizedModel(sessions)
  const volume = effectiveWeeklyVolume(sessions, { days: 7, now })
  const recovery = muscleRecovery(sessions, { now })
  const focus = new Set(activeBlock(blocks)?.focusMuscles || [])
  const week = recentExercises(sessions, 7, now)
  const fortnight = recentExercises(sessions, 14, now)
  const recs = []

  // R0 — layoff: still mid-break, or your latest session followed a gap of
  // ADVISOR_LAYOFF_MIN_DAYS+. Not a fatigue-management case (nothing to trim),
  // just context: ease back in and expect a temporary strength dip — normal,
  // and it comes back fast. Annotations (if any) explain why, in your words.
  const layoff = layoffContext(sessions, annotations, { now })
  const reasonSuffix = (reasons) => (reasons.length ? ` (${reasons.map(reasonLabel).join(', ').toLowerCase()})` : '')
  if (layoff && layoff.sinceLatest >= ADVISOR_LAYOFF_MIN_DAYS) {
    recs.push({
      id: 'layoff-ongoing',
      severity: 'amber',
      title: `${layoff.sinceLatest} days since your last session${reasonSuffix(layoff.ongoingReasons)}`,
      detail:
        `No rush — when you're ready to jump back in, go a bit lighter than your last numbers and let RIR guide you back up. ` +
        `A layoff this long usually costs a little strength at first, but it comes back fast.`,
    })
  } else if (
    layoff &&
    layoff.gapBeforeLatest != null &&
    layoff.gapBeforeLatest >= ADVISOR_LAYOFF_MIN_DAYS &&
    layoff.sinceLatest <= ADVISOR_LAYOFF_RETURN_WINDOW_DAYS
  ) {
    recs.push({
      id: 'layoff-returned',
      severity: 'amber',
      title: `Back after ${layoff.gapBeforeLatest} days off${reasonSuffix(layoff.priorReasons)}`,
      detail:
        `Ease into this first week back — go a bit lighter than before and let RIR guide you up rather than chasing your old numbers immediately. ` +
        `Strength dips after a layoff like this are normal and bounce back quickly.`,
    })
  }

  // R1 — over the productive ceiling: trim the worst stimulus-to-fatigue
  // exercise feeding that muscle. Specialization-block focus muscles get slack
  // (pushing them is the point of the block).
  const overMuscles = new Set()
  for (const v of volume) {
    const ceiling = v.landmarks.high * (focus.has(v.muscle) ? ADVISOR_BLOCK_SLACK : 1)
    if (v.sets <= ceiling) continue
    overMuscles.add(v.muscle)
    const candidates = week.filter((e) => e.muscles.has(v.muscle) && e.db)
    // Worst SFR first; break ties toward the more fatiguing movement.
    candidates.sort((a, b) => (SFR_RANK[a.db.sfr] || 2) - (SFR_RANK[b.db.sfr] || 2) || b.db.fatigueScore - a.db.fatigueScore)
    const cut = candidates[0]
    const excess = Math.max(1, Math.ceil(v.sets - v.landmarks.high))
    recs.push({
      id: `over-${v.muscle}`,
      severity: 'amber',
      title: `${v.muscle} volume is past the productive ceiling`,
      detail:
        `${v.sets} effective sets this week vs the ~${v.landmarks.high} ceiling — extra sets past that are mostly fatigue. ` +
        (cut
          ? `Trim ~${excess}, starting with ${cut.name} (the week's worst stimulus-to-fatigue ratio for ${v.muscle.toLowerCase()}).`
          : `Trim ~${excess} sets from your ${v.muscle.toLowerCase()} work.`),
    })
  }

  // R2 — chronically trained under-recovered: space it out or trim its most
  // fatiguing driver.
  const chronicMuscles = new Set()
  for (const [muscle, flags] of Object.entries(model.workedLow)) {
    const window = flags.slice(-ADVISOR_UNDERRECOVERED_WINDOW)
    const hits = window.filter(Boolean).length
    if (window.length < ADVISOR_UNDERRECOVERED_MIN || hits < ADVISOR_UNDERRECOVERED_MIN) continue
    chronicMuscles.add(muscle)
    const candidates = fortnight.filter((e) => e.muscles.has(muscle) && e.db)
    candidates.sort((a, b) => b.db.fatigueScore - a.db.fatigueScore)
    const driver = candidates[0]
    recs.push({
      id: `under-recovered-${muscle}`,
      severity: 'amber',
      title: `${muscle} keeps getting trained before it recovers`,
      detail:
        `Under the ready line in ${hits} of its last ${window.length} sessions. ` +
        `Give it one more day between hits${driver ? `, or trim a set from ${driver.name} (its most fatiguing driver)` : ''}.`,
    })
  }

  // R3 — performance regression where fatigue is the likely culprit: e1RM
  // below trend several sessions running AND the lift's muscles run hot.
  // Exactly the targeted per-exercise trim the app is built around.
  for (const [key, p] of Object.entries(model.perf)) {
    if (p.residuals.length < ADVISOR_REGRESSION_STREAK) continue
    const recent = p.residuals.slice(-ADVISOR_REGRESSION_STREAK)
    if (!recent.every((r) => r < ADVISOR_REGRESSION_EPS)) continue
    const db = key.startsWith('name:') ? null : DB_BY_ID.get(key)
    const muscles = db ? primaryMusclesFor({ exerciseId: key, name: p.name }) : new Set([muscleForExercise(p.name)].filter(Boolean))
    const hot = [...muscles].find((m) => overMuscles.has(m) || chronicMuscles.has(m))
    if (!hot) continue // could be sleep/technique — stay quiet rather than guess
    recs.push({
      id: `regression-${key}`,
      severity: 'red',
      title: `${p.name} is trending down`,
      detail:
        `Estimated 1RM has been below trend ${ADVISOR_REGRESSION_STREAK} sessions running while ${hot} runs hot. ` +
        `Cut a set from ${p.name} specifically and see if the trend turns — everything else trains on as planned.`,
    })
  }

  // R4 — whole-body strain high while lifts slip: shave the costliest movers.
  if (recovery.systemic.level === 'high') {
    const slipping = Object.values(model.perf).filter((p) => p.residuals.length && p.residuals[p.residuals.length - 1] < 0)
    if (slipping.length >= 2) {
      const costly = week
        .filter((e) => e.db)
        .sort(
          (a, b) =>
            b.db.fatigueScore * (b.db.axialLoading ? 1.3 : 1) - a.db.fatigueScore * (a.db.axialLoading ? 1.3 : 1)
        )
        .slice(0, 2)
        .map((e) => e.name)
      recs.push({
        id: 'systemic',
        severity: 'red',
        title: 'Whole-body strain is high and lifts are slipping',
        detail:
          `Systemic strain is at ${recovery.systemic.pct}% with several lifts under trend. ` +
          (costly.length
            ? `Shave one set off ${costly.join(' and ')} this week — the most systemically costly work — and keep the rest as planned.`
            : 'Shave a set off your heaviest compound lifts this week and keep the rest as planned.'),
      })
    }
  }

  if (!recs.length) {
    const lastResiduals = Object.values(model.perf).map((p) => p.residuals[p.residuals.length - 1])
    const trendingUp = lastResiduals.length > 0 && lastResiduals.filter((r) => r >= 0).length >= lastResiduals.length / 2
    return [
      {
        id: 'all-clear',
        severity: 'green',
        title: 'All systems go',
        detail: `Volume is in range and recovery is keeping up${trendingUp ? ' — and your lifts are trending up' : ''}. Keep doing what you're doing.`,
      },
    ]
  }

  const rank = { red: 0, amber: 1, green: 2 }
  return recs.sort((a, b) => rank[a.severity] - rank[b.severity]).slice(0, ADVISOR_MAX_RECS)
}
