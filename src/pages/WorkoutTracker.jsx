import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Plus, X, Check, Dumbbell, Activity, Trash2, ChevronUp, ChevronDown, ChevronRight, HelpCircle, LineChart, Calendar, CalendarDays, ArrowLeftRight, Link2, Pencil, Timer, StickyNote, Repeat, Split, Merge, Bandage, History, Route } from 'lucide-react'
import {
  getDraft,
  saveDraft,
  clearDraft,
  emptyDraft,
  createExercise,
  createSet,
  convertSet,
  setsFromPrevious,
  promoteHint,
  stripHints,
  getHistory,
  makeSession,
  addLocalSession,
  updateLocalSession,
  clearLocalHistory,
  deleteSession,
  stashDraft,
  getStashedDraft,
  clearStashedDraft,
  sessionStats,
  getUnit,
  saveUnit,
  getRestTimer,
  saveRestTimer,
  firstSetAt,
  getGuestShare,
  saveGuestShare,
  getExerciseTarget,
  saveExerciseTarget,
  getExerciseNote,
  saveExerciseNote,
  getExerciseNotesMap,
  migrateExerciseNotes,
  getBodyweightLog,
  getProgram,
  getProgramsState,
  saveProgram,
  getDayAnnotations,
  makeDayAnnotation,
  saveDayAnnotation,
} from '../lib/workoutStore'
import { fetchRemoteHistory, insertRemoteSession, insertRemoteSessions, deleteRemoteSession, updateRemoteSessionDate, updateRemoteSessionTimes, updateRemoteSession, insertSharedLifts, submitGuestLifts, fetchRemoteProgram, upsertRemoteProgram, fetchRemoteDayAnnotations, upsertRemoteDayAnnotation, upsertRemoteExerciseNotes } from '../lib/workoutRemote'
import { todayPlan, advanceProgram, draftFromDay, scheduleMode, nextTrainingDate, dayForSession, dayForPlannedExercise, plannedRowFor, plannedLaterality, reasonConsumesSlot } from '../lib/program'
import { buildSharedLifts, distanceUnit, repRangeStatus, convertWeight, supersetLabels, sessionAvgRest, formatRest, setSummary, sideSetSummary, lastLoggedExercise, newSupersetId, pruneSupersets, regroupSupersets, exerciseBlocks, setHasWork, sideHasWork, isStampedSet } from '../lib/workoutStats'
import { diffSessionAgainstDay, applySplitChanges } from '../lib/splitSync'
import { draftHasWork, isStaleProgramDraft, isStaleEditDraft, liveDraft } from '../lib/draftState'
import { reasonLabel, annotationForDate } from '../lib/dayLog'
import { fetchProfile } from '../lib/profile'
import { getTurnstileToken, turnstileConfigured } from '../lib/turnstile'
import { useAuth } from '../lib/auth'
import { useLocalDay } from '../lib/useLocalDay'
import Modal from '../components/Modal'
import ExerciseProgress from '../components/ExerciseProgress'
import ExercisePicker from '../components/ExercisePicker'
import PatternPicker from '../components/PatternPicker'
import WorkoutCalendar from '../components/WorkoutCalendar'
import SessionNamePicker from '../components/SessionNamePicker'
import { lateralityFor, usesBodyweight } from '../lib/movements'
import { getExercise, exerciseIdForName } from '../lib/exerciseLibrary'
import { useInjuries, useInjuryRisk } from '../lib/useInjuries'
import { openInjuries, injuryTitle } from '../lib/injuries'
import InjuryBadge from '../components/InjuryBadge'
import { muscleRecovery, musclesForExercises } from '../lib/engine'
import UnitHelp from '../components/UnitHelp'
import LogTabs from '../components/LogTabs'
import QuickCalculator from '../components/QuickCalculator'
import RestTimer from '../components/RestTimer'
import HintBar from '../components/HintBar'
import NumberField from '../components/NumberField'
import SessionSummary from '../components/SessionSummary'
import SplitSyncModal from '../components/SplitSyncModal'
import { formatDuration } from '../lib/dashboard'
import { adviseTraining } from '../lib/advisor'

// Columns: set no. · weight · reps · RIR · done tick · remove.
const SET_GRID = 'grid grid-cols-[18px_1fr_1fr_44px_18px_18px] gap-1.5 items-center'
// Same as SET_GRID plus a trailing column for the per-set laterality toggle —
// only used on "both" exercises, where a flat row can be split into L/R.
const SET_GRID_TOGGLE = 'grid grid-cols-[18px_1fr_1fr_44px_18px_18px_18px] gap-1.5 items-center'
const CARDIO_SET_GRID = 'grid grid-cols-[18px_1fr_1fr_18px_18px] gap-1.5 items-center'

function formatDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

// Timestamp <-> the YYYY-MM-DD value a native date input expects, kept in
// local time and pinned to noon to dodge timezone off-by-one-day issues.
function toInputDate(ts) {
  const d = new Date(ts)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function fromInputDate(value) {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0).getTime()
}

// Clock time <-> the HH:MM a native time input expects. These are the one place
// the app keeps a real time of day: `date` stays noon-pinned above so day
// bucketing can't drift, and a session's start/end live in their own fields.
function toInputTime(ts) {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Put HH:MM onto the calendar day `onDay` falls in.
function withTimeOfDay(onDay, value) {
  const [h, m] = value.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  const d = new Date(onDay)
  d.setHours(h, m, 0, 0)
  return d.getTime()
}

// Day annotations are noon-anchored (see makeDayAnnotation) so they can never
// land on a day boundary and read as the day either side.
function noonOf(ts) {
  const d = new Date(ts)
  d.setHours(12, 0, 0, 0)
  return d.getTime()
}

function isSameDay(a, b) {
  const da = new Date(a), db = new Date(b)
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate()
}

// "tomorrow" or "on Friday" — for pointing at the next planned training day.
function nextDayLabel(ts) {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (isSameDay(ts, tomorrow.getTime())) return 'tomorrow'
  return `on ${new Date(ts).toLocaleDateString(undefined, { weekday: 'long' })}`
}

// A calendar day strictly after today — can't log a workout there.
function isFutureDay(ts) {
  const d = new Date(ts); d.setHours(0, 0, 0, 0)
  const t = new Date(); t.setHours(0, 0, 0, 0)
  return d.getTime() > t.getTime()
}

// Passively timestamp a set as it's logged, so rest between sets and the
// session's length can both be derived automatically. Takes the set AS EDITED
// and returns a patch to merge, or null when nothing changes.
//
// Asked of the SET rather than of one privileged field. The clock should start
// the moment a row holds a set you actually did, and it makes no difference
// whether the numbers were typed or taken up from last week's in one tap — the
// set is behind you either way, and that's when rest begins. Gating on the reps
// field meant the "same as last time" paths filled a whole exercise in and the
// timer sat there at zero, never having seen a keystroke.
//
// The stamp tracks the LAST edit of a row, not the first. Stamping once on
// first entry meant typing `12` recorded the moment you pressed `1`, so how
// long a set appeared to take depended on your typing order — weight-first and
// reps-first gave different answers for the same set. That only actually holds
// now that every field refines it, rather than reps alone.
//
// Only an edit that lands soon after the existing stamp moves it. Later than
// that you're correcting a set you logged a while ago, and re-anchoring rest to
// a typo fix would be worse than leaving it alone.
//
// That window is right for a stamp you earned by filling the row in, and wrong
// for one the app guessed on your behalf. "Same as last time" fills EVERY set of
// an exercise at once, including three you haven't done yet, and stamping them
// used to lock all three: by the time you'd actually finished set two, the guess
// was older than the window, so the real edit was dismissed as a typo fix and
// the clock stayed pinned to the tap for the whole exercise. Those stamps are
// marked `stampAuto` and stay open to correction however long they've sat there.
const STAMP_REFINE_MS = 3 * 60 * 1000

// Nor does it apply to a limb you've only now filled in. `setHasWork` is asked
// of the SET, and a unilateral set counts as real from the moment its first arm
// is written down — so the second arm arrived at a row that already "had work"
// and got dismissed as a correction to it. But the two arms of a single-limb set
// are two efforts with a rest in between, by definition: the second one lands
// outside the window nearly every time, and it is the opposite of a typo fix.
// It's the moment the set actually finished, which is also the honest stamp for
// the recorded rest, not just for the clock on screen.
function gainedWork(prev, next, kind) {
  if (kind === 'cardio' || !next.left) return false
  return ['left', 'right'].some((side) => sideHasWork(next, side) && !sideHasWork(prev, side))
}

function restStamp(prev, next, kind) {
  if (!setHasWork(next, kind)) return null
  const now = Date.now()
  if (!next.completedAt || next.stampAuto) return { completedAt: now, stampAuto: undefined }
  if (gainedWork(prev, next, kind)) return { completedAt: now }
  return now - next.completedAt <= STAMP_REFINE_MS ? { completedAt: now } : null
}

// A set with an edit applied, stamped if that edit finished it off. `prev` is
// the same set before the edit — the stamp turns on what CHANGED, not only on
// where the row ended up.
function withRestStamp(prev, next, kind) {
  return { ...next, ...restStamp(prev, next, kind) }
}

// The same, for a fill that covers sets you may not have done yet. The stamp
// still lands — filling an exercise in after the fact is a real way to log it,
// and the session would otherwise have no timestamps at all — it's just held
// provisionally, so the first thing you do to that row afterwards wins.
function withAutoStamp(prev, next, kind) {
  const stamp = restStamp(prev, next, kind)
  return stamp ? { ...next, ...stamp, stampAuto: true } : { ...next }
}

// "I've just finished this set" said outright, by the tick on the row. The one
// path that re-stamps unconditionally: after a fill there's nothing left to type
// and no implicit signal to read, so this is what restarts the clock when you
// repeat last week's numbers exactly. Refuses an empty row — there's no set
// there to have finished.
function withDoneStamp(next, kind) {
  if (!setHasWork(next, kind)) return next
  return { ...next, completedAt: Date.now(), stampAuto: undefined }
}

// Drafts saved before laterality existed have no `laterality` on their
// exercises, so they'd fall back to "both" and wrongly show the toggle (e.g.
// a unilateral toggle on Bench Press). Backfill it from the DB on load and
// snap the sets to the resolved shape.
function migrateExercise(ex) {
  if (!ex || ex.kind === 'cardio') return ex
  let next = ex
  // Backfill laterality (+ snap set shapes) on exercises saved before it existed.
  if (!ex.laterality) {
    const laterality = lateralityFor(ex.name)
    const unilateral = laterality === 'unilateral' ? true : laterality === 'bilateral' ? false : !!ex.unilateral
    next = { ...ex, laterality, unilateral, sets: (ex.sets || []).map((s) => convertSet(s, unilateral)) }
  }
  // Backfill the exercise-DB id from the name where it matches, so exercises
  // logged before IDs existed still link to the library. Retry on null, not
  // just undefined: a name that didn't resolve on an earlier pass would
  // otherwise be stamped null forever, orphaned from the library even once
  // resolution improves (as it did when stale names started walking forward
  // through the id aliases). Only rewrite on a hit, so a genuinely custom
  // exercise doesn't allocate a new object on every normalize pass.
  if (next.exerciseId == null) {
    const resolved = exerciseIdForName(next.name)
    if (resolved) next = { ...next, exerciseId: resolved }
  }
  return next
}
// Convert legacy adjacency-based supersets (`linkedToPrev`) to the group-id
// model (`supersetId`), so grouping no longer depends on list order. No-op once
// data is already on the new model. Also normalizes to the contiguous-group
// invariant below, in case any older history has a group scattered non-
// adjacently (from before that was enforced).
function migrateSupersets(exercises) {
  if (!exercises.some((e) => e && e.linkedToPrev)) return regroupSupersets(exercises)
  const out = exercises.map((e) => ({ ...e }))
  for (let i = 0; i < out.length; i++) {
    if (!out[i].supersetId && i > 0 && out[i].linkedToPrev) {
      if (!out[i - 1].supersetId) out[i - 1].supersetId = newSupersetId()
      out[i].supersetId = out[i - 1].supersetId
    }
    delete out[i].linkedToPrev
  }
  return regroupSupersets(out)
}

// A set's suggestion for one field, rendered as the input's placeholder — grey
// by default, so last time's numbers are visible to aim at without ever reading
// as something you logged. `side` picks a limb on a left/right set. Falls back
// to the neutral dash when there's nothing to suggest.
function hintFor(set, field, side, fallback = '—') {
  const src = side ? set.hint?.[side] : set.hint
  const v = src?.[field]
  return v === '' || v == null ? fallback : String(v)
}

// Touch device? Decides whether the hint bar is needed at all — on anything with
// a real keyboard, Enter already takes the suggestion.
function isTouch() {
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
}

// Does this SET have a suggestion still waiting to be taken up? `side` asks the
// same question of ONE limb, which is what the per-set offer is scoped to now:
// a left arm you've already written down leaves nothing to take up, even while
// the right is still blank.
function setHasUntakenHint(s, side = null) {
  if (!s.hint) return false
  if (s.left) {
    const sides = side === 'left' || side === 'right' ? [side] : ['left', 'right']
    return sides.some((k) => ['weight', 'reps', 'rir'].some((f) => s[k]?.[f] === '' && s.hint[k]?.[f] !== '' && s.hint[k]?.[f] != null))
  }
  const fields = s.bw != null ? ['added', 'reps', 'rir'] : ['weight', 'reps', 'rir', 'duration', 'distance']
  return fields.some((f) => (s[f] === '' || s[f] == null) && s.hint[f] !== '' && s.hint[f] != null)
}

// …and does this exercise have one anywhere?
function hasUntakenHint(ex) {
  return ex.sets.some(setHasUntakenHint)
}

function migrateDraft(draft) {
  if (!draft || !Array.isArray(draft.exercises)) return draft
  return { ...draft, exercises: migrateSupersets(draft.exercises.map(migrateExercise)) }
}

// Whether starting today's planned session would set the current draft aside
// rather than replace it. One predicate for both the promise on the card and
// the stash itself, so they can't drift apart. A program draft normally IS
// today's session (nothing to set aside); a leftover one is only worth keeping
// once it holds logged work.
function willStashDraft(draft, leftover) {
  if (!draft.exercises.length || draft.editingId) return false
  if (!draft.programId) return true
  // A backdated one isn't today's session either, however deliberate it was, so
  // starting today's has to set it aside rather than write over it.
  return (leftover || draft.backdated) && draftHasWork(draft)
}

// Restore the draft on mount, dropping what has plainly been abandoned.
//
// An edit from a previous day is closed the way Cancel closes it — the session
// being edited is saved and untouched, so the most that goes is unsaved tweaks
// to it from a day the user walked away from. Leaving it in place costs far
// more: the logger stays stuck on it forever.
//
// A leftover program draft with nothing logged is pure debris — one tap that
// went nowhere. One with real sets is always kept; the UI labels it honestly
// instead of passing it off as today's.
function restoreDraft() {
  const draft = migrateDraft(getDraft())
  if (!draft) return emptyDraft()
  if (isStaleEditDraft(draft)) {
    // Same restore Cancel does: bring back whatever was set aside when the edit
    // was opened, unless that's stale too.
    const stash = migrateDraft(getStashedDraft())
    clearStashedDraft()
    clearDraft()
    if (!stash || isStaleEditDraft(stash) || (isStaleProgramDraft(stash) && !draftHasWork(stash))) return emptyDraft()
    saveDraft(stash)
    return stash
  }
  if (isStaleProgramDraft(draft) && !draftHasWork(draft)) {
    clearDraft()
    return emptyDraft()
  }
  return draft
}

// The split day this session PROVABLY came from: the day it was started from,
// or a day still reachable through one of its plan links — which is how a past
// session finds its way home, since makeSession drops programId/programDayId.
//
// dayForSession's exercise-overlap GUESS is deliberately not consulted here.
// The guess is good enough to offer ("3 changes not in Upper A — review?") but
// not to act on: a wrong guess would rewrite a day you never trained. Anything
// written without the user looking has to come from a recorded fact.
function confidentDay(program, draft) {
  if (!program) return null
  if (draft.programId === program.id && draft.programDayId) {
    return program.days.find((d) => d.id === draft.programDayId) || null
  }
  for (const ex of draft.exercises || []) {
    const day = dayForPlannedExercise(program, ex.plannedExerciseId)
    if (day) return day
  }
  return null
}

export default function WorkoutTracker() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  // Rolls over on its own at midnight, so a phone that was only resumed rather
  // than reloaded stops answering with yesterday's plan.
  const today = useLocalDay()
  const [draft, setDraft] = useState(restoreDraft)
  // A session the dashboard set aside to start a fresh one. The stash slot has
  // always existed for edit mode and for starting a planned session over a
  // draft, but both of those consume it themselves; this is the first writer
  // that hands it to the user to bring back, so the logger has to offer it.
  const [setAside, setSetAside] = useState(() => migrateDraft(getStashedDraft()))
  const [history, setHistory] = useState([])
  const [program, setProgram] = useState(null)
  const [annotations, setAnnotations] = useState([])
  // Whether the day_annotations table is reachable — same fallback the calendar
  // page keeps. Starts true when signed in, flips to local the first time a
  // remote call fails.
  const [remoteAnnotationsOk, setRemoteAnnotationsOk] = useState(!!user)
  // The injury prompt, or null. { mode: 'session' } ends the session in
  // progress; { mode: 'day' } just marks today, with nothing to end.
  const [injuryPrompt, setInjuryPrompt] = useState(null)
  const [injuryNote, setInjuryNote] = useState('')
  // Which tracked injury the mark-off belongs to: an existing one's id, 'new' to
  // start tracking one, or null to just mark the day off the old way.
  const [injuryLink, setInjuryLink] = useState(null)
  const { injuries } = useInjuries()
  const injuryRisk = useInjuryRisk()
  const openInjuryList = useMemo(() => openInjuries(injuries), [injuries])
  const [loadingHistory, setLoadingHistory] = useState(true)
  // The day name a calendar "start" link asked for and couldn't have, because a
  // session with work in it was already open. Cleared the moment that session
  // is out of the way.
  const [blockedStart, setBlockedStart] = useState(null)
  const [importable, setImportable] = useState(null)
  const [profile, setProfile] = useState(null)
  const [unit, setUnit] = useState(() => getUnit())
  const [openSession, setOpenSession] = useState(null)
  const [supersetMenuFor, setSupersetMenuFor] = useState(null)
  const [noteOpenFor, setNoteOpenFor] = useState(() => new Set())
  const [substituteFor, setSubstituteFor] = useState(null)
  const [pendingSub, setPendingSub] = useState(null) // { exId, name, kind, exerciseId, plannedExerciseId, dayId }
  const [splitSyncOpen, setSplitSyncOpen] = useState(false)
  // The finish is waiting on the review sheet — only ever set when the split day
  // was inferred rather than known. { day, changes, confident }
  const [pendingSync, setPendingSync] = useState(null)
  // What the last finish wrote to the split, so it can be said out loud and
  // taken back. { dayName, count, snapshot }
  const [splitSyncDone, setSplitSyncDone] = useState(null)
  const [selectedCalDay, setSelectedCalDay] = useState(null)
  const [editingSessionDate, setEditingSessionDate] = useState(null)
  const [editingSessionTime, setEditingSessionTime] = useState(null)
  const [showRirHelp, setShowRirHelp] = useState(false)
  const [progressExercise, setProgressExercise] = useState(null)
  const [editingDate, setEditingDate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [guestShare, setGuestShare] = useState(() => getGuestShare())
  // Rest timer: the on/off preference plus the two taps that override the
  // derived anchor — `anchor` ("rest starts now") and `dismissedAt` ("hide it
  // until my next set"). All three live in localStorage rather than React
  // state, so reloading mid-rest doesn't silently throw them away.
  const [restTimer, setRestTimer] = useState(() => getRestTimer())
  // Which set the caret is in, so the hint bar knows whose suggestion to offer.
  const [focusedSet, setFocusedSet] = useState(null) // { exId, setId, side }
  const [hp, setHp] = useState('') // honeypot — real users leave this empty
  const [loadError, setLoadError] = useState('')
  const firstRender = useRef(true)
  // Guards against double-submit. A ref flag isn't enough: the guest path is
  // fully synchronous, so a `finally` reset happens before the second click of
  // a double-click lands (which still sees the old draft in its stale closure).
  // Instead remember which draft was already finished, by its startedAt stamp.
  const lastFinishedRef = useRef(null)

  function updateGuestShare(patch) {
    setGuestShare((prev) => {
      const next = { ...prev, ...patch }
      saveGuestShare(next)
      return next
    })
  }

  const draftDate = draft.date || Date.now()
  const isToday = isSameDay(draftDate, today)
  const isEditing = !!draft.editingId
  // The program's answer for today — todayPlan is the same source the
  // dashboard hero and the calendar projection use, so the three surfaces
  // always agree. `plan.status === 'done'` covers both modes: weekly (a
  // session logged today) and rotating (the pointer advanced today — in that
  // case plan.day is the NEXT day up, planned for tomorrow).
  const isWeeklyProgram = !!program && scheduleMode(program) === 'weekly'
  const loggedToday = useMemo(() => history.some((s) => isSameDay(s.date, today)), [history, today])
  const plan = useMemo(
    () => todayPlan(program, { now: today, annotations, trainedToday: loggedToday }),
    [program, annotations, loggedToday, today]
  )
  const todayDay = plan.day
  // Is this draft genuinely the session for today? Only while it's dated today
  // AND still points at the day the program has up — the two ways a draft goes
  // stale. It never expires on its own and it lives in THIS device's storage,
  // so a "Start session" tap that was finished elsewhere (or never finished)
  // sits here indefinitely. Left unchecked it suppressed today's card, which is
  // how the dashboard came to promise Lower A while the logger served Upper A.
  // Until the program loads there's nothing to compare against, so assume it's
  // current rather than flash today's card over a live session.
  const isLeftoverDraft = (d) => {
    if (d.editingId) return isStaleEditDraft(d)
    if (!d.programId || d.backdated) return false
    if (!isSameDay(d.date || d.startedAt || today, today)) return true
    if (!program) return false
    return d.programId !== program.id || (!!plan.day && d.programDayId !== plan.day.id)
  }
  const staleDraft = isLeftoverDraft(draft)
  // Only a draft that's genuinely current — today's session in progress, or an
  // edit opened just now — gets to stand in for today's card. Anything left
  // over shows it instead of hiding behind it. (restoreDraft clears most of
  // these on mount; this catches one that goes stale with the page still open.)
  const showTodayCard = !!todayDay && !((isEditing || draft.programId) && !staleDraft)
  const doneToday = plan.status === 'done'
  const nextUp = useMemo(
    () => (doneToday || plan.status === 'rest' || plan.status === 'off' ? nextTrainingDate(program, { annotations }) : null),
    [doneToday, plan.status, program, annotations]
  )
  // Today marked off (sick/injury/travel/rest/other) on a training day — the
  // card below swaps to an acknowledgment + skip instead of "Start session".
  const todayAnnotation = plan.annotation
  const skipTodayCard = plan.status === 'off' && todayDay?.kind === 'train'
  // A reason that spends the day's slot needs no "skip ahead" offer — the
  // rotation has already moved on by tomorrow, and offering it again would read
  // as a second skip.
  const offTodayConsumes = !!todayAnnotation && reasonConsumesSlot(todayAnnotation.reason)

  // Engine v2 nudge: which of today's target muscles are still recovering.
  // Informational only — never a gate on training. Only meaningful when
  // there's a pending training day (done/rest days never show it).
  const recoveringToday = useMemo(() => {
    const day = plan.status === 'train' || plan.status === 'off' ? plan.day : null
    if (!day || day.kind === 'rest' || !day.exercises.length || !history.length) return []
    const hit = musclesForExercises(day.exercises)
    return muscleRecovery(history).muscles.filter((m) => hit.has(m.muscle) && m.status === 'recovering')
  }, [plan, history])

  // What the rest clock counts from: the most recent set holding real work,
  // warm-ups included. `isStampedSet` rather than `isLoggedSet` — the two part
  // company exactly here. You rest after a warm-up like you rest after anything
  // else, and a clock that ignored them sat there counting from the previous
  // exercise while you worked up to your first heavy set. The recorded "avg
  // rest" still uses `isLoggedSet` and still ignores warm-ups; what's on screen
  // and what's in your history are answering different questions.
  //
  // The winning set's exercise comes back too — that's where the rest target
  // shown in the widget comes from — and whether it was a warm-up, because the
  // target doesn't apply to one.
  const lastLogged = useMemo(() => {
    let at = 0
    let name = ''
    let exerciseId = null
    let warmup = false
    for (const ex of draft.exercises) {
      for (const s of ex.sets) {
        if (!isStampedSet(s, ex.kind) || s.completedAt <= at) continue
        at = s.completedAt
        name = ex.name
        exerciseId = ex.exerciseId || exerciseIdForName(ex.name)
        warmup = s.type === 'warmup'
      }
    }
    return at ? { at, name, exerciseId, warmup } : null
  }, [draft])

  // The whole session so far. Runs from the moment the workout started — the
  // "Start session" tap, or adding the first exercise — so the live number in
  // the rest widget and the duration saved at finish are the same clock. Falls
  // back to the first stamped set for drafts begun before that was recorded.
  const sessionStartTs = useMemo(
    () => draft.sessionStartedAt || firstSetAt(draft.exercises),
    [draft]
  )

  // A manual tap wins over the derived anchor when it's more recent; the next
  // logged set takes it back. `dismissedAt` hides the number the same way,
  // until a newer set revives it — the widget itself stays put, showing its
  // idle face, so there's always something to tap to start a rest.
  const anchorCandidate = Math.max(restTimer.anchor || 0, lastLogged?.at || 0) || null
  const restAnchorTs = anchorCandidate > (restTimer.dismissedAt || 0) ? anchorCandidate : null
  // Only once a session is genuinely underway — the draft holds at least one
  // exercise and isn't a leftover from another day. Without that last clause the
  // bubble sat on the log screen permanently, next to the "Start session" card,
  // and one stray tap started a rest that then ticked for half an hour against
  // a workout that hadn't begun. It still appears before your first SET, which
  // is the point of it; just not before your first exercise.
  const sessionUnderway = draft.exercises.length > 0 && !staleDraft
  const setAsideSummary = useMemo(() => liveDraft(setAside), [setAside])
  const showRestTimer = restTimer.enabled && !isEditing && isToday && sessionUnderway

  // No target after a warm-up. The DB's rest figure is what to take between
  // working sets, and offering three minutes after a set of the empty bar would
  // be worse than offering nothing — the widget says what it's counting instead.
  const restTargetSec = useMemo(
    () => (lastLogged?.exerciseId && !lastLogged.warmup ? getExercise(lastLogged.exerciseId)?.restSeconds || null : null),
    [lastLogged]
  )

  function updateRestTimer(patch) {
    setRestTimer((prev) => saveRestTimer({ ...prev, ...patch }))
  }

  // Re-read the stash whenever this session goes empty — that's the only
  // moment the offer can appear, and it's also when the other stash consumers
  // (finishing, cancelling an edit) have just emptied the slot. Gated on
  // emptiness rather than on the draft itself so it isn't parsing localStorage
  // on every keystroke.
  const draftEmpty = draft.exercises.length === 0
  useEffect(() => {
    setSetAside(draftEmpty ? migrateDraft(getStashedDraft()) : null)
  }, [draftEmpty])

  // The manual taps are per-session, so they die with the draft. Called
  // wherever the draft is cleared — finishing, discarding, leaving edit mode —
  // otherwise a rest you started in the last set of a workout carries on
  // counting after you've saved it.
  function clearRestAnchor() {
    updateRestTimer({ anchor: null, dismissedAt: null })
  }

  // What the hint bar offers, or null to hide it. Only on touch devices: a
  // physical keyboard already has Enter, and a strip across the bottom of a
  // desktop window while you type would be clutter solving nothing.
  const hintBar = useMemo(() => {
    if (!focusedSet || !isTouch()) return null
    const ex = draft.exercises.find((e) => e.id === focusedSet.exId)
    const set = ex?.sets.find((s) => s.id === focusedSet.setId)
    const side = focusedSet.side
    if (!set || !setHasUntakenHint(set, side)) return null
    // Written by the same formatter as a logged set, so what the bar promises
    // reads exactly like what lands in the row — one limb's worth when that's
    // all the tap is going to fill.
    const filled = promoteHint(set, side)
    if (set.left && (side === 'left' || side === 'right')) return sideSetSummary(filled, side, unit)
    return setSummary(filled, unit, ex.kind, distanceUnit(unit))
  }, [focusedSet, draft, unit])

  // Auto-save the draft on every change (skip the very first render).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    saveDraft(draft)
  }, [draft])

  // Load history from the right place: Supabase when logged in, localStorage
  // when anonymous. When logging in with local workouts still on the device,
  // offer to import them into the account.
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadingHistory(true)
      setLoadError('')
      if (user) {
        try {
          const [remote, prof, prog, annos] = await Promise.all([
            fetchRemoteHistory(user.id), fetchProfile(user.id), fetchRemoteProgram(user.id), fetchRemoteDayAnnotations(user.id),
          ])
          if (cancelled) return
          setHistory(remote)
          setProfile(prof)
          setProgram(prog || getProgram())
          setAnnotations(annos)
          setRemoteAnnotationsOk(true)
          const local = getHistory()
          setImportable(local.length > 0 ? local : null)
        } catch {
          if (!cancelled) {
            setHistory([])
            setProgram(getProgram())
            setAnnotations(getDayAnnotations())
            setRemoteAnnotationsOk(false)
            setLoadError("Couldn't load your workouts — check your connection and refresh.")
          }
        }
      } else {
        setHistory(getHistory())
        setProgram(getProgram())
        setAnnotations(getDayAnnotations())
        setImportable(null)
        setProfile(null)
      }
      if (!cancelled) setLoadingHistory(false)
    }
    load()
    return () => { cancelled = true }
  }, [user])

  // Lift any notes written before they were shared per movement into the shared
  // map, so nothing already typed disappears. Runs at most once, and only after
  // both sources are actually loaded.
  useEffect(() => {
    if (loadingHistory) return
    const state = getProgramsState()
    migrateExerciseNotes(program ? [program, ...state.programs.filter((p) => p.id !== program.id)] : state.programs, history)
  }, [loadingHistory, program, history])

  // Arriving here via the dashboard calendar's "Edit" action: once history has
  // loaded, load that session into the editor, then clear the navigation state
  // so a refresh or navigating back doesn't re-trigger it.
  useEffect(() => {
    const editId = location.state?.editSessionId
    if (!editId || loadingHistory) return
    const session = history.find((s) => s.id === editId)
    if (session) editSession(session)
    navigate(location.pathname, { replace: true, state: {} })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, loadingHistory, history])

  // Arriving via the exercise bank's "Log this" action: add that exercise to the
  // current draft (same path as picking it from the picker), then clear the nav
  // state so a refresh/back doesn't re-add it.
  useEffect(() => {
    const addName = location.state?.addExerciseName
    if (!addName || loadingHistory) return
    addExercise(addName, 'strength', location.state?.addExerciseId || null)
    navigate(location.pathname, { replace: true, state: {} })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, loadingHistory])

  // Arriving via the calendar's "Start today's session" / "Log this workout":
  // open the draft for that split day straight away, so the tap that says start
  // actually starts it instead of landing you on a card with another button.
  // `sessionDate` is what makes the second one work — a missed day is logged
  // against the date it was missed on, not today.
  //
  // Refuses when there's already work in the draft that starting would discard
  // (a session in progress that isn't today's planned one, so willStashDraft
  // wouldn't set it aside). A live workout outranks a link you tapped — but
  // refusing in silence reads as a broken button, so it says so and leaves the
  // session alone. Waits for the load, which is what settles `program` — until
  // then the day can't be looked up and a miss would be a false "not found".
  useEffect(() => {
    const dayId = location.state?.startPlannedDay
    if (!dayId || loadingHistory) return
    const day = program?.days.find((d) => d.id === dayId)
    const safe = !draftHasWork(draft) || willStashDraft(draft, staleDraft)
    if (day && day.kind !== 'rest') {
      if (safe) startPlannedSession(day, { date: location.state.sessionDate || Date.now() })
      else setBlockedStart(day.name || 'that day')
    }
    navigate(location.pathname, { replace: true, state: {} })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, loadingHistory, program])

  // The notice above is only true while the session that caused it is in the
  // way. Finished, discarded, or emptied out, it stops being an explanation and
  // starts being clutter.
  useEffect(() => {
    if (blockedStart && !draftHasWork(draft)) setBlockedStart(null)
  }, [draft, blockedStart])

  // History plus the in-progress session as a provisional "today" point, so
  // graphs stay live while you're logging.
  const progressSessions = useMemo(() => {
    const provisional = draft.exercises.length
      ? [{ id: '__draft__', date: draft.date || Date.now(), provisional: true, unit, exercises: draft.exercises }]
      : []
    // While editing a past session, the live draft stands in for it — drop the
    // saved copy from history so the graph doesn't count it twice.
    const base = draft.editingId ? history.filter((s) => s.id !== draft.editingId) : history
    return [...provisional, ...base]
  }, [draft, history, unit])

  const sortedHistory = useMemo(() => [...history].sort((a, b) => b.date - a.date), [history])

  // The workout whose summary card is open. Looked up rather than held in state
  // so an edit (a moved date, a corrected time) shows through immediately
  // instead of the card holding a stale copy.
  const openSessionData = useMemo(
    () => (openSession ? sortedHistory.find((s) => s.id === openSession) || null : null),
    [openSession, sortedHistory]
  )

  // Only computed while a card is open, and only its worst item is shown — the
  // summary is a place for one thought, not the whole advisor.
  //
  // No specialization blocks passed: the logger doesn't load them (the dashboard
  // does), and fetching them for one line of text isn't worth a round trip. The
  // consequence is bounded and worth stating — the block-focus recommendation
  // can't appear here, so if it would have been the worst item, the summary
  // shows the next one down instead.
  const topAdvice = useMemo(() => {
    if (!openSessionData) return null
    const recs = adviseTraining(sortedHistory, { annotations, injuries })
    return recs.find((r) => r.severity === 'red') || recs.find((r) => r.severity === 'amber') || null
  }, [openSessionData, sortedHistory, annotations])

  // Workouts on the calendar-selected day (kept fresh as history changes), for
  // the day-detail panel under the calendar.
  const daySessions = useMemo(
    () => (selectedCalDay ? sortedHistory.filter((s) => isSameDay(s.date, selectedCalDay)) : []),
    [selectedCalDay, sortedHistory]
  )

  // Exercises the user has logged before, most-recent first and split by kind,
  // so each section's picker surfaces what they actually train there.
  const recentByKind = useMemo(() => {
    const resistance = [], cardio = []
    const seen = new Set()
    for (const s of sortedHistory) {
      for (const ex of s.exercises) {
        const key = ex.name.trim().toLowerCase()
        if (!key || seen.has(key)) continue
        seen.add(key)
        ;(ex.kind === 'cardio' ? cardio : resistance).push(ex.name.trim())
      }
    }
    return { resistance, cardio }
  }, [sortedHistory])

  // `kind` is decided by which section's picker added it (resistance/cardio),
  // not a per-exercise toggle. Prefill the rep target from the last time this
  // exercise was trained, if we remember one.
  // Best guess at the user's current bodyweight in the display unit: their
  // profile value (logged in) or the latest weigh-in, else blank.
  function prefillBodyweight() {
    if (profile?.bodyweight) return Math.round(convertWeight(Number(profile.bodyweight), profile.unit || 'kg', unit) * 10) / 10
    const log = getBodyweightLog()
    if (log.length) {
      const e = [...log].sort((a, b) => b.date - a.date)[0]
      return Math.round(convertWeight(Number(e.weight), e.unit || 'kg', unit) * 10) / 10
    }
    return ''
  }

  function addExercise(name, kind, exerciseId) {
    const trimmed = name.trim().slice(0, 60)
    if (!trimmed) return
    const isStrength = kind !== 'cardio'
    // When picked from the library, take laterality/bodyweight straight from the
    // DB entry (authoritative). For custom/typed exercises, infer from the name.
    const lib = isStrength ? getExercise(exerciseId) : null
    const laterality = isStrength ? (lib ? lib.laterality : lateralityFor(trimmed)) : undefined
    const bodyweight = isStrength ? (lib ? lib.bodyweight : usesBodyweight(trimmed)) : false
    const repRange = isStrength ? getExerciseTarget(trimmed) || undefined : undefined
    // Whatever this movement's note says, wherever it was last written.
    const note = getExerciseNote({ exerciseId, name: trimmed })
    setDraft((d) => {
      const bw = bodyweight ? (d.bodyweight != null && d.bodyweight !== '' ? d.bodyweight : prefillBodyweight()) : undefined
      const ex = createExercise(trimmed, kind, { laterality, repRange, bodyweight, bw: Number(bw) || 0, exerciseId: exerciseId || null, note })
      // File it after the last exercise of its OWN kind rather than at the end
      // of the array: the logger renders resistance and cardio as two sections,
      // and the split learns its order from this array. Appending blindly would
      // teach the plan to put a new lift behind the cardio block.
      const isCardio = kind === 'cardio'
      let at = -1
      d.exercises.forEach((e, i) => {
        if ((e.kind === 'cardio') === isCardio) at = i
      })
      const insertAt = at !== -1 ? at + 1 : isCardio ? d.exercises.length : 0
      const next = { ...d, exercises: [...d.exercises.slice(0, insertAt), ex, ...d.exercises.slice(insertAt)] }
      if (bodyweight && (d.bodyweight == null || d.bodyweight === '')) next.bodyweight = bw
      // The session clock starts here when you went straight into the log
      // instead of tapping "Start session" (which stamps it itself). Not
      // `d.startedAt` — that's set when the page finds no draft to restore,
      // which can be hours before you pick up a dumbbell.
      if (!d.sessionStartedAt && !d.exercises.length) next.sessionStartedAt = Date.now()
      return next
    })
  }

  // Replace an exercise's identity (name/kind/DB link) mid-session, keeping
  // its slot (position, superset membership, planned-exercise link) but
  // resetting its sets to the new movement's shape — same number of sets as
  // before, blank values, fresh rep-target lookup. The note comes from the
  // movement you swapped TO: the old one's cue referred to a different lift.
  function substituteExercise(exId, name, kind, exerciseId) {
    const trimmed = name.trim().slice(0, 60)
    if (!trimmed) return
    const isStrength = kind !== 'cardio'
    const lib = isStrength ? getExercise(exerciseId) : null
    const laterality = isStrength ? (lib ? lib.laterality : lateralityFor(trimmed)) : undefined
    const bodyweight = isStrength ? (lib ? lib.bodyweight : usesBodyweight(trimmed)) : false
    const repRange = isStrength ? getExerciseTarget(trimmed) || undefined : undefined
    const note = getExerciseNote({ exerciseId, name: trimmed })
    setDraft((d) => ({
      ...d,
      exercises: d.exercises.map((e) => {
        if (e.id !== exId) return e
        const bw = bodyweight ? (d.bodyweight != null && d.bodyweight !== '' ? Number(d.bodyweight) : Number(prefillBodyweight()) || 0) : 0
        const fresh = createExercise(trimmed, kind, { laterality, repRange, bodyweight, bw, exerciseId: exerciseId || null, note })
        const targetCount = Math.max(1, e.sets.length)
        while (fresh.sets.length < targetCount) {
          const setOpts = fresh.bodyweight ? { bodyweight: true, bw } : { unilateral: fresh.unilateral }
          fresh.sets.push(createSet(fresh.sets[fresh.sets.length - 1], setOpts))
        }
        return {
          ...fresh,
          id: e.id,
          supersetId: kind === 'cardio' || e.kind === 'cardio' ? null : e.supersetId,
          plannedExerciseId: e.plannedExerciseId,
        }
      }),
    }))
  }

  // The split day this session came from, or null. A session started from the
  // split says so outright; anything else — a past session being edited, a
  // workout logged by hand — falls back to dayForSession, which recognises the
  // day by matching the exercises themselves. Memoized because everything below
  // reruns on every keystroke otherwise, and dayForSession rescans every day.
  const planDayForDraft = useMemo(
    () => (program ? confidentDay(program, draft) || dayForSession(program, draft) : null),
    [program, draft]
  )

  // Apply the same swap to the plan slot this session exercise came from — so
  // future sessions start with the new movement too. The day is passed in
  // rather than read off the draft: a session being edited afterwards no
  // longer knows which day it started from (see planDayForDraft).
  // Rewrites the plan row through the functional setter rather than the
  // closure's `program`, so a swap can't spread a stale copy over whatever the
  // split just learned from another change in the same session.
  function substituteInRoutine(dayId, plannedExerciseId, name, kind, exerciseId) {
    if (!dayId || !plannedExerciseId) return
    const trimmed = name.trim().slice(0, 60)
    setProgram((p) => {
      if (!p) return p
      const updated = {
        ...p,
        days: p.days.map((d) =>
          d.id === dayId
            ? { ...d, exercises: d.exercises.map((pe) => (pe.id === plannedExerciseId ? { ...pe, name: trimmed, exerciseId: exerciseId || null, kind } : pe)) }
            : d
        ),
        updatedAt: Date.now(),
      }
      persistProgram(updated)
      return updated
    })
  }

  // An OPEN slot got its movement. This is not a substitution — the plan asked
  // a question and this is the answer — so nothing is written back to the split
  // and nothing is asked about it: the row was left open on purpose and stays
  // open for next time (see the isOpenSlot guard in splitSync).
  //
  // The row is rebuilt rather than patched, because until now it had no
  // laterality, no bodyweight flag and no sets at all; those all come from the
  // movement you just picked. The slot, the plan link and the superset pairing
  // ride across, and the set count the plan asked for is restored so a 3-set
  // slot opens with 3 rows.
  function resolveSlot(exId, name, category, exerciseId) {
    const trimmed = name.trim().slice(0, 60)
    setDraft((d) => ({
      ...d,
      exercises: d.exercises.map((e) => {
        if (e.id !== exId) return e
        const lib = exerciseId ? getExercise(exerciseId) : null
        const kind = category === 'Cardio' ? 'cardio' : 'strength'
        const fresh = createExercise(trimmed, kind, {
          laterality: lib ? lib.laterality : lateralityFor(trimmed),
          repRange: e.repRange || undefined,
          bodyweight: lib ? lib.bodyweight : usesBodyweight(trimmed),
          bw: Number(d.bodyweight) || 0,
          exerciseId: exerciseId || null,
          note: getExerciseNote({ exerciseId, name: trimmed }),
        })
        const target = Math.max(1, Number(e.slot?.sets) || 1)
        while (fresh.sets.length < target) {
          const setOpts = fresh.bodyweight ? { bodyweight: true, bw: Number(d.bodyweight) || 0 } : { unilateral: fresh.unilateral }
          fresh.sets.push(createSet(fresh.sets[fresh.sets.length - 1], setOpts))
        }
        return {
          ...prefillFromHistory(fresh, Number(d.bodyweight) || 0, null),
          id: e.id,
          slot: e.slot,
          plannedExerciseId: e.plannedExerciseId,
          supersetId: e.supersetId,
        }
      }),
    }))
    setSubstituteFor(null)
  }

  // The picker chose a replacement. If the exercise sits in a row of the split
  // day this session belongs to, ask whether to update the split as well;
  // otherwise apply straight away (there's nothing to save into) — and the swap
  // is still offered at finish, once the day IS resolvable.
  function pickSubstitute(exId, name, category, exerciseId) {
    const kind = category === 'Cardio' ? 'cardio' : 'strength'
    const ex = draft.exercises.find((e) => e.id === exId)
    const day = planDayForDraft
    const pe = plannedRowFor(day, ex)
    if (pe) {
      setPendingSub({ exId, name, kind, exerciseId, plannedExerciseId: pe.id, dayId: day.id, dayName: day.name })
    } else {
      substituteExercise(exId, name, kind, exerciseId)
      setSubstituteFor(null)
    }
  }

  function confirmSubstitute(alsoRoutine) {
    if (!pendingSub) return
    const { exId, name, kind, exerciseId, plannedExerciseId, dayId } = pendingSub
    substituteExercise(exId, name, kind, exerciseId)
    if (alsoRoutine) {
      substituteInRoutine(dayId, plannedExerciseId, name, kind, exerciseId)
    } else {
      // Asked and declined: don't ask again about this row at the end of the
      // session. Recorded against the PLAN row, so swapping the same slot twice
      // still only costs one answer.
      setDraft((d) => ({ ...d, declinedSwaps: [...new Set([...(d.declinedSwaps || []), plannedExerciseId])] }))
    }
    setPendingSub(null)
    setSubstituteFor(null)
  }

  // Flip an exercise between bilateral and per-limb (left/right) logging,
  // converting its existing sets so nothing typed is lost.
  function toggleUnilateral(exId) {
    setDraft((d) => ({
      ...d,
      exercises: d.exercises.map((e) => {
        if (e.id !== exId || e.kind === 'cardio') return e
        // Only "both" exercises can switch; bilateral/unilateral are fixed.
        if ((e.laterality || 'both') !== 'both') return e
        const unilateral = !e.unilateral
        const next = { ...e, unilateral, sets: e.sets.map((s) => convertSet(s, unilateral)) }
        // The note is keyed by laterality as well as by movement, so switching
        // form switches which note this exercise is showing.
        return { ...next, note: getExerciseNote(next) || '' }
      }),
    }))
  }

  // Flip ONE set's shape (bilateral <-> left/right), independent of its
  // siblings — lets a "both" exercise mix shapes set to set within a single
  // session (e.g. a bilateral warm-up, then unilateral working sets). Only
  // offered on "both" exercises; fixed-laterality exercises keep every set
  // the same shape by construction, so toggling one would leave it stranded.
  function toggleSetUnilateral(exId, setId) {
    setDraft((d) => ({
      ...d,
      exercises: d.exercises.map((e) => {
        if (e.id !== exId || e.kind === 'cardio') return e
        if ((e.laterality || 'both') !== 'both') return e
        return { ...e, sets: e.sets.map((s) => (s.id === setId ? convertSet(s, !s.left) : s)) }
      }),
    }))
  }

  // Group two resistance exercises into a superset. If either is already in a
  // superset the other joins it; otherwise a new group is created. Works for
  // any two exercises regardless of their position in the list — they're
  // immediately pulled adjacent afterward (regroupSupersets) so paired
  // exercises always render together.
  function pairSuperset(exId, targetId) {
    setDraft((d) => {
      const a = d.exercises.find((e) => e.id === exId)
      const b = d.exercises.find((e) => e.id === targetId)
      if (!a || !b || a.kind === 'cardio' || b.kind === 'cardio') return d
      const groupId = b.supersetId || a.supersetId || newSupersetId()
      const exercises = d.exercises.map((e) => (e.id === exId || e.id === targetId ? { ...e, supersetId: groupId } : e))
      return { ...d, exercises: regroupSupersets(pruneSupersets(exercises)) }
    })
  }

  // How this session has drifted from its split day — drives the "Update split"
  // row and the review modal. Empty when they already agree, when the session
  // isn't linked to a split, or when there's no split at all.
  const splitChanges = useMemo(
    () =>
      diffSessionAgainstDay(draft.exercises, planDayForDraft, {
        complete: isEditing,
        droppedPlannedIds: draft.droppedPlannedIds || [],
        ignoreSwaps: draft.declinedSwaps || [],
      }),
    [draft.exercises, draft.droppedPlannedIds, draft.declinedSwaps, planDayForDraft, isEditing]
  )

  // Write the accepted changes into the split. Exercises added to the plan are
  // stamped back onto the session so they stay linked from here on — a later
  // swap on one will offer to update the split too.
  function applyChangesToSplit(accepted) {
    if (!program || !planDayForDraft || !accepted.length) return
    const { program: updated, links } = applySplitChanges(program, planDayForDraft.id, accepted)
    setProgram(updated)
    persistProgram(updated)
    if (links.size) {
      setDraft((d) => ({
        ...d,
        exercises: d.exercises.map((e) => (links.has(e.id) ? { ...e, plannedExerciseId: links.get(e.id) } : e)),
      }))
    }
  }

  // What this session has to say to the split, resolved as the session ENDS.
  // `complete: true` here and nowhere else: at finish a set count below the plan
  // is a real signal rather than "not there yet", and an exercise with nothing
  // logged didn't happen.
  function splitSyncPlan() {
    if (!program) return null
    const sure = confidentDay(program, draft)
    const day = sure || dayForSession(program, draft)
    if (!day) return null
    const changes = diffSessionAgainstDay(draft.exercises, day, {
      complete: true,
      droppedPlannedIds: draft.droppedPlannedIds || [],
      ignoreSwaps: draft.declinedSwaps || [],
    })
    if (!changes.length) return null
    return { day, changes, confident: !!sure }
  }

  // A soft removal is an absence, not an instruction — you ran out of time. It's
  // offered in the review sheet but never written unattended, so one short
  // session can't quietly delete a lift from the split.
  const autoAcceptable = (changes) => changes.filter((c) => !(c.kind === 'remove' && c.soft))

  // Put the split back exactly as it was before the last finish. The snapshot is
  // a deep copy taken before the write — applySplitChanges doesn't mutate, so a
  // reference would do today, but a safety net that can silently stop being one
  // isn't a safety net. updatedAt is bumped so the restore reads as the newest
  // write rather than a stale blob losing to what it just replaced.
  function undoSplitSync() {
    if (!splitSyncDone?.snapshot) return
    const restored = { ...splitSyncDone.snapshot, updatedAt: Date.now() }
    setProgram(restored)
    persistProgram(restored)
    setSplitSyncDone(null)
  }

  // Move an exercise up/down, keeping resistance and cardio reordered
  // independently (they render in separate sections) and superset groups
  // moving as a single unit (exerciseBlocks treats a contiguous group as one
  // block, so this can't split them apart).
  function moveExercise(exId, delta) {
    setDraft((d) => {
      const ex = d.exercises.find((e) => e.id === exId)
      if (!ex) return d
      const isCardio = ex.kind === 'cardio'
      const sameKind = d.exercises.filter((e) => (e.kind === 'cardio') === isCardio)
      const blocks = exerciseBlocks(sameKind)
      const blockIdx = blocks.findIndex((b) => b.some((e) => e.id === exId))
      const to = blockIdx + delta
      if (to < 0 || to >= blocks.length) return d
      const reordered = blocks.slice()
      const [blk] = reordered.splice(blockIdx, 1)
      reordered.splice(to, 0, blk)
      const newSameKindOrder = reordered.flat()
      let ptr = 0
      const exercises = d.exercises.map((e) => ((e.kind === 'cardio') === isCardio ? newSameKindOrder[ptr++] : e))
      return { ...d, exercises }
    })
  }

  // Remove one exercise from its superset (and dissolve the group if that leaves
  // a lone partner).
  function removeFromSuperset(exId) {
    setDraft((d) => {
      const exercises = d.exercises.map((e) => (e.id === exId ? { ...e, supersetId: null } : e))
      return { ...d, exercises: pruneSupersets(exercises) }
    })
  }

  function updateLimbSet(exId, setId, side, field, value) {
    if (value !== '') {
      const n = Number(value)
      if (!Number.isFinite(n) || n < 0) return
      if (field === 'rir' && n > 10) return
    }
    setDraft((d) => ({
      ...d,
      exercises: d.exercises.map((e) =>
        e.id === exId
          ? { ...e, sets: e.sets.map((s) => (s.id === setId ? withRestStamp(s, { ...s, [side]: { ...s[side], [field]: value } }, e.kind) : s)) }
          : e
      ),
    }))
  }

  // Swap a unilateral set's left/right values (e.g. you logged them the wrong
  // way round, or want to lead with the other side).
  function swapLimbs(exId, setId) {
    setDraft((d) => ({
      ...d,
      exercises: d.exercises.map((e) =>
        e.id === exId
          ? { ...e, sets: e.sets.map((s) => (s.id === setId && s.left ? { ...s, left: s.right, right: s.left } : s)) }
          : e
      ),
    }))
  }

  function setRepRange(exId, field, value) {
    const n = value === '' ? '' : Math.max(1, Math.min(50, parseInt(value, 10) || 0))
    setDraft((d) => ({
      ...d,
      exercises: d.exercises.map((e) =>
        e.id === exId ? { ...e, repRange: { ...(e.repRange || { low: 6, high: 10 }), [field]: n } } : e
      ),
    }))
  }

  // Add a rep-range target to an exercise (opt-in) or clear it (pass null).
  function setRepTarget(exId, repRange) {
    setDraft((d) => ({
      ...d,
      exercises: d.exercises.map((e) => (e.id === exId ? { ...e, repRange } : e)),
    }))
  }

  // Free-text note on an exercise. The note belongs to the MOVEMENT, not to this
  // session or this split day: write it on Lat Pulldown here and it's there on
  // every other day that trains it, and in the builder. The copy on the exercise
  // is the record of what the note said at the time, so old sessions keep
  // reading the way they did.
  function setExerciseNote(exId, note) {
    setDraft((d) => {
      const ex = d.exercises.find((e) => e.id === exId)
      if (ex) saveExerciseNote(ex, note)
      return { ...d, exercises: d.exercises.map((e) => (e.id === exId ? { ...e, note: note.slice(0, 300) } : e)) }
    })
  }

  // Push the notes map up once typing stops (blur), not per keystroke — a
  // network call per character would be wasteful and racy. Best-effort: a
  // failed push just leaves the account slightly behind until the next one.
  function syncNotesToRemote() {
    if (!user) return
    upsertRemoteExerciseNotes(user.id, getExerciseNotesMap()).catch(() => {})
  }

  function toggleNote(exId) {
    setNoteOpenFor((prev) => {
      const next = new Set(prev)
      if (next.has(exId)) next.delete(exId)
      else next.add(exId)
      return next
    })
  }

  // Cycle a set's type: working → warm-up → back-off → working. Warm-ups are
  // logged but excluded from volume/hard-set counts; back-offs are working sets,
  // just labeled.
  function cycleSetType(exId, setId) {
    // normal -> warmup -> backoff -> normal. An explicit order array (rather
    // than a lookup object) avoids ?? ambiguity between "no such key" and "the
    // next state is genuinely undefined" — the bug that used to send back-off
    // back to warm-up instead of clearing to normal.
    const order = ['warmup', 'backoff', undefined]
    setDraft((d) => ({
      ...d,
      exercises: d.exercises.map((e) =>
        e.id === exId
          ? {
              ...e,
              sets: e.sets.map((s) => {
                if (s.id !== setId) return s
                const t = order[(order.indexOf(s.type) + 1) % order.length]
                const { type, ...rest } = s // eslint-disable-line no-unused-vars
                return t ? { ...rest, type: t } : rest
              }),
            }
          : e
      ),
    }))
  }

  function changeUnit(u) {
    setUnit(u)
    saveUnit(u)
  }

  function changeDate(value) {
    if (!value) return
    // The input's `max` only constrains the picker — a typed future date still
    // comes through, so clamp it to today.
    const ts = Math.min(fromInputDate(value), Date.now())
    if (Number.isNaN(ts)) return
    // Moving a backdated write-up onto today makes it today's session, and the
    // flag has to go with the date it was about — left set, it would keep the
    // leftover checks looking the other way.
    setDraft((d) => ({ ...d, date: ts, backdated: d.backdated && !isSameDay(ts, Date.now()) }))
  }

  function removeExercise(exId) {
    setDraft((d) => {
      const ex = d.exercises.find((e) => e.id === exId)
      // Deleting a planned exercise is a decision; skipping one is running out of
      // time. Only the decision may shrink the split unattended (see splitSync's
      // soft removals) — and this tap is the only moment the two are
      // distinguishable, since once it's out of the list they look identical.
      const droppedPlannedIds = ex?.plannedExerciseId
        ? [...new Set([...(d.droppedPlannedIds || []), ex.plannedExerciseId])]
        : d.droppedPlannedIds
      return { ...d, exercises: d.exercises.filter((e) => e.id !== exId), droppedPlannedIds }
    })
  }

  function addSet(exId) {
    const now = Date.now()
    setDraft((d) => ({
      ...d,
      exercises: d.exercises.map((e) => {
        if (e.id !== exId) return e
        // Moving on to a new set means the current last set is done — stamp it
        // (if logged but not yet stamped) so rest is captured even when you keep
        // the same reps and never touch the inputs.
        const sets = e.sets.map((s, i) =>
          i === e.sets.length - 1 && !s.completedAt && setHasWork(s, e.kind) ? { ...s, completedAt: now } : s
        )
        const prev = sets[sets.length - 1]
        // A new set inherits the PREVIOUS set's own shape (not an exercise-wide
        // flag) — so on a "both" exercise, adding a set after a unilateral one
        // defaults to unilateral, and after a bilateral one defaults to bilateral.
        const opts = e.bodyweight ? { bodyweight: true, bw: Number(d.bodyweight) || 0 } : { unilateral: !!prev?.left }
        return { ...e, sets: [...sets, createSet(prev, opts)] }
      }),
    }))
  }

  // Session bodyweight (shared by all bodyweight-loaded exercises). Recompute
  // each affected set's effective load = bodyweight + added.
  function setSessionBodyweight(value) {
    if (value !== '' && !Number.isFinite(Number(value))) return
    const bw = Number(value) || 0
    setDraft((d) => ({
      ...d,
      bodyweight: value,
      exercises: d.exercises.map((e) =>
        e.bodyweight
          ? { ...e, sets: e.sets.map((s) => ({ ...s, bw, weight: Math.max(0, bw + (Number(s.added) || 0)) })) }
          : e
      ),
    }))
  }

  // Added/assist weight for a bodyweight set (may be negative for assisted).
  function updateAdded(exId, setId, value) {
    if (value !== '' && value !== '-' && !Number.isFinite(Number(value))) return
    setDraft((d) => {
      const bw = Number(d.bodyweight) || 0
      return {
        ...d,
        exercises: d.exercises.map((e) =>
          e.id === exId
            ? { ...e, sets: e.sets.map((s) => (s.id === setId ? withRestStamp(s, { ...s, added: value, weight: Math.max(0, bw + (Number(value) || 0)) }, e.kind) : s)) }
            : e
        ),
      }
    })
  }

  function updateSet(exId, setId, field, value) {
    // `min`/`max` on number inputs don't stop typed values — reject negatives
    // and cap RIR at 10 so the stats/shared-data math never sees junk.
    if (value !== '') {
      const n = Number(value)
      if (!Number.isFinite(n) || n < 0) return
      if (field === 'rir' && n > 10) return
    }
    setDraft((d) => ({
      ...d,
      exercises: d.exercises.map((e) =>
        e.id === exId
          ? { ...e, sets: e.sets.map((s) => (s.id === setId ? withRestStamp(s, { ...s, [field]: value }, e.kind) : s)) }
          : e
      ),
    }))
  }

  // Take up every suggestion still showing on this exercise, in one tap — the
  // "same as last time" path, back after suggestions stopped being pre-typed.
  // Only fills blanks, so it can't overwrite anything already entered.
  //
  // Stamped like any other way of logging a set: taking last week's numbers is
  // still saying you did the work, and rest starts from the tap. Sets filled in
  // the same instant are gaps of zero, which restBetweenSets already discards as
  // implausible — logging in a batch means your rest simply wasn't measured, not
  // that it was nothing.
  //
  // PROVISIONALLY stamped, though, unlike every other path. This one tap covers
  // sets you may not have done yet, and the app can't tell which way round it is
  // — filling the exercise in afterwards and setting it up before you start look
  // identical from here. So the stamps stay open to correction: whatever you do
  // to one of these rows next, however much later, takes it back. See restStamp.
  function fillFromHint(exId) {
    setDraft((d) => ({
      ...d,
      exercises: d.exercises.map((e) =>
        e.id === exId
          ? { ...e, sets: e.sets.map((s) => { const filled = promoteHint(s); return filled === s ? s : withAutoStamp(s, filled, e.kind) }) }
          : e
      ),
    }))
  }

  // The done tick on a set row. Says outright what typing into a field says by
  // implication — that set is behind you — and it's the only way to say it once
  // "Same as last time" has filled every row and left nothing to type. Works on
  // a warm-up too: the clock counts rest after those the same as after anything.
  function markSetDone(exId, setId) {
    setDraft((d) => ({
      ...d,
      exercises: d.exercises.map((e) =>
        e.id === exId
          ? { ...e, sets: e.sets.map((s) => (s.id === setId ? withDoneStamp(s, e.kind) : s)) }
          : e
      ),
    }))
  }

  // Take up ONE set's suggestion. Only blanks are filled, same guarantee as the
  // exercise-wide button, so a weight you already changed by hand survives —
  // which is what makes it safe to fill the whole row rather than just the field
  // you happened to be in. Stamped as logged just now when it lands on real
  // work, so the rest timer starts exactly as if you'd typed the numbers.
  //
  // On a unilateral set the row stops at the limb you're in: `side` is the field
  // that asked, and the other arm stays blank until you've actually done it.
  function fillSetFromHint(exId, setId, side = null) {
    setDraft((d) => ({
      ...d,
      exercises: d.exercises.map((e) =>
        e.id === exId
          ? {
              ...e,
              sets: e.sets.map((s) => {
                if (s.id !== setId) return s
                const filled = promoteHint(s, side)
                return filled === s ? s : withRestStamp(s, filled, e.kind)
              }),
            }
          : e
      ),
    }))
  }

  // Enter takes this set's suggestion and closes the field. The most common set
  // of all is "same as last time", and it should cost one key rather than
  // retyping numbers already sitting there in grey. `enterKeyHint` is what makes
  // that key draw as Done (a checkmark on Android) instead of a return arrow,
  // so the thing you press looks like the thing it does.
  //
  // This is a keyboard-and-Android path ONLY. iOS numeric keypads have no Return
  // key whatsoever — the ✓ Safari shows above them is OS chrome that just
  // dismisses the keyboard, firing no key event — so `enterKeyHint` is inert
  // there and this handler can never run. <HintBar> is what makes the same
  // action reachable by thumb; the onFocus/onBlur below are how it knows which
  // set you're in.
  //
  // preventDefault so it can never submit anything, and blur explicitly: the IME
  // closes itself on Android but not everywhere, and a caret still sitting in a
  // field you've just finished reads as though nothing happened.
  const hintKeyProps = (exId, setId, side = null) => ({
    enterKeyHint: 'done',
    onFocus: () => setFocusedSet({ exId, setId, side }),
    onBlur: () => setFocusedSet((cur) => (cur && cur.setId === setId && cur.side === side ? null : cur)),
    onKeyDown: (e) => {
      if (e.key !== 'Enter') return
      e.preventDefault()
      fillSetFromHint(exId, setId, side)
      e.currentTarget.blur()
    },
  })

  function removeSet(exId, setId) {
    setDraft((d) => ({
      ...d,
      exercises: d.exercises.map((e) =>
        e.id === exId ? { ...e, sets: e.sets.filter((s) => s.id !== setId) } : e
      ),
    }))
  }

  // Load a past session back into the editor. Any unfinished (non-edit) draft
  // is stashed so it can be restored when the edit is done or cancelled.
  function editSession(session) {
    setDraft((cur) => {
      if (cur.exercises.length > 0 && !cur.editingId) stashDraft(cur)
      // Restore the session's bodyweight (used by bodyweight-loaded sets) from
      // whatever was baked into its sets.
      let bodyweight = ''
      for (const ex of session.exercises) {
        if (ex.bodyweight) {
          const s = ex.sets.find((st) => st.bw != null)
          if (s) { bodyweight = s.bw; break }
        }
      }
      return {
        startedAt: Date.now(),
        date: session.date,
        name: session.name || '',
        exercises: migrateSupersets(session.exercises.map(migrateExercise)),
        bodyweight,
        editingId: session.id,
        // Carried, not recomputed. `startedAt` above is this EDIT's wall clock
        // (it doubles as the double-submit key); the three below are when the
        // workout itself ran — deliberately named apart so the two can't be
        // confused. A hand-corrected time has to survive re-opening a session.
        sessionStartedAt: session.startedAt ?? null,
        sessionEndedAt: session.endedAt ?? null,
        durationMs: session.durationMs ?? null,
      }
    })
    setOpenSession(null)
    setEditingDate(false)
    setSaveError('')
    setSplitSyncDone(null)
    lastFinishedRef.current = null
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 40)
  }

  // Leave edit / program-session mode, restoring any stashed in-progress draft
  // (else start fresh).
  function exitEditMode() {
    const stash = getStashedDraft()
    clearStashedDraft()
    clearDraft()
    setDraft(stash || emptyDraft())
    setEditingDate(false)
    clearRestAnchor()
  }

  // Persist the program: locally always, remotely (best-effort) when logged in.
  function persistProgram(p) {
    saveProgram(p)
    if (user) upsertRemoteProgram(user.id, p).catch(() => {})
  }

  // Seed an exercise's sets from the last time it was logged (any session, not
  // just this same routine day): set count (warm-ups included) and each set's
  // own bilateral/unilateral shape come from there, and so do the numbers — but
  // as GREY SUGGESTIONS, not as entries. This is the per-day memory: a "both"
  // exercise logged unilateral on Push day and bilateral on a Full-Body day
  // recreates that exact per-set mix next time.
  //
  // Suggestions rather than values because the split now learns from what you
  // logged: pre-typing last week's numbers would mean every planned exercise
  // read as "done" the moment the session opened, and skipping one would be
  // impossible to express. The plan's set count is kept as a floor, so a day
  // that asks for four sets still shows four rows even if you only did two last
  // time. Only bails when bodyweight-loaded doesn't match.
  function prefillFromHistory(ex, sessionBw, plannedUnilateral = null) {
    if (ex.kind === 'cardio') return ex
    const last = lastLoggedExercise(history, { exerciseId: ex.exerciseId, name: ex.name })
    if (!last) return ex
    // Per-day memory replays last time's per-set mix — EXCEPT where the split
    // has stated an opinion. A laterality you just set in the builder must not
    // be quietly undone by last week's log; a split that says nothing still
    // defers to history, exactly as before.
    const laterality =
      ex.bodyweight || typeof plannedUnilateral !== 'boolean'
        ? ex.laterality
        : plannedUnilateral
          ? 'unilateral'
          : 'bilateral'
    const sets = setsFromPrevious(last.ex, last.unit, unit, { laterality, bodyweight: ex.bodyweight, bw: sessionBw, asHint: true })
    if (!sets || !sets.length) return ex
    // Top back up to whatever the plan asked for, so a day prescribing four sets
    // still shows four rows when last time only got two.
    while (sets.length < ex.sets.length) {
      const prev = sets[sets.length - 1]
      const setOpts = ex.bodyweight ? { bodyweight: true, bw: sessionBw } : { unilateral: !!prev?.left }
      sets.push({ ...createSet(undefined, setOpts), ...(prev?.hint ? { hint: prev.hint } : {}) })
    }
    // Keep the display flag roughly in sync with what a fresh "add set" would
    // now inherit (the last set's shape) — purely cosmetic for the toggle
    // button's label; each set's real shape is what actually gets logged.
    const unilateral = ex.bodyweight ? false : !!sets[sets.length - 1].left
    return { ...ex, sets, unilateral }
  }

  // Start a planned session: fill the draft from the program day (name +
  // exercises + targets) and tag it so finishing advances the rotation. Whatever
  // is worth keeping (see willStashDraft) is stashed first, like edit mode, and
  // restored later.
  //
  // `date` is the day the session BELONGS to, which is today for every button on
  // this page but a past date when the calendar sends you here to log a workout
  // you missed.
  function startPlannedSession(day, { date = Date.now() } = {}) {
    const backdated = !isSameDay(date, Date.now())
    setDraft((cur) => {
      if (willStashDraft(cur, isLeftoverDraft(cur))) stashDraft(cur)
      const bodyweight = prefillBodyweight()
      // Resolved by plan link rather than array index, so this survives
      // draftFromDay ever filtering or reordering what it returns.
      const byPeId = new Map((day.exercises || []).map((pe) => [pe.id, pe]))
      const exercises = draftFromDay(day, { bodyweight })
        .map((ex) => prefillFromHistory(ex, Number(bodyweight) || 0, plannedLaterality(byPeId.get(ex.plannedExerciseId))))
        // The note follows the movement, so it comes from the shared store
        // rather than from this day's copy of it (draftFromDay stays pure).
        .map((ex) => ({ ...ex, note: getExerciseNote(ex) || ex.note || '' }))
      return {
        startedAt: Date.now(),
        // This tap is the start of the workout, and what its duration counts
        // from. Distinct from `startedAt` above, which is bookkeeping for the
        // draft itself (and the double-submit guard).
        //
        // Not stamped for a workout you're writing up after the fact: the clock
        // would run from now, and report the minutes you spent TYPING as the
        // length of a session you trained days ago. Left unset, sessionTimes
        // falls back to the span of the sets themselves, and the window stays
        // editable on the saved session.
        sessionStartedAt: backdated ? null : Date.now(),
        // Today keeps the real timestamp (it's what orders two sessions logged
        // on the same day); a past date is noon-pinned, the way the date picker
        // and every stored annotation pin theirs.
        date: backdated ? noonOf(date) : date,
        backdated,
        name: day.name || '',
        exercises,
        bodyweight,
        programId: program.id,
        programDayId: day.id,
      }
    })
    setEditingDate(false)
    setSaveError('')
    setSplitSyncDone(null)
    lastFinishedRef.current = null
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 40)
  }

  // Advance the rotation past `day` without logging anything — for an actual
  // rest day, or for a training day you've marked off (sick/injury/etc.) and
  // are skipping rather than logging.
  function markRestDone(day) {
    if (!program) return
    const advanced = advanceProgram(program, day.id)
    setProgram(advanced)
    persistProgram(advanced)
  }

  // ---- Injury ---------------------------------------------------------------
  //
  // Marking a day as an injury is what tells the rotation its slot is SPENT
  // rather than owed (SLOT_CONSUMING_REASONS in program.js): the split carries
  // on and every day after it keeps its place in the calendar. That's why it's
  // one tap from here rather than a trip to /calendar — a rule you can only
  // reach from another page is one you won't reach mid-session.

  // Same remote-with-local-fallback shape the calendar page uses.
  async function persistAnnotation(entry) {
    if (user && remoteAnnotationsOk) {
      try {
        await upsertRemoteDayAnnotation(user.id, entry)
        setAnnotations((prev) => [entry, ...prev.filter((a) => a.id !== entry.id)])
        return
      } catch {
        setRemoteAnnotationsOk(false)
      }
    }
    setAnnotations(saveDayAnnotation(entry))
  }

  // One annotation per calendar day, so reuse whatever the date already carries
  // — a second mark-off edits it rather than stacking a duplicate underneath.
  //
  // `injuryId` links the day to a tracked injury. The annotation still carries
  // the whole meaning on its own (and still spends the day's split slot), so the
  // link is optional in both directions: you can mark a day off without tracking
  // anything, and a tracked injury doesn't write a mark-off for every day it
  // lasts. See the note on SLOT_CONSUMING_REASONS in program.js.
  function markInjured(date, note, injuryId = null) {
    const existing = annotationForDate(annotations, date)
    const entry = existing
      ? { ...existing, reason: 'injury', note: (note || '').trim().slice(0, 300), injuryId: injuryId || existing.injuryId || null }
      : { ...makeDayAnnotation('injury', note, noonOf(date)), injuryId }
    return persistAnnotation(entry)
  }

  function openInjuryPrompt(mode, date) {
    const existing = annotationForDate(annotations, date)
    setInjuryPrompt({ mode, date })
    setInjuryNote(existing?.note || '')
    // Default to the injury this day is already attached to; failing that, to
    // the only open one, since with exactly one candidate the question is noise.
    setInjuryLink(existing?.injuryId || (openInjuryList.length === 1 ? openInjuryList[0].id : null))
  }

  // Confirmed. Whatever was already logged is worth keeping — you trained until
  // you couldn't — so a session with work in it saves through the ordinary
  // finish path, which advances the rotation and records the day exactly as a
  // normal finish would. The split sync is deliberately skipped (`null`): a
  // workout cut short is the last thing the plan should learn from, since every
  // exercise you never got to would read as one you'd dropped.
  //
  // The mark-off is written FIRST so an injury is recorded even if the save then
  // fails — the day is a fact, the session is a save that can be retried.
  async function confirmInjury() {
    if (!injuryPrompt || saving) return
    const { mode, date } = injuryPrompt
    setInjuryPrompt(null)
    // Links the day to the injury and nothing more. It's tempting to also write
    // a check-in here — a day you had to stop is obviously a bad day — but any
    // number we picked would be one the user never chose, sitting on the pain
    // chart that exists to tell them honestly whether this is healing. The link
    // is a fact; the severity would be a guess. Rating stays a deliberate act,
    // one tap away on the calendar day panel or the injury page.
    const linked = openInjuryList.find((i) => i.id === injuryLink) || null
    await markInjured(date, injuryNote, linked?.id || null)
    if (mode !== 'session') return
    if (hasLoggedSets) await commitSession(null)
    else discard()
  }

  // "Something new" from the prompt: get out of the way and let /injuries ask
  // the questions properly (which area, which side, when it started) rather than
  // growing a second injury form inside a modal about ending a session.
  async function markInjuredAndTrack() {
    if (!injuryPrompt || saving) return
    const { mode, date } = injuryPrompt
    setInjuryPrompt(null)
    await markInjured(date, injuryNote, null)
    if (mode === 'session') {
      if (hasLoggedSets) await commitSession(null)
      else discard()
    }
    navigate('/injuries', { state: { newInjury: true } })
  }

  // Finishing is two steps whenever the split day was only a guess: show the
  // list, then commit with the answer. The double-submit guard is READ but not
  // armed here — nothing has been written yet, so coming back through the sheet
  // isn't a second finish, it's the same one continuing.
  async function finish() {
    if (saving || pendingSync || lastFinishedRef.current === draft.startedAt) return
    const sync = splitSyncPlan()
    if (sync && !sync.confident) {
      setPendingSync(sync)
      return
    }
    await commitSession(sync ? { day: sync.day, accepted: autoAcceptable(sync.changes) } : null)
  }

  // The review sheet resolved. `accepted` is [] when the user chose to finish
  // without updating.
  function resolvePendingSync(accepted) {
    const sync = pendingSync
    setPendingSync(null)
    if (sync) commitSession({ day: sync.day, accepted })
  }

  async function commitSession(sync) {
    if (saving || lastFinishedRef.current === draft.startedAt) return
    lastFinishedRef.current = draft.startedAt
    setSaveError('')
    setSaving(true)

    // ONE program write for the whole finish. The rotation advance and the split
    // changes are folded into a single object before either is persisted:
    // persistProgram's remote half is a read-modify-write, so two writes a round
    // trip apart would race — and advanceProgram SPREADS what it's handed, so
    // running the two in sequence off the original would discard whichever went
    // first. The write lands before the session save so the plan-row ids it
    // mints can be baked into the session; a failed save rolls it back below.
    //
    // The advance goes FIRST so it can be snapshotted into `base`: undoing the
    // split sync must not un-log the workout. The two touch disjoint fields
    // (pointer vs days), so the order is free.
    let base = program
    if (!draft.editingId && program && draft.programId === program.id && draft.programDayId) {
      // The advance stamp comes from the session's date, not the wall clock, so
      // a backdated log consumes a past slot instead of marking today done.
      base = advanceProgram(base, draft.programDayId, { sessionDate: draft.date || Date.now() })
    }
    let nextProgram = base
    let links = new Map()
    if (sync?.accepted?.length) {
      const applied = applySplitChanges(base, sync.day.id, sync.accepted)
      nextProgram = applied.program
      links = applied.links
    }
    if (nextProgram !== program) {
      setProgram(nextProgram)
      persistProgram(nextProgram)
    }
    // Undo targets the split edits only — the rotation stays where finishing put
    // it, because the session that advanced it is still saved.
    const banner = sync?.accepted?.length
      ? { dayName: sync.day.name, count: sync.accepted.length, snapshot: JSON.parse(JSON.stringify(base)) }
      : null
    // Bake the links the split just minted into the exercises we're about to
    // SAVE, not only into the live draft: re-open this session next month and it
    // still knows which day it came from, so an edit can be offered back.
    const exercises = links.size
      ? draft.exercises.map((e) => (links.has(e.id) ? { ...e, plannedExerciseId: links.get(e.id) } : e))
      : draft.exercises
    // The program write already happened, so put it ALL back if the session
    // doesn't land — split edits and rotation advance both. A split that learned
    // from a workout that was never saved is worse than one that learned nothing.
    const rollback = () => {
      if (nextProgram === program) return
      setProgram(program)
      persistProgram(program)
    }

    // Editing an existing session: overwrite it in place (keep its id and the
    // times the workout originally ran) instead of creating a new one.
    if (draft.editingId) {
      const updated = {
        id: draft.editingId,
        date: draft.date || Date.now(),
        name: draft.name || '',
        unit,
        startedAt: draft.sessionStartedAt ?? null,
        endedAt: draft.sessionEndedAt ?? null,
        durationMs: draft.durationMs ?? null,
        exercises: stripHints(exercises),
      }
      try {
        if (user) {
          await updateRemoteSession(user.id, updated)
          setHistory((prev) => [updated, ...prev.filter((s) => s.id !== updated.id)].sort((a, b) => b.date - a.date))
        } else {
          setHistory(updateLocalSession(updated))
        }
        for (const ex of updated.exercises) {
          if (ex.kind !== 'cardio' && ex.repRange) saveExerciseTarget(ex.name, ex.repRange)
        }
        setSplitSyncDone(banner)
        exitEditMode()
      } catch {
        rollback()
        lastFinishedRef.current = null
        setSaveError('Could not save your changes. Check your connection and try again.')
      } finally {
        setSaving(false)
      }
      return
    }

    const session = makeSession({ ...draft, exercises }, unit)
    try {
      if (user) {
        await insertRemoteSession(user.id, session)
        setHistory((prev) => [session, ...prev].sort((a, b) => b.date - a.date))
        // If the user opted in, contribute anonymized rows — best-effort, never
        // block or fail the session save.
        if (profile?.share_data) {
          try {
            const rows = buildSharedLifts(session, profile)
            if (rows.length) await insertSharedLifts(rows)
          } catch {
            // ignore
          }
        }
      } else {
        setHistory(addLocalSession(session))
        // Guest contribution — opt-in, anonymized, through the Turnstile-
        // protected edge function. Best-effort; never blocks the save.
        if (guestShare.share && turnstileConfigured()) {
          try {
            const rows = buildSharedLifts(session, { sex: guestShare.sex, bodyweight: guestShare.bodyweight, unit })
            if (rows.length) {
              const token = await getTurnstileToken()
              await submitGuestLifts(token, rows, hp)
            }
          } catch {
            // ignore
          }
        }
      }
      // Remember each exercise's rep target so it prefills next time.
      for (const ex of session.exercises) {
        if (ex.kind !== 'cardio' && ex.repRange) saveExerciseTarget(ex.name, ex.repRange)
      }
      setSplitSyncDone(banner)
      // Restore any stashed in-progress draft (set aside when a planned session
      // was started over it), else start fresh. Harmless for plain saves.
      const stash = getStashedDraft()
      clearStashedDraft()
      clearDraft()
      setDraft(stash || emptyDraft())
      setEditingDate(false)
      clearRestAnchor()
    } catch {
      // Allow retrying this same draft after a failed save.
      rollback()
      lastFinishedRef.current = null
      setSaveError('Could not save your session. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  // Bring back the session the dashboard set aside. Only offered while the
  // current draft is empty, so this can never write over work in progress.
  function restoreSetAside() {
    const stash = migrateDraft(getStashedDraft())
    clearStashedDraft()
    setSetAside(null)
    if (!stash) return
    saveDraft(stash)
    setDraft(stash)
    setEditingDate(false)
  }

  // ...or let it go. Without this the slot could sit occupied indefinitely, and
  // a stash nobody claims is what a later "cancel edit" would resurrect.
  function dropSetAside() {
    clearStashedDraft()
    setSetAside(null)
  }

  function discard() {
    // Editing or a started program session: restore any stashed draft.
    if (draft.editingId || draft.programId) return exitEditMode()
    clearDraft()
    setDraft(emptyDraft())
    setEditingDate(false)
    clearRestAnchor()
  }

  async function removeSession(id) {
    if (user) {
      try {
        await deleteRemoteSession(id)
      } catch {
        return
      }
      setHistory((prev) => prev.filter((s) => s.id !== id))
    } else {
      setHistory(deleteSession(id))
    }
  }

  // Tap a day in the calendar: select it so the day-detail panel (below the
  // calendar) shows that day's workouts with edit / delete / add actions.
  function selectCalendarDay(date) {
    setSelectedCalDay((prev) => (prev && isSameDay(prev, date) ? null : date))
  }

  // Start (or backdate the in-progress) session onto a chosen day, then jump to
  // the editor — the quick way to log a workout you forgot, from the calendar.
  function startWorkoutOnDay(date) {
    const noon = new Date(date)
    noon.setHours(12, 0, 0, 0)
    const day = Math.min(noon.getTime(), Date.now())
    if (draft.editingId) {
      // Leave edit mode, restoring any stashed in-progress draft, then backdate.
      const stash = getStashedDraft()
      clearStashedDraft()
      clearDraft()
      setDraft({ ...(stash || emptyDraft()), date: day })
    } else {
      setDraft((d) => ({ ...d, date: day }))
    }
    setEditingDate(false)
    setSelectedCalDay(null)
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 40)
  }

  // Move a saved session to another day (e.g. the date was misclicked). Clamp
  // to today — a workout can't be logged in the future.
  async function changeSessionDate(session, value) {
    if (!value) return setEditingSessionDate(null)
    const ts = Math.min(fromInputDate(value), Date.now())
    if (Number.isNaN(ts) || isSameDay(ts, session.date)) return setEditingSessionDate(null)
    const updated = { ...session, date: ts }
    if (user) {
      try {
        await updateRemoteSessionDate(session.id, ts)
      } catch {
        setSaveError('Could not move that workout. Check your connection and try again.')
        return
      }
      setHistory((prev) => [updated, ...prev.filter((s) => s.id !== session.id)].sort((a, b) => b.date - a.date))
    } else {
      setHistory(updateLocalSession(updated))
    }
    setEditingSessionDate(null)
    setSaveError('')
  }

  // Correct when a saved session ran. The clock is derived from the set stamps
  // at finish, which is right for a session you logged as you went and wrong
  // for one you wrote up afterwards — so it's editable.
  //
  // Only the timing fields move. `date` stays exactly where it is (and stays
  // noon-pinned), so correcting the time can never bump a workout onto another
  // day. Note there's no isSameDay guard like changeSessionDate's — that's
  // day-granularity and would swallow every same-day edit, which is all of them.
  async function changeSessionTime(session, { start, end }) {
    const day = session.date || Date.now()
    const startTs = start ? withTimeOfDay(day, start) : null
    let endTs = end ? withTimeOfDay(day, end) : null
    if (!startTs || !endTs) return setEditingSessionTime(null)
    // Finishing "before" you started means you trained past midnight.
    if (endTs < startTs) endTs += 24 * 60 * 60 * 1000
    const durationMs = endTs - startTs
    if (durationMs === session.durationMs && startTs === session.startedAt) return setEditingSessionTime(null)

    const updated = { ...session, startedAt: startTs, endedAt: endTs, durationMs }
    if (user) {
      try {
        await updateRemoteSessionTimes(session.id, startTs, endTs, durationMs)
      } catch {
        setSaveError('Could not save that time. Check your connection and try again.')
        return
      }
      setHistory((prev) => [updated, ...prev.filter((s) => s.id !== session.id)].sort((a, b) => b.date - a.date))
    } else {
      setHistory(updateLocalSession(updated))
    }
    setEditingSessionTime(null)
    setSaveError('')
  }

  async function importLocal() {
    if (!user || !importable) return
    try {
      await insertRemoteSessions(user.id, importable)
      clearLocalHistory()
      const remote = await fetchRemoteHistory(user.id)
      setHistory(remote)
      setImportable(null)
    } catch {
      setSaveError('Could not import your local workouts. Please try again.')
    }
  }

  const distUnit = distanceUnit(unit)
  const hasLoggedSets = draftHasWork(draft)
  const liveStats = sessionStats(draft)
  // Counted from the working sets, which is what the header shows — but a draft
  // can hold work and still count zero (warm-ups only), so fall back to a plain
  // phrase rather than promising to save "0 sets".
  const injurySavesLabel =
    liveStats.sets > 0
      ? `Your ${liveStats.sets} logged set${liveStats.sets === 1 ? ' is' : 's are'} saved first`
      : 'What you’ve logged is saved first'
  const resistanceExercises = draft.exercises.filter((e) => e.kind !== 'cardio')
  const cardioExercises = draft.exercises.filter((e) => e.kind === 'cardio')
  // Superset grouping is a resistance-only concept, derived from each exercise's
  // `linkedToPrev` flag over the section in order.
  const resistanceGroups = supersetLabels(resistanceExercises)

  const CHIP_TONE = {
    go: 'text-green-700 bg-green-50 border-green-300',
    in: 'text-text-secondary bg-white border-border',
    below: 'text-text-muted bg-white border-border',
  }

  // One exercise card. Cardio shows duration/distance; resistance shows a
  // laterality toggle, a rep-range target (double progression) with a live
  // status chip, and either flat sets or per-limb (L/R) sets.
  const renderExercise = (ex, exIndex) => {
    const status = repRangeStatus(ex)
    // Working-set numbering: warm-ups show "W", back-offs "B", the rest count 1,2,3…
    let workNo = 0
    const setLabels = ex.sets.map((s) => (s.type === 'warmup' ? 'W' : s.type === 'backoff' ? 'B' : String(++workNo)))
    const typeClass = (s) => (s.type === 'warmup' ? 'text-amber-500 font-semibold' : s.type === 'backoff' ? 'text-sky-500 font-semibold' : 'text-text-muted')
    // The done tick, in whichever of the three row shapes is being drawn. Filled
    // in means done, which is why the mark is already set for you the moment you
    // type — it's there for the sets you DIDN'T type, taken up in one tap from
    // last week, where tapping it is the only thing that tells the rest clock
    // you've finished one. Tapping a set already marked re-marks it now.
    const doneTick = (set, i) => {
      const done = !!set.completedAt
      const filled = setHasWork(set, ex.kind)
      return (
        <button
          type="button"
          onClick={() => markSetDone(ex.id, set.id)}
          disabled={!filled}
          aria-label={done ? `Set ${i + 1} done — mark again to restart rest` : `Mark set ${i + 1} done`}
          title={!filled ? 'Fill the set in first' : done ? 'Done — tap to restart the rest clock' : 'Mark done and start resting'}
          // Taller than it looks. The mark is 14px like the icons beside it, but
          // this is the one you reach for between every set, with a thumb, and
          // the padding is pulled straight back out so the row doesn't grow.
          //
          // No `transition-colors`, deliberately, and the remove X beside it
          // doesn't have one either. A colour transition on a themed token
          // survives the theme toggle: switch to light mid-session and the mark
          // stays on the dark palette's grey while every icon around it changes.
          // Same trap the rest widget's progress bar hit.
          className={`flex justify-center bg-transparent border-none cursor-pointer px-0 py-1.5 -my-1.5 disabled:opacity-30 disabled:cursor-not-allowed ${done ? 'text-text-primary' : 'text-text-light hover:text-text-primary'}`}
        >
          <Check className="w-3.5 h-3.5" />
        </button>
      )
    }
    // "Both" exercises can mix bilateral/unilateral set by set, so each row
    // gets its own toggle; fixed-laterality exercises can't mix, so no toggle.
    const showsSetToggle = ex.kind !== 'cardio' && !ex.bodyweight && (ex.laterality || 'both') === 'both'
    const group = ex.kind === 'cardio' ? null : resistanceGroups.get(ex.id)
    const inSuperset = !!group && group.size > 1
    // Other resistance exercises this one can be supersetted with.
    const supersetTargets = ex.kind === 'cardio' ? [] : resistanceExercises.filter((o) => o.id !== ex.id)
    // Position within its own section's BLOCKS (a superset counts as one block,
    // so moving any member moves the whole group — see moveExercise).
    const kindList = ex.kind === 'cardio' ? cardioExercises : resistanceExercises
    const kindBlocks = exerciseBlocks(kindList)
    const blockIdx = kindBlocks.findIndex((b) => b.some((e) => e.id === ex.id))
    const isFirstBlock = blockIdx <= 0
    const isLastBlock = blockIdx === kindBlocks.length - 1
    // A row the split left open, still waiting for a movement. It carries a
    // slot and no exercise, and until that changes there is nothing to log.
    const unresolvedSlot = !!ex.slot && !ex.exerciseId
    return (
      <motion.div
        key={ex.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        className={`mb-4 border border-border bg-cream ${inSuperset ? 'border-l-2 border-l-text-primary' : ''}`}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex flex-col shrink-0">
              <button
                onClick={() => moveExercise(ex.id, -1)}
                disabled={isFirstBlock}
                aria-label={`Move ${ex.name} up`}
                className="text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer p-0 leading-none disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => moveExercise(ex.id, 1)}
                disabled={isLastBlock}
                aria-label={`Move ${ex.name} down`}
                className="text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer p-0 leading-none disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
            {inSuperset && (
              <span
                title={`Superset ${group.letter}`}
                className="shrink-0 inline-flex items-center justify-center text-[10px] font-semibold text-cream bg-text-primary px-1.5 py-0.5 tracking-wide"
              >
                {group.label}
              </span>
            )}
            {/* Name and injury badge stack, they do NOT sit side by side.
                This row is already nearly full on a phone — reorder arrows, the
                superset chip, and five action icons — so a badge beside the name
                leaves the name a few pixels and `break-words` renders "Smith
                Machine Good Morning" one letter per line. Under it, the name
                always gets the full width and the badge is still right where you
                need it. Costs a line only when an injury is actually open. */}
            <div className="min-w-0">
              <span className="flex items-start gap-1 text-[14px] font-medium text-text-primary break-words">
                {unresolvedSlot && <Route className="w-3.5 h-3.5 shrink-0 mt-0.5 text-text-light" />}
                <span className="break-words">{ex.name}</span>
              </span>
              {injuryRisk.get(ex.exerciseId) && (
                <span className="block mt-1">
                  <InjuryBadge hit={injuryRisk.get(ex.exerciseId)} compact />
                </span>
              )}
            </div>
          </div>
          <div className="relative flex items-center gap-1">
            {ex.kind !== 'cardio' && supersetTargets.length > 0 && (
              <button
                onClick={() => setSupersetMenuFor(supersetMenuFor === ex.id ? null : ex.id)}
                aria-haspopup="true"
                aria-expanded={supersetMenuFor === ex.id}
                aria-label={`Superset options for ${ex.name}`}
                title={inSuperset ? `In superset ${group.letter}` : 'Superset with another exercise'}
                className={`bg-transparent border-none cursor-pointer p-1 transition-colors ${
                  inSuperset ? 'text-text-primary' : 'text-text-light hover:text-text-primary'
                }`}
              >
                <Link2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => toggleNote(ex.id)}
              aria-label={ex.note ? `Edit note for ${ex.name}` : `Add note for ${ex.name}`}
              title="Note"
              className={`bg-transparent border-none cursor-pointer p-1 transition-colors ${ex.note ? 'text-text-primary' : 'text-text-light hover:text-text-primary'}`}
            >
              <StickyNote className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setSubstituteFor(substituteFor === ex.id ? null : ex.id); setPendingSub(null) }}
              aria-label={`Substitute ${ex.name}`}
              aria-pressed={substituteFor === ex.id}
              title="Substitute exercise"
              className={`bg-transparent border-none cursor-pointer p-1 transition-colors ${substituteFor === ex.id ? 'text-text-primary' : 'text-text-light hover:text-text-primary'}`}
            >
              <Repeat className="w-4 h-4" />
            </button>
            <button
              onClick={() => setProgressExercise({ name: ex.name, kind: ex.kind })}
              aria-label={`View ${ex.name} progress`}
              className="text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer p-1"
            >
              <LineChart className="w-4 h-4" />
            </button>
            <button
              onClick={() => removeExercise(ex.id)}
              aria-label={`Remove ${ex.name}`}
              className="text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer p-1"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Superset picker — anchored to the button cluster's right edge so
                it never runs off a narrow screen. */}
            {supersetMenuFor === ex.id && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setSupersetMenuFor(null)} />
                <div className="absolute right-0 top-full z-30 mt-1 w-56 max-w-[calc(100vw-3rem)] bg-white border border-border shadow-lg">
                  <p className="px-3 py-2 text-[10px] uppercase tracking-wider text-text-light border-b border-border">
                    Superset with
                  </p>
                  <div className="max-h-56 overflow-y-auto">
                    {supersetTargets.map((o) => {
                      const og = resistanceGroups.get(o.id)
                      const together = inSuperset && og && og.letter === group.letter
                      return (
                        <button
                          key={o.id}
                          onClick={() => { pairSuperset(ex.id, o.id); setSupersetMenuFor(null) }}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left bg-transparent border-none cursor-pointer hover:bg-cream transition-colors"
                        >
                          <span className="text-[12px] text-text-primary truncate">{o.name}</span>
                          {(og || together) && (
                            <span className="shrink-0 text-[9px] font-semibold text-cream bg-text-primary px-1 py-0.5">
                              {together ? 'paired' : og.label}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  {inSuperset && (
                    <button
                      onClick={() => { removeFromSuperset(ex.id); setSupersetMenuFor(null) }}
                      className="w-full text-left px-3 py-2 text-[12px] text-red-600 bg-transparent border-t border-border cursor-pointer hover:bg-cream transition-colors"
                    >
                      Remove from superset
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* An OPEN slot hasn't decided what it is yet, so there is nothing to
            log against — no laterality, no bodyweight flag, no history to
            prefill from. The card is the question instead: the movement path,
            the sets it wants, and the list that answers it. Sets appear the
            moment you choose (resolveSlot rebuilds the row), which is also what
            unblocks finishing the session. */}
        {unresolvedSlot ? (
          <div className="px-4 py-3">
            <p className="text-[12px] text-text-light mb-2">
              {ex.slot.sets} set{ex.slot.sets === 1 ? '' : 's'}
              {ex.repRange ? ` · ${ex.repRange.low}–${ex.repRange.high} reps` : ''}
              {ex.slot.muscle ? ` · for ${ex.slot.muscle.toLowerCase()}` : ''}
            </p>
            <PatternPicker
              planned={ex.slot ? { ...ex, slot: ex.slot } : ex}
              program={program}
              dayId={planDayForDraft?.id}
              sessions={history}
              initialLimit={4}
              onPick={(o) => resolveSlot(ex.id, o.name, o.category, o.id)}
            />
          </div>
        ) : (
        <div className="px-4 py-3">
          {(noteOpenFor.has(ex.id) || !!ex.note) && (
            <textarea
              value={ex.note || ''}
              onChange={(e) => setExerciseNote(ex.id, e.target.value)}
              onBlur={syncNotesToRemote}
              placeholder="Note — form cue, machine setting, anything worth remembering…"
              aria-label={`Note for ${ex.name}`}
              rows={2}
              className="w-full mb-3 bg-white border border-border px-2.5 py-2 text-text-primary text-[12px] outline-none focus:border-text-primary transition-colors resize-none"
            />
          )}
          {substituteFor === ex.id && (
            <div className="mb-3">
              {pendingSub?.exId === ex.id ? (
                <div className="p-2.5 border border-border bg-white text-[12px] text-text-primary">
                  <p className="mb-2">
                    Replace <span className="font-medium">{ex.name}</span> with <span className="font-medium">{pendingSub.name}</span>?
                  </p>
                  {/* Keeping the swap is the common case — a busy rack, a sore
                      joint — so it leads. "Just this session" is also an answer
                      we remember: declining here means the end-of-session sync
                      won't ask about this slot again. */}
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => confirmSubstitute(true)}
                      className="text-[11px] font-medium text-cream bg-text-primary px-2.5 py-1.5 border-none cursor-pointer hover:bg-accent-hover transition-colors"
                    >
                      {/* Names the day: when the split day was inferred rather
                          than recorded, a wrong guess has to be visible here. */}
                      Save to {pendingSub.dayName || 'split'}
                    </button>
                    <button
                      onClick={() => confirmSubstitute(false)}
                      className="text-[11px] font-medium text-text-primary bg-white border border-border hover:border-border-hover px-2.5 py-1.5 cursor-pointer transition-colors"
                    >
                      Just this session
                    </button>
                    <button
                      onClick={() => setPendingSub(null)}
                      className="text-[11px] text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer px-2.5 py-1.5"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : ex.kind !== 'cardio' && ex.slot?.pattern ? (
                /* The machine is taken. The list that answers that is every
                   other movement down the same path, ranked in this day's real
                   context — one tap, without leaving the set you're mid-way
                   through. Picking still routes through pickSubstitute, so the
                   "save this to the split too?" prompt is unchanged. */
                <PatternPicker
                  planned={ex}
                  program={program}
                  dayId={planDayForDraft?.id}
                  sessions={history}
                  initialLimit={5}
                  onPick={(o) => pickSubstitute(ex.id, o.name, o.category, o.id)}
                />
              ) : (
                <ExercisePicker
                  onSelect={(name, category, id) => pickSubstitute(ex.id, name, category, id)}
                  onlyCategory={ex.kind === 'cardio' ? 'Cardio' : undefined}
                  excludeCategory={ex.kind === 'cardio' ? undefined : 'Cardio'}
                  placeholder="Replace with…"
                />
              )}
            </div>
          )}
          {ex.kind === 'cardio' ? (
            <>
              <div className={`${CARDIO_SET_GRID} mb-2 text-[10px] uppercase tracking-wider text-text-light`}>
                <span className="text-center">#</span>
                <span>Min</span>
                <span>{distUnit}</span>
                <span />
                <span />
              </div>
              {ex.sets.map((set, i) => (
                <div key={set.id} className={`${CARDIO_SET_GRID} mb-2`}>
                  <span className="text-center text-[13px] text-text-muted">{i + 1}</span>
                  <NumberField
                    value={set.duration ?? ''}
                    onValueChange={(v) => updateSet(ex.id, set.id, 'duration', v)}
                    {...hintKeyProps(ex.id, set.id)}
                    placeholder={hintFor(set, 'duration')} aria-label={`Entry ${i + 1} duration in minutes`}
                    className="w-full min-w-0 bg-white border border-border px-2 py-2 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors"
                  />
                  <NumberField
                    value={set.distance ?? ''}
                    onValueChange={(v) => updateSet(ex.id, set.id, 'distance', v)}
                    {...hintKeyProps(ex.id, set.id)}
                    placeholder={hintFor(set, 'distance')} aria-label={`Entry ${i + 1} distance in ${distUnit}`}
                    className="w-full min-w-0 bg-white border border-border px-2 py-2 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors"
                  />
                  {doneTick(set, i)}
                  <button
                    onClick={() => removeSet(ex.id, set.id)} aria-label={`Remove entry ${i + 1}`} disabled={ex.sets.length === 1}
                    className="flex justify-center text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => addSet(ex.id)}
                className="inline-flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text-primary bg-transparent border-none cursor-pointer mt-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add interval
              </button>
            </>
          ) : (
            <>
              {/* laterality control + double-progression rep target */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                {(ex.laterality || 'both') === 'both' ? (
                  <button
                    type="button"
                    onClick={() => toggleUnilateral(ex.id)}
                    aria-pressed={!!ex.unilateral}
                    title={ex.unilateral ? 'Logging each limb separately' : 'Log both limbs together'}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium border cursor-pointer transition-colors ${
                      ex.unilateral ? 'bg-text-primary text-cream border-text-primary' : 'bg-white text-text-muted border-border hover:border-border-hover'
                    }`}
                  >
                    <ArrowLeftRight className="w-3 h-3" /> {ex.unilateral ? 'Unilateral' : 'Bilateral'}
                  </button>
                ) : ex.laterality === 'unilateral' ? (
                  <span
                    title="This movement is trained one limb at a time"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium border border-border bg-white text-text-muted"
                  >
                    <ArrowLeftRight className="w-3 h-3" /> Unilateral
                  </span>
                ) : (
                  <span />
                )}
                {ex.repRange ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-text-light">Target</span>
                    <NumberField
                      decimal={false}
                      value={ex.repRange?.low ?? ''}
                      onValueChange={(v) => setRepRange(ex.id, 'low', v)}
                      aria-label="Target rep range low"
                      className="w-11 bg-white border border-border px-1.5 py-1 text-center text-text-primary text-[12px] outline-none focus:border-text-primary transition-colors"
                    />
                    <span className="text-text-light text-[12px]">–</span>
                    <NumberField
                      decimal={false}
                      value={ex.repRange?.high ?? ''}
                      onValueChange={(v) => setRepRange(ex.id, 'high', v)}
                      aria-label="Target rep range high"
                      className="w-11 bg-white border border-border px-1.5 py-1 text-center text-text-primary text-[12px] outline-none focus:border-text-primary transition-colors"
                    />
                    <span className="text-[11px] text-text-light">reps</span>
                    <button
                      type="button"
                      onClick={() => setRepTarget(ex.id, null)}
                      aria-label="Remove rep target"
                      className="text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer p-0.5 ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setRepTarget(ex.id, { low: 6, high: 10 })}
                    className="inline-flex items-center gap-1 text-[11px] text-text-muted hover:text-text-primary bg-white border border-border hover:border-border-hover px-2 py-1 cursor-pointer transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Rep target
                  </button>
                )}
              </div>

              {status && (
                <p className={`inline-flex items-center text-[11px] font-medium border px-2 py-1 mb-3 ${CHIP_TONE[status.tone]}`}>
                  {status.label}
                </p>
              )}

              {exIndex === 0 && (
                <p className="text-[11px] text-text-light mb-3">
                  Tip: tap a set's number to mark it a warm-up (<span className="text-amber-500 font-semibold">W</span>, excluded from volume) or back-off (<span className="text-sky-500 font-semibold">B</span>).
                </p>
              )}

              {exIndex === 1 && !inSuperset && (
                <p className="text-[11px] text-text-light mb-3 inline-flex items-center gap-1">
                  Tip: use <Link2 className="w-3 h-3 inline" /> to superset this with any other exercise.
                </p>
              )}

              {ex.bodyweight ? (
                <>
                  <div className="flex items-center gap-1.5 mb-3">
                    <span className="text-[10px] uppercase tracking-wider text-text-light">Bodyweight</span>
                    <NumberField
                      value={draft.bodyweight ?? ''}
                      onValueChange={setSessionBodyweight}
                      placeholder="—"
                      aria-label="Session bodyweight"
                      className="w-16 bg-white border border-border px-2 py-1 text-center text-text-primary text-[12px] outline-none focus:border-text-primary transition-colors"
                    />
                    <span className="text-[11px] text-text-light">{unit} · counted as load</span>
                  </div>
                  <div className={`${SET_GRID} mb-2 text-[10px] uppercase tracking-wider text-text-light`}>
                    <span className="text-center">#</span>
                    <span>+{unit}</span>
                    <span>Reps</span>
                    <span className="flex items-center gap-1">RIR
                      <button type="button" onClick={() => setShowRirHelp(true)} aria-label="What is RIR?" className="text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer p-0 leading-none">
                        <HelpCircle className="w-3 h-3" />
                      </button>
                    </span>
                    <span />
                    <span />
                  </div>
                  {ex.sets.map((set, i) => (
                    <div key={set.id} className={`${SET_GRID} mb-2`}>
                      <button
                        type="button"
                        onClick={() => cycleSetType(ex.id, set.id)}
                        title="Tap: working → warm-up (W) → back-off (B)"
                        className={`text-center text-[13px] bg-transparent border-none cursor-pointer p-0 ${typeClass(set)}`}
                      >
                        {setLabels[i]}
                      </button>
                      <NumberField
                        negative
                        value={set.added ?? ''}
                        onValueChange={(v) => updateAdded(ex.id, set.id, v)}
                        {...hintKeyProps(ex.id, set.id)}
                        placeholder={hintFor(set, 'added', null, '0')}
                        aria-label={`Set ${i + 1} added weight in ${unit}`}
                        className="w-full min-w-0 bg-white border border-border px-2 py-2 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors"
                      />
                      <NumberField
                        decimal={false}
                        value={set.reps}
                        onValueChange={(v) => updateSet(ex.id, set.id, 'reps', v)}
                        {...hintKeyProps(ex.id, set.id)}
                        placeholder={hintFor(set, 'reps')}
                        aria-label={`Set ${i + 1} reps`}
                        className="w-full min-w-0 bg-white border border-border px-2 py-2 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors"
                      />
                      {set.type === 'warmup' ? (
                        <span className="text-center text-text-light text-[13px]" aria-hidden="true">—</span>
                      ) : (
                        <NumberField
                          decimal={false}
                          value={set.rir ?? ''}
                          onValueChange={(v) => updateSet(ex.id, set.id, 'rir', v)}
                          {...hintKeyProps(ex.id, set.id)}
                          placeholder={hintFor(set, 'rir')}
                          aria-label={`Set ${i + 1} reps in reserve`}
                          className="w-full min-w-0 bg-white border border-border px-2 py-2 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors"
                        />
                      )}
                      {doneTick(set, i)}
                      <button
                        onClick={() => removeSet(ex.id, set.id)} aria-label={`Remove set ${i + 1}`} disabled={ex.sets.length === 1}
                        className="flex justify-center text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <p className="text-[11px] text-text-light mt-1 mb-2">Load = bodyweight + added (use a negative number for assisted reps). Warm-up sets skip RIR.</p>
                  <button
                    onClick={() => addSet(ex.id)}
                    className="inline-flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text-primary bg-transparent border-none cursor-pointer mt-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add set
                  </button>
                </>
              ) : (
                <>
                  <div className={`${showsSetToggle ? SET_GRID_TOGGLE : SET_GRID} mb-2 text-[10px] uppercase tracking-wider text-text-light`}>
                    <span className="text-center">#</span>
                    <span>{unit}</span>
                    <span>Reps</span>
                    <span className="flex items-center gap-1">RIR
                      <button type="button" onClick={() => setShowRirHelp(true)} aria-label="What is RIR?" className="text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer p-0 leading-none">
                        <HelpCircle className="w-3 h-3" />
                      </button>
                    </span>
                    <span />
                    <span />
                    {showsSetToggle && <span />}
                  </div>
                  {/* Each set renders by its OWN shape (set.left), not the
                      exercise-wide flag — a "both" exercise can mix bilateral
                      and unilateral sets in the same list. */}
                  {ex.sets.map((set, i) =>
                    set.left ? (
                      <div key={set.id} className="mb-2.5 pb-2.5 border-b border-border-soft last:border-0 last:pb-0 last:mb-1">
                        <div className="flex items-center justify-between mb-1">
                          <button
                            type="button"
                            onClick={() => cycleSetType(ex.id, set.id)}
                            title="Tap: working → warm-up (W) → back-off (B)"
                            className={`text-[11px] bg-transparent border-none cursor-pointer p-0 ${typeClass(set)}`}
                          >
                            {set.type === 'warmup' ? 'Warm-up' : set.type === 'backoff' ? 'Back-off' : `Set ${setLabels[i]}`}
                          </button>
                          <div className="flex items-center gap-1">
                            {doneTick(set, i)}
                            {showsSetToggle && (
                              <button
                                type="button"
                                onClick={() => toggleSetUnilateral(ex.id, set.id)}
                                aria-label={`Log set ${i + 1} with both limbs together`}
                                title="Combine into one bilateral set"
                                className="text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer"
                              >
                                <Merge className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => swapLimbs(ex.id, set.id)}
                              aria-label={`Swap left and right for set ${i + 1}`}
                              title="Swap left / right"
                              className="text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer"
                            >
                              <ArrowLeftRight className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => removeSet(ex.id, set.id)} aria-label={`Remove set ${i + 1}`} disabled={ex.sets.length === 1}
                              className="text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        {['left', 'right'].map((side) => (
                          <div key={side} className="grid grid-cols-[20px_1fr_1fr_44px] gap-2 items-center mb-1.5 last:mb-0">
                            <span className="text-[11px] font-medium uppercase text-text-light">{side === 'left' ? 'L' : 'R'}</span>
                            <NumberField
                              value={set[side]?.weight ?? ''}
                              onValueChange={(v) => updateLimbSet(ex.id, set.id, side, 'weight', v)}
                              {...hintKeyProps(ex.id, set.id, side)}
                              placeholder={hintFor(set, 'weight', side)} aria-label={`Set ${i + 1} ${side} weight`}
                              className="w-full min-w-0 bg-white border border-border px-2 py-2 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors"
                            />
                            <NumberField
                              decimal={false}
                              value={set[side]?.reps ?? ''}
                              onValueChange={(v) => updateLimbSet(ex.id, set.id, side, 'reps', v)}
                              {...hintKeyProps(ex.id, set.id, side)}
                              placeholder={hintFor(set, 'reps', side)} aria-label={`Set ${i + 1} ${side} reps`}
                              className="w-full min-w-0 bg-white border border-border px-2 py-2 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors"
                            />
                            {set.type === 'warmup' ? (
                              <span className="text-center text-text-light text-[13px]" aria-hidden="true">—</span>
                            ) : (
                              <NumberField
                                decimal={false}
                                value={set[side]?.rir ?? ''}
                                onValueChange={(v) => updateLimbSet(ex.id, set.id, side, 'rir', v)}
                                {...hintKeyProps(ex.id, set.id, side)}
                                placeholder={hintFor(set, 'rir', side)} aria-label={`Set ${i + 1} ${side} reps in reserve`}
                                className="w-full min-w-0 bg-white border border-border px-2 py-2 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div key={set.id} className={`${showsSetToggle ? SET_GRID_TOGGLE : SET_GRID} mb-2`}>
                        <button
                          type="button"
                          onClick={() => cycleSetType(ex.id, set.id)}
                          title="Tap: working → warm-up (W) → back-off (B)"
                          className={`text-center text-[13px] bg-transparent border-none cursor-pointer p-0 ${typeClass(set)}`}
                        >
                          {setLabels[i]}
                        </button>
                        <NumberField
                          value={set.weight}
                          onValueChange={(v) => updateSet(ex.id, set.id, 'weight', v)}
                          {...hintKeyProps(ex.id, set.id)}
                          placeholder={hintFor(set, 'weight')} aria-label={`Set ${i + 1} weight in ${unit}`}
                          className="w-full min-w-0 bg-white border border-border px-2 py-2 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors"
                        />
                        <NumberField
                          decimal={false}
                          value={set.reps}
                          onValueChange={(v) => updateSet(ex.id, set.id, 'reps', v)}
                          {...hintKeyProps(ex.id, set.id)}
                          placeholder={hintFor(set, 'reps')} aria-label={`Set ${i + 1} reps`}
                          className="w-full min-w-0 bg-white border border-border px-2 py-2 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors"
                        />
                        {set.type === 'warmup' ? (
                          <span className="text-center text-text-light text-[13px]" aria-hidden="true">—</span>
                        ) : (
                          <NumberField
                            decimal={false}
                            value={set.rir ?? ''}
                            onValueChange={(v) => updateSet(ex.id, set.id, 'rir', v)}
                            {...hintKeyProps(ex.id, set.id)}
                            placeholder={hintFor(set, 'rir')} aria-label={`Set ${i + 1} reps in reserve`}
                            className="w-full min-w-0 bg-white border border-border px-2 py-2 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors"
                          />
                        )}
                        {doneTick(set, i)}
                        <button
                          onClick={() => removeSet(ex.id, set.id)} aria-label={`Remove set ${i + 1}`} disabled={ex.sets.length === 1}
                          className="flex justify-center text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        {showsSetToggle && (
                          <button
                            type="button"
                            onClick={() => toggleSetUnilateral(ex.id, set.id)}
                            aria-label={`Log set ${i + 1} left and right separately`}
                            title="Split into left / right"
                            className="flex justify-center text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer"
                          >
                            <Split className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )
                  )}
                  <button
                    onClick={() => addSet(ex.id)}
                    className="inline-flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text-primary bg-transparent border-none cursor-pointer mt-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add set
                  </button>
                </>
              )}
            </>
          )}

          {/* Last time's numbers are showing as grey suggestions, not entries —
              this takes them all up at once, for the sessions where nothing
              changed. Only blanks are filled, so it can't overwrite you. */}
          {hasUntakenHint(ex) && (
            <button
              type="button"
              onClick={() => fillFromHint(ex.id)}
              className="inline-flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text-primary bg-transparent border-none cursor-pointer mt-1 transition-colors"
            >
              <Repeat className="w-3.5 h-3.5" /> Same as last time
            </button>
          )}
        </div>
        )}
      </motion.div>
    )
  }

  return (
    <div className="pt-28 pb-24 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">
        <LogTabs active="/log" />

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-heading text-4xl font-medium text-text-primary mb-3">Workout log</h1>
          <p className="text-text-muted text-[15px] mb-10">
            {user
              ? 'Track what you trained, set by set — saved to your account and synced across your devices.'
              : 'Track what you trained, set by set. Everything saves automatically in your browser — no account needed.'}
          </p>

          {/* Today's planned session (from the active program) */}
          {showTodayCard && (
            <div className="bg-text-primary text-cream p-6 md:p-7 mb-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2 min-w-0">
                  <CalendarDays className="w-4 h-4 text-cream-70 shrink-0" />
                  <p className="text-[11px] uppercase tracking-wider text-cream-60">Today’s session</p>
                </div>
                <Link to={`/split/${program.id}`} className="text-[11px] text-cream-70 underline hover:text-cream no-underline shrink-0">Edit split</Link>
              </div>

              {/* `done` must win over the rest branch: for a rotating program
                  that advanced today, plan.day is TOMORROW's day and may well
                  be a rest slot — today is still "done", not "rest". */}
              {doneToday ? (
                <div>
                  <p className="font-heading text-xl font-medium flex items-center gap-2">
                    <Check className="w-5 h-5" /> {isWeeklyProgram ? `${todayDay.name} — logged` : 'Done for today'}
                  </p>
                  <p className="text-[12px] text-cream-60 mt-0.5">
                    {isWeeklyProgram ? 'Done for today.' : 'Nice work.'}{nextUp ? ` Next up: ${nextUp.day.name} ${nextDayLabel(nextUp.date)}.` : ''}
                  </p>
                </div>
              ) : todayDay.kind === 'rest' ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-heading text-xl font-medium">Rest day</p>
                    <p className="text-[12px] text-cream-60 mt-0.5">
                      {isWeeklyProgram
                        ? `Enjoy your day off — relax and recover.${nextUp ? ` Back at it ${nextDayLabel(nextUp.date)} with ${nextUp.day.name}.` : ''}`
                        : 'Recovery in your rotation — it passes on its own tomorrow. Log freely below, or mark it done to move on now.'}
                    </p>
                  </div>
                  {!isWeeklyProgram && (
                    <button
                      onClick={() => markRestDone(todayDay)}
                      className="shrink-0 inline-flex items-center justify-center gap-2 bg-cream text-text-primary font-medium px-5 py-2.5 border-none cursor-pointer text-[13px] hover:bg-white transition-colors"
                    >
                      Mark rest done
                    </button>
                  )}
                </div>
              ) : skipTodayCard ? (
                <div>
                  <p className="font-heading text-xl font-medium">{todayDay.name} — marked off</p>
                  <p className="text-[12px] text-cream-60 mt-0.5">
                    You marked today as {reasonLabel(todayAnnotation.reason).toLowerCase()}
                    {todayAnnotation.note ? ` — "${todayAnnotation.note}"` : ''}.{' '}
                    {offTodayConsumes
                      ? `Nothing's owed — your split doesn't wait for this day.${nextUp ? ` Next up: ${nextUp.day.name} ${nextDayLabel(nextUp.date)}.` : ''} Log it anyway if you're up for it.`
                      : 'No pressure — log it anyway if you’re up for it, or skip ahead.'}
                  </p>
                  <div className="flex items-center gap-3 flex-wrap mt-4">
                    <button
                      onClick={() => startPlannedSession(todayDay)}
                      className="inline-flex items-center justify-center gap-2 bg-cream text-text-primary font-medium px-5 py-2.5 border-none cursor-pointer text-[14px] hover:bg-white transition-colors"
                    >
                      <Check className="w-4 h-4" /> Log anyway
                    </button>
                    {!isWeeklyProgram && !offTodayConsumes && (
                      <button
                        onClick={() => markRestDone(todayDay)}
                        className="shrink-0 inline-flex items-center justify-center gap-2 bg-transparent text-cream border border-cream-30 font-medium px-5 py-2.5 cursor-pointer text-[13px] hover:border-cream-60 transition-colors"
                      >
                        Skip — move to next
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <p className="font-heading text-2xl font-medium mb-1 break-words">{todayDay.name}</p>
                  {todayDay.exercises.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mt-3 mb-5">
                      {todayDay.exercises.map((ex) => (
                        <span key={ex.id} className="text-[12px] text-cream-90 bg-cream-10 border border-cream-20 px-2.5 py-1">
                          {ex.name} <span className="text-cream-50">· {ex.sets}×</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12px] text-cream-60 mt-1 mb-5">No exercises planned yet — add some in the routine builder.</p>
                  )}
                  {recoveringToday.length > 0 && (
                    /* This card inverts with the theme (near-black in light,
                       near-white in dark), so the amber flips too. */
                    <p className="text-[12px] text-amber-300 dark:text-amber-700 -mt-3 mb-5">
                      Still recovering: {recoveringToday.map((m) => `${m.muscle} ${m.recoveryPct}%`).join(' · ')}
                    </p>
                  )}
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={() => startPlannedSession(todayDay)}
                      className="inline-flex items-center justify-center gap-2 bg-cream text-text-primary font-medium px-5 py-2.5 border-none cursor-pointer text-[14px] hover:bg-white transition-colors"
                    >
                      <Check className="w-4 h-4" /> Start session
                    </button>
                    {/* An injury you're not even starting the session for. Here
                        rather than only on /calendar because this is the screen
                        you're on when you find out. */}
                    <button
                      type="button"
                      onClick={() => openInjuryPrompt('day', today)}
                      className="inline-flex items-center justify-center gap-2 bg-transparent text-cream border border-cream-30 font-medium px-5 py-2.5 cursor-pointer text-[13px] hover:border-cream-60 transition-colors"
                    >
                      <Bandage className="w-4 h-4" /> Injured today
                    </button>
                    {willStashDraft(draft, staleDraft) && (
                      <span className="text-[11px] text-cream-60">Your current entries will be set aside and restored after.</span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Current session */}
          {/* Padding steps down on a narrow phone. A set row is seven columns
              wide once the done tick is in it, and at 320px this panel's inset
              plus the page's plus the exercise card's left 181px for all of
              them — weight and reps came out 17px each, too narrow to read the
              number you'd just typed. The chrome yields before the numbers do. */}
          <div className="bg-white border border-border p-4 sm:p-7 md:p-9">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-text-light mb-1">
                  {/* Short words only — the sets counter and unit toggle leave
                      this label ~60px at 320px, so it has to be able to wrap. */}
                  {isEditing ? 'Editing session' : staleDraft ? "Not today's" : isToday ? "Today's session" : 'Past session'}
                </p>
                {editingDate ? (
                  <input
                    type="date"
                    autoFocus
                    value={toInputDate(draftDate)}
                    max={toInputDate(Date.now())}
                    onChange={(e) => changeDate(e.target.value)}
                    onBlur={() => setEditingDate(false)}
                    className="bg-cream border border-border px-2 py-1 text-text-primary text-[15px] font-heading font-medium outline-none focus:border-text-primary transition-colors"
                  />
                ) : (
                  <button
                    onClick={() => setEditingDate(true)}
                    className="group flex items-center gap-1.5 bg-transparent border-none cursor-pointer p-0"
                  >
                    <span className="font-heading text-lg font-medium text-text-primary">{formatDate(draftDate)}</span>
                    <Calendar className="w-3.5 h-3.5 text-text-light group-hover:text-text-primary transition-colors" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-4">
                {hasLoggedSets && (
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-wider text-text-light mb-1">Sets</p>
                    <p className="font-heading text-lg font-medium text-text-primary">{liveStats.sets}</p>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <div className="flex border border-border">
                    {[['kg', 'Metric'], ['lbs', 'Imperial']].map(([u, label]) => (
                      <button
                        key={u}
                        onClick={() => changeUnit(u)}
                        className={`px-3 py-1.5 text-[12px] font-medium cursor-pointer transition-colors ${
                          unit === u ? 'bg-text-primary text-cream' : 'bg-white text-text-muted hover:text-text-primary'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <UnitHelp align="right" />
                </div>
              </div>
            </div>

            {/* Logging has never needed a split — but nothing said so, and an
                empty log screen under a "Training split" tab reads like a step
                was skipped. Only while there's genuinely nothing to say
                otherwise: no split, and an empty session. */}
            {!program && !draft.exercises.length && !isEditing && (
              <p className="text-[12px] text-text-light leading-relaxed mb-6">
                No split needed — add exercises as you go. After a week or so of logging you can turn them into one.
              </p>
            )}

            {/* You asked the calendar to open a different day while this one
                was underway. Nothing was touched — here's why. */}
            {blockedStart && (
              <div className="w-full flex items-center gap-2 bg-cream border border-border py-2 px-3 mb-6">
                <Calendar className="w-3.5 h-3.5 text-text-light shrink-0" />
                <span className="text-[12px] text-text-secondary min-w-0">
                  <span className="text-text-primary">{blockedStart}</span> wasn’t opened — this session already has
                  sets in it. Finish or discard it first.
                </span>
              </div>
            )}

            {/* Left over from an earlier sitting — an edit never closed, or a
                planned session never finished. Say so, or it reads as today's
                workout; today's own card is shown above it either way. */}
            {staleDraft && (
              <div className="w-full flex items-center gap-2 bg-cream border border-border py-2 px-3 mb-6">
                <Calendar className="w-3.5 h-3.5 text-text-light shrink-0" />
                <span className="text-[12px] text-text-secondary min-w-0">
                  {isEditing ? (
                    <>
                      Still editing your session from <span className="text-text-primary">{formatDate(draftDate)}</span>.
                      Save or cancel it to get back to today's.
                    </>
                  ) : (
                    <>
                      Unfinished <span className="text-text-primary">{draft.name || 'session'}</span>
                      {isToday ? ' — not the day your split has up now' : ` from ${formatDate(draftDate)}`}. Finish it,
                      or discard it to start today's session.
                    </>
                  )}
                </span>
              </div>
            )}

            {/* Set aside from the dashboard to start a fresh one — offered back
                here, because a "you can bring it back" promise made on another
                screen has to be keepable on this one. Only while this session
                is still empty: restoring can then never cost anything. */}
            {setAsideSummary && !isEditing && !draft.exercises.length && (
              <div className="w-full flex items-center gap-2 bg-cream border border-border py-2 px-3 mb-6">
                <History className="w-3.5 h-3.5 text-text-light shrink-0" />
                <span className="text-[12px] text-text-secondary min-w-0">
                  <span className="text-text-primary">{setAsideSummary.name || 'A session'}</span> was set aside —{' '}
                  {setAsideSummary.exerciseCount} exercise{setAsideSummary.exerciseCount !== 1 ? 's' : ''}
                  {setAsideSummary.setCount ? `, ${setAsideSummary.setCount} set${setAsideSummary.setCount !== 1 ? 's' : ''}` : ''}
                </span>
                <button
                  type="button"
                  onClick={restoreSetAside}
                  className="ml-auto text-[11px] font-medium uppercase tracking-wider text-text-primary bg-transparent border-none cursor-pointer shrink-0"
                >
                  Restore
                </button>
                <button
                  type="button"
                  onClick={dropSetAside}
                  aria-label="Discard the session that was set aside"
                  className="text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer p-0 shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* This session has drifted from the split day it came from. Quiet
                until there's something to say, and never automatic — tapping
                opens a review where each difference is accepted or skipped. */}
            {/* The split was just updated on finish. Said plainly and made
                reversible: a write the user can't see and can't take back isn't
                a feature. Sits in the same slot as the drift prompt below —
                the draft is empty by now, so they can never both show. */}
            {splitSyncDone && (
              <div className="w-full flex items-center gap-2 bg-cream border border-border py-2 px-3 mb-6">
                <Check className="w-3.5 h-3.5 text-text-light shrink-0" />
                <span className="text-[12px] text-text-secondary min-w-0">
                  <span className="text-text-primary">{splitSyncDone.dayName}</span> updated —{' '}
                  {splitSyncDone.count} {splitSyncDone.count === 1 ? 'change' : 'changes'}
                </span>
                <button
                  type="button"
                  onClick={undoSplitSync}
                  className="ml-auto text-[11px] font-medium uppercase tracking-wider text-text-primary bg-transparent border-none cursor-pointer shrink-0"
                >
                  Undo
                </button>
                <button
                  type="button"
                  onClick={() => setSplitSyncDone(null)}
                  aria-label="Dismiss"
                  className="text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer p-0 shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {splitChanges.length > 0 && (
              <button
                type="button"
                onClick={() => setSplitSyncOpen(true)}
                className="w-full flex items-center gap-2 bg-cream border border-border py-2 px-3 mb-6 cursor-pointer hover:border-border-hover transition-colors text-left"
              >
                <Link2 className="w-3.5 h-3.5 text-text-light shrink-0" />
                <span className="text-[12px] text-text-secondary min-w-0">
                  {splitChanges.length} {splitChanges.length === 1 ? 'change' : 'changes'} not in{' '}
                  <span className="text-text-primary">{planDayForDraft.name}</span>
                </span>
                <span className="ml-auto text-[11px] font-medium uppercase tracking-wider text-text-primary shrink-0">
                  Update split
                </span>
              </button>
            )}

            {/* The rest clock used to live here, above the session name, where
                it scrolled out of sight after the first exercise. It's a
                corner bubble now — see <RestTimer /> at the end of the page. */}

            <div className="mb-6">
              <SessionNamePicker
                value={draft.name || ''}
                onChange={(name) => setDraft((d) => ({ ...d, name }))}
              />
            </div>

            {/* Resistance training */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Dumbbell className="w-4 h-4 text-text-primary" />
                <h3 className="text-[12px] font-medium uppercase tracking-wider text-text-secondary">Resistance training</h3>
              </div>
              <AnimatePresence initial={false}>
                {resistanceExercises.map(renderExercise)}
              </AnimatePresence>
              <ExercisePicker
                onSelect={(name, _cat, id) => addExercise(name, 'strength', id)}
                recentNames={recentByKind.resistance}
                excludeCategory="Cardio"
                placeholder="Search for a resistance exercise…"
              />
            </div>

            {/* Cardio */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-text-primary" />
                <h3 className="text-[12px] font-medium uppercase tracking-wider text-text-secondary">Cardio</h3>
              </div>
              <AnimatePresence initial={false}>
                {cardioExercises.map(renderExercise)}
              </AnimatePresence>
              <ExercisePicker
                onSelect={(name, _cat, id) => addExercise(name, 'cardio', id)}
                recentNames={recentByKind.cardio}
                onlyCategory="Cardio"
                placeholder="Search for a cardio exercise…"
              />
            </div>

            {draft.exercises.length > 0 && (
              <div className="mt-6 pt-6 border-t border-border">
                {saveError && <p className="text-[13px] text-red-600 mb-3">{saveError}</p>}
                <div className="flex gap-3">
                  <button
                    onClick={finish}
                    disabled={!hasLoggedSets || saving}
                    className="flex-1 inline-flex items-center justify-center gap-2 bg-text-primary text-cream font-medium py-3.5 border-none cursor-pointer text-[14px] hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Check className="w-4 h-4" /> {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Finish session'}
                  </button>
                  <button
                    onClick={discard}
                    className="px-5 text-text-muted hover:text-text-primary bg-white border border-border hover:border-border-hover cursor-pointer text-[13px] transition-colors"
                  >
                    {isEditing ? 'Cancel' : 'Discard'}
                  </button>
                </div>
                {/* Something went wrong mid-session. Its own row rather than a
                    third button up there: at 320px three side by side leaves
                    each of them unreadable. Never while editing a past session
                    — there's no session in progress to end. */}
                {!isEditing && (
                  <button
                    type="button"
                    onClick={() => openInjuryPrompt('session', draftDate)}
                    disabled={saving}
                    className="mt-3 w-full inline-flex items-center justify-center gap-2 py-2.5 text-text-muted hover:text-text-primary bg-white border border-border hover:border-border-hover cursor-pointer text-[12px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Bandage className="w-3.5 h-3.5" /> Injured — end session
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Import local workouts into the account */}
          {importable && importable.length > 0 && (
            <div className="mt-8 bg-white border border-border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-[13px] text-text-secondary">
                You have {importable.length} workout{importable.length !== 1 ? 's' : ''} saved on this device.
                Add {importable.length !== 1 ? 'them' : 'it'} to your account?
              </p>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={importLocal}
                  className="bg-text-primary text-cream text-[12px] font-medium px-4 py-2 border-none cursor-pointer hover:bg-accent-hover transition-colors"
                >
                  Import
                </button>
                <button
                  onClick={() => setImportable(null)}
                  className="text-text-muted text-[12px] px-4 py-2 bg-white border border-border cursor-pointer hover:border-border-hover transition-colors"
                >
                  Not now
                </button>
              </div>
            </div>
          )}

          {user && loadingHistory && (
            <p className="mt-14 text-[13px] text-text-muted">Loading your workouts…</p>
          )}
          {loadError && !loadingHistory && (
            <p className="mt-14 text-[13px] text-red-600">{loadError}</p>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className="mt-14">
              <h2 className="font-heading text-xl font-medium text-text-primary mb-6">History</h2>

              {saveError && draft.exercises.length === 0 && (
                <p className="text-[13px] text-red-600 mb-4">{saveError}</p>
              )}

              {/* Browse past days — tap a day to see and edit that day's workouts. */}
              <div className="bg-white border border-border p-5 sm:p-6 mb-6">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-text-primary" />
                    <h3 className="text-[12px] font-medium uppercase tracking-wider text-text-secondary">Calendar</h3>
                  </div>
                  <Link to="/calendar" className="text-[12px] text-text-muted hover:text-text-primary no-underline transition-colors">
                    Full calendar
                  </Link>
                </div>
                <WorkoutCalendar
                  sessions={sortedHistory}
                  program={program}
                  annotations={annotations}
                  selectedDate={selectedCalDay}
                  onSelectDay={selectCalendarDay}
                />

                {selectedCalDay && (
                  <div className="mt-5 pt-5 border-t border-border">
                    <p className="text-[13px] font-medium text-text-primary mb-3">{formatDate(selectedCalDay)}</p>
                    {daySessions.length === 0 ? (
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <p className="text-[12px] text-text-muted">No workout logged this day.</p>
                        {!isFutureDay(selectedCalDay) && (
                          <button
                            onClick={() => startWorkoutOnDay(selectedCalDay)}
                            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-cream bg-text-primary px-3 py-1.5 border-none cursor-pointer hover:bg-accent-hover transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" /> Log a workout on this day
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {/* Same shape as the calendar page's day panel: what the
                            workout was, and one way into the card. Edit and
                            delete live on the card. */}
                        {daySessions.map((s) => {
                          const st = sessionStats(s)
                          const dur = formatDuration(s.durationMs)
                          return (
                            <button
                              key={s.id}
                              onClick={() => setOpenSession(s.id)}
                              aria-label={`Open the summary for ${s.name || 'this workout'}`}
                              className="w-full text-left bg-cream border border-border p-3 cursor-pointer hover:border-border-hover transition-colors"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-[13px] font-medium text-text-primary break-words">{s.name || 'Workout'}</p>
                                  <p className="text-[11px] text-text-muted mt-0.5">
                                    {st.exercises} exercise{st.exercises !== 1 ? 's' : ''} · {st.sets} set{st.sets !== 1 ? 's' : ''}
                                    {st.volume > 0 && ` · ${st.volume.toLocaleString()} ${s.unit || 'kg'}`}
                                    {dur && ` · ${dur}`}
                                  </p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {sortedHistory.map((session) => {
                  const stats = sessionStats(session)
                  const avgRest = formatRest(sessionAvgRest(session))
                  const duration = formatDuration(session.durationMs)
                  return (
                    <div key={session.id} id={`session-${session.id}`} className="bg-white border border-border scroll-mt-28">
                      <button
                        onClick={() => setOpenSession(session.id)}
                        className="w-full flex items-center justify-between px-6 py-4 bg-transparent border-none cursor-pointer text-left"
                      >
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[14px] font-medium text-text-primary">{formatDate(session.date)}</p>
                            {session.name && (
                              <span className="text-[11px] font-medium text-text-secondary bg-cream border border-border px-2 py-0.5 break-words">
                                {session.name}
                              </span>
                            )}
                          </div>
                          <p className="text-[12px] text-text-muted mt-0.5">
                            {stats.exercises} exercise{stats.exercises !== 1 ? 's' : ''} · {stats.sets} set{stats.sets !== 1 ? 's' : ''}
                            {stats.volume > 0 && ` · ${stats.volume.toLocaleString()} ${session.unit || 'kg'} volume`}
                            {duration && ` · ${duration}`}
                            {avgRest && ` · ${avgRest} avg rest`}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* The summary card for whichever workout was tapped. It used to be an
              accordion inside the row above, which meant the thing you most want
              to look back at got the least room on a phone. */}
          {openSessionData && (
            <SessionSummary
              session={openSessionData}
              history={sortedHistory}
              unit={unit}
              annotation={annotationForDate(annotations, openSessionData.date)}
              // Whole-history advice: it's about how you're training NOW, so it
              // belongs only on the session you just did. On a workout from
              // March it would read present-tense advice onto old work.
              advice={openSessionData.id === sortedHistory[0]?.id ? topAdvice : null}
              onClose={() => { setOpenSession(null); setEditingSessionDate(null); setEditingSessionTime(null) }}
              // Swaps the summary for the progress chart rather than stacking a
              // second dialog on top of the first.
              onExerciseProgress={(ex) => { setOpenSession(null); setProgressExercise(ex) }}
              actions={(() => {
                const session = openSessionData
                return (
                  <div className="flex flex-wrap items-center gap-4">
                                <button
                                  onClick={() => editSession(session)}
                                  disabled={draft.editingId === session.id}
                                  className="inline-flex items-center gap-1.5 text-[12px] text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-default"
                                >
                                  <Pencil className="w-3.5 h-3.5" /> {draft.editingId === session.id ? 'Editing…' : 'Edit'}
                                </button>
                                {draft.editingId !== session.id && (editingSessionDate === session.id ? (
                                  <input
                                    type="date"
                                    autoFocus
                                    defaultValue={toInputDate(session.date)}
                                    max={toInputDate(Date.now())}
                                    onChange={(e) => changeSessionDate(session, e.target.value)}
                                    onBlur={() => setEditingSessionDate(null)}
                                    className="bg-cream border border-border px-2 py-1 text-text-primary text-[12px] outline-none focus:border-text-primary transition-colors"
                                  />
                                ) : (
                                  <button
                                    onClick={() => setEditingSessionDate(session.id)}
                                    className="inline-flex items-center gap-1.5 text-[12px] text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer transition-colors"
                                  >
                                    <Calendar className="w-3.5 h-3.5" /> Move to another day
                                  </button>
                                ))}
                                {/* One control for both jobs: it shows the window
                                    the workout ran in, and opens for correction
                                    when the derived one is wrong (a session
                                    written up afterwards, say). */}
                                {draft.editingId !== session.id && (editingSessionTime?.id === session.id ? (
                                  <span className="inline-flex items-center gap-1.5">
                                    <input
                                      type="time"
                                      autoFocus
                                      aria-label="Session start time"
                                      value={editingSessionTime.start}
                                      onChange={(e) => setEditingSessionTime((p) => ({ ...p, start: e.target.value }))}
                                      className="bg-cream border border-border px-2 py-1 text-text-primary text-[12px] outline-none focus:border-text-primary transition-colors"
                                    />
                                    <span className="text-[12px] text-text-light">–</span>
                                    <input
                                      type="time"
                                      aria-label="Session end time"
                                      value={editingSessionTime.end}
                                      onChange={(e) => setEditingSessionTime((p) => ({ ...p, end: e.target.value }))}
                                      className="bg-cream border border-border px-2 py-1 text-text-primary text-[12px] outline-none focus:border-text-primary transition-colors"
                                    />
                                    <button
                                      onClick={() => changeSessionTime(session, editingSessionTime)}
                                      aria-label="Save session time"
                                      className="inline-flex items-center text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer p-1 transition-colors"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => setEditingSessionTime(null)}
                                      aria-label="Cancel"
                                      className="inline-flex items-center text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer p-1 transition-colors"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </span>
                                ) : (
                                  <button
                                    onClick={() =>
                                      setEditingSessionTime({
                                        id: session.id,
                                        start: toInputTime(session.startedAt || session.date),
                                        end: toInputTime(session.endedAt || session.date),
                                      })
                                    }
                                    className="inline-flex items-center gap-1.5 text-[12px] text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer transition-colors"
                                  >
                                    <Timer className="w-3.5 h-3.5" />
                                    {/* Same wording as the card above it, so the
                                        control and the thing it edits agree. */}
                                    {session.startedAt && session.endedAt ? 'Change session time' : 'Set session time'}
                                  </button>
                                ))}
                                {draft.editingId !== session.id && (
                                  <button
                                    onClick={() => removeSession(session.id)}
                                    className="inline-flex items-center gap-1.5 text-[12px] text-text-light hover:text-red-600 bg-transparent border-none cursor-pointer transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" /> Delete session
                                  </button>
                                )}
                  </div>
                )
              })()}
            />
          )}

          {/* Guest data-sharing opt-in */}
          {!user && turnstileConfigured() && (
            <div className="mt-10 bg-white border border-border p-6">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={guestShare.share}
                  onChange={(e) => updateGuestShare({ share: e.target.checked })}
                  className="mt-0.5 w-4 h-4 shrink-0 accent-text-primary cursor-pointer"
                />
                <span className="text-[13px] text-text-secondary leading-relaxed">
                  <span className="font-medium text-text-primary">Help improve the strength standards.</span>{' '}
                  Share your lifts anonymously as you log them — no account, no name, nothing that identifies you.
                </span>
              </label>

              {guestShare.share && (
                <div className="mt-5 pl-7 space-y-4">
                  <div>
                    <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-2">Sex</label>
                    <div className="flex gap-3 max-w-xs">
                      {['male', 'female'].map((s) => (
                        <button
                          key={s}
                          onClick={() => updateGuestShare({ sex: s })}
                          className={`flex-1 py-2.5 text-[13px] font-medium border cursor-pointer transition-colors capitalize ${
                            guestShare.sex === s ? 'bg-text-primary text-cream border-text-primary' : 'bg-white text-text-muted border-border hover:border-border-hover'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-2">Bodyweight ({unit})</label>
                    <NumberField
                      value={guestShare.bodyweight}
                      onValueChange={(v) => updateGuestShare({ bodyweight: v })}
                      placeholder={unit === 'kg' ? '80' : '176'}
                      className="w-full max-w-xs bg-cream border border-border px-4 py-2.5 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors"
                    />
                  </div>
                  <p className="text-[11px] text-text-light leading-relaxed">
                    Your bodyweight and sex help calibrate the standards. Sent anonymously and never shown to anyone.
                  </p>
                </div>
              )}

              {/* Honeypot: hidden from people, tempting to bots. */}
              <input
                type="text"
                value={hp}
                onChange={(e) => setHp(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }}
              />
            </div>
          )}

          <p className="text-[12px] text-text-light leading-relaxed mt-10">
            {user
              ? 'Your workouts are saved to your account — log in on any device to pick up where you left off.'
              : "Your log is saved on this device only, and won't sync to other devices. Log in to save it to your account and keep it for good."}
          </p>
        </motion.div>
      </div>

      {/* RIR explainer */}
      {showRirHelp && (
        <Modal onClose={() => setShowRirHelp(false)} maxWidth="max-w-md">
          <div className="p-7">
            <h3 className="font-heading text-xl font-medium text-text-primary mb-4">What is RIR?</h3>
            <div className="space-y-3 text-[13px] text-text-muted leading-relaxed">
              <p>
                <strong className="text-text-primary">RIR = Reps In Reserve.</strong> It's how many more reps you
                could have done before hitting failure on a set. RIR 2 means you stopped with about 2 reps left in the
                tank; RIR 0 means you went to true failure.
              </p>
              <p>
                Tracking it captures how hard each set actually was — two people can both do 10 reps, but 10 reps at
                RIR 0 is far harder than 10 at RIR 4. It's the missing piece that weight and reps alone don't tell you.
              </p>
              <p>
                For most training aimed at muscle and strength, keeping your working sets around{' '}
                <strong className="text-text-primary">RIR 1–3</strong> is the sweet spot: close enough to failure to
                drive progress, far enough to keep your form clean and recover for the next session.
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* Exercise progress graph */}
      {progressExercise && (
        <Modal onClose={() => setProgressExercise(null)} maxWidth="max-w-xl">
          <ExerciseProgress exerciseName={progressExercise.name} kind={progressExercise.kind} sessions={progressSessions} unit={unit} />
        </Modal>
      )}

      {/* Review what this session changed, and push the accepted bits to the split */}
      {splitSyncOpen && splitChanges.length > 0 && (
        <SplitSyncModal
          dayName={planDayForDraft.name}
          changes={splitChanges}
          onApply={applyChangesToSplit}
          onClose={() => setSplitSyncOpen(false)}
        />
      )}

      {/* Finishing, but the split day was only inferred — so the same answer
          decides both what the split learns and that the session saves.
          Dismissing means "back to the session": nothing has been written yet. */}
      {pendingSync && (
        <SplitSyncModal
          mode="finish"
          dayName={pendingSync.day.name}
          changes={pendingSync.changes}
          onApply={resolvePendingSync}
          onSkip={() => resolvePendingSync([])}
          onClose={() => setPendingSync(null)}
        />
      )}

      {/* Injury — what gets saved and what it means for the split, both said
          before it happens rather than discovered afterwards. */}
      {injuryPrompt && (
        <Modal onClose={() => setInjuryPrompt(null)} maxWidth="max-w-md">
          <div className="p-6 sm:p-7">
            <div className="flex items-center gap-2 mb-2 pr-8">
              <Bandage className="w-4 h-4 text-text-primary shrink-0" />
              <h3 className="font-heading text-lg font-medium text-text-primary">
                {injuryPrompt.mode === 'session' ? 'End this session — injured?' : 'Mark today as an injury?'}
              </h3>
            </div>
            <p className="text-[13px] text-text-secondary mb-1">
              {injuryPrompt.mode !== 'session'
                ? `${formatDate(injuryPrompt.date)} gets marked off as an injury.`
                : hasLoggedSets
                  ? `${injurySavesLabel} — you trained until you couldn’t — then the session closes.`
                  : 'Nothing’s been logged yet, so there’s nothing to save. The session just closes.'}
            </p>
            <p className="text-[13px] text-text-muted mb-4">
              {!program
                ? 'It’s recorded on your calendar.'
                : isWeeklyProgram
                  ? 'Your split is fixed to the week, so nothing shifts.'
                  : 'Your split won’t wait for this day — tomorrow stays whatever it was already going to be.'}
            </p>
            {/* Which injury this is. A day marked off is an event; the thing
                that caused it usually isn't a one-day event, and tying the two
                together is what turns a scatter of red squares into a story
                about one shoulder. Only offered when something's already
                tracked — with nothing open, "is this the same one?" is a
                question about nothing. */}
            {openInjuryList.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] uppercase tracking-wider text-text-light mb-2">Is this one you’re tracking?</p>
                <div className="flex flex-wrap gap-1.5">
                  {openInjuryList.map((i) => (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => setInjuryLink(injuryLink === i.id ? null : i.id)}
                      aria-pressed={injuryLink === i.id}
                      className={`px-2.5 py-1 text-[11px] font-medium border cursor-pointer transition-colors ${
                        injuryLink === i.id
                          ? 'bg-text-primary text-cream border-text-primary'
                          : 'bg-white text-text-muted border-border hover:border-border-hover'
                      }`}
                    >
                      {injuryTitle(i)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <textarea
              value={injuryNote}
              onChange={(e) => setInjuryNote(e.target.value)}
              placeholder="What happened, which area, how it feels — anything worth remembering (optional)"
              rows={3}
              className="w-full bg-cream border border-border px-3 py-2 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors resize-none mb-3"
            />

            <button
              type="button"
              onClick={markInjuredAndTrack}
              disabled={saving}
              className="w-full mb-4 inline-flex items-center justify-center gap-1.5 bg-transparent border border-border hover:border-text-primary text-text-muted hover:text-text-primary cursor-pointer py-2 text-[12px] transition-colors disabled:opacity-40"
            >
              <Bandage className="w-3.5 h-3.5" />
              {openInjuryList.length ? 'Something new — track it properly' : 'Track this injury properly'}
            </button>

            <div className="flex gap-2">
              <button
                onClick={confirmInjury}
                disabled={saving}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-text-primary text-cream font-medium py-3 border-none cursor-pointer text-[14px] hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Bandage className="w-4 h-4" /> {injuryPrompt.mode === 'session' ? 'End session' : 'Mark injured'}
              </button>
              <button
                onClick={() => setInjuryPrompt(null)}
                className="px-5 text-text-muted hover:text-text-primary bg-white border border-border hover:border-border-hover cursor-pointer text-[13px] transition-colors"
              >
                Cancel
              </button>
            </div>
            <p className="text-[11px] text-text-light mt-3">You can change or clear this any time from the calendar.</p>
          </div>
        </Modal>
      )}

      <HintBar
        label={hintBar}
        onTake={() => {
          if (focusedSet) fillSetFromHint(focusedSet.exId, focusedSet.setId, focusedSet.side)
          document.activeElement?.blur?.()
          setFocusedSet(null)
        }}
      />
      <QuickCalculator />
      {showRestTimer && (
        <RestTimer
          anchorTs={restAnchorTs}
          targetSec={restTargetSec}
          exerciseName={lastLogged?.name || ''}
          afterWarmup={!!lastLogged?.warmup}
          sessionStartTs={sessionStartTs}
          onReset={() => updateRestTimer({ anchor: Date.now(), dismissedAt: null })}
          onDismiss={() => updateRestTimer({ dismissedAt: Date.now() })}
        />
      )}
    </div>
  )
}
