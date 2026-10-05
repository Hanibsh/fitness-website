import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { ArrowLeft, Plus, ChevronRight, Users, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import StatusChip from '../components/StatusChip'
import JoinLinkCard from '../components/JoinLinkCard'
import { createClient, CLIENT_NAME_MAX, CLIENT_STATUSES, clientStatus } from '../lib/clients'
import { linkForCard, fetchClientSummaries, SUMMARY_DAYS } from '../lib/coach'
import { lastWorkoutLabel, noTrainingFlag, weightTrend } from '../lib/coachStats'
import { useReturnLink } from '../lib/returnPath'

const TREND_ICON = { up: TrendingUp, down: TrendingDown, flat: Minus }
// Active clients first, then paused, then ended; the list's own order within.
const STATUS_ORDER = Object.fromEntries(CLIENT_STATUSES.map((s, i) => [s.id, i]))

// The coach's client list — /coach. Only the coach's account reaches it
// (CoachLayout). Each client is a person with a profile and the programs
// written for them; tapping one opens all of that. A client whose account is
// linked also shows how they're doing at a glance.
export default function Clients() {
  const { user, clients, addClient, links } = useOutletContext()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [summaries, setSummaries] = useState({})

  function add(e) {
    e.preventDefault()
    if (!name.trim()) return
    const client = createClient(name)
    addClient(client)
    setName('')
    navigate(`/coach/${client.id}`)
  }

  // In the top bar on every page, so "back" is wherever you opened it from.
  const back = useReturnLink('coach', { to: '/', label: 'Back to dashboard' })

  const linkedIds = useMemo(() => {
    const map = {}
    for (const c of clients) {
      const { state, link } = linkForCard(links, c.id)
      if (state === 'linked') map[c.id] = link.client_id
    }
    return map
  }, [clients, links])
  const idsKey = Object.values(linkedIds).sort().join(',')

  useEffect(() => {
    if (!idsKey) return
    let cancelled = false
    fetchClientSummaries(user?.id, idsKey.split(','))
      .then((s) => { if (!cancelled) setSummaries(s) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user, idsKey])

  const sorted = useMemo(
    () => clients.map((c, i) => ({ c, i })).sort((a, b) => STATUS_ORDER[clientStatus(a.c)] - STATUS_ORDER[clientStatus(b.c)] || a.i - b.i).map((x) => x.c),
    [clients]
  )

  const fmt = (ts) => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const now = Date.now()

  // The line under a linked client's name: last workout, weight, flags.
  function glance(c) {
    const s = summaries[linkedIds[c.id]]
    if (!s) return null
    const unit = c.profile?.unit === 'lbs' ? 'lbs' : 'kg'
    const trend = weightTrend(s.bodyweight, unit, { now })
    const Trend = trend.dir ? TREND_ICON[trend.dir] : null
    // A paused or finished client not training is the point, not a flag.
    const idle = clientStatus(c) === 'active' ? noTrainingFlag(s.sessions, now) : null
    return (
      <span className="flex items-center gap-x-2 gap-y-1 flex-wrap text-[11px] text-text-light mt-1">
        <span>{lastWorkoutLabel(s.sessions, now) || `Nothing logged in ${SUMMARY_DAYS} days`}</span>
        {trend.latest != null && (
          <span className="inline-flex items-center gap-1">
            · {trend.latest} {unit}
            {Trend && <Trend className="w-3 h-3" />}
          </span>
        )}
        {s.waitingCheckin && <StatusChip tone="dark">New check-in</StatusChip>}
        {idle != null && <StatusChip tone="amber">{idle} days no training</StatusChip>}
      </span>
    )
  }

  return (
    <>
      <Link to={back.to} state={back.state} className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary no-underline text-[13px] mb-10 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> {back.label}
      </Link>

      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-heading text-4xl font-medium text-text-primary mb-3">Clients</h1>
        <p className="text-text-muted text-[15px] mb-10 leading-relaxed">
          Programs you write for other people — each with their own profile, built by the same generator and
          editor as your splits, and exported with their name on it. Only you can see this page.
        </p>

        <JoinLinkCard user={user} />

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
            {sorted.map((c) => {
              const status = clientStatus(c)
              const linked = !!linkedIds[c.id]
              return (
                <Link
                  key={c.id}
                  to={`/coach/${c.id}`}
                  className={`flex items-center justify-between gap-3 px-4 py-3.5 no-underline hover:bg-cream transition-colors ${status === 'ended' ? 'opacity-60' : ''}`}
                >
                  <div className="min-w-0">
                    <span className="flex items-center gap-2 flex-wrap">
                      {linked && <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" title="Account linked" aria-label="Account linked" />}
                      <span className="text-[14px] font-medium text-text-primary break-words">{c.name || 'Unnamed client'}</span>
                      {status !== 'active' && <StatusChip tone="muted">{CLIENT_STATUSES.find((s) => s.id === status).label}</StatusChip>}
                    </span>
                    {(linked && glance(c)) || (
                      <span className="block text-[11px] text-text-light mt-0.5">
                        {c.programs.length} program{c.programs.length === 1 ? '' : 's'} · updated {fmt(c.updatedAt || c.createdAt)}
                      </span>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-text-light shrink-0" />
                </Link>
              )
            })}
          </div>
        )}

        <p className="text-[12px] text-text-light mt-8">
          Saved automatically{user ? ' to your account' : ' on this device'}.
        </p>
      </motion.div>
    </>
  )
}
