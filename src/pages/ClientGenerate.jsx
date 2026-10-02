import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { motion } from 'framer-motion'
import SplitWizard from '../components/SplitWizard'
import { withProgram } from '../lib/clients'
import { InjuryScope, NO_INJURIES } from '../lib/useInjuries'

// The split generator, writing for a client — /coach/:clientId/generate. Same
// wizard as /split/generate; the client's profile seeds it, and the program it
// saves goes into the client's record, not your own splits. Scoped so your
// injuries don't steer someone else's program.
export default function ClientGenerate() {
  const { clientId } = useParams()
  const { clients, updateClient } = useOutletContext()
  const navigate = useNavigate()
  const client = clients.find((c) => c.id === clientId) || null

  if (!client) {
    return (
      <>
        <Link to="/coach" className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary no-underline text-[13px] mb-10 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> All clients
        </Link>
        <p className="text-[13px] text-text-muted">That client couldn’t be found — they may have been deleted.</p>
      </>
    )
  }

  // Saved with the muscles it brings up, back onto their profile — so their
  // next program starts from the same emphasis, as yours does.
  function save(program, { focus }) {
    updateClient(client.id, (c) => withProgram({ ...c, profile: { ...c.profile, focus_muscles: focus } }, program), { now: true })
    // Replace, not push: back from the new program goes to the client, not
    // to a wizard for a program that's already saved.
    navigate(`/coach/${client.id}/split/${program.id}`, { replace: true })
  }

  return (
    <>
      <Link to={`/coach/${client.id}`} className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary no-underline text-[13px] mb-10 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to {client.name || 'client'}
      </Link>
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-heading text-4xl font-medium text-text-primary mb-3 break-words">
          A program for {client.name || 'this client'}
        </h1>
        <p className="text-text-muted text-[15px] mb-10 leading-relaxed">
          Training age, equipment and focus start from their profile. Nothing here reads your own log or injuries.
        </p>
        <InjuryScope.Provider value={NO_INJURIES}>
          <SplitWizard client={client} onCreate={save} />
        </InjuryScope.Provider>
      </motion.div>
    </>
  )
}
