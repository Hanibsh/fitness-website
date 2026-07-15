import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { getHistory, getUnit } from '../lib/workoutStore'
import { fetchRemoteHistory } from '../lib/workoutRemote'
import { exerciseSummary, recentExerciseSessions, convertWeight } from '../lib/workoutStats'
import ExerciseProgress from './ExerciseProgress'

// "Your performance" section for the exercise detail page: the user's own
// lifetime stats, progress chart and recent sessions for one DB exercise.
// Matching runs by exercise id (alias-resolved) with name fallback, so renamed
// exercises and old logs still attach. Reads remote history when logged in,
// local history otherwise — the same pattern as the dashboard.

const fmtDate = (ts) =>
  new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

// Weights round to one decimal so lbs conversions stay readable.
const fmtW = (v) => (Math.round(v * 10) / 10).toLocaleString()

// One logged set → a compact label ("80×8", "L 20×10 / R 18×10", "12 reps").
function setLabel(s, kind, conv) {
  if (kind === 'cardio') {
    return Number(s.duration) > 0 ? `${s.duration} min` : null
  }
  if (s.left) {
    const side = (x) => (x && Number(x.reps) > 0 ? `${conv(x.weight)}×${x.reps}` : null)
    const L = side(s.left)
    const R = side(s.right)
    if (!L && !R) return null
    return `L ${L || '—'} / R ${R || '—'}`
  }
  const reps = Number(s.reps)
  if (!(reps > 0)) return null
  return Number(s.weight) > 0 ? `${conv(s.weight)}×${reps}` : `${reps} reps`
}

// One logged exercise entry → its working sets as a single line.
function entryLine(entry, sessionUnit, displayUnit) {
  const conv = (w) => fmtW(convertWeight(Number(w) || 0, sessionUnit, displayUnit))
  const parts = entry.sets
    .filter((s) => s.type !== 'warmup')
    .map((s) => setLabel(s, entry.kind, conv))
    .filter(Boolean)
  if (!parts.length) return null
  const showUnit = entry.kind !== 'cardio' && parts.some((p) => p.includes('×'))
  return parts.join(', ') + (showUnit ? ` ${displayUnit}` : '')
}

export default function ExercisePerformance({ exercise }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [sessions, setSessions] = useState(null) // null = still loading
  const unit = getUnit()

  useEffect(() => {
    let cancelled = false
    async function load() {
      let hist
      if (user) {
        try {
          hist = await fetchRemoteHistory(user.id)
        } catch {
          hist = getHistory()
        }
      } else {
        hist = getHistory()
      }
      if (!cancelled) setSessions(hist)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [user])

  const target = useMemo(() => ({ id: exercise.id, name: exercise.name }), [exercise])
  const summary = useMemo(
    () => (sessions ? exerciseSummary(sessions, target, unit) : null),
    [sessions, target, unit]
  )
  const recent = useMemo(
    () => (sessions ? recentExerciseSessions(sessions, target, 4) : []),
    [sessions, target]
  )

  if (!sessions) return null

  const heading = (
    <h2 className="font-heading text-base font-medium text-text-primary mt-10 mb-3">Your performance</h2>
  )

  if (!summary) {
    return (
      <section>
        {heading}
        <div className="border border-dashed border-border rounded-xl px-6 py-8 text-center">
          <p className="text-[13px] text-text-muted">You haven't logged this exercise yet.</p>
          <button
            onClick={() => navigate('/log', { state: { addExerciseId: exercise.id, addExerciseName: exercise.name } })}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-primary bg-transparent border-none cursor-pointer mt-2 hover:text-accent-hover"
          >
            <Plus className="w-4 h-4" /> Log it once and your stats appear here
          </button>
        </div>
      </section>
    )
  }

  const tiles = [
    ['Best weight', summary.bestWeight != null ? `${fmtW(summary.bestWeight)} ${unit}` : '—'],
    ['Est. 1RM', summary.bestE1rm != null ? `${Math.round(summary.bestE1rm)} ${unit}` : '—'],
    ['Best reps', summary.bestReps ?? '—'],
    ['Lifetime volume', `${Math.round(summary.lifetimeVolume).toLocaleString()} ${unit}`],
    ['Times performed', summary.timesPerformed],
    ['Last done', fmtDate(summary.lastDate)],
  ]

  return (
    <section>
      {heading}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {tiles.map(([label, val]) => (
          <div key={label} className="bg-white border border-border rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wide text-text-light">{label}</p>
            <p className="text-[15px] font-medium text-text-primary mt-0.5">{val}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-border rounded-xl p-5 mt-6">
        <ExerciseProgress
          exerciseName={exercise.name}
          exerciseId={exercise.id}
          sessions={sessions}
          unit={unit}
          compact
        />
      </div>

      {recent.length > 0 && (
        <>
          <p className="text-text-secondary text-[13px] font-medium mt-6 mb-2">Recent sessions</p>
          <div className="space-y-2">
            {recent.map((s) => {
              const lines = s.entries
                .map((entry) => entryLine(entry, s.unit, unit))
                .filter(Boolean)
              return (
                <div key={s.id} className="bg-white border border-border rounded-lg px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[12px] text-text-muted">{fmtDate(s.date)}</span>
                    {s.name && <span className="text-[12px] text-text-light truncate">{s.name}</span>}
                  </div>
                  {lines.map((line) => (
                    <p key={line} className="text-[13px] text-text-primary mt-1 break-words">{line}</p>
                  ))}
                </div>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}
