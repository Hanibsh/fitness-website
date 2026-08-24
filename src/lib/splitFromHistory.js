// Build a training split out of what you actually logged.
//
// The app used to assume the split came first. It doesn't have to: you can log
// freely from day one, and after a week or so of real sessions the shape of a
// routine is already sitting in the history — the same handful of workouts, in
// roughly the same order, with roughly the same set counts. This module reads
// that shape back out and proposes a split from it.
//
// Pure and portable (same rule as program.js / dashboard.js): no React, no
// storage, no navigation. It produces a program object built with program.js's
// own factories, so the result is indistinguishable from a hand-built split and
// every existing consumer — the logger's prefill, the calendar projection,
// finish-time split sync — works on it unchanged.
//
// Nothing here writes anything. The caller previews the proposal and the user
// confirms it; a routine the user never asked for is not a feature.

import { canonicalExerciseId, newSupersetId, setHasWork } from './workoutStats'
import { createDay, createPlannedExercise, emptyProgram, canChooseLaterality } from './program'

// How far back to read, and how much evidence is enough to offer at all. Four
// sessions is "a week or so" for most people and two of anything is the least
// that can show a pattern — one workout repeated isn't a split, it's a workout.
export const WINDOW_DAYS = 21
export const MIN_SESSIONS = 4

const DAY_MS = 24 * 60 * 60 * 1000

// ---- Exercise identity ------------------------------------------------------

// The same rule matchesPlanned uses (program.js): library id when both sides
// resolve to one — so a renamed exercise still lines up — else the name.
function exKey(ex) {
  return canonicalExerciseId(ex?.exerciseId) || (ex?.name || '').trim().toLowerCase()
}

function nameKey(s) {
  return (s || '').trim().toLowerCase()
}

// Only exercises with real work count toward the shape of a day. A row added
// and never filled in says nothing about what you train.
function workedExercises(session) {
  return (session?.exercises || []).filter((ex) => (ex.sets || []).some((s) => setHasWork(s, ex.kind)))
}

// ---- Small stats ------------------------------------------------------------

function median(nums) {
  if (!nums.length) return 0
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

// The most common value, ties broken by first appearance — used for names,
// where "whatever you called it most often" is the honest answer.
function mode(values) {
  const counts = new Map()
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1)
  let best = null
  let bestN = 0
  for (const [v, n] of counts) {
    if (n > bestN) { best = v; bestN = n }
  }
  return best
}

// ---- Should we even offer? --------------------------------------------------

export function sessionsInWindow(sessions, { now = Date.now(), windowDays = WINDOW_DAYS } = {}) {
  const cutoff = now - windowDays * DAY_MS
  return (sessions || [])
    .filter((s) => s && s.date >= cutoff && s.date <= now + DAY_MS && workedExercises(s).length)
    .sort((a, b) => a.date - b.date)
}

// Is there enough logged history to shape a split out of? Independent of
// whether any split already exists: building one from your workouts adds a new
// split alongside whatever you have, so the split page can always offer it.
export function canBuildFromHistory(sessions, opts = {}) {
  return sessionsInWindow(sessions, opts).length >= MIN_SESSIONS
}

// PROMPTING for it is a stricter question than allowing it. Only someone with
// no split at all. Once a split exists
// the finish-time sync is the right mechanism for keeping it honest, and a
// second "build from history" nudge on top of it would just be noise.
export function shouldSuggestSplit(sessions, programsState, opts = {}) {
  const hasSplit = Array.isArray(programsState?.programs)
    ? programsState.programs.length > 0
    : !!programsState
  if (hasSplit) return false
  return sessionsInWindow(sessions, opts).length >= MIN_SESSIONS
}

// ---- Clustering: which sessions are the same workout? -----------------------

// How alike two workouts are, 0–1 (intersection over union of their exercises).
function overlap(aKeys, bKeys) {
  if (!aKeys.size || !bKeys.size) return 0
  let shared = 0
  for (const k of aKeys) if (bKeys.has(k)) shared++
  return shared / (aKeys.size + bKeys.size - shared)
}

const SAME_WORKOUT = 0.5

// Group the window's sessions into distinct workouts.
//
// Oldest first, so a cluster's `sessions` read in the order they were trained —
// which is what the rotation below is built from. A session joins the cluster it
// looks most like; sharing a name is enough on its own (you called both of them
// "Push", that's a statement of intent), otherwise half the movements have to
// match. Anything else starts a new cluster.
export function clusterSessions(sessions, opts = {}) {
  const inWindow = sessionsInWindow(sessions, opts)
  const clusters = []

  for (const session of inWindow) {
    const keys = new Set(workedExercises(session).map(exKey))
    const name = nameKey(session.name)

    let best = null
    let bestScore = 0
    for (const c of clusters) {
      const named = name && c.names.some((n) => n === name)
      const score = named ? 1 : overlap(keys, c.keys)
      if (score > bestScore) { best = c; bestScore = score }
    }

    if (best && bestScore >= SAME_WORKOUT) {
      best.sessions.push(session)
      if (name) best.names.push(name)
      for (const k of keys) best.keys.add(k)
    } else {
      clusters.push({ sessions: [session], names: name ? [name] : [], keys: new Set(keys) })
    }
  }

  // A workout done once in three weeks isn't part of a routine — it's a one-off.
  // Kept only when dropping it would leave nothing to build from.
  const repeated = clusters.filter((c) => c.sessions.length >= 2)
  return repeated.length ? repeated : clusters
}

// ---- One cluster → one training day -----------------------------------------

// What to call this day: whatever you named these sessions most often, else a
// positional fallback the user can rename in the editor.
function clusterName(cluster, index) {
  const named = cluster.sessions.map((s) => (s.name || '').trim()).filter(Boolean)
  if (!named.length) return `Day ${index + 1}`
  // Mode over the lowercased key, but return the original casing of the first
  // session that used it.
  const key = mode(named.map(nameKey))
  return named.find((n) => nameKey(n) === key) || named[0]
}

// Working sets only — warm-ups aren't part of the plan's target (the same rule
// effectiveSets applies in workoutStore).
function workingSetCount(ex) {
  return (ex.sets || []).filter((s) => s.type !== 'warmup' && setHasWork(s, ex.kind)).length
}

// The rep target this exercise has been trained at. Reps are read per limb for
// unilateral sets so a left/right session isn't counted as double the reps.
function loggedReps(ex) {
  const out = []
  for (const s of ex.sets || []) {
    if (s.type === 'warmup') continue
    if (s.left) {
      for (const side of [s.left, s.right]) {
        const r = Number(side?.reps)
        if (r > 0) out.push(r)
      }
    } else {
      const r = Number(s.reps)
      if (r > 0) out.push(r)
    }
  }
  return out
}

const DEFAULT_RANGE = { low: 6, high: 10 }

// A double-progression target that matches how the exercise has actually been
// trained. Built from the middle of the logged reps rather than the extremes —
// one heavy triple inside a set of tens shouldn't drag the range down to 3.
// Exported because the generator gives a returning user their own rep ranges
// for movements they already train, and one rule for that is enough.
export function repRangeFor(repsPerSession) {
  const all = repsPerSession.flat()
  if (all.length < 2) return { ...DEFAULT_RANGE }
  const sorted = [...all].sort((a, b) => a - b)
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))]
  let low = Math.round(at(0.25))
  let high = Math.round(at(0.75))
  if (high < low) [low, high] = [high, low]
  // A range needs room to progress into: everything at 10 becomes 8–12, not
  // 10–10, which would be un-progressable the moment it's created.
  if (high - low < 2) {
    low = Math.max(1, low - 1)
    high = low + 3
  }
  return { low: Math.max(1, low), high: Math.min(50, Math.max(low + 1, high)) }
}

// Does the plan get an opinion on left/right logging for this movement? Only
// where the DB leaves it open — canChooseLaterality decides, exactly as the
// builder's own toggle does — and only when the sessions agree with each other.
function lateralityFor(entries) {
  const votes = entries.flatMap((ex) =>
    (ex.sets || []).filter((s) => s.type !== 'warmup' && setHasWork(s, ex.kind)).map((s) => !!s.left)
  )
  if (!votes.length) return null
  const uni = votes.filter(Boolean).length
  if (uni === votes.length) return true
  if (uni === 0) return false
  return null // mixed — no opinion, let the DB and history decide
}

// Turn one cluster into a training day.
//
// An exercise earns a slot by turning up in at least half the cluster's
// sessions: that's the difference between what you train and what you happened
// to do once. Order follows the median position it was logged at, so the day
// reads in the order you actually work through it.
export function dayFromCluster(cluster, index = 0) {
  const sessions = cluster.sessions
  const seen = new Map() // key -> { entries, positions, name, exerciseId, kind, supersetKeys }

  for (const session of sessions) {
    const exercises = workedExercises(session)
    exercises.forEach((ex, pos) => {
      const key = exKey(ex)
      if (!key) return
      let rec = seen.get(key)
      if (!rec) {
        rec = { key, entries: [], positions: [], sessionIds: new Set(), name: ex.name, exerciseId: ex.exerciseId || null, kind: ex.kind || 'strength', partners: new Map() }
        seen.set(key, rec)
      }
      rec.entries.push(ex)
      rec.positions.push(pos)
      rec.sessionIds.add(session.id)
      // Who was this paired with? Superset partners within the same session.
      if (ex.supersetId) {
        for (const other of exercises) {
          if (other === ex || other.supersetId !== ex.supersetId) continue
          const ok = exKey(other)
          if (ok) rec.partners.set(ok, (rec.partners.get(ok) || 0) + 1)
        }
      }
    })
  }

  const threshold = Math.max(1, Math.ceil(sessions.length / 2))
  const kept = [...seen.values()]
    .filter((rec) => rec.sessionIds.size >= threshold)
    .sort((a, b) => median(a.positions) - median(b.positions))

  const day = createDay('train', clusterName(cluster, index))
  const byKey = new Map()

  day.exercises = kept.map((rec) => {
    const sets = Math.max(1, Math.round(median(rec.entries.map(workingSetCount))) || 1)
    const planned = createPlannedExercise(rec.name, {
      exerciseId: rec.exerciseId || null,
      kind: rec.kind,
      sets,
      repRange: rec.kind === 'cardio' ? { ...DEFAULT_RANGE } : repRangeFor(rec.entries.map(loggedReps)),
    })
    const wanted = lateralityFor(rec.entries)
    planned.unilateral = wanted !== null && canChooseLaterality(planned) ? wanted : null
    byKey.set(rec.key, planned)
    return planned
  })

  // Re-mint supersets: a pairing carries into the plan only when both partners
  // made the cut and they were paired in most of the sessions they shared.
  const grouped = new Set()
  for (const rec of kept) {
    const planned = byKey.get(rec.key)
    if (!planned || grouped.has(rec.key)) continue
    const partners = [...rec.partners.entries()]
      .filter(([k, n]) => byKey.has(k) && !grouped.has(k) && n >= Math.ceil(rec.entries.length / 2))
      .map(([k]) => k)
    if (!partners.length) continue
    const id = newSupersetId()
    planned.supersetId = id
    grouped.add(rec.key)
    for (const k of partners) {
      byKey.get(k).supersetId = id
      grouped.add(k)
    }
  }

  return day
}

// ---- Schedule shape ---------------------------------------------------------

// Mon=0 … Sun=6, matching program.js's fixed-week day order.
function weekdayIndex(ts) {
  return (new Date(ts).getDay() + 6) % 7
}

// Does this history look like a FIXED WEEK — the same workouts on the same
// weekdays, week after week? That's a different claim from "trains 4x a week",
// and it's the one that decides whether the split should be 7 days (which is
// how scheduleMode infers weekly) or a rotation.
//
// Requires: at least two weeks of data, at least two distinct training
// weekdays, every cluster landing on a consistent weekday, and no two clusters
// fighting over the same one.
function weeklyShape(clusters, inWindow) {
  if (inWindow.length < 2) return null
  const span = inWindow[inWindow.length - 1].date - inWindow[0].date
  if (span < 13 * DAY_MS) return null

  const claimed = new Map() // weekday -> cluster index
  const placement = []
  for (let i = 0; i < clusters.length; i++) {
    const days = clusters[i].sessions.map((s) => weekdayIndex(s.date))
    const dominant = mode(days)
    // Every session of this workout has to have been on that weekday. One
    // Saturday makeup session and it isn't a fixed week any more.
    if (days.some((d) => d !== dominant)) return null
    if (claimed.has(dominant)) return null
    claimed.set(dominant, i)
    placement.push({ weekday: dominant, cluster: clusters[i], index: i })
  }
  if (placement.length < 2) return null
  return placement
}

// Average whole days between one session and the next, as a rest-day count.
function restGap(inWindow) {
  if (inWindow.length < 2) return 1
  const gaps = []
  for (let i = 1; i < inWindow.length; i++) {
    const days = Math.round((inWindow[i].date - inWindow[i - 1].date) / DAY_MS)
    if (days >= 1 && days <= 7) gaps.push(days)
  }
  if (!gaps.length) return 1
  return Math.min(2, Math.max(0, Math.round(median(gaps)) - 1))
}

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Name the proposal after the workouts in it — "Push / Pull" says more than
// "My split", and matters more than it sounds: building from history is now
// offered even when splits already exist, so two of them called "My split"
// would be indistinguishable in the list.
function suggestName(days) {
  const names = [...new Set(days.map((d) => d.name).filter(Boolean))]
  if (!names.length || names.length > 3) return 'My split'
  const joined = names.join(' / ')
  return joined.length <= 32 ? joined : 'My split'
}

// ---- The proposal -----------------------------------------------------------

// Build a split from history. Returns { program, summary } — or null when
// there isn't enough to go on. `summary` is what the preview renders; it exists
// so the modal never has to re-derive anything from the program it's showing.
export function programFromHistory(sessions, opts = {}) {
  const inWindow = sessionsInWindow(sessions, opts)
  if (inWindow.length < 2) return null

  const clusters = clusterSessions(sessions, opts)
  if (!clusters.length) return null

  const days = clusters.map((c, i) => dayFromCluster(c, i))
  const usable = days.filter((d) => d.exercises.length)
  if (!usable.length) return null

  const program = emptyProgram(opts.name || suggestName(usable))
  const weekly = weeklyShape(clusters, inWindow)
  const summaryDays = []

  if (weekly) {
    // A fixed week is exactly 7 days, Mon→Sun, with rest in the gaps —
    // scheduleMode reads weekly off the length alone, so there's no mode flag
    // to set and nothing for the user to configure.
    const byWeekday = new Map()
    for (const p of weekly) {
      const day = days[p.index]
      if (day.exercises.length) byWeekday.set(p.weekday, { day, cluster: p.cluster })
    }
    if (byWeekday.size) {
      for (let wd = 0; wd < 7; wd++) {
        const hit = byWeekday.get(wd)
        if (hit) {
          program.days.push(hit.day)
          summaryDays.push(daySummary(hit.day, hit.cluster, WEEKDAY_NAMES[wd]))
        } else {
          const rest = createDay('rest')
          program.days.push(rest)
          summaryDays.push(daySummary(rest, null, WEEKDAY_NAMES[wd]))
        }
      }
      return { program, summary: buildSummary('weekly', program, summaryDays, inWindow, opts) }
    }
  }

  // Otherwise a rotating cycle: your workouts in the order you did them, with
  // rest days matching the gap you've been leaving between sessions.
  const rest = restGap(inWindow)
  usable.forEach((day) => {
    const cluster = clusters[days.indexOf(day)]
    program.days.push(day)
    summaryDays.push(daySummary(day, cluster, null))
    // Rest after every training day, the last one included — the cycle wraps,
    // so a trailing rest is the gap between the last workout and the first.
    for (let r = 0; r < rest; r++) {
      const restDay = createDay('rest')
      program.days.push(restDay)
      summaryDays.push(daySummary(restDay, null, null))
    }
  })

  return { program, summary: buildSummary('cycle', program, summaryDays, inWindow, opts) }
}

function daySummary(day, cluster, weekday) {
  return {
    id: day.id,
    name: day.name,
    kind: day.kind,
    weekday,
    exerciseCount: day.exercises.length,
    fromSessions: cluster ? cluster.sessions.length : 0,
    sample: day.exercises.slice(0, 3).map((e) => e.name),
  }
}

function buildSummary(mode_, program, days, inWindow, opts) {
  const training = program.days.filter((d) => d.kind !== 'rest').length
  return {
    mode: mode_,
    // The same phrasing the split list uses for a saved split, so the preview
    // and the list describe the result identically.
    shapeLabel:
      mode_ === 'weekly'
        ? `Fixed week · ${training} training day${training !== 1 ? 's' : ''}`
        : `${program.days.length}-day rotation · ${training} training day${training !== 1 ? 's' : ''}`,
    sourceCount: inWindow.length,
    windowDays: opts.windowDays || WINDOW_DAYS,
    days,
  }
}
