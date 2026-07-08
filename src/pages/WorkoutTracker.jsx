import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, X, Check, Dumbbell, Activity, Trash2, ChevronDown, HelpCircle, LineChart, Calendar, CalendarDays, ArrowLeftRight, Link2, Pencil } from 'lucide-react'
import {
  getDraft,
  saveDraft,
  clearDraft,
  emptyDraft,
  createExercise,
  createSet,
  convertSet,
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
  getGuestShare,
  saveGuestShare,
  getExerciseTarget,
  saveExerciseTarget,
  getBodyweightLog,
} from '../lib/workoutStore'
import { fetchRemoteHistory, insertRemoteSession, insertRemoteSessions, deleteRemoteSession, updateRemoteSessionDate, updateRemoteSession, insertSharedLifts, submitGuestLifts } from '../lib/workoutRemote'
import { buildSharedLifts, distanceUnit, repRangeStatus, convertWeight, supersetLabels } from '../lib/workoutStats'
import { fetchProfile } from '../lib/profile'
import { getTurnstileToken, turnstileConfigured } from '../lib/turnstile'
import { useAuth } from '../lib/auth'
import Modal from '../components/Modal'
import ExerciseProgress from '../components/ExerciseProgress'
import ExercisePicker from '../components/ExercisePicker'
import WorkoutCalendar from '../components/WorkoutCalendar'
import SessionNamePicker from '../components/SessionNamePicker'
import { lateralityFor, usesBodyweight } from '../lib/movements'
import { getExercise, exerciseIdForName } from '../lib/exerciseLibrary'
import UnitHelp from '../components/UnitHelp'

const SET_GRID = 'grid grid-cols-[18px_1fr_1fr_50px_18px] gap-2 items-center'
const CARDIO_SET_GRID = 'grid grid-cols-[18px_1fr_1fr_18px] gap-2 items-center'

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

function isSameDay(a, b) {
  const da = new Date(a), db = new Date(b)
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate()
}

function sideSummary(s, unit) {
  const base = s.weight ? `${s.weight}${unit} × ${s.reps}` : `${s.reps}`
  const hasRir = s.rir !== '' && s.rir != null
  return hasRir ? `${base} @${s.rir}` : base
}

function setSummary(set, unit, kind, distUnit) {
  if (kind === 'cardio') {
    const parts = []
    if (set.duration) parts.push(`${set.duration} min`)
    if (set.distance) parts.push(`${set.distance} ${distUnit}`)
    return parts.join(' · ') || '—'
  }
  const tag = set.type === 'warmup' ? 'W · ' : set.type === 'backoff' ? 'B · ' : ''
  if (set.left) {
    return `${tag}L ${sideSummary(set.left, unit)} · R ${sideSummary(set.right || {}, unit)}`
  }
  const hasRir = set.rir !== '' && set.rir != null
  const base = set.weight ? `${set.weight}${unit} × ${set.reps}` : `${set.reps} reps`
  return tag + (hasRir ? `${base} · ${set.rir} RIR` : base)
}

// A unilateral set is "worked" if either limb has reps; a bilateral set if it
// has reps; a cardio entry if it has duration.
function isWorkingSet(set, kind) {
  if (kind === 'cardio') return Number(set.duration) > 0
  if (set.left) return Number(set.left?.reps) > 0 || Number(set.right?.reps) > 0
  return Number(set.reps) > 0
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
  // logged before IDs existed still link to the library.
  if (next.exerciseId === undefined) {
    next = { ...next, exerciseId: exerciseIdForName(next.name) }
  }
  return next
}
function newSupersetId() {
  return `ss-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

// Convert legacy adjacency-based supersets (`linkedToPrev`) to the group-id
// model (`supersetId`), so grouping no longer depends on list order. No-op once
// data is already on the new model.
function migrateSupersets(exercises) {
  if (!exercises.some((e) => e && e.linkedToPrev)) return exercises
  const out = exercises.map((e) => ({ ...e }))
  for (let i = 0; i < out.length; i++) {
    if (!out[i].supersetId && i > 0 && out[i].linkedToPrev) {
      if (!out[i - 1].supersetId) out[i - 1].supersetId = newSupersetId()
      out[i].supersetId = out[i - 1].supersetId
    }
    delete out[i].linkedToPrev
  }
  return out
}

function migrateDraft(draft) {
  if (!draft || !Array.isArray(draft.exercises)) return draft
  return { ...draft, exercises: migrateSupersets(draft.exercises.map(migrateExercise)) }
}

export default function WorkoutTracker() {
  const { user } = useAuth()
  const [draft, setDraft] = useState(() => migrateDraft(getDraft()) || emptyDraft())
  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [importable, setImportable] = useState(null)
  const [profile, setProfile] = useState(null)
  const [unit, setUnit] = useState(() => getUnit())
  const [openSession, setOpenSession] = useState(null)
  const [supersetMenuFor, setSupersetMenuFor] = useState(null)
  const [selectedCalDay, setSelectedCalDay] = useState(null)
  const [editingSessionDate, setEditingSessionDate] = useState(null)
  const [showRirHelp, setShowRirHelp] = useState(false)
  const [progressExercise, setProgressExercise] = useState(null)
  const [editingDate, setEditingDate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [guestShare, setGuestShare] = useState(() => getGuestShare())
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
  const isToday = isSameDay(draftDate, Date.now())
  const isEditing = !!draft.editingId

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
          const [remote, prof] = await Promise.all([fetchRemoteHistory(user.id), fetchProfile(user.id)])
          if (cancelled) return
          setHistory(remote)
          setProfile(prof)
          const local = getHistory()
          setImportable(local.length > 0 ? local : null)
        } catch {
          if (!cancelled) {
            setHistory([])
            setLoadError("Couldn't load your workouts — check your connection and refresh.")
          }
        }
      } else {
        setHistory(getHistory())
        setImportable(null)
        setProfile(null)
      }
      if (!cancelled) setLoadingHistory(false)
    }
    load()
    return () => { cancelled = true }
  }, [user])

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
    setDraft((d) => {
      const bw = bodyweight ? (d.bodyweight != null && d.bodyweight !== '' ? d.bodyweight : prefillBodyweight()) : undefined
      const ex = createExercise(trimmed, kind, { laterality, repRange, bodyweight, bw: Number(bw) || 0, exerciseId: exerciseId || null })
      const next = { ...d, exercises: [...d.exercises, ex] }
      if (bodyweight && (d.bodyweight == null || d.bodyweight === '')) next.bodyweight = bw
      return next
    })
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
        return { ...e, unilateral, sets: e.sets.map((s) => convertSet(s, unilateral)) }
      }),
    }))
  }

  // Any supersetId shared by fewer than two exercises is meaningless — clear it
  // so a leftover partner falls back to standalone.
  function pruneSupersets(exercises) {
    const counts = {}
    for (const e of exercises) if (e.supersetId) counts[e.supersetId] = (counts[e.supersetId] || 0) + 1
    return exercises.map((e) => (e.supersetId && counts[e.supersetId] < 2 ? { ...e, supersetId: null } : e))
  }

  // Group two resistance exercises into a superset. If either is already in a
  // superset the other joins it; otherwise a new group is created. Works for
  // any two exercises regardless of their position in the list.
  function pairSuperset(exId, targetId) {
    setDraft((d) => {
      const a = d.exercises.find((e) => e.id === exId)
      const b = d.exercises.find((e) => e.id === targetId)
      if (!a || !b || a.kind === 'cardio' || b.kind === 'cardio') return d
      const groupId = b.supersetId || a.supersetId || newSupersetId()
      const exercises = d.exercises.map((e) => (e.id === exId || e.id === targetId ? { ...e, supersetId: groupId } : e))
      return { ...d, exercises: pruneSupersets(exercises) }
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
          ? { ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, [side]: { ...s[side], [field]: value } } : s)) }
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
        e.id === exId ? { ...e, repRange: { ...(e.repRange || { low: 8, high: 12 }), [field]: n } } : e
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

  // Cycle a set's type: working → warm-up → back-off → working. Warm-ups are
  // logged but excluded from volume/hard-set counts; back-offs are working sets,
  // just labeled.
  function cycleSetType(exId, setId) {
    const next = { undefined: 'warmup', warmup: 'backoff', backoff: undefined }
    setDraft((d) => ({
      ...d,
      exercises: d.exercises.map((e) =>
        e.id === exId
          ? {
              ...e,
              sets: e.sets.map((s) => {
                if (s.id !== setId) return s
                const t = next[s.type] ?? 'warmup'
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
    setDraft((d) => ({ ...d, date: ts }))
  }

  function removeExercise(exId) {
    setDraft((d) => ({ ...d, exercises: d.exercises.filter((e) => e.id !== exId) }))
  }

  function addSet(exId) {
    setDraft((d) => ({
      ...d,
      exercises: d.exercises.map((e) => {
        if (e.id !== exId) return e
        const opts = e.bodyweight ? { bodyweight: true, bw: Number(d.bodyweight) || 0 } : { unilateral: e.unilateral }
        return { ...e, sets: [...e.sets, createSet(e.sets[e.sets.length - 1], opts)] }
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
            ? { ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, added: value, weight: Math.max(0, bw + (Number(value) || 0)) } : s)) }
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
          ? { ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, [field]: value } : s)) }
          : e
      ),
    }))
  }

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
        durationMs: session.durationMs ?? null,
      }
    })
    setOpenSession(null)
    setEditingDate(false)
    setSaveError('')
    lastFinishedRef.current = null
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 40)
  }

  // Leave edit mode, restoring any stashed in-progress draft (else start fresh).
  function exitEditMode() {
    const stash = getStashedDraft()
    clearStashedDraft()
    clearDraft()
    setDraft(stash || emptyDraft())
    setEditingDate(false)
  }

  async function finish() {
    if (saving || lastFinishedRef.current === draft.startedAt) return
    lastFinishedRef.current = draft.startedAt
    setSaveError('')
    setSaving(true)

    // Editing an existing session: overwrite it in place (keep its id and
    // original duration) instead of creating a new one.
    if (draft.editingId) {
      const updated = {
        id: draft.editingId,
        date: draft.date || Date.now(),
        name: draft.name || '',
        unit,
        durationMs: draft.durationMs ?? null,
        exercises: draft.exercises,
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
        exitEditMode()
      } catch {
        lastFinishedRef.current = null
        setSaveError('Could not save your changes. Check your connection and try again.')
      } finally {
        setSaving(false)
      }
      return
    }

    const session = makeSession(draft, unit)
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
      clearDraft()
      setDraft(emptyDraft())
      setEditingDate(false)
    } catch {
      // Allow retrying this same draft after a failed save.
      lastFinishedRef.current = null
      setSaveError('Could not save your session. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  function discard() {
    if (draft.editingId) return exitEditMode()
    clearDraft()
    setDraft(emptyDraft())
    setEditingDate(false)
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

  // Tap a day in the history calendar: highlight it and, if a workout was
  // logged that day, open the first session and scroll it into view.
  function selectCalendarDay(date, daySessions) {
    setSelectedCalDay(date)
    if (daySessions.length) {
      const first = daySessions[0]
      setOpenSession(first.id)
      setTimeout(() => {
        document.getElementById(`session-${first.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 60)
    }
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
  const hasLoggedSets = draft.exercises.some((e) => e.sets.some((s) => isWorkingSet(s, e.kind)))
  const liveStats = sessionStats(draft)
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
    const group = ex.kind === 'cardio' ? null : resistanceGroups.get(ex.id)
    const inSuperset = !!group && group.size > 1
    // Other resistance exercises this one can be supersetted with.
    const supersetTargets = ex.kind === 'cardio' ? [] : resistanceExercises.filter((o) => o.id !== ex.id)
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
            {inSuperset && (
              <span
                title={`Superset ${group.letter}`}
                className="shrink-0 inline-flex items-center justify-center text-[10px] font-semibold text-cream bg-text-primary px-1.5 py-0.5 tracking-wide"
              >
                {group.label}
              </span>
            )}
            <span className="text-[14px] font-medium text-text-primary min-w-0 break-words">{ex.name}</span>
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

        <div className="px-4 py-3">
          {ex.kind === 'cardio' ? (
            <>
              <div className={`${CARDIO_SET_GRID} mb-2 text-[10px] uppercase tracking-wider text-text-light`}>
                <span className="text-center">#</span>
                <span>Min</span>
                <span>{distUnit}</span>
                <span />
              </div>
              {ex.sets.map((set, i) => (
                <div key={set.id} className={`${CARDIO_SET_GRID} mb-2`}>
                  <span className="text-center text-[13px] text-text-muted">{i + 1}</span>
                  <input
                    type="number" inputMode="decimal" min="0"
                    value={set.duration ?? ''}
                    onChange={(e) => updateSet(ex.id, set.id, 'duration', e.target.value)}
                    placeholder="—" aria-label={`Entry ${i + 1} duration in minutes`}
                    className="w-full min-w-0 bg-white border border-border px-2 py-2 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors"
                  />
                  <input
                    type="number" inputMode="decimal" min="0"
                    value={set.distance ?? ''}
                    onChange={(e) => updateSet(ex.id, set.id, 'distance', e.target.value)}
                    placeholder="—" aria-label={`Entry ${i + 1} distance in ${distUnit}`}
                    className="w-full min-w-0 bg-white border border-border px-2 py-2 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors"
                  />
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
                    <input
                      type="number" inputMode="numeric" min="1" max="50"
                      value={ex.repRange?.low ?? ''}
                      onChange={(e) => setRepRange(ex.id, 'low', e.target.value)}
                      aria-label="Target rep range low"
                      className="w-11 bg-white border border-border px-1.5 py-1 text-center text-text-primary text-[12px] outline-none focus:border-text-primary transition-colors"
                    />
                    <span className="text-text-light text-[12px]">–</span>
                    <input
                      type="number" inputMode="numeric" min="1" max="50"
                      value={ex.repRange?.high ?? ''}
                      onChange={(e) => setRepRange(ex.id, 'high', e.target.value)}
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
                    onClick={() => setRepTarget(ex.id, { low: 8, high: 12 })}
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
                    <input
                      type="number" inputMode="decimal" min="0"
                      value={draft.bodyweight ?? ''}
                      onChange={(e) => setSessionBodyweight(e.target.value)}
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
                      <input
                        type="number" inputMode="decimal"
                        value={set.added ?? ''}
                        onChange={(e) => updateAdded(ex.id, set.id, e.target.value)}
                        placeholder="0"
                        aria-label={`Set ${i + 1} added weight in ${unit}`}
                        className="w-full min-w-0 bg-white border border-border px-2 py-2 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors"
                      />
                      <input
                        type="number" inputMode="numeric" min="0"
                        value={set.reps}
                        onChange={(e) => updateSet(ex.id, set.id, 'reps', e.target.value)}
                        placeholder="—"
                        aria-label={`Set ${i + 1} reps`}
                        className="w-full min-w-0 bg-white border border-border px-2 py-2 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors"
                      />
                      <input
                        type="number" inputMode="numeric" min="0" max="10"
                        value={set.rir ?? ''}
                        onChange={(e) => updateSet(ex.id, set.id, 'rir', e.target.value)}
                        placeholder="—"
                        aria-label={`Set ${i + 1} reps in reserve`}
                        className="w-full min-w-0 bg-white border border-border px-2 py-2 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors"
                      />
                      <button
                        onClick={() => removeSet(ex.id, set.id)} aria-label={`Remove set ${i + 1}`} disabled={ex.sets.length === 1}
                        className="flex justify-center text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <p className="text-[11px] text-text-light mt-1 mb-2">Load = bodyweight + added (use a negative number for assisted reps).</p>
                  <button
                    onClick={() => addSet(ex.id)}
                    className="inline-flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text-primary bg-transparent border-none cursor-pointer mt-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add set
                  </button>
                </>
              ) : ex.unilateral ? (
                <>
                  <div className="grid grid-cols-[20px_1fr_1fr_44px] gap-2 mb-1.5 text-[10px] uppercase tracking-wider text-text-light">
                    <span />
                    <span>{unit}</span>
                    <span>Reps</span>
                    <span className="flex items-center gap-1">RIR
                      <button type="button" onClick={() => setShowRirHelp(true)} aria-label="What is RIR?" className="text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer p-0 leading-none">
                        <HelpCircle className="w-3 h-3" />
                      </button>
                    </span>
                  </div>
                  {ex.sets.map((set, i) => (
                    <div key={set.id} className="mb-2.5 pb-2.5 border-b border-border/60 last:border-0 last:pb-0 last:mb-1">
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
                          <input
                            type="number" inputMode="decimal" min="0"
                            value={set[side]?.weight ?? ''}
                            onChange={(e) => updateLimbSet(ex.id, set.id, side, 'weight', e.target.value)}
                            placeholder="—" aria-label={`Set ${i + 1} ${side} weight`}
                            className="w-full min-w-0 bg-white border border-border px-2 py-2 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors"
                          />
                          <input
                            type="number" inputMode="numeric" min="0"
                            value={set[side]?.reps ?? ''}
                            onChange={(e) => updateLimbSet(ex.id, set.id, side, 'reps', e.target.value)}
                            placeholder="—" aria-label={`Set ${i + 1} ${side} reps`}
                            className="w-full min-w-0 bg-white border border-border px-2 py-2 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors"
                          />
                          <input
                            type="number" inputMode="numeric" min="0" max="10"
                            value={set[side]?.rir ?? ''}
                            onChange={(e) => updateLimbSet(ex.id, set.id, side, 'rir', e.target.value)}
                            placeholder="—" aria-label={`Set ${i + 1} ${side} reps in reserve`}
                            className="w-full min-w-0 bg-white border border-border px-2 py-2 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors"
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                  <button
                    onClick={() => addSet(ex.id)}
                    className="inline-flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text-primary bg-transparent border-none cursor-pointer mt-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add set
                  </button>
                </>
              ) : (
                <>
                  <div className={`${SET_GRID} mb-2 text-[10px] uppercase tracking-wider text-text-light`}>
                    <span className="text-center">#</span>
                    <span>{unit}</span>
                    <span>Reps</span>
                    <span className="flex items-center gap-1">RIR
                      <button type="button" onClick={() => setShowRirHelp(true)} aria-label="What is RIR?" className="text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer p-0 leading-none">
                        <HelpCircle className="w-3 h-3" />
                      </button>
                    </span>
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
                      <input
                        type="number" inputMode="decimal" min="0"
                        value={set.weight}
                        onChange={(e) => updateSet(ex.id, set.id, 'weight', e.target.value)}
                        placeholder="—" aria-label={`Set ${i + 1} weight in ${unit}`}
                        className="w-full min-w-0 bg-white border border-border px-2 py-2 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors"
                      />
                      <input
                        type="number" inputMode="numeric" min="0"
                        value={set.reps}
                        onChange={(e) => updateSet(ex.id, set.id, 'reps', e.target.value)}
                        placeholder="—" aria-label={`Set ${i + 1} reps`}
                        className="w-full min-w-0 bg-white border border-border px-2 py-2 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors"
                      />
                      <input
                        type="number" inputMode="numeric" min="0" max="10"
                        value={set.rir ?? ''}
                        onChange={(e) => updateSet(ex.id, set.id, 'rir', e.target.value)}
                        placeholder="—" aria-label={`Set ${i + 1} reps in reserve`}
                        className="w-full min-w-0 bg-white border border-border px-2 py-2 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors"
                      />
                      <button
                        onClick={() => removeSet(ex.id, set.id)} aria-label={`Remove set ${i + 1}`} disabled={ex.sets.length === 1}
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
                    <Plus className="w-3.5 h-3.5" /> Add set
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </motion.div>
    )
  }

  return (
    <div className="pt-28 pb-24 px-6">
      <div className="max-w-2xl mx-auto">
        <Link to="/tools" className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary no-underline text-[13px] mb-10 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to tools
        </Link>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-heading text-4xl font-medium text-text-primary mb-3">Workout log</h1>
          <p className="text-text-muted text-[15px] mb-10">
            {user
              ? 'Track what you trained, set by set — saved to your account and synced across your devices.'
              : 'Track what you trained, set by set. Everything saves automatically in your browser — no account needed.'}
          </p>

          {/* Current session */}
          <div className="bg-white border border-border p-7 md:p-9">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-text-light mb-1">
                  {isEditing ? 'Editing session' : isToday ? "Today's session" : 'Past session'}
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
                placeholder="Search or add a resistance exercise…"
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
                placeholder="Search or add a cardio exercise…"
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

              {/* Browse past days — tap a day to jump to that session. */}
              <div className="bg-white border border-border p-5 sm:p-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <CalendarDays className="w-4 h-4 text-text-primary" />
                  <h3 className="text-[12px] font-medium uppercase tracking-wider text-text-secondary">Calendar</h3>
                </div>
                <WorkoutCalendar
                  sessions={sortedHistory}
                  selectedDate={selectedCalDay}
                  onSelectDay={selectCalendarDay}
                />
              </div>

              <div className="space-y-3">
                {sortedHistory.map((session) => {
                  const stats = sessionStats(session)
                  const isOpen = openSession === session.id
                  const sessionGroups = supersetLabels(session.exercises.filter((e) => e.kind !== 'cardio'))
                  return (
                    <div key={session.id} id={`session-${session.id}`} className="bg-white border border-border scroll-mt-28">
                      <button
                        onClick={() => setOpenSession(isOpen ? null : session.id)}
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
                          </p>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>

                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="px-6 pb-5 border-t border-border pt-4">
                              {session.exercises.map((ex) => {
                                const du = distanceUnit(session.unit || 'kg')
                                const shown = ex.sets.filter((s) => isWorkingSet(s, ex.kind))
                                const g = sessionGroups.get(ex.id)
                                const badge = g && g.size > 1 ? g.label : null
                                return (
                                  <div key={ex.id} className="mb-4 last:mb-0">
                                    <div className="flex items-center gap-2 mb-1.5">
                                      {badge && (
                                        <span className="shrink-0 inline-flex items-center justify-center text-[9px] font-semibold text-cream bg-text-primary px-1.5 py-0.5 tracking-wide">
                                          {badge}
                                        </span>
                                      )}
                                      <p className="text-[13px] font-medium text-text-primary min-w-0 break-words">{ex.name}</p>
                                      <button
                                        onClick={() => setProgressExercise({ name: ex.name, kind: ex.kind })}
                                        aria-label={`View ${ex.name} progress`}
                                        className="text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer p-0.5"
                                      >
                                        <LineChart className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {shown.map((s) => (
                                        <span key={s.id} className="text-[12px] text-text-muted bg-cream border border-border px-2.5 py-1">
                                          {setSummary(s, session.unit || 'kg', ex.kind, du)}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )
                              })}
                              <div className="flex flex-wrap items-center gap-4 mt-3">
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
                                {draft.editingId !== session.id && (
                                  <button
                                    onClick={() => removeSession(session.id)}
                                    className="inline-flex items-center gap-1.5 text-[12px] text-text-light hover:text-red-600 bg-transparent border-none cursor-pointer transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" /> Delete session
                                  </button>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>
            </div>
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
                    <input
                      type="number"
                      min="0"
                      value={guestShare.bodyweight}
                      onChange={(e) => {
                        const v = e.target.value
                        if (v !== '' && (!Number.isFinite(Number(v)) || Number(v) < 0)) return
                        updateGuestShare({ bodyweight: v })
                      }}
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
    </div>
  )
}
