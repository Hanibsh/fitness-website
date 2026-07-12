import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Pencil, Trash2, X, BatteryCharging } from 'lucide-react'
import { useAuth } from '../lib/auth'
import {
  getHistory, getProgram, deleteSession,
  getDayAnnotations, makeDayAnnotation, saveDayAnnotation, deleteDayAnnotation,
} from '../lib/workoutStore'
import {
  fetchRemoteHistory, fetchRemoteProgram, deleteRemoteSession,
  fetchRemoteDayAnnotations, upsertRemoteDayAnnotation, deleteRemoteDayAnnotation,
} from '../lib/workoutRemote'
import { plannedDayForDate } from '../lib/program'
import { DAY_REASONS, reasonLabel, daySummary, currentBreak, annotationForDate } from '../lib/dayLog'
import WorkoutCalendar from '../components/WorkoutCalendar'

const SUMMARY_RANGES = [
  { days: 7, label: 'Week' },
  { days: 30, label: 'Month' },
  { days: 90, label: '3 Months' },
]

function noonOf(ts) {
  const d = new Date(ts)
  d.setHours(12, 0, 0, 0)
  return d.getTime()
}

function fullDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
}

function Card({ children, className = '' }) {
  return <div className={`bg-white border border-border p-5 sm:p-6 ${className}`}>{children}</div>
}

function SectionHeading({ children, icon: Icon, right }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-text-primary" />}
        <h2 className="font-heading text-lg font-medium text-text-primary">{children}</h2>
      </div>
      {right}
    </div>
  )
}

function MiniStat({ label, value }) {
  return (
    <div className="bg-cream border border-border px-3 py-3 text-center">
      <p className="text-[10px] uppercase tracking-wider text-text-light mb-1">{label}</p>
      <p className="text-[15px] font-medium text-text-primary break-words">{value}</p>
    </div>
  )
}

// Full-page, bigger calendar than the compact widget embedded in the
// dashboard/logger — room for both workout dots and off-day markers, a fuller
// day panel, and a rolling summary. A day can have both a logged workout AND
// an annotation (sick/injury/travel/rest/other): they're tracked and shown
// independently, not as alternatives.
export default function CalendarPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])
  const [program, setProgram] = useState(null)
  const [annotations, setAnnotations] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState(null) // { date, sessions }
  // Whether the day_annotations table is reachable. Starts true when logged
  // in; flips off (→ local) the first time a remote call fails, e.g. the
  // migration hasn't been run yet.
  const [remoteAnnotationsOk, setRemoteAnnotationsOk] = useState(!!user)
  const [rangeDays, setRangeDays] = useState(30)
  const [reasonDraft, setReasonDraft] = useState(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      if (user) {
        try {
          const [remoteSessions, prog, remoteAnnotations] = await Promise.all([
            fetchRemoteHistory(user.id),
            fetchRemoteProgram(user.id),
            fetchRemoteDayAnnotations(user.id),
          ])
          if (!cancelled) {
            setSessions(remoteSessions)
            setProgram(prog || getProgram())
            setAnnotations(remoteAnnotations)
            setRemoteAnnotationsOk(true)
          }
        } catch {
          if (!cancelled) {
            setSessions(getHistory())
            setProgram(getProgram())
            setAnnotations(getDayAnnotations())
            setRemoteAnnotationsOk(false)
          }
        }
      } else {
        setSessions(getHistory())
        setProgram(getProgram())
        setAnnotations(getDayAnnotations())
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [user])

  const useRemoteAnnotations = !!user && remoteAnnotationsOk

  // Prefill the annotation form from whatever's already on the selected day.
  useEffect(() => {
    if (!selectedDay) { setReasonDraft(null); setNoteDraft(''); return }
    const existing = annotationForDate(annotations, selectedDay.date.getTime())
    setReasonDraft(existing?.reason || null)
    setNoteDraft(existing?.note || '')
  }, [selectedDay, annotations])

  async function persistAnnotation(entry) {
    if (useRemoteAnnotations) {
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

  async function persistDeleteAnnotation(id) {
    if (useRemoteAnnotations) {
      try {
        await deleteRemoteDayAnnotation(id)
        setAnnotations((prev) => prev.filter((a) => a.id !== id))
        return
      } catch {
        setRemoteAnnotationsOk(false)
      }
    }
    setAnnotations(deleteDayAnnotation(id))
  }

  async function saveAnnotation() {
    if (!selectedDay || !reasonDraft || saving) return
    setSaving(true)
    const existing = annotationForDate(annotations, selectedDay.date.getTime())
    const entry = existing
      ? { ...existing, reason: reasonDraft, note: noteDraft.trim().slice(0, 300) }
      : makeDayAnnotation(reasonDraft, noteDraft, noonOf(selectedDay.date.getTime()))
    await persistAnnotation(entry)
    setSaving(false)
  }

  async function clearAnnotation() {
    if (!selectedDay || saving) return
    const existing = annotationForDate(annotations, selectedDay.date.getTime())
    if (!existing) return
    setSaving(true)
    await persistDeleteAnnotation(existing.id)
    setSaving(false)
  }

  // Same edit/delete pattern the dashboard's calendar day panel uses.
  function editDaySession(session) {
    navigate('/log', { state: { editSessionId: session.id } })
  }

  async function deleteDaySession(session) {
    if (user) {
      try {
        await deleteRemoteSession(session.id)
      } catch {
        return
      }
      setSessions((prev) => prev.filter((s) => s.id !== session.id))
    } else {
      setSessions(deleteSession(session.id))
    }
    setSelectedDay((prev) => (prev ? { ...prev, sessions: prev.sessions.filter((s) => s.id !== session.id) } : prev))
  }

  const now = Date.now()
  const summary = useMemo(
    () => daySummary(sessions, annotations, { start: now - rangeDays * 86400000, end: now, now }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessions, annotations, rangeDays]
  )
  const breakInfo = useMemo(() => currentBreak(sessions, annotations, { now }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessions, annotations])

  const selectedAnnotation = selectedDay ? annotationForDate(annotations, selectedDay.date.getTime()) : null
  const selectedPlanned = selectedDay && selectedDay.sessions.length === 0 ? plannedDayForDate(program, selectedDay.date.getTime()) : null

  if (loading) {
    return (
      <div className="pt-28 pb-24 px-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-[13px] text-text-muted">Loading…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-28 pb-24 px-6">
      <div className="max-w-3xl mx-auto">
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary no-underline text-[13px] mb-6 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to dashboard
        </Link>

        {breakInfo && (
          <div className="mb-6 bg-amber-50 border border-amber-300 dark:bg-amber-500/10 dark:border-amber-500/30 px-4 py-3 flex items-center gap-2.5">
            <BatteryCharging className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
            <p className="text-[13px] text-amber-700 dark:text-amber-400">
              {breakInfo.days} day{breakInfo.days !== 1 ? 's' : ''} off ({breakInfo.reasons.map(reasonLabel).join(', ').toLowerCase()}) — ease back in when you're ready.
            </p>
          </div>
        )}

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_280px]">
          <Card>
            <SectionHeading icon={CalendarDays}>Calendar</SectionHeading>
            <WorkoutCalendar
              sessions={sessions}
              program={program}
              annotations={annotations}
              selectedDate={selectedDay?.date}
              onSelectDay={(date, daySessions) => setSelectedDay({ date, sessions: daySessions })}
              size="lg"
            />

            {/* legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-5 pt-4 border-t border-border">
              {DAY_REASONS.map((r) => (
                <span key={r.id} className="inline-flex items-center gap-1.5 text-[11px] text-text-muted">
                  <span
                    className={`w-1.5 h-1.5 ${
                      { sick: 'bg-amber-400', injury: 'bg-rose-600', travel: 'bg-sky-400', rest: 'bg-slate-400', other: 'bg-stone-400' }[r.id]
                    }`}
                  />
                  {r.label}
                </span>
              ))}
            </div>

            {selectedDay && (
              <div className="mt-5 pt-5 border-t border-border">
                <p className="text-[13px] font-medium text-text-primary mb-3">{fullDate(selectedDay.date)}</p>

                {/* logged workout(s) */}
                {selectedDay.sessions.length === 0 ? (
                  <div className="mb-4">
                    {selectedPlanned && selectedPlanned.kind === 'train' ? (
                      <div>
                        <p className="text-[12px] text-text-muted">
                          Planned: <span className="font-medium text-text-primary">{selectedPlanned.name}</span>
                        </p>
                        {selectedPlanned.exercises.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {selectedPlanned.exercises.map((pe) => (
                              <span key={pe.id} className="text-[11px] text-text-muted bg-cream border border-border px-2 py-0.5">
                                {pe.name} · {pe.sets}×
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : selectedPlanned && selectedPlanned.kind === 'rest' ? (
                      <p className="text-[12px] text-text-muted">Rest day in your schedule.</p>
                    ) : (
                      <p className="text-[12px] text-text-muted">No workout logged this day.</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2.5 mb-4">
                    {selectedDay.sessions.map((s) => (
                      <div key={s.id} className="bg-cream border border-border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[12px] font-medium text-text-primary break-words">{s.name || 'Workout'}</p>
                            <p className="text-[11px] text-text-muted mt-0.5">
                              {s.exercises.length} exercise{s.exercises.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => editDaySession(s)}
                              aria-label={`Edit ${s.name || 'workout'}`}
                              title="Edit this workout"
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-cream bg-text-primary px-2.5 py-1 border-none cursor-pointer hover:bg-accent-hover transition-colors"
                            >
                              <Pencil className="w-3 h-3" /> Edit
                            </button>
                            <button
                              onClick={() => deleteDaySession(s)}
                              aria-label={`Delete ${s.name || 'workout'}`}
                              title="Delete this workout"
                              className="text-text-light hover:text-red-600 bg-transparent border-none cursor-pointer p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        {s.exercises.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {s.exercises.map((ex) => (
                              <span key={ex.id} className="text-[11px] text-text-muted bg-white border border-border px-2 py-0.5">
                                {ex.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* annotation editor — independent of the workout(s) above */}
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-text-light mb-2">Day note</p>
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {DAY_REASONS.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setReasonDraft(reasonDraft === r.id ? null : r.id)}
                        aria-pressed={reasonDraft === r.id}
                        className={`px-2.5 py-1 text-[11px] font-medium border cursor-pointer transition-colors ${
                          reasonDraft === r.id
                            ? 'bg-text-primary text-cream border-text-primary'
                            : 'bg-white text-text-muted border-border hover:border-border-hover'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                  {reasonDraft && (
                    <textarea
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      placeholder="Note (optional) — what happened, how you're feeling, anything worth remembering…"
                      rows={2}
                      className="w-full bg-cream border border-border px-2.5 py-2 text-text-primary text-[12px] outline-none focus:border-text-primary transition-colors resize-none mb-2.5"
                    />
                  )}
                  <div className="flex gap-1.5">
                    <button
                      onClick={saveAnnotation}
                      disabled={!reasonDraft || saving}
                      className="text-[11px] font-medium text-cream bg-text-primary px-3 py-1.5 border-none cursor-pointer hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Save
                    </button>
                    {selectedAnnotation && (
                      <button
                        onClick={clearAnnotation}
                        disabled={saving}
                        className="inline-flex items-center gap-1 text-[11px] text-text-light hover:text-red-600 bg-transparent border-none cursor-pointer px-2 py-1.5 disabled:opacity-40"
                      >
                        <X className="w-3 h-3" /> Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* summary */}
          <Card className="h-max">
            <SectionHeading>Summary</SectionHeading>
            <div className="flex border border-border w-max mb-4">
              {SUMMARY_RANGES.map((r) => (
                <button
                  key={r.days}
                  onClick={() => setRangeDays(r.days)}
                  className={`px-2.5 py-1.5 text-[11px] font-medium cursor-pointer transition-colors ${
                    rangeDays === r.days ? 'bg-text-primary text-cream' : 'bg-white text-text-muted hover:text-text-primary'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <MiniStat label="Trained" value={summary.trained} />
              <MiniStat label="Off" value={summary.off} />
            </div>
            {summary.off > 0 && (
              <div className="space-y-1.5 mb-4">
                {Object.entries(summary.byReason).map(([reason, count]) => (
                  <div key={reason} className="flex justify-between text-[12px]">
                    <span className="text-text-secondary">{reasonLabel(reason)}</span>
                    <span className="text-text-muted">{count} day{count !== 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-text-light">
              {summary.untouched} of {summary.totalDays} day{summary.totalDays !== 1 ? 's' : ''} untouched — no workout logged and no note.
            </p>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
