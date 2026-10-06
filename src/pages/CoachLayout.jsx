import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { useClientsState, useCoachAccess } from '../lib/useClientsState'
import { useCoachLinks, useSentPrograms } from '../lib/useCoachLinks'
import { joinedCards } from '../lib/coach'
import { useCoachUnread } from '../lib/useChat'
import { DEV_COACH_ID } from '../lib/messages'

// The coach area's shell: the gate, the page frame, and the client list every
// page under /coach shares.
//
// Only the coach's own account gets in (profiles.is_coach); anyone else lands
// on the home page as if the URL didn't exist — there's no link to it from
// anywhere they can see, either. The list is loaded ONCE here and handed down,
// so moving between a client, their program and a day doesn't refetch it.
export default function CoachLayout() {
  const { checking, isCoach } = useCoachAccess()
  if (checking) {
    return (
      <Frame>
        <p className="text-[13px] text-text-muted">Loading…</p>
      </Frame>
    )
  }
  if (!isCoach) return <Navigate to="/" replace />
  return <CoachArea />
}

// Split out so the client list is only ever fetched for the coach.
function CoachArea() {
  const clientsState = useClientsState()
  const linksState = useCoachLinks(clientsState.user, clientsState.clients, !clientsState.loading)
  const sentState = useSentPrograms(clientsState.user, !clientsState.loading)
  // Unread messages per client account ({ clientUserId: n }), for the list,
  // the inbox and each client's page. Signed out, only the dev sample is here.
  const { pathname } = useLocation()
  const unread = useCoachUnread(clientsState.user?.id || DEV_COACH_ID, !clientsState.loading, pathname)
  const state = { ...clientsState, ...linksState, ...sentState, unread }

  // Someone accepted the join link since the list last loaded: give them a card.
  const { links, clients, loading, addClient } = state
  useEffect(() => {
    if (loading) return
    const fresh = joinedCards(links, clients)
    if (fresh.length) addClient(fresh)
  }, [links, clients, loading, addClient])

  // No ScrollRestoration in this app — without this, opening a client from
  // halfway down the list lands halfway down their page.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <Frame>
      {/* Level with every page's back link. The installed app also has pull
          to refresh (PullToRefresh); this is for a computer. */}
      <button
        onClick={() => window.location.reload()}
        aria-label="Refresh"
        title="Refresh"
        className="absolute right-0 top-0 inline-flex items-center gap-1.5 text-[13px] text-text-muted hover:text-text-primary bg-transparent border-none cursor-pointer p-0 transition-colors"
      >
        <RefreshCw className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Refresh</span>
      </button>
      {state.loading ? <p className="text-[13px] text-text-muted">Loading…</p> : <Outlet context={state} />}
    </Frame>
  )
}

function Frame({ children }) {
  return (
    <div className="pt-28 pb-24 px-6">
      <div className="max-w-2xl mx-auto relative">{children}</div>
    </div>
  )
}
