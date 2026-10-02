import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { ArrowLeft, Plus, ChevronRight, Users } from 'lucide-react'
import { createClient, CLIENT_NAME_MAX } from '../lib/clients'

// The coach's client list — /coach. Only the coach's account reaches it
// (CoachLayout). Each client is a person with a profile and the programs
// written for them; tapping one opens all of that.
export default function Clients() {
  const { user, clients, addClient } = useOutletContext()
  const navigate = useNavigate()
  const [name, setName] = useState('')

  function add(e) {
    e.preventDefault()
    if (!name.trim()) return
    const client = createClient(name)
    addClient(client)
    setName('')
    navigate(`/coach/${client.id}`)
  }

  const fmt = (ts) => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <>
      <Link to="/log/split" className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary no-underline text-[13px] mb-10 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Your training splits
      </Link>

      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-heading text-4xl font-medium text-text-primary mb-3">Clients</h1>
        <p className="text-text-muted text-[15px] mb-10 leading-relaxed">
          Programs you write for other people — each with their own profile, built by the same generator and
          editor as your splits, and exported with their name on it. Only you can see this page.
        </p>

        <form onSubmit={add} className="bg-white border border-border p-5 sm:p-6 mb-6">
          <label htmlFor="new-client" className="text-[11px] uppercase tracking-wider text-text-light block mb-2">
            New client
          </label>
          <div className="flex gap-2">
            <input
              id="new-client"
              value={name}
              maxLength={CLIENT_NAME_MAX}
              onChange={(e) => setName(e.target.value)}
              placeholder="Their name"
              className="flex-1 min-w-0 bg-cream border border-border px-3 py-2.5 text-text-primary text-[14px] outline-none focus:border-text-primary transition-colors"
            />
            <button
              type="submit"
              disabled={!name.trim()}
              className="shrink-0 inline-flex items-center gap-1.5 bg-text-primary text-cream font-medium px-4 py-2.5 border-none cursor-pointer text-[13px] hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
        </form>

        {clients.length === 0 ? (
          <div className="bg-white border border-border p-7 text-center">
            <Users className="w-5 h-5 text-text-light mx-auto mb-3" />
            <p className="text-[13px] text-text-muted">No clients yet — add someone above to start their program.</p>
          </div>
        ) : (
          <div className="bg-white border border-border divide-y divide-border">
            {clients.map((c) => (
              <Link
                key={c.id}
                to={`/coach/${c.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3.5 no-underline hover:bg-cream transition-colors"
              >
                <div className="min-w-0">
                  <span className="block text-[14px] font-medium text-text-primary break-words">{c.name || 'Unnamed client'}</span>
                  <span className="block text-[11px] text-text-light mt-0.5">
                    {c.programs.length} program{c.programs.length === 1 ? '' : 's'} · updated {fmt(c.updatedAt || c.createdAt)}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-text-light shrink-0" />
              </Link>
            ))}
          </div>
        )}

        <p className="text-[12px] text-text-light mt-8">
          Saved automatically{user ? ' to your account' : ' on this device'}.
        </p>
      </motion.div>
    </>
  )
}
