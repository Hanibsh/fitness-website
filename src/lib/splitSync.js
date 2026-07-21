// Session → split reconciliation.
//
// A session started from the split drifts from it: you add a fourth set, drop a
// movement, bolt on a finisher, retune a rep target. None of that should silently
// rewrite the plan — but none of it should be stranded in one log either. This
// module describes the drift as a list of individually acceptable changes, and
// applies the ones the user picks.
//
// Pure and portable (same shape as program.js / workoutStats.js): no storage, no
// React. Exercises line up against plan rows via plannedRowFor — plan link when
// there is one, otherwise library id or name, so workouts logged before plan
// links existed (or logged by hand) reconcile just the same.
//
// Deliberately NOT synced:
//   - weight: a planned exercise has nowhere to put one. Weights carry forward
//     from your last session via prefillFromHistory, not from the plan.
//   - notes: session notes are scratch, editable without touching the template.

import { createPlannedExercise, plannedRowFor } from './program'
import { newSupersetId, pruneSupersets, regroupSupersets, setHasWork } from './workoutStats'

const DEFAULT_REP_RANGE = { low: 6, high: 10 }

// Sets that count as prescription: actually logged, warm-ups excluded. A warm-up
// is ad-hoc ramping, not something the plan should start prescribing.
function prescribedSetCount(ex) {
  return ex.sets.filter((s) => s.type !== 'warmup' && setHasWork(s, ex.kind)).length
}

function sameRepRange(a, b) {
  if (!a && !b) return true
  if (!a || !b) return false
  return Number(a.low) === Number(b.low) && Number(a.high) === Number(b.high)
}

function repRangeLabel(r) {
  return r && r.low != null && r.high != null ? `${r.low}–${r.high}` : 'none'
}

// Canonical signature of a superset partition over {key, group} pairs, so two
// groupings can be compared regardless of id space or ordering.
function partitionSignature(items) {
  const groups = new Map()
  const singles = []
  for (const { key, group } of items) {
    if (group) {
      if (!groups.has(group)) groups.set(group, [])
      groups.get(group).push(key)
    } else {
      singles.push([key])
    }
  }
  return [...groups.values(), ...singles].map((g) => g.slice().sort().join('+')).sort().join('|')
}

// Line every session exercise up with its plan row, walking the session in
// order so two sets of the same movement can't both claim one row. `pe` is null
// for exercises the plan doesn't have.
function pairWithPlan(exercises, day) {
  const claimed = new Set()
  return exercises.map((ex) => {
    const pe = plannedRowFor(day, ex, claimed)
    if (pe) claimed.add(pe.id)
    return { ex, pe }
  })
}

// Do the session and the plan day disagree about which exercises are paired?
// Compared over the exercises they share, so a hand-added finisher (no plan row)
// or a planned exercise you skipped never counts as a difference on its own.
function supersetsDiffer(pairs, day) {
  const shared = pairs.filter(({ ex, pe }) => pe && ex.kind !== 'cardio')
  if (shared.length < 2) return false
  const common = new Set(shared.map(({ pe }) => pe.id))
  const draftSig = partitionSignature(shared.map(({ ex, pe }) => ({ key: pe.id, group: ex.supersetId })))
  const planSig = partitionSignature(
    day.exercises.filter((pe) => common.has(pe.id)).map((pe) => ({ key: pe.id, group: pe.supersetId }))
  )
  return draftSig !== planSig
}

// What this session says about the split day it came from, as a list of changes
// the user can accept or skip individually. Empty list = they already agree.
//
// `id` is stable across recomputes so checkbox state survives re-renders.
//
// `complete` says whether the session is finished (i.e. being edited afterwards)
// rather than in progress. It only gates set-count DECREASES: mid-workout you're
// always "below" the plan — one set into a planned three — and proposing to cut
// the plan down to what you've logged so far would nag through every session.
// Once the session is done, logging two of three planned sets is a real signal.
export function diffSessionAgainstDay(exercises = [], day, { complete = false } = {}) {
  if (!day) return []
  const pairs = pairWithPlan(exercises, day)
  const changes = []

  // Exercises the session has that the plan doesn't — positioned by the nearest
  // preceding exercise the two DO share, so a finisher added after Lat Pulldown
  // lands after Lat Pulldown rather than at the end of the day.
  let afterPeId = null
  for (const { ex, pe } of pairs) {
    if (pe) {
      afterPeId = pe.id
      continue
    }
    const sets = Math.max(1, prescribedSetCount(ex))
    changes.push({
      id: `add:${ex.id}`,
      kind: 'add',
      name: ex.name,
      draftExerciseId: ex.id,
      exerciseId: ex.exerciseId || null,
      exKind: ex.kind || 'strength',
      sets,
      repRange: ex.kind === 'cardio' ? null : ex.repRange || DEFAULT_REP_RANGE,
      afterPeId,
    })
  }

  // Per-exercise prescription drift, for the rows the two share.
  for (const { ex, pe } of pairs) {
    if (!pe) continue

    const count = prescribedSetCount(ex)
    if (count > 0 && count !== Number(pe.sets) && (complete || count > Number(pe.sets))) {
      changes.push({ id: `sets:${pe.id}`, kind: 'sets', name: ex.name, peId: pe.id, from: Number(pe.sets), to: count })
    }

    if (ex.kind !== 'cardio' && ex.repRange && !sameRepRange(ex.repRange, pe.repRange)) {
      changes.push({
        id: `repRange:${pe.id}`,
        kind: 'repRange',
        name: ex.name,
        peId: pe.id,
        from: repRangeLabel(pe.repRange),
        to: repRangeLabel(ex.repRange),
        repRange: { low: Number(ex.repRange.low), high: Number(ex.repRange.high) },
      })
    }
  }

  // Plan rows this session dropped.
  const kept = new Set(pairs.map(({ pe }) => pe?.id).filter(Boolean))
  for (const pe of day.exercises) {
    if (!kept.has(pe.id)) changes.push({ id: `remove:${pe.id}`, kind: 'remove', name: pe.name, peId: pe.id })
  }

  // Pairing is one all-or-nothing change: the partition only makes sense whole.
  // It carries its own resolved pairing so applying never has to re-match.
  if (supersetsDiffer(pairs, day)) {
    changes.push({
      id: 'supersets',
      kind: 'supersets',
      name: 'Superset pairing',
      groups: pairs.map(({ ex, pe }) => ({
        draftExerciseId: ex.id,
        peId: pe?.id || null,
        supersetId: ex.supersetId || null,
      })),
    })
  }

  return changes
}

// Apply the accepted `changes` to `dayId` of `program`. Returns the updated
// program plus `links` (draft exercise id → new plannedExerciseId) so the caller
// can stamp newly added exercises and keep them tied to the plan from now on.
// Never mutates its arguments; days other than `dayId` are returned untouched.
export function applySplitChanges(program, dayId, changes) {
  if (!program || !dayId || !changes?.length) return { program, links: new Map() }

  const links = new Map()
  const byKind = (k) => changes.filter((c) => c.kind === k)

  const days = program.days.map((day) => {
    if (day.id !== dayId) return day

    let exercises = day.exercises

    const removals = new Set(byKind('remove').map((c) => c.peId))
    if (removals.size) exercises = exercises.filter((pe) => !removals.has(pe.id))

    const setChanges = new Map(byKind('sets').map((c) => [c.peId, c.to]))
    const rangeChanges = new Map(byKind('repRange').map((c) => [c.peId, c.repRange]))
    if (setChanges.size || rangeChanges.size) {
      exercises = exercises.map((pe) => {
        if (!setChanges.has(pe.id) && !rangeChanges.has(pe.id)) return pe
        const next = { ...pe }
        if (setChanges.has(pe.id)) next.sets = Math.max(1, setChanges.get(pe.id))
        if (rangeChanges.has(pe.id)) next.repRange = rangeChanges.get(pe.id)
        return next
      })
    }

    // Insert in list order so two exercises added after the same anchor keep
    // their relative order; an anchor that was itself removed falls back to
    // the end, which is where it would have landed anyway.
    for (const c of byKind('add')) {
      const pe = createPlannedExercise(c.name, {
        exerciseId: c.exerciseId,
        kind: c.exKind,
        sets: c.sets,
        repRange: c.repRange || DEFAULT_REP_RANGE,
      })
      links.set(c.draftExerciseId, pe.id)
      const at = c.afterPeId ? exercises.findIndex((x) => x.id === c.afterPeId) : -1
      const insertAt = c.afterPeId && at === -1 ? exercises.length : at + 1
      exercises = [...exercises.slice(0, insertAt), pe, ...exercises.slice(insertAt)]
    }

    // Pairing last, over the final exercise list: session group ids are
    // session-scoped, so they're re-minted into the plan's own id space. Rows
    // the session didn't touch keep whatever pairing they already had.
    const pairing = byKind('supersets')[0]
    if (pairing) {
      const sessionGroupOf = new Map()
      for (const g of pairing.groups) {
        // A just-added exercise pairs via its brand-new plan row; everything
        // else via the row the diff already matched it to.
        const peId = g.peId || links.get(g.draftExerciseId)
        if (peId) sessionGroupOf.set(peId, g.supersetId)
      }
      const planGroupId = new Map()
      exercises = exercises.map((pe) => {
        if (!sessionGroupOf.has(pe.id)) return pe
        const g = sessionGroupOf.get(pe.id)
        if (!g) return { ...pe, supersetId: null }
        if (!planGroupId.has(g)) planGroupId.set(g, newSupersetId())
        return { ...pe, supersetId: planGroupId.get(g) }
      })
      exercises = regroupSupersets(pruneSupersets(exercises))
    }

    return { ...day, exercises }
  })

  return { program: { ...program, days, updatedAt: Date.now() }, links }
}
