import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useClientsState, useCoachAccess } from '../lib/useClientsState'

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
  const state = useClientsState()
  const { pathname } = useLocation()

  // No ScrollRestoration in this app — without this, opening a client from
  // halfway down the list lands halfway down their page.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <Frame>
      {state.loading ? <p className="text-[13px] text-text-muted">Loading…</p> : <Outlet context={state} />}
    </Frame>
  )
}

function Frame({ children }) {
  return (
    <div className="pt-28 pb-24 px-6">
      <div className="max-w-2xl mx-auto">{children}</div>
    </div>
  )
}
