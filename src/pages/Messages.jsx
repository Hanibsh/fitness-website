import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Chat from '../components/Chat'
import { useAuth } from '../lib/auth'
import { useMyCoach } from '../lib/useMyCoach'
import { DEV_CLIENT_ID } from '../lib/messages'

// A coached client's chat with their coach — /messages.
export default function Messages() {
  const { user } = useAuth()
  const { coach, coachLoading } = useMyCoach()
  // Signed out, only the dev client sample has a coach.
  const me = user?.id || DEV_CLIENT_ID
  const name = coach?.coach_name || 'Leon'

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
          <Chat coachId={coach.coach_id} clientId={me} meId={me} otherName={name} />
        ) : (
          <p className="text-[13px] text-text-muted pb-24">Messages are for coaching clients. Link your account to a coach to chat.</p>
        )}
      </div>
    </div>
  )
}
