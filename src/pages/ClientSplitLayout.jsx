import { useEffect, useRef } from 'react'
import { Link, Outlet, useOutletContext, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { scheduleMode, syncTwins } from '../lib/program'
import { withProgram, withoutProgram } from '../lib/clients'
import { InjuryScope } from '../lib/useInjuries'
import { useLinkedClient } from '../lib/useClientData'

// One of a client's programs, in the SAME editor as your own splits
// (SplitOverview + SplitDay). This layout is SplitLayout's twin: it hands those
// pages the outlet context they expect, but every write goes into the client's
// record, and `mode: 'client'` turns off what only makes sense for a split you
// follow yourself — Active, Today, Up next, Start session, your shared notes.
//
// Wrapped in an InjuryScope so the swap panels and pickers steer around the
// client (their real injuries once their account is linked), not around you.
export default function ClientSplitLayout() {
  const { clientId, id } = useParams()
  const { user, clients, updateClient, sent, pushProgram, unsend } = useOutletContext()
  const client = clients.find((c) => c.id === clientId) || null
  const program = client?.programs.find((p) => p.id === id) || null
  const { injuries } = useLinkedClient(clientId)

  // Sent to their account: every edit here follows it there. The first render
  // is skipped — opening the editor isn't an edit.
  const seen = useRef(program?.updatedAt)
  useEffect(() => {
    if (!program || program.updatedAt === seen.current) return
    seen.current = program.updatedAt
    if (sent[program.id]) pushProgram(program)
  }, [program, sent, pushProgram])

  if (!client || !program) {
    return (
      <>
        <Link to={client ? `/coach/${client.id}` : '/coach'} className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary no-underline text-[13px] mb-10 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> {client ? `Back to ${client.name}` : 'All clients'}
        </Link>
        <p className="text-[13px] text-text-muted">That program couldn’t be found — it may have been deleted.</p>
      </>
    )
  }

  // Same contract as SplitLayout's update: a lib/program.js mutator. Applied to
  // the client's CURRENT copy of the program, not this render's, so two edits
  // in one tick can't overwrite each other.
  function update(mutator) {
    updateClient(client.id, (c) => {
      const current = c.programs.find((p) => p.id === program.id)
      // Both turns of a day that comes round twice change together (syncTwins).
      return current ? withProgram(c, { ...syncTwins(current, mutator(current)), updatedAt: Date.now() }) : c
    })
  }

  return (
    <InjuryScope.Provider value={injuries}>
      <Outlet
        context={{
          user,
          program,
          update,
          isActive: false,
          setActiveRoutine: () => {},
          deleteRoutine: (programId) => {
            if (sent[programId]) unsend(programId).catch(() => {})
            updateClient(client.id, (c) => withoutProgram(c, programId), { now: true })
          },
          isWeekly: scheduleMode(program) === 'weekly',
          // Nothing is "today" on someone else's plan.
          todayWeekdayIndex: -1,
          pointerIndex: -1,
          highlightIndex: -1,
          mode: 'client',
          client,
          liveOnAccount: !!sent[program.id],
          basePath: `/coach/${client.id}/split/${program.id}`,
          listPath: `/coach/${client.id}`,
          listLabel: `Back to ${client.name || 'client'}`,
        }}
      />
    </InjuryScope.Provider>
  )
}
