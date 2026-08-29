// Training program + schedule.
//
// Pure, portable logic (same pattern as dashboard.js / workoutStats.js). A
// program is an ordered list of days; HOW it schedules is inferred from its
// shape — no mode setting for the user to understand:
//
//   - Exactly 7 days ⇒ a FIXED WEEKLY schedule, day 1 = Monday … day 7 =
//     Sunday (rest days are ordinary rest slots among the 7). The same day
//     always lands on the same weekday; missing a day never shifts anything.
//   - Any other length ⇒ a rotating CYCLE: `pointer` is the index of the next
//     day up. Completing a day advances the pointer (mod the cycle length).
//     Training days WAIT for you — a missed day shifts the plan forward, it
//     never skips a workout — while rest days pass on their own, one per
//     elapsed calendar day (see effectiveRotation). The exception is a day you
//     marked off as an INJURY, which spends its slot rather than banking it:
//     the workout you couldn't do isn't owed to you, so nothing after it moves.
//
// Each training day lists planned exercises with a target set count + rep
// range that pre-fill the logger when you start the session.

import { createExercise, createSet, convertSet, getExerciseNote, saveExerciseNote, exerciseNoteKey } from './workoutStore'
import { getExercise } from './exerciseLibrary'
import { plannedExerciseDbId } from './planStats'
import { lateralityFor, usesBodyweight } from './movements'
import { canonicalExerciseId, newSupersetId, pruneSupersets, regroupSupersets, exerciseBlocks } from './workoutStats'
import { patternPhrase } from '../data/movementPatterns'

export { plannedExerciseDbId }

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// Move an item within an array by delta, returning a new array. Shared by
// every reorderable list in the builder (routines, days, planned exercises).
export function moveInArray(arr, index, delta) {
  const to = index + delta
  if (to < 0 || to >= arr.length) return arr
  const next = arr.slice()
  const [item] = next.splice(index, 1)
  next.splice(to, 0, item)
  return next
}

// ---- Factories -------------------------------------------------------------

// A planned exercise inside a training day. `exerciseId` links to the DB when
// picked from the library (null for custom), `sets` is the target count, and
// `repRange` is the double-progression target.
//
// `unilateral` is the plan's opinion on left/right logging, for the movements
// the exercise DB leaves open (a dumbbell press works either way): true = log
// each limb, false = both limbs together, null = no opinion, follow the DB.
// Only ever read for 'both', non-bodyweight movements — a DB-fixed laterality
// can't be overridden by a plan, and bodyweight-loaded sets have no L/R shape.
// Null rather than false so splits built before this field read identically to
// a fresh row, with no migration.
// `slot` is what the row is there to DO, as opposed to what it currently says:
//
//   { pattern: 'vertical-pull', muscle: 'Lats', pinned: false, suggestedId: 'lat-pulldown-wide-grip' }
//
// A row with a slot prescribes a movement PATH and a target muscle; the
// exercise filling it is an implementation detail you can change without
// changing the plan. `pinned` means you have committed to this exact movement
// and don't want to be offered the path. `suggestedId` is the movement the
// generator would pick — it stays put even when the row is OPEN (exerciseId
// null, name reading "Any vertical pull"), because every planned-side
// calculation resolves through it, so an open slot still has honest volume and
// fatigue numbers instead of an estimate. See plannedExerciseDbId.
//
// Null on every hand-built row and on every split written before this existed,
// and null reads exactly as the app read before — nothing migrates.
export function createPlannedExercise(name, opts = {}) {
  const { exerciseId = null, kind = 'strength', sets = 3, repRange = { low: 6, high: 10 }, note = '', unilateral = null, slot = null } = opts
  return { id: newId(), exerciseId, name: name.trim().slice(0, 60), kind, sets: Math.max(1, sets), repRange, note, unilateral, slot }
}

// Is this row waiting for you to choose a movement?
export function isOpenSlot(pe) {
  return !!pe?.slot && !pe.exerciseId
}



export function createDay(kind = 'train', name = '') {
  return {
    id: newId(),
    kind,
    name: name || (kind === 'rest' ? 'Rest' : 'Training day'),
    exercises: [],
  }
}

export function emptyProgram(name = 'My split') {
  const now = Date.now()
  return { id: newId(), name, days: [], pointer: 0, createdAt: now, updatedAt: now }
}

// ---- Editing --------------------------------------------------------------
//
// Every mutator below takes a program and returns a NEW one — nothing is
// persisted here, the caller hands the result to saveProgram. They live in this
// module rather than in a page because the split UI is split across two pages
// (the overview edits days, the day page edits exercises) and both need them.

// Keep the "up next" pointer within the (possibly changed) day list.
function clampPointer(p) {
  const pointer = p.days.length ? p.pointer % p.days.length : 0
  return pointer === p.pointer ? p : { ...p, pointer }
}

// Apply a change to one day, leaving the rest of the program alone.
function withDay(program, dayId, fn) {
  return { ...program, days: program.days.map((d) => (d.id === dayId ? fn(d) : d)) }
}

// Apply a change to one exercise within one day.
function withExercise(program, dayId, exId, fn) {
  return withDay(program, dayId, (d) => ({ ...d, exercises: d.exercises.map((e) => (e.id === exId ? fn(e) : e)) }))
}

export function setProgramName(program, name) {
  return { ...program, name: name.slice(0, 60) }
}

// Takes an already-created day (createDay) rather than a kind, so the caller
// holds its id and can navigate straight into it.
export function appendDay(program, day) {
  return { ...program, days: [...program.days, day] }
}

export function removeDay(program, dayId) {
  return clampPointer({ ...program, days: program.days.filter((d) => d.id !== dayId) })
}

export function moveDay(program, index, delta) {
  return clampPointer({ ...program, days: moveInArray(program.days, index, delta) })
}

export function setDayName(program, dayId, name) {
  return withDay(program, dayId, (d) => ({ ...d, name: name.slice(0, 40) }))
}

export function addExercise(program, dayId, { name, category, exerciseId }) {
  const planned = createPlannedExercise(name, {
    exerciseId,
    kind: category === 'Cardio' ? 'cardio' : 'strength',
    // Whatever this movement's note already says, wherever it was written —
    // notes belong to the movement, not to the slot.
    note: getExerciseNote({ exerciseId, name }),
  })
  return withDay(program, dayId, (d) => ({ ...d, exercises: [...d.exercises, planned] }))
}

export function removeExercise(program, dayId, exId) {
  return withDay(program, dayId, (d) => ({ ...d, exercises: pruneSupersets(d.exercises.filter((e) => e.id !== exId)) }))
}

// Reorder by BLOCK: a contiguous superset group moves as one unit, exactly like
// the logger — nudging any member moves the whole pair.
export function moveExercise(program, dayId, exId, delta) {
  return withDay(program, dayId, (d) => {
    const blocks = exerciseBlocks(d.exercises)
    const from = blocks.findIndex((b) => b.some((e) => e.id === exId))
    if (from === -1 || from + delta < 0 || from + delta >= blocks.length) return d
    return { ...d, exercises: moveInArray(blocks, from, delta).flat() }
  })
}

export function setExerciseSets(program, dayId, exId, value) {
  const sets = value === '' ? '' : Math.max(1, Math.min(20, parseInt(value, 10) || 1))
  return withExercise(program, dayId, exId, (e) => ({ ...e, sets }))
}

export function setExerciseRep(program, dayId, exId, field, value) {
  const n = value === '' ? '' : Math.max(1, Math.min(50, parseInt(value, 10) || 0))
  return withExercise(program, dayId, exId, (e) => ({ ...e, repRange: { ...(e.repRange || { low: 6, high: 10 }), [field]: n } }))
}

// Whether this movement is logged one limb at a time. Two-state, not tri-: for a
// movement the DB leaves open, "no opinion" and "bilateral" look the same in the
// logger, so a third state would have nothing to say. Toggling just makes the
// row explicit — which is what a session syncing back writes anyway.
export function toggleExerciseUnilateral(program, dayId, exId) {
  return withExercise(program, dayId, exId, (e) => {
    const next = { ...e, unilateral: !e.unilateral }
    // Notes are keyed by laterality too, so flipping the form flips which note
    // this row is showing. Read the new one rather than carrying the old text
    // across — carrying it would copy a one-arm cue onto the bilateral form
    // (or the reverse) the moment the field next blurs.
    return { ...next, note: getExerciseNote(next) }
  })
}

// A note belongs to the MOVEMENT, not to this slot: writing one here writes it
// everywhere that movement appears. The shared store is the source of truth
// (that's what other splits and the logger read); the copy on each planned row
// is kept in step so this split renders right away without a reload.
export function setExerciseNote(program, dayId, exId, note) {
  const target = program.days.find((d) => d.id === dayId)?.exercises.find((e) => e.id === exId)
  if (!target) return program
  // An OPEN slot has no movement yet, so there is nothing for a movement-scoped
  // note to belong to. Writing one to the shared store would file it under the
  // pattern phrase and then show it on every future "any vertical pull" — so it
  // stays on the row until the slot is filled.
  if (!isOpenSlot(target)) saveExerciseNote(target, note)
  const trimmed = note.slice(0, 300)
  return {
    ...program,
    days: program.days.map((d) => ({
      ...d,
      // Same movement AND same form: the one-arm row and the bilateral row of a
      // movement that can be logged either way hold two different notes, so
      // writing one must not overwrite the other's copy.
      exercises: d.exercises.map((e) =>
        matchesPlanned(target, e) && exerciseNoteKey(e) === exerciseNoteKey(target) ? { ...e, note: trimmed } : e
      ),
    })),
  }
}

// Swap a planned exercise's identity (name/DB link/kind) in place — sets, rep
// target and note all stay as planned, only WHAT you're doing changes.
// `pattern` is the movement path of what you picked, when the caller knows it.
// A pick from inside the slot's own path leaves the slot alone; a pick from
// somewhere else RE-POINTS the slot rather than letting it keep claiming a path
// the row no longer follows — a slot that says "vertical pull" above a leg curl
// is worse than no slot at all.
export function substituteExercise(program, dayId, exId, { name, category, exerciseId, pattern }) {
  return withExercise(program, dayId, exId, (e) => {
    const slot = e.slot && pattern && pattern !== e.slot.pattern ? { ...e.slot, pattern } : e.slot
    return {
      ...e,
      name: name.trim().slice(0, 60),
      exerciseId,
      kind: category === 'Cardio' ? 'cardio' : 'strength',
      slot,
    }
  })
}

// Commit this row to the movement it currently names, or hand it back to its
// path. Unpinning CLEARS the movement (the row reads "Any vertical pull" again)
// but keeps it as the slot's suggestion, so the numbers don't move and the
// picker still opens on it.
export function setSlotPinned(program, dayId, exId, pinned) {
  return withExercise(program, dayId, exId, (e) => {
    if (!e.slot) return e
    // Nothing to pin to, and nothing to un-pin from: a row with no movement is
    // already as open as it gets.
    if (!e.exerciseId) return e
    if (pinned) return { ...e, slot: { ...e.slot, pinned: true } }
    const suggestedId = e.exerciseId || e.slot.suggestedId || null
    return {
      ...e,
      exerciseId: null,
      name: patternPhrase(e.slot.pattern),
      slot: { ...e.slot, pinned: false, suggestedId },
    }
  })
}

// Same superset model as the logger: partners share a supersetId, groups are
// pulled contiguous on pairing, lone leftovers are pruned back to standalone.
export function pairSuperset(program, dayId, exId, targetId) {
  return withDay(program, dayId, (d) => {
    const a = d.exercises.find((e) => e.id === exId)
    const b = d.exercises.find((e) => e.id === targetId)
    if (!a || !b || a.kind === 'cardio' || b.kind === 'cardio') return d
    const groupId = b.supersetId || a.supersetId || newSupersetId()
    const exercises = d.exercises.map((e) => (e.id === exId || e.id === targetId ? { ...e, supersetId: groupId } : e))
    return { ...d, exercises: regroupSupersets(pruneSupersets(exercises)) }
  })
}

export function unpairSuperset(program, dayId, exId) {
  return withDay(program, dayId, (d) => ({
    ...d,
    exercises: pruneSupersets(d.exercises.map((e) => (e.id === exId ? { ...e, supersetId: null } : e))),
  }))
}

// ---- Scheduling ------------------------------------------------------------

const DAY_MS = 86400000

// How this program schedules — inferred from its shape, never stored.
export function scheduleMode(program) {
  return program?.days?.length === 7 ? 'weekly' : 'rotating'
}

// Monday-first weekday index (Mon=0 … Sun=6), matching the weekly-streak
// convention in dashboard.js.
function mondayIndex(ts) {
  return (new Date(ts).getDay() + 6) % 7
}

function startOfDay(ts) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// Step n calendar days from ts, landing on local midnight. Uses setDate so a
// DST shift (23/25-hour day) still lands on the right day — `ts + n * DAY_MS`
// doesn't.
function addDays(ts, n) {
  const d = new Date(ts)
  d.setDate(d.getDate() + n)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// Whole calendar days from a to b (both local midnights). Safe across DST,
// unlike (b - a) / DAY_MS, because it rounds off the ±1h a transition adds.
function daysBetween(a, b) {
  return Math.round((b - a) / DAY_MS)
}

// Normalise a pointer into a valid day index.
function safeIndex(program) {
  const n = program.days.length
  return n ? ((program.pointer % n) + n) % n : 0
}

// Mark-off reasons that CONSUME the day's slot rather than pausing the
// rotation. An injury isn't a workout you're owed: you couldn't train that day,
// so the split carries on without it and the calendar keeps its shape — the day
// after an injury is whatever it was always going to be. Every other reason
// still waits for you (and can be moved past by hand, see advanceProgram).
//
// Ids match dayLog.js's DAY_REASONS, spelled out here rather than imported —
// dayLog imports THIS module, so the arrow only points one way.
const SLOT_CONSUMING_REASONS = new Set(['injury'])

// Split the mark-offs into the two things they can do to the rotation, keyed by
// local midnight. Every scheduling read derives its sets from here, so "which
// reasons consume" is answered in exactly one place.
function annotationDays(annotations) {
  const paused = new Set()
  const consumed = new Set()
  for (const a of annotations || []) {
    ;(SLOT_CONSUMING_REASONS.has(a.reason) ? consumed : paused).add(startOfDay(a.date))
  }
  return { paused, consumed }
}

// Does a mark-off with this reason move the rotation on by itself? The logger
// card asks so it can drop the manual "skip ahead" offer for the reasons that
// don't need it — offering to do something that already happened reads as a
// second skip.
export function reasonConsumesSlot(reason) {
  return SLOT_CONSUMING_REASONS.has(reason)
}

// Walk the rotation forward over the days (from, to] — i.e. every calendar day
// strictly after `from` and strictly before `to`, the ones that have fully
// elapsed. THE rule, in one place: a day marked off with a consuming reason
// (injury) eats its slot whatever that slot was, a training day otherwise waits
// for the user (the walk stops dead), a rest day is consumed by one elapsed
// calendar day, and any other mark-off consumes nothing. Both the "where does
// the rotation stand now" read (effectiveRotation) and the "what fell on this
// past date" read (rotationDayForPastDate) go through here so they can't drift
// apart.
function walkRotation(program, index, from, to, { paused, consumed }) {
  const n = program.days.length
  let i = index
  for (let d = addDays(from, 1); d < to; d = addDays(d, 1)) {
    if (consumed.has(d)) {
      i = (i + 1) % n // injured: this slot is spent, training day or not
      continue
    }
    if (program.days[i].kind !== 'rest') break // training day: waits for the user
    if (!paused.has(d)) i = (i + 1) % n // rest day consumed by elapsed day d
  }
  return i
}

// Where a ROTATING program actually stands as of `now` — the single source of
// truth for "which day is up" (todayPlan and plannedDayForDate both build on
// it, so the logger, dashboard and calendar can never disagree again).
//
// Returns { index, anchor }: days[index] is the pending day, planned for the
// `anchor` date (today, or tomorrow when the rotation already advanced today).
//
// Training days wait for the user — the rotation drifts with reality, a missed
// day never skips a workout. Rest days pass on their own: each fully-elapsed
// calendar day since the last advance consumes one pending rest day, no tap
// needed. Today itself is still ongoing, so a rest day SHOWS as rest today and
// auto-passes at tomorrow's read — and so does an injured day, which is what
// lets you still log it anyway before the split moves on. Marked-off dates
// consume no slot unless the reason says otherwise (SLOT_CONSUMING_REASONS),
// matching plannedDayForDate's skip rule. Pure read-time computation — nothing
// is written, so viewing on two devices can't race the synced blob.
export function effectiveRotation(program, { now = Date.now(), annotations = [] } = {}) {
  const today = startOfDay(now)
  if (!program || !program.days?.length) return { index: 0, anchor: today }
  const index = safeIndex(program)
  // Clamp a future stamp (clock skew, another device ahead of us) to today.
  const stamp = program.lastAdvancedAt ? Math.min(startOfDay(program.lastAdvancedAt), today) : null
  if (stamp === today) return { index, anchor: addDays(today, 1) } // advanced today → pointer day is tomorrow's
  if (stamp == null) return { index, anchor: today } // never advanced / legacy blob: no reference point, no auto-pass
  return { index: walkRotation(program, index, stamp, today, annotationDays(annotations)), anchor: today }
}

// THE canonical answer to "what does the program say about today?" — every
// surface (logger card, dashboard hero, calendar) derives from this, never
// from the raw pointer. Returns { status, day, annotation }:
//
//   'none'  — no program / empty program (day is null)
//   'done'  — today's slot is complete. Weekly: a training day with a session
//             already logged (`trainedToday`, caller-supplied — this module
//             knows nothing about sessions). Rotating: the pointer advanced
//             today, so `day` is the NEXT day up (planned for tomorrow).
//   'off'   — today is annotated (sick/travel/…); `day` is what was planned.
//   'rest' / 'train' — today's pending day, in `day`.
//
// Precedence: done > off > rest/train (finishing a workout outranks a mark-off).
export function todayPlan(program, { now = Date.now(), annotations = [], trainedToday = false } = {}) {
  if (!program || !program.days?.length) return { status: 'none', day: null, annotation: null }
  const today = startOfDay(now)
  const annotation = annotations.find((a) => startOfDay(a.date) === today) || null
  if (scheduleMode(program) === 'weekly') {
    const day = program.days[mondayIndex(today)]
    if (day.kind === 'train' && trainedToday) return { status: 'done', day, annotation }
    if (annotation) return { status: 'off', day, annotation }
    return { status: day.kind === 'rest' ? 'rest' : 'train', day, annotation }
  }
  const { index, anchor } = effectiveRotation(program, { now, annotations })
  const day = program.days[index]
  if (anchor > today) return { status: 'done', day, annotation }
  if (annotation) return { status: 'off', day, annotation }
  return { status: day.kind === 'rest' ? 'rest' : 'train', day, annotation }
}

// Move the pointer to the slot after `dayId` (mod length). Falls back to
// advancing the current pointer if the id isn't found (e.g. the day was
// deleted). Returns a new program object. `lastAdvancedAt` anchors the
// projection (see effectiveRotation): it's stamped from the SESSION's date —
// not the wall clock — so logging yesterday's missed workout today consumes
// yesterday's slot and today still shows today's plan. Clamped to no later
// than today. Weekly programs are date-driven — nothing to advance, so this
// is a safe no-op there.
export function advanceProgram(program, dayId, { sessionDate = Date.now(), now = Date.now() } = {}) {
  if (!program || !program.days.length) return program
  if (scheduleMode(program) === 'weekly') return program
  const idx = program.days.findIndex((d) => d.id === dayId)
  const from = idx === -1 ? safeIndex(program) : idx
  const stamp = Math.min(startOfDay(sessionDate), startOfDay(now))
  return {
    ...program,
    pointer: (from + 1) % program.days.length,
    lastAdvancedAt: stamp,
    advances: appendAdvance(program.advances, { date: stamp, dayId: program.days[from].id }),
    updatedAt: Date.now(),
  }
}

// Manual correction: point AT `dayId` directly (unlike advanceProgram, which
// moves past a day). Lets a user fix the rotation if it drifted from reality
// — a forgotten skip, a workout logged out of order, etc. The stamp is set to
// YESTERDAY, which effectiveRotation reads as "this day became pending today":
// the chosen day projects onto today (same as the old null-stamp behavior),
// and if it's a rest day it auto-passes starting tomorrow instead of sticking
// until tapped. Deliberately reuses the one existing field — no schema change,
// old blobs with a null/undefined stamp stay valid. No-op if the day isn't
// found.
export function setPointerToDay(program, dayId, { now = Date.now() } = {}) {
  if (!program || !program.days.length) return program
  const idx = program.days.findIndex((d) => d.id === dayId)
  if (idx === -1) return program
  const stamp = addDays(now, -1)
  return {
    ...program,
    pointer: idx,
    lastAdvancedAt: stamp,
    // The user is telling us the rotation drifted, so anything the history
    // claims from the corrected point on was wrong — drop it. Entries before
    // it still describe days that really happened, so they stay.
    advances: (program.advances || []).filter((a) => startOfDay(a.date) < stamp),
    updatedAt: Date.now(),
  }
}

// ---- Rotation history ------------------------------------------------------
//
// A rotating split's pointer alone says where you stand TODAY and nothing about
// how you got there, so the calendar couldn't say which slot fell on a date last
// month. Two things answer that now:
//
//   - `advances`: one { date, dayId } per completed day, appended by
//     advanceProgram. Lives on the program blob (jsonb — no migration), and
//     records from here on.
//   - the SESSION LOG, which has held the same fact all along: a logged workout
//     that traces back to a split day says that day was completed on that date.
//     That's what an advance entry is. Reading it means dates from before
//     advance-recording existed still resolve, so an established log doesn't
//     have to wait weeks for its own past to make sense.

// Keep the log bounded — two years of daily training is well under this, and the
// whole blob is synced on every write.
const MAX_ADVANCES = 400

function appendAdvance(advances, entry) {
  // Same day twice (a re-log, an edit) replaces rather than stacks.
  const kept = (advances || []).filter((a) => startOfDay(a.date) !== entry.date)
  return [...kept, entry].sort((a, b) => a.date - b.date).slice(-MAX_ADVANCES)
}

// Every "day X was completed on date D" we can establish, oldest first — the
// recorded advances plus everything the session log proves. Sessions win where
// both speak: they're the workout itself rather than a note about it.
// dayForSession answers null unless the match is unambiguous, so a session that
// can't be placed simply contributes nothing.
//
// Expensive enough (it scores sessions against the split) that callers derive it
// ONCE for a whole range rather than per date — see statusContext.
export function rotationReferences(program, sessions = []) {
  if (!program?.days?.length) return []
  const byDate = new Map()
  for (const a of program.advances || []) byDate.set(startOfDay(a.date), a.dayId)
  for (const s of sessions) {
    const day = dayForSession(program, s)
    if (day) byDate.set(startOfDay(s.date), day.id)
  }
  return [...byDate]
    .map(([date, dayId]) => ({ date, dayId }))
    .sort((a, b) => a.date - b.date)
}

// The day a ROTATING program had pending on a PAST date, or null when nothing we
// know reaches back that far. Finds the last day proven complete at or before the
// target, then walks the rotation forward from the slot after it under the same
// rules as the live read (walkRotation).
export function rotationDayForPastDate(program, target, { annotations = [], references = [] } = {}) {
  let last = null
  for (const ref of references) {
    if (ref.date > target) break
    last = ref
  }
  if (!last) return null // target predates everything we know
  const idx = program.days.findIndex((d) => d.id === last.dayId)
  if (idx === -1) return null // that day was since deleted from the split
  // The day was completed ON the target date — that's the day it was.
  if (last.date === target) return program.days[idx]
  const start = (idx + 1) % program.days.length
  return program.days[walkRotation(program, start, last.date, target, annotationDays(annotations))]
}

// ---- Calendar projection -----------------------------------------------------

// Rotating projections drift with reality (any missed day shifts everything), so
// "what's next" refuses to reach further than this. The CALENDAR deliberately
// isn't capped by it — a projected month is a best guess, but a blank month is
// worse than a guess, and the grid is read as a plan rather than a promise.
export const PROJECTION_HORIZON_DAYS = 28

// The day this program plans for a calendar date, or null (empty program, a
// date you've marked off, or a past date history can't reach). Weekly programs
// are deterministic — the weekday decides, except an annotated date is
// suppressed (you already know you're off; no need for a training-day
// projection to say otherwise — the fixed weekly schedule itself doesn't
// shift). Rotating programs project the cycle forward from where the rotation
// actually stands (effectiveRotation — the same answer the logger and
// dashboard use), one day per date, starting at its anchor: today, or
// tomorrow if the rotation already advanced today. A PAUSED annotated date
// doesn't consume a slot: it's skipped and everything after it shifts up by
// one, same as if that day simply hadn't happened yet. An injured one is the
// opposite — it eats its slot like an ordinary day, so the projection after it
// doesn't move, and the date itself still answers WITH the day it ate rather
// than null (the calendar shows you what the injury cost). `annotations` is
// optional so callers that haven't been updated for this still work, just
// without the skip. Past dates are answered from the rotation history
// (rotationDayForPastDate), which reaches back as far as the log does — pass
// `sessions` (or precomputed `references`) for that, or omit them to only look
// forward.
export function plannedDayForDate(program, date, { now = Date.now(), annotations = [], sessions = [], references = null } = {}) {
  if (!program || !program.days.length) return null
  const target = startOfDay(date)
  const { paused: pausedDays } = annotationDays(annotations)
  if (pausedDays.has(target)) return null
  if (scheduleMode(program) === 'weekly') return program.days[mondayIndex(target)]
  const { index, anchor } = effectiveRotation(program, { now, annotations })
  if (target < anchor) {
    return rotationDayForPastDate(program, target, { annotations, references: references || rotationReferences(program, sessions) })
  }
  // Days from the anchor up to (not including) the target, less the paused ones
  // — those consume no slot. Counted arithmetically rather than walked: the grid
  // asks this for every cell, and a month a year out would otherwise be ~365
  // iterations × 31 cells on every repaint.
  let paused = 0
  for (const d of pausedDays) if (d >= anchor && d < target) paused++
  return program.days[(index + daysBetween(anchor, target) - paused) % program.days.length]
}

// Everything the day classifier needs, derived ONCE so a whole month costs what
// a single day used to. Also fixes the two callers (grid, summary) that used to
// re-derive their own view of "trained that day" and could disagree with the
// panel.
function statusContext(program, { sessions = [], annotations = [], now = Date.now(), inferDay = true } = {}) {
  const sessionsByDay = new Map()
  // The earliest day we have any record of. Before it there was no program and
  // no log, so a blank day there is genuinely nothing rather than a skip —
  // without this floor the grid would call 2019 a skipped session.
  let floor = program?.createdAt ? startOfDay(program.createdAt) : null
  for (const s of sessions) {
    const key = startOfDay(s.date)
    if (!sessionsByDay.has(key)) sessionsByDay.set(key, [])
    sessionsByDay.get(key).push(s)
    if (floor == null || key < floor) floor = key
  }
  const annotationByDay = new Map(annotations.map((a) => [startOfDay(a.date), a]))
  // Derived once here — it scores every session against the split, which would be
  // ruinous per cell.
  const references = rotationReferences(program, sessions)
  return { today: startOfDay(now), now, annotations, sessionsByDay, annotationByDay, references, floor, inferDay }
}

function statusAt(program, target, ctx) {
  const onDate = ctx.sessionsByDay.get(target) || []
  const annotation = ctx.annotationByDay.get(target) || null

  if (onDate.length) {
    // The plan day is only ever inferred from the session itself — dayForSession
    // answers null unless the match is unambiguous, and a null day just means the
    // card can't offer a link back to the split. Skipped for range callers, which
    // never read `day` on a done date and would pay for it once per trained day.
    const day = ctx.inferDay ? onDate.map((s) => dayForSession(program, s)).find(Boolean) || null : null
    return { status: 'done', day, sessions: onDate, annotation }
  }

  if (!program || !program.days.length) return { status: 'none', day: null, sessions: [], annotation }

  // Scheduled view of the date. plannedDayForDate suppresses annotated dates, so
  // ask the weekday directly when we only need to know what WOULD have been on.
  const weekly = scheduleMode(program) === 'weekly'
  const scheduled = weekly
    ? program.days[mondayIndex(target)]
    : plannedDayForDate(program, target, { now: ctx.now, annotations: ctx.annotations, references: ctx.references })

  if (annotation) return { status: 'off', day: scheduled || null, sessions: [], annotation }
  if (scheduled) {
    if (scheduled.kind === 'rest') return { status: 'rest', day: scheduled, sessions: [], annotation }
    if (target < ctx.today) return { status: 'missed', day: scheduled, sessions: [], annotation }
    return { status: target === ctx.today ? 'today' : 'upcoming', day: scheduled, sessions: [], annotation }
  }
  // Rotating, and nothing we know places this date. A past day you didn't train
  // is still an off day, so say that much — but NOT "skipped", which would be
  // calling a rest day a failure on no evidence. It's one or the other and we
  // can't tell which.
  if (target < ctx.today && ctx.floor != null && target >= ctx.floor) {
    return { status: 'unlogged', day: null, sessions: [], annotation }
  }
  return { status: 'none', day: null, sessions: [], annotation }
}

// Where one CALENDAR DATE stands. The calendar's day panel is the caller — it
// needs one answer for any square you tap, past or future, which
// plannedDayForDate alone can't give.
//
// Returns { status, day, sessions, annotation }:
//
//   'done'     — trained that day. `sessions` holds them; `day` is the split day
//                they came from when that's provable, else null.
//   'off'      — marked off (sick/travel/…), nothing logged. `day` is what the
//                schedule would have said, when recoverable.
//   'rest'     — a rest slot in the schedule.
//   'today' / 'upcoming' — a training day still to come.
//   'missed'   — a past training day with nothing logged and no mark-off.
//   'unlogged' — a past day you didn't train, where the split can't say whether
//                it was a rest slot or a session you skipped. Still an off day,
//                just an unattributed one.
//   'none'     — no program, or a date from before you had one.
//
// Precedence is logging first, then a mark-off, matching todayPlan — finishing a
// workout outranks having marked the day off.
//
// Past dates resolve exactly for a WEEKLY split (the weekday decides) and, for a
// rotating one, as far back as the rotation history reaches — which is as far as
// the session log goes, since a logged workout proves the day it completed
// (rotationReferences). Anything older falls back to 'unlogged'.
export function dayStatusForDate(program, date, { sessions = [], annotations = [], now = Date.now() } = {}) {
  return statusAt(program, startOfDay(date), statusContext(program, { sessions, annotations, now }))
}

// Every date in [start, end] classified, as a Map keyed by local midnight. Same
// answers as dayStatusForDate, one shared derivation — this is what lets the
// grid, the day panel and the summary card be structurally incapable of
// disagreeing about what a day was.
export function dayStatusesForRange(program, { start, end, sessions = [], annotations = [], now = Date.now(), inferDay = false } = {}) {
  const ctx = statusContext(program, { sessions, annotations, now, inferDay })
  const last = startOfDay(end)
  const out = new Map()
  for (let d = startOfDay(start); d <= last; d = addDays(d, 1)) out.set(d, statusAt(program, d, ctx))
  return out
}

// The next upcoming TRAINING day strictly after `now`'s date — { date, day }
// or null. Powers "done for today — next: Upper A on Friday".
export function nextTrainingDate(program, { now = Date.now(), annotations = [] } = {}) {
  if (!program || !program.days.length) return null
  for (let i = 1; i <= PROJECTION_HORIZON_DAYS; i++) {
    const date = addDays(now, i)
    const day = plannedDayForDate(program, date, { now, annotations })
    if (day && day.kind === 'train') return { date, day }
  }
  return null
}

// The training day a logged exercise came from, found by its plan link
// (`plannedExerciseId`, stamped by draftFromDay below). Planned-exercise ids
// are program-unique, so the day is unambiguous. This is how a past session —
// which doesn't store the day it was started from — is traced back to the
// split, so edits to it can be offered back to the plan.
export function dayForPlannedExercise(program, plannedExerciseId) {
  if (!program || !plannedExerciseId) return null
  return program.days.find((d) => (d.exercises || []).some((pe) => pe.id === plannedExerciseId)) || null
}

function nameKey(s) {
  return (s || '').trim().toLowerCase()
}

// Does this logged exercise correspond to this planned one? Library id first
// (survives renames — BOTH sides walk forward through the id aliases, so a
// split built before a rename still recognises a session logged after it),
// then name. Used wherever a session has to be lined up against a plan without
// the benefit of a plan link.
export function matchesPlanned(ex, pe) {
  if (!ex || !pe) return false
  const a = canonicalExerciseId(ex.exerciseId)
  const b = canonicalExerciseId(pe.exerciseId)
  if (a && b) return a === b
  return nameKey(ex.name) === nameKey(pe.name)
}

// The plan row a logged exercise came from, within one day: its plan link if it
// has one, else the first unclaimed row that matches by id/name. `claimed` lets
// callers walk a session in order without two exercises grabbing the same row.
export function plannedRowFor(day, ex, claimed = new Set()) {
  if (!day || !ex) return null
  if (ex.plannedExerciseId) {
    const linked = day.exercises.find((pe) => pe.id === ex.plannedExerciseId)
    if (linked) return linked
  }
  return day.exercises.find((pe) => !claimed.has(pe.id) && matchesPlanned(ex, pe)) || null
}

// Which split day does this session belong to?
//
// Sessions started from the split since mid-2026 carry plan links and answer
// this outright. Everything logged before that — or logged by hand — doesn't,
// so the day is inferred from the workout itself: the day sharing the most
// exercises with it wins. That's a strong signal (an Upper day and a Lower day
// have almost nothing in common) but it must be UNAMBIGUOUS, so a tie is only
// broken by an exact session-name match, and a weak overlap answers null rather
// than guessing. Callers always confirm before writing, naming the day.
export function dayForSession(program, session) {
  if (!program?.days?.length || !session) return null
  const exercises = session.exercises || []
  if (!exercises.length) return null

  for (const ex of exercises) {
    const day = dayForPlannedExercise(program, ex.plannedExerciseId)
    if (day) return day
  }

  const trainingDays = program.days.filter((d) => d.kind !== 'rest' && d.exercises?.length)
  if (!trainingDays.length) return null

  const scored = trainingDays.map((day) => {
    const claimed = new Set()
    let overlap = 0
    for (const ex of exercises) {
      const pe = day.exercises.find((p) => !claimed.has(p.id) && matchesPlanned(ex, p))
      if (pe) {
        claimed.add(pe.id)
        overlap++
      }
    }
    return { day, overlap, nameMatch: !!session.name && nameKey(session.name) === nameKey(day.name) }
  })

  const best = scored.reduce((a, b) => (b.overlap > a.overlap ? b : a))
  // At least half the session has to be recognisable as this day, and at least
  // two exercises — one shared movement means nothing when squats show up on
  // three different days.
  if (best.overlap < 2 || best.overlap < Math.ceil(exercises.length / 2)) return null

  const tied = scored.filter((s) => s.overlap === best.overlap)
  if (tied.length === 1) return best.day
  const named = tied.filter((s) => s.nameMatch)
  return named.length === 1 ? named[0].day : null
}

// ---- Prefill the logger from a planned day ---------------------------------

// Can this planned exercise carry a laterality opinion? Only where the DB
// leaves the question open: a fixed-laterality movement is decided by the
// library, and a bodyweight-loaded one has no left/right shape to choose. The
// builder's toggle and draftFromDay's override below both gate on this, so
// they can never disagree about which rows the field means anything for.
export function canChooseLaterality(pe) {
  if (!pe || pe.kind === 'cardio' || isOpenSlot(pe)) return false
  const lib = pe.exerciseId ? getExercise(pe.exerciseId) : null
  if (lib ? lib.bodyweight : usesBodyweight(pe.name)) return false
  return (lib ? lib.laterality : lateralityFor(pe.name)) === 'both'
}

// The shape a planned row asks for, or null when it has no opinion (or isn't
// entitled to one). Callers treat null as "whatever the DB / history says".
export function plannedLaterality(pe) {
  if (typeof pe?.unilateral !== 'boolean') return null
  return canChooseLaterality(pe) ? pe.unilateral : null
}

// Build a draft's `exercises` array from a training day, reusing the same
// factories the manual "add exercise" flow uses so laterality / bodyweight /
// targets all match. `bodyweight` is the session bodyweight for BW-loaded moves.
export function draftFromDay(day, opts = {}) {
  const sessionBw = Number(opts.bodyweight) || 0
  return (day?.exercises || []).map((pe) => {
    // An OPEN slot starts the session as a question rather than an exercise:
    // no library row, no laterality, and NO SETS, so it can't be logged until
    // the movement is chosen. The logger renders it as a chooser card and
    // rebuilds it through this same path once you pick (see WorkoutTracker).
    if (isOpenSlot(pe)) {
      const ex = createExercise(pe.name, 'strength', { repRange: pe.repRange || undefined })
      ex.sets = []
      ex.exerciseId = null
      ex.slot = { ...pe.slot, sets: Math.max(1, Number(pe.sets) || 1) }
      ex.plannedExerciseId = pe.id
      ex.supersetId = pe.supersetId || null
      return ex
    }
    const strength = pe.kind !== 'cardio'
    const lib = pe.exerciseId ? getExercise(pe.exerciseId) : null
    const laterality = strength ? (lib ? lib.laterality : lateralityFor(pe.name)) : undefined
    const bodyweight = strength ? (lib ? lib.bodyweight : usesBodyweight(pe.name)) : false
    const ex = createExercise(pe.name, pe.kind || 'strength', {
      laterality,
      repRange: pe.repRange || undefined,
      bodyweight,
      bw: sessionBw,
      exerciseId: pe.exerciseId || null,
      note: pe.note || '',
    })
    // The plan's laterality outranks the DB default for the movements the DB
    // leaves open. Applied BEFORE the padding loop below, so every set the
    // target count adds inherits the planned shape rather than the default one.
    const wanted = plannedLaterality(pe)
    if (wanted !== null && wanted !== ex.unilateral) {
      ex.unilateral = wanted
      ex.sets = ex.sets.map((s) => convertSet(s, wanted))
    }
    // createExercise seeds one set; add the rest to hit the target count.
    const target = Math.max(1, Number(pe.sets) || 1)
    while (ex.sets.length < target) {
      const setOpts = ex.bodyweight ? { bodyweight: true, bw: sessionBw } : { unilateral: ex.unilateral }
      ex.sets.push(createSet(ex.sets[ex.sets.length - 1], setOpts))
    }
    // Traces this session exercise back to its slot in the routine, so a
    // mid-session substitution can optionally update the plan too.
    ex.plannedExerciseId = pe.id
    // Planned supersets carry into the session: partners share the same group
    // id in the plan, so the log renders the same A1/A2 pairing.
    ex.supersetId = pe.supersetId || null
    return ex
  })
}

// Starter templates (PPL / Upper-Lower) used to live here — removed 2026-07-20:
// ready-made programs are the upcoming "Programs" feature's job, so the builder
// starts every split from scratch. Git history has them if ever needed.
