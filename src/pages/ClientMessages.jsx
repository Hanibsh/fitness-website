import { Link, useLocation, useOutletContext, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Chat from '../components/Chat'
import { linkForCard } from '../lib/coach'
import { withProgram } from '../lib/clients'
import { DEV_COACH_ID } from '../lib/messages'
import { copyOfSharedSplit } from '../lib/chatCards'
import { useLinkedClient } from '../lib/useClientData'
import { useClientCheckins, useClientTargets } from '../lib/useCoachNotes'
import { pickTargets } from '../lib/useDailyTargets'

// The coach's chat with one linked client — /coach/:clientId/messages. The
// programs written for them are there to share; a split they share can be
// kept as one of their programs, to edit and send back. Their name opens
// their progress, split, check-ins and the chat's media.
export default function ClientMessages() {
  const { clientId } = useParams()
  const { user, clients, links, updateClient } = useOutletContext()
  const client = clients.find((c) => c.id === clientId) || null
  const { state, link } = linkForCard(links, clientId)
  const { data, loading } = useLinkedClient(clientId)
  const checkins = useClientCheckins(state === 'linked' ? link.client_id : null)
  const { targets } = useClientTargets(state === 'linked' ? link.client_id : null)
  const name = client?.name || 'Client'
  // Opened from the inbox: back goes to the inbox.
  const fromInbox = !!useLocation().state?.inbox
  // Signed out, only the dev sample gets here (CoachLayout's gate).
  const coachId = user?.id || DEV_COACH_ID

  // Their current split opens in your editor only when it's one you sent.
  const program = data?.program || null
  const yours = program && client?.programs.some((p) => p.id === program.id)
  const about = {
    since: link?.accepted_at || null,
    sinceLabel: 'Client since',
    loading: loading || !data,
    sessions: data?.sessions || [],
    bodyweight: data?.bodyweight || [],
    weekly: data?.weekly || [],
    // The targets you set them; their own profile's aren't yours to see here.
    targets: pickTargets(targets, null),
    annotations: data?.annotations || [],
    unit: data?.profile?.unit === 'lbs' ? 'lbs' : 'kg',
    program,
    splitPath: yours ? `/coach/${client.id}/split/${program.id}` : null,
    checkins,
    checkinsPath: client ? `/coach/${client.id}` : null,
  }

  async function saveSplit(program) {
    const copy = copyOfSharedSplit(program)
    updateClient(client.id, (c) => withProgram(c, copy))
    return `/coach/${client.id}/split/${copy.id}`
  }

  return (
    <>
      <Link
        to={fromInbox ? '/coach/messages' : client ? `/coach/${client.id}` : '/coach'}
        className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary no-underline text-[13px] mb-6 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> {fromInbox ? 'All messages' : client ? `Back to ${name}` : 'All clients'}
      </Link>
      {state === 'linked' ? (
        // -mb-24 cancels the coach frame's bottom padding, so the composer
        // sits on the bottom edge rather than floating above a gap.
        <div className="-mb-24">
          <Chat
            coachId={coachId}
            clientId={link.client_id}
            meId={coachId}
            otherName={name}
            about={about}
            splits={client?.programs || []}
            saveSplit={client ? saveSplit : null}
          />
        </div>
      ) : (
        <>
          <h1 className="font-heading text-3xl font-medium text-text-primary mb-2 break-words">{name}</h1>
          <p className="text-[13px] text-text-muted">
            {client ? `Link ${name}’s account to message them.` : 'That client couldn’t be found.'}
          </p>
        </>
      )}
    </>
  )
}
