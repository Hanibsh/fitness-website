import { Link, useOutletContext, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Chat from '../components/Chat'
import { linkForCard } from '../lib/coach'
import { DEV_COACH_ID } from '../lib/messages'

// The coach's chat with one linked client — /coach/:clientId/messages.
export default function ClientMessages() {
  const { clientId } = useParams()
  const { user, clients, links } = useOutletContext()
  const client = clients.find((c) => c.id === clientId) || null
  const { state, link } = linkForCard(links, clientId)
  const name = client?.name || 'Client'
  // Signed out, only the dev sample gets here (CoachLayout's gate).
  const coachId = user?.id || DEV_COACH_ID

  return (
    <>
      <Link
        to={client ? `/coach/${client.id}` : '/coach'}
        className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary no-underline text-[13px] mb-6 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> {client ? `Back to ${name}` : 'All clients'}
      </Link>
      <h1 className="font-heading text-3xl font-medium text-text-primary mb-2 break-words">{name}</h1>
      {state === 'linked' ? (
        // -mb-24 cancels the coach frame's bottom padding, so the composer
        // sits on the bottom edge rather than floating above a gap.
        <div className="-mb-24">
          <Chat coachId={coachId} clientId={link.client_id} meId={coachId} otherName={name} />
        </div>
      ) : (
        <p className="text-[13px] text-text-muted">
          {client ? `Link ${name}’s account to message them.` : 'That client couldn’t be found.'}
        </p>
      )}
    </>
  )
}
