import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, BarChart3, BatteryCharging, TrendingUp, Bandage, ChevronRight, History, MessageCircle } from 'lucide-react'
import Card from '../components/Card'
import SectionHeading from '../components/SectionHeading'
import BodyweightTracker from '../components/BodyweightTracker'
import ExerciseSelect from '../components/ExerciseSelect'
import ExerciseProgress from '../components/ExerciseProgress'
import WorkoutCalendar from '../components/WorkoutCalendar'
import SessionSummary from '../components/SessionSummary'
import ClientTrainingSummary from '../components/ClientTrainingSummary'
import CoachComments from '../components/CoachComments'
import {
  AdherenceCard, StalledLiftsCard, StrengthLevelCard, EffortCard, TrainingTimeCard,
} from '../components/DashboardInsightCards'
import { useLinkedClient } from '../lib/useClientData'
import { useClientNotes } from '../lib/useCoachNotes'
import { effectiveWeeklyVolume, muscleRecovery, formatReadyIn } from '../lib/engine'
import { loggedExerciseNames, convertWeight } from '../lib/workoutStats'
import { sessionStats } from '../lib/workoutStore'
import { annotationForDate } from '../lib/dayLog'
import { openInjuries, injuryTitle, injuryDuration, INJURY_STATUSES } from '../lib/injuries'

// A linked client's training, read-only: the overview (how they're doing) and
// their full log. Reached from their page (ClientDetail → Their training).
export default function ClientTraining() {
  const { clientId } = useParams()
  const { clients } = useOutletContext()
  const client = clients.find((c) => c.id === clientId) || null
  const { linked, link, data, loading } = useLinkedClient(clientId)
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'log' ? 'log' : 'overview'
  const name = client?.name || 'Client'

  const back = (
    <Link
      to={client ? `/coach/${client.id}` : '/coach'}
      className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary no-underline text-[13px] mb-10 transition-colors"
    >
      <ArrowLeft className="w-3.5 h-3.5" /> {client ? `Back to ${name}` : 'All clients'}
    </Link>
  )

  if (!client || !linked) {
    return (
      <>
        {back}
        <p className="text-[13px] text-text-muted">
          {client ? `${name}'s account isn’t linked.` : 'That client couldn’t be found.'}
        </p>
      </>
    )
  }

  const tabBtn = (id, label) => (
    <button
      onClick={() => setParams(id === 'log' ? { tab: 'log' } : {}, { replace: true })}
      aria-pressed={tab === id}
      className={`flex-1 px-4 py-2 text-[13px] font-medium border-none cursor-pointer transition-colors ${
        tab === id ? 'bg-text-primary text-cream' : 'bg-white text-text-muted hover:text-text-primary'
      }`}
    >
      {label}
    </button>
  )

  return (
    <>
      {back}
      <h1 className="font-heading text-3xl sm:text-4xl font-medium text-text-primary mb-6 break-words">{name}’s training</h1>
      <div className="flex border border-border mb-6 max-w-xs">
        {tabBtn('overview', 'Overview')}
        {tabBtn('log', 'Log')}
      </div>
      {loading || !data ? (
        <p className="text-[13px] text-text-muted">Loading…</p>
      ) : tab === 'log' ? (
        <ClientLog data={data} clientUserId={link.client_id} />
      ) : (
        <Overview clientId={client.id} data={data} />
      )}
    </>
  )
}

function useUnit(data) {
  return data?.profile?.unit === 'lbs' ? 'lbs' : 'kg'
}

// ---- Overview --------------------------------------------------------------------

function Overview({ clientId, data }) {
  const now = useMemo(() => Date.now(), [])
  const unit = useUnit(data)
  const { sessions, annotations, program, injuries, bodyweight, profile } = data

  // Their bodyweight for the strength card: the profile's, else the latest weigh-in.
  const bodyweightKg = useMemo(() => {
    if (Number(profile?.bodyweight) > 0) return convertWeight(Number(profile.bodyweight), profile.unit === 'lbs' ? 'lbs' : 'kg', 'kg')
    const latest = [...bodyweight].sort((a, b) => b.date - a.date)[0]
    return latest ? convertWeight(Number(latest.weight), latest.unit || 'kg', 'kg') : null
  }, [profile, bodyweight])

  return (
    <div className="space-y-4">
      <ClientTrainingSummary clientId={clientId} data={data} loading={false} hideOpen />
      <BodyweightTracker entries={bodyweight} unit={unit} />
      {program && <AdherenceCard sessions={sessions} annotations={annotations} program={program} now={now} />}
      <LiftProgress sessions={sessions} unit={unit} />
      <StalledLiftsCard sessions={sessions} unit={unit} now={now} />
      <MuscleVolume sessions={sessions} now={now} />
      <Recovery sessions={sessions} now={now} />
      <EffortCard sessions={sessions} now={now} />
      {profile?.sex && bodyweightKg && (
        <StrengthLevelCard sessions={sessions} sex={profile.sex} bodyweightKg={bodyweightKg} unit={unit} now={now} signedIn />
      )}
      <Injuries injuries={injuries} now={now} />
      <TrainingTimeCard sessions={sessions} now={now} />
    </div>
  )
}

function LiftProgress({ sessions, unit }) {
  const names = useMemo(() => loggedExerciseNames(sessions), [sessions])
  const [selected, setSelected] = useState('')
  useEffect(() => {
    if (names.length && !names.includes(selected)) setSelected(names[0])
  }, [names, selected])
  const kind = useMemo(() => {
    for (const s of [...sessions].sort((a, b) => b.date - a.date)) {
      const ex = s.exercises.find((e) => e.name.trim().toLowerCase() === selected.trim().toLowerCase())
      if (ex) return ex.kind === 'cardio' ? 'cardio' : 'strength'
    }
    return 'strength'
  }, [sessions, selected])
  return (
    <Card>
      <SectionHeading icon={TrendingUp}>Exercise progress</SectionHeading>
      {names.length === 0 ? (
        <p className="text-[13px] text-text-muted">Nothing logged yet.</p>
      ) : (
        <>
          <ExerciseSelect value={selected} options={names} onChange={setSelected} className="w-full sm:w-80 mb-2" />
          {selected && (
            <div className="-mx-1">
              <ExerciseProgress exerciseName={selected} kind={kind} sessions={sessions} unit={unit} />
            </div>
          )}
        </>
      )}
    </Card>
  )
}

// Same tiers and colours as the dashboard's Muscle volume card, last 7 days only.
const TIER_BAR = { under: 'bg-amber-400', prime: 'bg-green-500', solid: 'bg-green-500', taxing: 'bg-amber-400', excess: 'bg-red-500' }

function MuscleVolume({ sessions, now }) {
  const volume = useMemo(() => effectiveWeeklyVolume(sessions, { days: 7, now }), [sessions, now])
  return (
    <Card>
      <SectionHeading icon={BarChart3}>Muscle volume · 7 days</SectionHeading>
      {volume.every((v) => v.sets === 0) ? (
        <p className="text-[13px] text-text-muted">No sets in the last 7 days.</p>
      ) : (
        <div className="space-y-2">
          {volume.map((v) => (
            <div key={v.muscle}>
              <div className="flex justify-between items-center gap-2 text-[12px] mb-1">
                <span className="text-text-secondary">{v.muscle}</span>
                <span className="text-text-muted tabular-nums">
                  {v.sets}
                  <span className="text-text-light"> sets · {v.tier?.label}</span>
                </span>
              </div>
              <div className="w-full h-2 bg-cream border border-border overflow-hidden">
                <div className={`h-full ${TIER_BAR[v.status] || 'bg-amber-400'}`} style={{ width: `${Math.min(100, Math.round((v.sets / v.landmarks.high) * 100))}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function Recovery({ sessions, now }) {
  const recovery = useMemo(() => muscleRecovery(sessions, { now }), [sessions, now])
  const recovering = recovery.muscles.filter((m) => m.lastTrained && m.status !== 'ready').sort((a, b) => a.recoveryPct - b.recoveryPct)
  return (
    <Card>
      <SectionHeading icon={BatteryCharging}>Recovery</SectionHeading>
      {recovering.length === 0 ? (
        <p className="text-[13px] text-text-muted">Every muscle is ready.</p>
      ) : (
        <div className="space-y-2">
          {recovering.map((m) => (
            <div key={m.muscle}>
              <div className="flex justify-between items-center gap-2 text-[12px] mb-1">
                <span className="text-text-secondary">{m.muscle}</span>
                <span className="text-text-muted tabular-nums">
                  {m.recoveryPct}%{m.readyAt && <span className="text-text-light"> · ready {formatReadyIn(m.readyAt, now)}</span>}
                </span>
              </div>
              <div className="w-full h-2 bg-cream border border-border overflow-hidden">
                <div className="h-full bg-amber-400" style={{ width: `${m.recoveryPct}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function Injuries({ injuries, now }) {
  const open = useMemo(() => openInjuries(injuries), [injuries])
  return (
    <Card>
      <SectionHeading icon={Bandage}>Injuries</SectionHeading>
      {open.length === 0 ? (
        <p className="text-[13px] text-text-muted">No open injuries.</p>
      ) : (
        <div className="divide-y divide-border">
          {open.map((i) => {
            const checks = [...(i.checkins || [])].sort((a, b) => a.date - b.date)
            const last = checks[checks.length - 1]?.pain
            const status = INJURY_STATUSES.find((s) => s.id === i.status)?.label
            return (
              <div key={i.id} className="py-2.5">
                <p className="text-[13px] font-medium text-text-primary break-words">{injuryTitle(i)}</p>
                <p className="text-[11px] text-text-muted">
                  {[status, `day ${injuryDuration(i, now)}`, last != null ? `pain ${last}/10` : null].filter(Boolean).join(' · ')}
                </p>
                {i.note && <p className="text-[12px] text-text-secondary mt-1 break-words">{i.note}</p>}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// ---- Log ---------------------------------------------------------------------------

const PAGE = 15

function ClientLog({ data, clientUserId }) {
  const unit = useUnit(data)
  const { sessions, annotations, program, injuries } = data
  const [open, setOpen] = useState(null) // session
  // Your comments on their sessions — they see them on their dashboard.
  const { notes, addNote, removeNote } = useClientNotes(clientUserId)
  const commentsOn = (id) => notes.filter((n) => n.kind === 'session' && n.target_id === id)
  const commented = useMemo(() => new Set(notes.filter((n) => n.kind === 'session').map((n) => n.target_id)), [notes])
  const [shown, setShown] = useState(PAGE)
  const sorted = useMemo(() => [...sessions].sort((a, b) => b.date - a.date), [sessions])
  const fmt = (ts) => new Date(ts).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="space-y-4">
      <Card>
        <WorkoutCalendar
          sessions={sessions}
          program={program}
          annotations={annotations}
          injuries={injuries}
          onSelectDay={(date, daySessions) => daySessions?.[0] && setOpen(daySessions[0])}
        />
      </Card>
      <Card>
        <SectionHeading icon={History}>Sessions</SectionHeading>
        {sorted.length === 0 ? (
          <p className="text-[13px] text-text-muted">Nothing logged yet.</p>
        ) : (
          <>
            <div className="divide-y divide-border">
              {sorted.slice(0, shown).map((s) => {
                const st = sessionStats(s)
                return (
                  <button
                    key={s.id}
                    onClick={() => setOpen(s)}
                    className="w-full flex items-center justify-between gap-3 py-3 bg-transparent border-none cursor-pointer text-left group"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-text-primary break-words group-hover:underline">{s.name || 'Workout'}</p>
                      <p className="text-[11px] text-text-muted">
                        {fmt(s.date)} · {st.exercises} exercise{st.exercises === 1 ? '' : 's'} · {st.sets} set{st.sets === 1 ? '' : 's'}
                        {commented.has(s.id) && <span className="inline-flex items-center gap-1 ml-1.5 align-middle"><MessageCircle className="w-3 h-3" /></span>}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-text-light shrink-0" />
                  </button>
                )
              })}
            </div>
            {shown < sorted.length && (
              <button
                onClick={() => setShown((n) => n + PAGE)}
                className="mt-3 text-[13px] font-medium text-text-muted hover:text-text-primary bg-transparent border-none cursor-pointer p-0 transition-colors"
              >
                Show more
              </button>
            )}
          </>
        )}
      </Card>
      {open && (
        <SessionSummary
          session={open}
          history={sessions}
          unit={unit}
          annotation={annotationForDate(annotations, open.date)}
          onClose={() => setOpen(null)}
          actions={
            <div className="w-full">
              <CoachComments
                notes={commentsOn(open.id)}
                onAdd={(body) => addNote({ kind: 'session', targetId: open.id, body })}
                onRemove={removeNote}
                placeholder="Comment on this workout"
              />
            </div>
          }
        />
      )}
    </div>
  )
}
