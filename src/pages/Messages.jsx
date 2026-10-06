import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Chat from '../components/Chat'
import { useAuth } from '../lib/auth'
import { useMyCoach } from '../lib/useMyCoach'
import { useProgramsState } from '../lib/useProgramsState'
import { DEV_CLIENT_ID } from '../lib/messages'
import { copyOfSharedSplit } from '../lib/chatCards'
import { useMyCheckins } from '../lib/useCoachNotes'
import { getHistory, getUnit, getBodyweightLog, getDayAnnotations } from '../lib/workoutStore'
import { fetchRemoteHistory, fetchRemoteBodyweight, fetchRemoteDayAnnotations } from '../lib/workoutRemote'

// Signed in, the account's copy; on any failure (or signed out), this device's.
const mine = (user, remote, local) => (user ? remote(user.id).catch(() => local()) : Promise.resolve(local()))

// A coached client's chat with their coach — /messages. Your splits and
// workouts are there to share; a split the coach shares can be kept as a copy.
// Tapping the coach's name shows your own progress, split and check-ins — the
// same panel the coach sees about you.
export default function Messages() {
  const { user } = useAuth()
  const { coach, coachLoading } = useMyCoach()
  const { programsState, addRoutine } = useProgramsState()
  const { checkins } = useMyCheckins(coach?.coach_id || null)
  const [mineData, setMineData] = useState(null) // { sessions, bodyweight, annotations }
  // Signed out, only the dev client sample has a coach.
  const me = user?.id || DEV_CLIENT_ID
  const name = coach?.coach_name || 'Leon'
  const history = mineData?.sessions || []

  useEffect(() => {
    let cancelled = false
    Promise.all([
      mine(user, fetchRemoteHistory, getHistory),
      mine(user, fetchRemoteBodyweight, getBodyweightLog),
      mine(user, fetchRemoteDayAnnotations, getDayAnnotations),
    ]).then(([sessions, bodyweight, annotations]) => {
      if (!cancelled) setMineData({ sessions: sessions || [], bodyweight: bodyweight || [], annotations: annotations || [] })
    })
    return () => { cancelled = true }
  }, [user])

  const active = programsState.programs.find((p) => p.id === programsState.activeId) || null
  const about = {
    since: coach?.since || null,
    sinceLabel: 'Your coach since',
    loading: !mineData,
    sessions: history,
    bodyweight: mineData?.bodyweight || [],
    annotations: mineData?.annotations || [],
    unit: getUnit(),
    program: active,
    splitPath: active ? `/split/${active.id}` : null,
    checkins,
  }

  async function saveSplit(program) {
    const copy = copyOfSharedSplit(program)
    addRoutine(copy)
    return `/split/${copy.id}`
  }

  return (
    <div className="pt-24 px-6">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary no-underline text-[13px] mb-6 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
        </Link>
        {coachLoading ? (
          <>
            <h1 className="font-heading text-3xl font-medium text-text-primary mb-2">{name}</h1>
            <p className="text-[13px] text-text-muted">Loading…</p>
          </>
        ) : coach?.coach_id ? (
          <Chat
            coachId={coach.coach_id}
            clientId={me}
            meId={me}
            otherName={name}
            about={about}
            splits={programsState.programs}
            sessions={{ list: history, unit: getUnit() }}
            saveSplit={saveSplit}
            sentSplitPath={(id) => `/split/${id}`}
          />
        ) : (
          <>
            <h1 className="font-heading text-3xl font-medium text-text-primary mb-2">{name}</h1>
            <p className="text-[13px] text-text-muted pb-24">Messages are for coaching clients. Link your account to a coach to chat.</p>
          </>
        )}
      </div>
    </div>
  )
}
