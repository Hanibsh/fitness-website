// One chat, open on screen: its messages and reactions (live), signed links
// for its photos and videos, sending, replying, reacting, deleting, and
// whether the other person is typing. Marks the other person's messages read
// while it's open. lib/messages.js has the calls.
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  fetchMessages, mediaUrls, subscribeToChat, markChatRead, sendMessage, deleteMessage, setReaction,
  fetchMyUnreadCount, fetchCoachUnread, fetchHasMessaged, subscribeToInbox,
} from './messages'

// "Typing…" shows this long after the last keystroke heard.
const TYPING_SHOWN_MS = 5000
// …and a keystroke is announced at most this often.
const TYPING_EVERY_MS = 2500

function withReaction(messages, { message_id, user_id, emoji }) {
  return messages.map((m) => {
    if (m.id !== message_id) return m
    const others = (m.reactions || []).filter((r) => r.user_id !== user_id)
    return { ...m, reactions: emoji ? [...others, { user_id, emoji }] : others }
  })
}

export function useChat(coachId, clientId, meId) {
  const [messages, setMessages] = useState([])
  const [urls, setUrls] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [otherTyping, setOtherTyping] = useState(false)
  const urlsRef = useRef(urls)
  urlsRef.current = urls
  const live = useRef(null)
  const typingTimer = useRef(null)
  const lastTypingSent = useRef(0)

  // Signed links for any file not linked yet.
  const sign = useCallback(async (rows) => {
    const need = rows.filter((m) => m.media_path && !urlsRef.current[m.media_path])
    if (!need.length) return
    const fresh = await mediaUrls(need)
    if (Object.keys(fresh).length) setUrls((prev) => ({ ...prev, ...fresh }))
  }, [])

  useEffect(() => {
    if (!coachId || !clientId) return
    let cancelled = false
    setLoading(true)
    const markRead = () => markChatRead(coachId, clientId, meId).catch(() => {})
    fetchMessages(coachId, clientId)
      .then((rows) => {
        if (cancelled) return
        setMessages(rows)
        setLoading(false)
        sign(rows)
        markRead()
      })
      .catch(() => {
        if (!cancelled) {
          setError('Couldn’t load messages — pull down to try again.')
          setLoading(false)
        }
      })
    live.current = subscribeToChat(coachId, clientId, meId, {
      onInsert: (row) => {
        setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]))
        sign([row])
        if (row.sender_id !== meId) {
          setOtherTyping(false)
          markRead()
        }
      },
      // Keeps the reactions this side already holds — the row doesn't carry them.
      onUpdate: (row) => setMessages((prev) => prev.map((m) => (m.id === row.id ? { ...m, ...row, reactions: m.reactions } : m))),
      onDelete: (id) => setMessages((prev) => prev.filter((m) => m.id !== id).map((m) => (m.reply_to === id ? { ...m, reply_to: null } : m))),
      onReaction: (row) => setMessages((prev) => withReaction(prev, row)),
      onReactionGone: (row) => setMessages((prev) => withReaction(prev, { ...row, emoji: null })),
      onTyping: () => {
        setOtherTyping(true)
        clearTimeout(typingTimer.current)
        typingTimer.current = setTimeout(() => setOtherTyping(false), TYPING_SHOWN_MS)
      },
    })
    return () => {
      cancelled = true
      live.current?.unsubscribe()
      live.current = null
      clearTimeout(typingTimer.current)
    }
  }, [coachId, clientId, meId, sign])

  const send = useCallback(
    async (body, media, { card = null, replyTo = null } = {}) => {
      const row = await sendMessage({ coachId, clientId, senderId: meId, body, media, card, replyTo })
      if (!row) return null
      // A file just sent shows from the device straight away; its signed link
      // replaces this on the next load.
      if (media && row.media_path && !row.media_path.startsWith('data:')) {
        setUrls((prev) => ({ ...prev, [row.media_path]: URL.createObjectURL(media.blob) }))
      }
      lastTypingSent.current = 0
      setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]))
      return row
    },
    [coachId, clientId, meId]
  )

  const remove = useCallback(async (message) => {
    await deleteMessage(message)
    setMessages((prev) => prev.filter((m) => m.id !== message.id).map((m) => (m.reply_to === message.id ? { ...m, reply_to: null } : m)))
  }, [])

  // Tapping your current reaction takes it off; anything else sets it. Shown
  // straight away, put back if it didn't save.
  const react = useCallback(
    async (message, emoji) => {
      const current = (message.reactions || []).find((r) => r.user_id === meId)?.emoji || null
      const next = current === emoji ? null : emoji
      setMessages((prev) => withReaction(prev, { message_id: message.id, user_id: meId, emoji: next }))
      try {
        await setReaction(message, meId, next)
      } catch {
        setMessages((prev) => withReaction(prev, { message_id: message.id, user_id: meId, emoji: current }))
        throw new Error('reaction failed')
      }
    },
    [meId]
  )

  // Call on every keystroke; it's throttled here.
  const typing = useCallback(() => {
    const now = Date.now()
    if (now - lastTypingSent.current < TYPING_EVERY_MS) return
    lastTypingSent.current = now
    live.current?.typing()
  }, [])

  // A dev-sample file is its own data: URL.
  const urlFor = useCallback((m) => (m.media_path?.startsWith('data:') ? m.media_path : urls[m.media_path] || null), [urls])

  return { messages, loading, error, send, remove, react, typing, otherTyping, urlFor }
}

// A number that goes up whenever a message in this account's chats arrives or
// is read — anything showing unread counts refetches on it, so badges move
// without leaving the page.
export function useInboxTick({ coachId = null, clientId = null }, enabled = true) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!enabled || !(coachId || clientId)) return
    return subscribeToInbox({ coachId, clientId }, () => setTick((t) => t + 1))
  }, [coachId, clientId, enabled])
  return tick
}

// The client's unread count (navbar, "From Leon" card). Live, and `refreshKey`
// — the navbar passes the page address — fetches again when it changes too.
export function useMyUnreadMessages(userId, enabled, refreshKey = null) {
  const [count, setCount] = useState(0)
  const tick = useInboxTick({ clientId: userId }, enabled)
  useEffect(() => {
    if (!enabled || !userId) return
    let cancelled = false
    fetchMyUnreadCount(userId).then((n) => { if (!cancelled) setCount(n) })
    return () => { cancelled = true }
  }, [userId, enabled, refreshKey, tick])
  return count
}

// Whether this client has sent their coach a message yet (null while checking).
export function useHasMessaged(userId, enabled) {
  const [sent, setSent] = useState(null)
  useEffect(() => {
    if (!enabled || !userId) return
    let cancelled = false
    fetchHasMessaged(userId).then((v) => { if (!cancelled) setSent(v) })
    return () => { cancelled = true }
  }, [userId, enabled])
  return sent
}

// The coach's unread counts per client account; live, `refreshKey` as above.
export function useCoachUnread(coachId, enabled = true, refreshKey = null) {
  const [counts, setCounts] = useState({})
  const tick = useInboxTick({ coachId }, enabled)
  useEffect(() => {
    if (!enabled || !coachId) return
    let cancelled = false
    fetchCoachUnread(coachId).then((c) => { if (!cancelled) setCounts(c) })
    return () => { cancelled = true }
  }, [coachId, enabled, refreshKey, tick])
  return counts
}
