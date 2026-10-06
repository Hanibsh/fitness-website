import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Chat from '../components/Chat'
import { useAuth } from '../lib/auth'
import { useMyCoach } from '../lib/useMyCoach'
import { useProgramsState } from '../lib/useProgramsState'
import { DEV_CLIENT_ID } from '../lib/messages'
import { copyOfSharedSplit } from '../lib/chatCards'
import { getHistory, getUnit } from '../lib/workoutStore'
import { fetchRemoteHistory } from '../lib/workoutRemote'

// A coached client's chat with their coach — /messages. Your splits and
// workouts are there to share; a split the coach shares can be kept as a copy.
export default function Messages() {
  const { user } = useAuth()
  const { coach, coachLoading } = useMyCoach()
  const { programsState, addRoutine } = useProgramsState()
  const [history, setHistory] = useState([])
  // Signed out, only the dev client sample has a coach.
  const me = user?.id || DEV_CLIENT_ID
  const name = coach?.coach_name || 'Leon'

  useEffect(() => {
    let cancelled = false
    const load = user ? fetchRemoteHistory(user.id).catch(() => getHistory()) : Promise.resolve(getHistory())
    load.then((rows) => { if (!cancelled) setHistory(rows || []) })
    return () => { cancelled = true }
  }, [user])

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
        <h1 className="font-heading text-3xl font-medium text-text-primary mb-2">{name}</h1>
        {coachLoading ? (
          <p className="text-[13px] text-text-muted">Loading…</p>
        ) : coach?.coach_id ? (
          <Chat
            coachId={coach.coach_id}
            clientId={me}
            meId={me}
            otherName={name}
            splits={programsState.programs}
            sessions={{ list: history, unit: getUnit() }}
            saveSplit={saveSplit}
            sentSplitPath={(id) => `/split/${id}`}
          />
        ) : (
          <p className="text-[13px] text-text-muted pb-24">Messages are for coaching clients. Link your account to a coach to chat.</p>
        )}
      </div>
    </div>
  )
}
