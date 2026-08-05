import { useMemo } from 'react'
import { Trophy, Timer, Dumbbell, Lightbulb, LineChart } from 'lucide-react'
import Modal from './Modal'
import {
  sessionAvgRest, formatRest, setSummary, distanceUnit, setHasWork,
  sessionPRs, PR_KINDS, supersetLabels,
} from '../lib/workoutStats'
import { sessionStats } from '../lib/workoutStore'
import { formatDuration } from '../lib/dashboard'
import { musclesForExercises } from '../lib/engine'
import { sessionMessage } from '../lib/sessionMessage'
import { reasonLabel } from '../lib/dayLog'

// What a finished workout looked like, in one card.
//
// This replaced an accordion in the history list that had to say everything in
// a single 12px line — exercises, sets, volume, rest — and then hid the sets
// behind a chevron. On a phone that meant the thing you actually want to look
// back at was the thing with the least room.

function clockTime(ts) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function fullDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="font-heading text-xl font-medium text-text-primary tabular-nums">{value}</p>
      <p className="text-[11px] uppercase tracking-wider text-text-light mt-0.5">{label}</p>
    </div>
  )
}

export default function SessionSummary({
  session,
  history = [],
  unit = 'kg',
  annotation = null,
  advice = null,
  onClose,
  onExerciseProgress = null,
  actions = null,
}) {
  const sessionUnit = session.unit || unit
  const stats = sessionStats(session)
  const avgRest = formatRest(sessionAvgRest(session))
  const duration = formatDuration(session.durationMs)
  const groups = supersetLabels(session.exercises.filter((e) => e.kind !== 'cardio'))

  const prs = useMemo(() => sessionPRs(session, history, sessionUnit), [session, history, sessionUnit])

  const muscles = useMemo(() => [...musclesForExercises(session.exercises)], [session])

  // Warm-ups are excluded from `stats.sets`, so they're counted separately
  // rather than silently dropped — they're work you did.
  const warmups = useMemo(() => {
    let n = 0
    for (const ex of session.exercises) {
      for (const s of ex.sets) if (s.type === 'warmup' && setHasWork(s, ex.kind)) n++
    }
    return n
  }, [session])

  const message = useMemo(() => {
    const prior = history
      .filter((s) => s.id !== session.id && s.date < session.date)
      .sort((a, b) => b.date - a.date)
      .map(sessionStats)
    return sessionMessage({ session, stats, priorStats: prior, prs, annotation })
  }, [session, history, stats, prs, annotation])

  return (
    <Modal onClose={onClose} maxWidth="max-w-xl">
      <div className="p-6 sm:p-8">
        {/* ---- Header ---------------------------------------------------- */}
        <p className="text-[12px] uppercase tracking-wider text-text-light">{fullDate(session.date)}</p>
        <h2 className="font-heading text-2xl font-medium text-text-primary mt-1 pr-8">
          {session.name || 'Workout'}
        </h2>
        {annotation && (
          <p className="text-[12px] text-text-muted mt-2">
            Marked as {reasonLabel(annotation.reason).toLowerCase()}
            {annotation.note ? ` — ${annotation.note}` : ''}
          </p>
        )}

        {/* ---- When, and for how long ------------------------------------ */}
        {(session.startedAt || duration) && (
          <div className="flex items-center gap-3 mt-5 bg-cream border border-border px-4 py-3">
            <Timer className="w-4 h-4 text-text-light shrink-0" />
            <div className="min-w-0">
              {session.startedAt && session.endedAt && (
                <p className="text-[13px] text-text-secondary tabular-nums">
                  {clockTime(session.startedAt)} <span className="text-text-light">→</span> {clockTime(session.endedAt)}
                </p>
              )}
              {duration && (
                <p className="font-heading text-[15px] font-medium text-text-primary">{duration}</p>
              )}
            </div>
          </div>
        )}

        {/* ---- The numbers ------------------------------------------------ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <Stat label="Exercises" value={stats.exercises} />
          <Stat label={stats.sets === 1 ? 'Working set' : 'Working sets'} value={stats.sets} />
          {stats.volume > 0 && <Stat label={`Volume (${sessionUnit})`} value={stats.volume.toLocaleString()} />}
          {avgRest && <Stat label="Avg rest" value={avgRest} />}
          {warmups > 0 && <Stat label={warmups === 1 ? 'Warm-up' : 'Warm-ups'} value={warmups} />}
        </div>

        {/* ---- Muscles trained -------------------------------------------- */}
        {muscles.length > 0 && (
          <div className="mt-6">
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-text-light mb-2">Muscles trained</h3>
            {/* Plain chips, deliberately. These are the engine's 20 muscles
                (Front Delts, Lats, Tibialis…) while the --color-muscle-* palette
                covers 11 broader groups, so colouring them would mean inventing
                a mapping into a palette that was tuned for CVD separation at its
                own granularity. Half-coloured chips would be worse than none,
                and the names carry the information on their own. */}
            <div className="flex flex-wrap gap-1.5">
              {muscles.map((m) => (
                <span key={m} className="text-[12px] text-text-secondary bg-cream border border-border px-2 py-1">
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ---- Personal bests --------------------------------------------- */}
        {prs.length > 0 && (
          <div className="mt-6">
            <h3 className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-text-light mb-2">
              <Trophy className="w-3.5 h-3.5" /> {prs.length === 1 ? 'Personal best' : 'Personal bests'}
            </h3>
            <div className="space-y-1.5">
              {prs.map((pr) => (
                <div key={`${pr.name}-${pr.kind}`} className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="text-text-primary min-w-0 truncate">{pr.name}</span>
                  <span className="text-text-muted shrink-0 tabular-nums">
                    {PR_KINDS[pr.kind]}{' '}
                    <span className="text-text-primary font-medium">
                      {pr.value}
                      {pr.kind === 'reps' ? '' : sessionUnit}
                    </span>{' '}
                    <span className="text-text-light">
                      (was {pr.previous}
                      {pr.kind === 'reps' ? '' : sessionUnit})
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---- What you did ----------------------------------------------- */}
        <div className="mt-6">
          <h3 className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-text-light mb-2">
            <Dumbbell className="w-3.5 h-3.5" /> The session
          </h3>
          <div className="space-y-3">
            {session.exercises.map((ex) => {
              const du = distanceUnit(sessionUnit)
              const shown = ex.sets.filter((s) => setHasWork(s, ex.kind))
              const g = groups.get(ex.id)
              const badge = g && g.size > 1 ? g.label : null
              return (
                <div key={ex.id}>
                  <div className="flex items-center gap-2">
                    {badge && (
                      <span className="shrink-0 inline-flex items-center justify-center text-[9px] font-semibold text-cream bg-text-primary px-1.5 py-0.5 tracking-wide">
                        {badge}
                      </span>
                    )}
                    <p className="text-[13px] font-medium text-text-primary min-w-0 break-words">{ex.name}</p>
                    {onExerciseProgress && (
                      <button
                        onClick={() => onExerciseProgress({ name: ex.name, kind: ex.kind })}
                        aria-label={`View ${ex.name} progress`}
                        className="text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer p-0.5 shrink-0"
                      >
                        <LineChart className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {shown.length ? (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {shown.map((s) => (
                        <span key={s.id} className="text-[12px] text-text-secondary bg-cream border border-border px-2 py-0.5 tabular-nums">
                          {setSummary(s, sessionUnit, ex.kind, du)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12px] text-text-light mt-1">Nothing logged</p>
                  )}
                  {ex.note && <p className="text-[12px] text-text-muted mt-1 italic">{ex.note}</p>}
                </div>
              )
            })}
          </div>
        </div>

        {/* ---- A word, only when there's one worth saying ------------------ */}
        {message && (
          <p className="text-[13px] text-text-secondary leading-relaxed mt-6 pt-5 border-t border-border">
            {message}
          </p>
        )}

        {/* ---- The advisor, only on the latest session (see WorkoutTracker) */}
        {advice && (
          <div className="mt-5 bg-cream border border-border p-4">
            <h3 className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-text-light mb-1.5">
              <Lightbulb className="w-3.5 h-3.5" /> Worth a look
            </h3>
            <p className="text-[13px] font-medium text-text-primary">{advice.title}</p>
            <p className="text-[12px] text-text-muted leading-relaxed mt-1">{advice.detail}</p>
          </div>
        )}

        {actions && <div className="mt-6 pt-5 border-t border-border">{actions}</div>}
      </div>
    </Modal>
  )
}
