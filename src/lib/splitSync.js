// Session → split reconciliation.
//
// A session started from the split drifts from it: you add a fourth set, drop a
// movement, bolt on a finisher, swap a busy machine, retune a rep target. None
// of that should silently rewrite the plan — but none of it should be stranded
// in one log either. This module describes the drift as a list of individually
// acceptable changes, and applies the ones the user picks.
//
// Pure and portable (same shape as program.js / workoutStats.js): no storage, no
// React. Exercises line up against plan rows via plannedRowFor — plan link when
// there is one, otherwise library id or name, so workouts logged before plan
// links existed (or logged by hand) reconcile just the same.
//
// Deliberately NOT synced:
//   - weight and logged reps: a planned exercise has nowhere to put them. They
//     carry forward from your last session as suggestions, not from the plan.
//   - notes: shared per movement, not per plan row (see workoutStore).

import { createPlannedExercise, matchesPlanned, plannedRowFor, isOpenSlot } from './program'
import { newSupersetId, pruneSupersets, regroupSupersets, setHasWork } from './workoutStats'

const DEFAULT_REP_RANGE = { low: 6, high: 10 }

// Sets that count as prescription: actually logged, warm-ups excluded. A warm-up
// is ad-hoc ramping, not something the plan should start prescribing.
function prescribedSetCount(ex) {
  return ex.sets.filter((s) => s.type !== 'warmup' && setHasWork(s, ex.kind)).length
}

// Did this exercise happen at all? Warm-ups count here, unlike above: an
// exercise you only warmed up on before the rack was taken still HAPPENED, and
// should keep its place in the plan rather than read as skipped.
function exerciseHappened(ex) {
  return (ex.sets || []).some((s) => setHasWork(s, ex.kind))
}

function sameRepRange(a, b) {
  if (!a && !b) return true
  if (!a || !b) return false
  return Number(a.low) === Number(b.low) && Number(a.high) === Number(b.high)
}

function repRangeLabel(r) {
  return r && r.low != null && r.high != null ? `${r.low}–${r.high}` : 'none'
}

// The shape this exercise's WORKING sets were actually LOGGED in, or null when
// there's no single answer. Read from the sets themselves (`!!set.left`) rather
// than the exercise's `unilateral` flag, which is cosmetic — it only decides
// what the toggle says and what a fresh "add set" inherits, while each set's real
// shape is what got logged. Null for: cardio, bodyweight-loaded (no L/R shape
// exists), a movement whose laterality the DB fixes, nothing logged, or working
// sets that disagree with EACH OTHER — a plan row holds one flag, so that mix
// isn't representable and is left alone rather than flattened into a lie.
//
// Warm-ups are not consulted, deliberately, and for the same reason
// prescribedSetCount ignores them: this flag governs the sets the plan
// prescribes, and a bilateral ramp into unilateral work is a normal way to train
// one movement, not a contradiction to resolve. The warm-up's own shape survives
// because replaying it reads the log rather than this flag — see
// setsFromPrevious, which lets the plan's opinion reach working sets only.
function loggedLaterality(ex) {
  if (ex.kind === 'cardio' || ex.bodyweight) return null
  if ((ex.laterality || 'both') !== 'both') return null
  const working = ex.sets.filter((s) => s.type !== 'warmup' && setHasWork(s, ex.kind))
  if (!working.length) return null
  const uni = working.filter((s) => !!s.left).length
  if (uni === working.length) return true
  if (uni === 0) return false
  return null
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

// Does the session run the shared exercises in a different order than the plan?
// Compared only over rows the two SHARE: a row the session didn't contain can't
// testify about where it belongs, and a hand-added finisher has no plan position
// to disagree with yet (its `add` carries its own anchor).
function orderDiffers(pairs, day) {
  const seq = pairs.map(({ pe }) => pe?.id).filter(Boolean)
  if (seq.length < 2) return false
  const shared = new Set(seq)
  return day.exercises.filter((pe) => shared.has(pe.id)).map((pe) => pe.id).join('|') !== seq.join('|')
}

// What this session says about the split day it came from, as a list of changes
// the user can accept or skip individually. Empty list = they already agree.
//
// `id` is stable across recomputes so checkbox state survives re-renders.
//
// `complete` says whether the session is finished (being saved, or edited
// afterwards) rather than in progress. Mid-workout you're "below" the plan on
// everything you haven't reached yet, so proposing to cut the plan down to what
// you've logged so far would nag through every session — set-count DECREASES and
// removals both wait for the end, where they're a real signal.
//
// `droppedPlannedIds` are plan rows the user explicitly deleted from the session.
// A row that's merely absent is an absence (you ran out of time); a row you
// deleted is an instruction. Only the second may be applied unattended, so the
// difference rides along as `soft` on each remove.
//
// `ignoreSwaps` are plan rows whose substitution the user already declined for
// this session — asked once at swap time, not asked again at the end.
export function diffSessionAgainstDay(exercises = [], day, { complete = false, droppedPlannedIds = [], ignoreSwaps = [] } = {}) {
  if (!day) return []

  // Once the session is done, an exercise with nothing logged didn't happen: an
  // empty row added by mistake must not become a prescription, and a planned
  // exercise you never started must not drag its set count to zero (it becomes a
  // soft removal below instead). Mid-session every row is empty until you log
  // it, so this can only ever apply when complete.
  const live = complete ? exercises.filter(exerciseHappened) : exercises
  const pairs = pairWithPlan(live, day)
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
      unilateral: loggedLaterality(ex),
      // The note follows the movement, so a row added here starts with whatever
      // the session had — which is that movement's shared note already.
      note: ex.note || '',
      afterPeId,
    })
  }

  // Per-exercise prescription drift, for the rows the two share.
  const declined = new Set(ignoreSwaps)
  for (const { ex, pe } of pairs) {
    if (!pe) continue

    // A substitution keeps the plan link — the slot is still this slot, but what
    // it IS changed. Only reachable through plannedRowFor's link branch: a
    // fallback pairing matches BY identity, so it can't disagree about identity.
    const swapped = !matchesPlanned(ex, pe) || (ex.kind || 'strength') !== (pe.kind || 'strength')
    // An OPEN slot asked you to choose a movement, and you did. That is the row
    // working as designed, not a deviation from it — offering to write today's
    // pick back into the plan would quietly close a slot the split deliberately
    // left open, every single session.
    if (swapped && !declined.has(pe.id) && !isOpenSlot(pe)) {
      changes.push({
        id: `swap:${pe.id}`,
        kind: 'swap',
        name: ex.name,
        from: pe.name,
        peId: pe.id,
        exerciseId: ex.exerciseId || null,
        exKind: ex.kind || 'strength',
      })
    }

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

    // A plan row with no opinion means "whatever the DB says", which for a
    // movement the DB leaves open IS bilateral — so a bilateral session against a
    // silent row is agreement, not drift, and this can't fire on every legacy
    // split the first time it's opened.
    const lat = loggedLaterality(ex)
    const plannedLat = typeof pe.unilateral === 'boolean' ? pe.unilateral : false
    if (lat !== null && lat !== plannedLat) {
      changes.push({ id: `laterality:${pe.id}`, kind: 'laterality', name: ex.name, peId: pe.id, unilateral: lat })
    }
  }

  // Plan rows this session dropped. Only once the session is done — mid-workout
  // you're "missing" everything you haven't reached yet.
  if (complete) {
    const dropped = new Set(droppedPlannedIds)
    const kept = new Set(pairs.map(({ pe }) => pe?.id).filter(Boolean))
    for (const pe of day.exercises) {
      if (kept.has(pe.id)) continue
      changes.push({ id: `remove:${pe.id}`, kind: 'remove', name: pe.name, peId: pe.id, soft: !dropped.has(pe.id) })
    }
  }

  // Order is all-or-nothing for the same reason pairing is: a sequence only
  // means something whole. It carries its own resolved pairing so applying never
  // has to re-match — and so a row ADDED in the same pass can be placed by
  // session order too, through the link that add mints.
  if (orderDiffers(pairs, day)) {
    changes.push({
      id: 'order',
      kind: 'order',
      name: 'Exercise order',
      slots: pairs.map(({ ex, pe }) => ({ draftExerciseId: ex.id, peId: pe?.id || null })),
    })
  }

  // Pairing is one all-or-nothing change: the partition only makes sense whole.
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

// Rewrite a day to the session's order. Rows the session didn't contain — a
// planned exercise you skipped, one you never reached — have no opinion about
// where they belong, but dumping them all at the end would restructure the day
// every time you cut a session short. Instead each is ANCHORED to the row it
// currently follows and rides along with it; the ones that lead the day keep
// leading it. Nothing can be lost: anything neither moved nor anchored is
// appended rather than dropped.
function reorderDay(exercises, desired) {
  const moving = new Set(desired)
  const head = []
  const trailers = new Map()
  let cur = null
  for (const pe of exercises) {
    if (moving.has(pe.id)) {
      cur = pe.id
      if (!trailers.has(cur)) trailers.set(cur, [])
    } else if (cur === null) {
      head.push(pe)
    } else {
      trailers.get(cur).push(pe)
    }
  }
  const byId = new Map(exercises.map((pe) => [pe.id, pe]))
  const out = [...head]
  for (const id of desired) {
    // A row the order names but a removal already took is simply skipped; its
    // trailers re-anchor to whatever survived before it.
    const pe = byId.get(id)
    if (pe) out.push(pe)
    out.push(...(trailers.get(id) || []))
  }
  const emitted = new Set(out.map((pe) => pe.id))
  for (const pe of exercises) if (!emitted.has(pe.id)) out.push(pe)
  return out
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
    const swaps = new Map(byKind('swap').map((c) => [c.peId, c]))
    const lats = new Map(byKind('laterality').map((c) => [c.peId, c.unilateral]))
    if (setChanges.size || rangeChanges.size || swaps.size || lats.size) {
      exercises = exercises.map((pe) => {
        if (!setChanges.has(pe.id) && !rangeChanges.has(pe.id) && !swaps.has(pe.id) && !lats.has(pe.id)) return pe
        const next = { ...pe }
        if (setChanges.has(pe.id)) next.sets = Math.max(1, setChanges.get(pe.id))
        if (rangeChanges.has(pe.id)) next.repRange = rangeChanges.get(pe.id)
        if (swaps.has(pe.id)) {
          // The slot survives, the movement changes: sets, rep target and
          // position all stay as planned — the same semantics as swapping a row
          // in the builder. A cardio row can't be half of a superset, so a swap
          // across that line has to let go of the pairing.
          const s = swaps.get(pe.id)
          next.name = s.name
          next.exerciseId = s.exerciseId || null
          next.kind = s.exKind
          if (s.exKind === 'cardio') next.supersetId = null
        }
        if (lats.has(pe.id)) next.unilateral = lats.get(pe.id)
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
        unilateral: c.unilateral ?? null,
        note: c.note || '',
      })
      links.set(c.draftExerciseId, pe.id)
      const at = c.afterPeId ? exercises.findIndex((x) => x.id === c.afterPeId) : -1
      const insertAt = c.afterPeId && at === -1 ? exercises.length : at + 1
      exercises = [...exercises.slice(0, insertAt), pe, ...exercises.slice(insertAt)]
    }

    // Order after the adds, so an exercise added in this same pass is placed by
    // SESSION order through the link the add just minted — accept both and the
    // new movement lands exactly where you logged it. When order is skipped (or
    // was never emitted) the add's own afterPeId anchor is what seats it.
    const ordering = byKind('order')[0]
    if (ordering) {
      const desired = []
      for (const s of ordering.slots) {
        const peId = s.peId || links.get(s.draftExerciseId)
        if (peId) desired.push(peId)
      }
      exercises = reorderDay(exercises, desired)
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
    }

    // Restore the two superset invariants once, for the changes that can break
    // them: a removal can orphan a partner, a reorder or a re-mint can scatter a
    // group. Skipped otherwise, so an apply that only touches set counts can
    // never quietly restructure a day.
    if (removals.size || ordering || pairing) exercises = regroupSupersets(pruneSupersets(exercises))

    return { ...day, exercises }
  })

  return { program: { ...program, days, updatedAt: Date.now() }, links }
}
