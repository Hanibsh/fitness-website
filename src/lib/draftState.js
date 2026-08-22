// What the in-progress draft IS — the predicates that decide whether a stored
// draft is a live session, debris from an abandoned tap, or an editing sitting
// someone walked away from.
//
// These lived inside WorkoutTracker while the logger was the only surface that
// could see the draft. The dashboard now offers "Continue / Start new", and the
// two have to reach the same verdict about the same draft: a dashboard that
// counts a leftover as live would invite you to continue a session the logger
// has already swept up. One module, one answer.

import { setHasWork } from './workoutStats'

function isSameDay(a, b) {
  const da = new Date(a), db = new Date(b)
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate()
}

export function draftHasWork(draft) {
  return (draft?.exercises || []).some((e) => (e.sets || []).some((s) => setHasWork(s, e.kind)))
}

// A program-tagged draft dated before today is a LEFTOVER: "Start session" was
// tapped and the workout was never finished on this device (usually because it
// was logged on another one). It has to be called out, because a program draft
// hides today's card — and the draft is per-device localStorage, so the phone
// can sit on last Tuesday's Upper A while the dashboard correctly says Lower A.
// `backdated` is the difference between a draft that ended up in the past and
// one that was OPENED there: the calendar's "Log this workout" on a day you
// missed. Same shape, opposite meaning — this one is exactly what was asked
// for, so it isn't debris, mustn't be swept up on the next mount, and doesn't
// get told it's not today's session.
export function isStaleProgramDraft(draft) {
  if (!draft?.programId || draft.editingId || draft.backdated) return false
  return !isSameDay(draft.date || draft.startedAt || Date.now(), Date.now())
}

// An edit opened on an earlier day and never saved or cancelled. Editing is a
// MODE, not a workout: it takes over the whole editor and hides today's card,
// but it was only ever meant to last as long as the sitting. It's written to
// the same per-device draft slot as everything else, so an edit abandoned on
// the phone reopens as "Editing session" every visit from then on — the split's
// real plan unreachable behind it. `startedAt` is when the edit began (`date`
// belongs to the session being edited, which is naturally in the past).
export function isStaleEditDraft(draft) {
  if (!draft?.editingId) return false
  return !isSameDay(draft.startedAt || draft.date || Date.now(), Date.now())
}

function loggedSetCount(draft) {
  let n = 0
  for (const ex of draft.exercises || []) {
    for (const s of ex.sets || []) if (setHasWork(s, ex.kind)) n++
  }
  return n
}

// Is there a session worth continuing, and what should we say about it?
//
// Returns null, or a summary for the dashboard's in-progress strip. The rules
// are restoreDraft's (WorkoutTracker), read from the other side: anything that
// mount would throw away is not something to offer a Continue button for.
//
//   - nothing in it            → nothing to continue
//   - an edit from an earlier  → restoreDraft closes it on the next visit, so
//     day                        promising to continue it would be a lie
//   - a leftover program draft → same; only kept when it holds real sets
//     with no work logged
//
// An edit opened TODAY is real work in the editor, so it counts — `isEdit` lets
// the caller word it as "editing a past workout" rather than "workout in
// progress", because Continue means something different for it.
export function liveDraft(draft) {
  if (!draft || !Array.isArray(draft.exercises) || !draft.exercises.length) return null
  if (draft.editingId && isStaleEditDraft(draft)) return null
  if (isStaleProgramDraft(draft) && !draftHasWork(draft)) return null
  return {
    name: (draft.name || '').trim(),
    exerciseCount: draft.exercises.length,
    setCount: loggedSetCount(draft),
    date: draft.date || draft.startedAt || Date.now(),
    startedAt: draft.sessionStartedAt || draft.startedAt || null,
    isEdit: !!draft.editingId,
    programId: draft.programId || null,
    stale: isStaleProgramDraft(draft),
  }
}
