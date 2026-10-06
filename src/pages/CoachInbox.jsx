import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useOutletContext } from 'react-router-dom'
import { ArrowLeft, ChevronRight, MessagesSquare } from 'lucide-react'
import { linkForCard } from '../lib/coach'
import { fetchCoachInbox, DEV_COACH_ID } from '../lib/messages'
import { cardLabel } from '../lib/chatCards'
import { useReturnLink } from '../lib/returnPath'
import { useInboxTick } from '../lib/useChat'

// The coach's chats in one list — /coach/messages, opened from the messenger
// icon in the top bar. Newest first; tapping one opens that chat.
export default function CoachInbox() {
  const { user, clients, links, unread = {} } = useOutletContext()
  // Signed out, only the dev sample gets here (CoachLayout's gate).
  const coachId = user?.id || DEV_COACH_ID
  const [latest, setLatest] = useState(null)
  // The icon is in the top bar on every page, so "back" is where you were.
  const back = useReturnLink('coach', { to: '/coach', label: 'All clients' })

  // Only clients whose account is linked can be messaged.
  const chats = useMemo(() => clients.flatMap((c) => {
    const { state, link } = linkForCard(links, c.id)
    return state === 'linked' ? [{ client: c, userId: link.client_id }] : []
  }), [clients, links])
  const idsKey = chats.map((c) => c.userId).sort().join(',')
  // A new message moves its chat to the top while you're looking.
  const tick = useInboxTick({ coachId }, !!idsKey)

  useEffect(() => {
    let cancelled = false
    fetchCoachInbox(coachId, idsKey ? idsKey.split(',') : [])
      .then((m) => { if (!cancelled) setLatest(m) })
      .catch(() => { if (!cancelled) setLatest({}) })
    return () => { cancelled = true }
  }, [coachId, idsKey, tick])

  const rows = useMemo(() => {
    const at = (c) => (latest?.[c.userId] ? Date.parse(latest[c.userId].created_at) : 0)
    return [...chats].sort((a, b) => at(b) - at(a))
  }, [chats, latest])

  return (
    <>
      <Link to={back.to} state={back.state} className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary no-underline text-[13px] mb-10 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> {back.label}
      </Link>

      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-heading text-4xl font-medium text-text-primary mb-8">Messages</h1>

        {chats.length === 0 ? (
          <div className="bg-white border border-border p-7 text-center">
            <MessagesSquare className="w-5 h-5 text-text-light mx-auto mb-3" />
            <p className="text-[13px] text-text-muted">
              No linked clients yet. Share your join link on{' '}
              <Link to="/coach" className="text-text-primary">Clients</Link>.
            </p>
          </div>
        ) : latest == null ? (
          <p className="text-[13px] text-text-muted">Loading…</p>
        ) : (
          <div className="bg-white border border-border divide-y divide-border">
            {rows.map(({ client, userId }) => {
              const last = latest[userId]
              const count = unread[userId] || 0
              return (
                <Link
                  key={client.id}
                  to={`/coach/${client.id}/messages`}
                  state={{ inbox: true }}
                  className="flex items-center gap-3 px-4 py-3.5 no-underline hover:bg-cream transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className={`text-[14px] text-text-primary truncate ${count ? 'font-semibold' : 'font-medium'}`}>
                        {client.name || 'Unnamed client'}
                      </span>
                      {last && <span className="text-[11px] text-text-light shrink-0">{whenLabel(last.created_at)}</span>}
                    </div>
                    <div className="flex items-center justify-between gap-3 mt-0.5">
                      <span className={`text-[12px] truncate ${count ? 'text-text-primary' : 'text-text-light'}`}>
                        {last ? preview(last, coachId) : 'No messages yet'}
                      </span>
                      {count > 0 && (
                        <span className="shrink-0 min-w-[18px] h-[18px] px-1.5 rounded-full bg-text-primary text-cream text-[10px] font-semibold flex items-center justify-center">
                          {count > 9 ? '9+' : count}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-text-light shrink-0" />
                </Link>
              )
            })}
          </div>
        )}
      </motion.div>
    </>
  )
}

// The last message in one line: its text, else what it carries.
function preview(m, coachId) {
  const what = m.body || (m.media_type === 'video' ? 'Video' : m.media_type === 'image' ? 'Photo' : m.card ? cardLabel(m.card) : 'Message')
  return m.sender_id === coachId ? `You: ${what}` : what
}

// Today: the time. This week: the day. Older: the date.
function whenLabel(iso) {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  if (now - d < 6 * 86400000) return d.toLocaleDateString('en-GB', { weekday: 'short' })
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
