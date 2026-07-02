import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, X, Check, Dumbbell, Trash2, ChevronDown, HelpCircle, LineChart, Calendar } from 'lucide-react'
import {
  getDraft,
  saveDraft,
  clearDraft,
  emptyDraft,
  createExercise,
  createSet,
  getHistory,
  makeSession,
  addLocalSession,
  clearLocalHistory,
  deleteSession,
  sessionStats,
  getUnit,
  saveUnit,
} from '../lib/workoutStore'
import { fetchRemoteHistory, insertRemoteSession, insertRemoteSessions, deleteRemoteSession } from '../lib/workoutRemote'
import { useAuth } from '../lib/auth'
import Modal from '../components/Modal'
import ExerciseProgress from '../components/ExerciseProgress'
import ExercisePicker from '../components/ExercisePicker'
import SessionNamePicker from '../components/SessionNamePicker'

const SET_GRID = 'grid grid-cols-[18px_1fr_1fr_50px_18px] gap-2 items-center'

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

function setSummary(set, unit) {
  const hasRir = set.rir !== '' && set.rir != null
  const base = set.weight ? `${set.weight}${unit} × ${set.reps}` : `${set.reps} reps`
  return hasRir ? `${base} · ${set.rir} RIR` : base
}

export default function WorkoutTracker() {
  const { user } = useAuth()
  const [draft, setDraft] = useState(() => getDraft() || emptyDraft())
  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [importable, setImportable] = useState(null)
  const [unit, setUnit] = useState(() => getUnit())
  const [openSession, setOpenSession] = useState(null)
  const [showRirHelp, setShowRirHelp] = useState(false)
  const [progressExercise, setProgressExercise] = useState(null)
  const [editingDate, setEditingDate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const firstRender = useRef(true)

  const draftDate = draft.date || Date.now()
  const isToday = isSameDay(draftDate, Date.now())

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
      if (user) {
        try {
          const remote = await fetchRemoteHistory(user.id)
          if (cancelled) return
          setHistory(remote)
          const local = getHistory()
          setImportable(local.length > 0 ? local : null)
        } catch {
          if (!cancelled) setHistory([])
        }
      } else {
        setHistory(getHistory())
        setImportable(null)
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
    return [...provisional, ...history]
  }, [draft, history, unit])

  const sortedHistory = useMemo(() => [...history].sort((a, b) => b.date - a.date), [history])

  function addExercise(name) {
    const trimmed = name.trim()
    if (!trimmed) return
    setDraft((d) => ({ ...d, exercises: [...d.exercises, createExercise(trimmed)] }))
  }

  function changeUnit(u) {
    setUnit(u)
    saveUnit(u)
  }

  function changeDate(value) {
    if (!value) return
    setDraft((d) => ({ ...d, date: fromInputDate(value) }))
  }

  function removeExercise(exId) {
    setDraft((d) => ({ ...d, exercises: d.exercises.filter((e) => e.id !== exId) }))
  }

  function addSet(exId) {
    setDraft((d) => ({
      ...d,
      exercises: d.exercises.map((e) =>
        e.id === exId ? { ...e, sets: [...e.sets, createSet(e.sets[e.sets.length - 1])] } : e
      ),
    }))
  }

  function updateSet(exId, setId, field, value) {
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

  async function finish() {
    setSaveError('')
    setSaving(true)
    const session = makeSession(draft, unit)
    try {
      if (user) {
        await insertRemoteSession(user.id, session)
        setHistory((prev) => [session, ...prev].sort((a, b) => b.date - a.date))
      } else {
        setHistory(addLocalSession(session))
      }
      clearDraft()
      setDraft(emptyDraft())
      setEditingDate(false)
    } catch {
      setSaveError('Could not save your session. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  function discard() {
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

  const hasLoggedSets = draft.exercises.some((e) => e.sets.some((s) => Number(s.reps) > 0))
  const liveStats = sessionStats(draft)

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
                  {isToday ? "Today's session" : 'Past session'}
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
                <div className="flex border border-border">
                  {['kg', 'lbs'].map((u) => (
                    <button
                      key={u}
                      onClick={() => changeUnit(u)}
                      className={`px-3 py-1.5 text-[12px] font-medium cursor-pointer transition-colors ${
                        unit === u ? 'bg-text-primary text-cream' : 'bg-white text-text-muted hover:text-text-primary'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mb-6">
              <SessionNamePicker
                value={draft.name || ''}
                onChange={(name) => setDraft((d) => ({ ...d, name }))}
              />
            </div>

            <AnimatePresence initial={false}>
              {draft.exercises.map((ex) => (
                <motion.div
                  key={ex.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 border border-border bg-cream"
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <span className="text-[14px] font-medium text-text-primary">{ex.name}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setProgressExercise(ex.name)}
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
                    </div>
                  </div>

                  <div className="px-4 py-3">
                    <div className={`${SET_GRID} mb-2 text-[10px] uppercase tracking-wider text-text-light`}>
                      <span className="text-center">#</span>
                      <span>{unit}</span>
                      <span>Reps</span>
                      <span className="flex items-center gap-1">
                        RIR
                        <button
                          type="button"
                          onClick={() => setShowRirHelp(true)}
                          aria-label="What is RIR?"
                          className="text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer p-0 leading-none"
                        >
                          <HelpCircle className="w-3 h-3" />
                        </button>
                      </span>
                      <span />
                    </div>

                    {ex.sets.map((set, i) => (
                      <div key={set.id} className={`${SET_GRID} mb-2`}>
                        <span className="text-center text-[13px] text-text-muted">{i + 1}</span>
                        <input
                          type="number" inputMode="decimal" min="0"
                          value={set.weight}
                          onChange={(e) => updateSet(ex.id, set.id, 'weight', e.target.value)}
                          placeholder="—"
                          className="w-full min-w-0 bg-white border border-border px-2 py-2 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors"
                        />
                        <input
                          type="number" inputMode="numeric" min="0"
                          value={set.reps}
                          onChange={(e) => updateSet(ex.id, set.id, 'reps', e.target.value)}
                          placeholder="—"
                          className="w-full min-w-0 bg-white border border-border px-2 py-2 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors"
                        />
                        <input
                          type="number" inputMode="numeric" min="0" max="10"
                          value={set.rir ?? ''}
                          onChange={(e) => updateSet(ex.id, set.id, 'rir', e.target.value)}
                          placeholder="—"
                          className="w-full min-w-0 bg-white border border-border px-2 py-2 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors"
                        />
                        <button
                          onClick={() => removeSet(ex.id, set.id)}
                          aria-label={`Remove set ${i + 1}`}
                          disabled={ex.sets.length === 1}
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
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {draft.exercises.length === 0 && (
              <div className="text-center py-8 border border-dashed border-border mb-4">
                <Dumbbell className="w-6 h-6 text-text-light mx-auto mb-2" />
                <p className="text-[13px] text-text-muted">Add your first exercise to start logging.</p>
              </div>
            )}

            {/* Add exercise */}
            <ExercisePicker onSelect={addExercise} />

            {draft.exercises.length > 0 && (
              <div className="mt-6 pt-6 border-t border-border">
                {saveError && <p className="text-[13px] text-red-600 mb-3">{saveError}</p>}
                <div className="flex gap-3">
                  <button
                    onClick={finish}
                    disabled={!hasLoggedSets || saving}
                    className="flex-1 inline-flex items-center justify-center gap-2 bg-text-primary text-cream font-medium py-3.5 border-none cursor-pointer text-[14px] hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Check className="w-4 h-4" /> {saving ? 'Saving…' : 'Finish session'}
                  </button>
                  <button
                    onClick={discard}
                    className="px-5 text-text-muted hover:text-text-primary bg-white border border-border hover:border-border-hover cursor-pointer text-[13px] transition-colors"
                  >
                    Discard
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

          {/* History */}
          {history.length > 0 && (
            <div className="mt-14">
              <h2 className="font-heading text-xl font-medium text-text-primary mb-6">History</h2>
              <div className="space-y-3">
                {sortedHistory.map((session) => {
                  const stats = sessionStats(session)
                  const isOpen = openSession === session.id
                  return (
                    <div key={session.id} className="bg-white border border-border">
                      <button
                        onClick={() => setOpenSession(isOpen ? null : session.id)}
                        className="w-full flex items-center justify-between px-6 py-4 bg-transparent border-none cursor-pointer text-left"
                      >
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[14px] font-medium text-text-primary">{formatDate(session.date)}</p>
                            {session.name && (
                              <span className="text-[11px] font-medium text-text-secondary bg-cream border border-border px-2 py-0.5">
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
                              {session.exercises.map((ex) => (
                                <div key={ex.id} className="mb-4 last:mb-0">
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <p className="text-[13px] font-medium text-text-primary">{ex.name}</p>
                                    <button
                                      onClick={() => setProgressExercise(ex.name)}
                                      aria-label={`View ${ex.name} progress`}
                                      className="text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer p-0.5"
                                    >
                                      <LineChart className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {ex.sets.filter((s) => Number(s.reps) > 0).map((s) => (
                                      <span key={s.id} className="text-[12px] text-text-muted bg-cream border border-border px-2.5 py-1">
                                        {setSummary(s, session.unit || 'kg')}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                              <button
                                onClick={() => removeSession(session.id)}
                                className="inline-flex items-center gap-1.5 text-[12px] text-text-light hover:text-red-600 bg-transparent border-none cursor-pointer mt-3 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Delete session
                              </button>
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
          <ExerciseProgress exerciseName={progressExercise} sessions={progressSessions} unit={unit} />
        </Modal>
      )}
    </div>
  )
}
