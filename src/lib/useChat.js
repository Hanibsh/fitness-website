// One chat, open on screen: its messages (live), signed links for its photos
// and videos, sending and deleting. Marks the other person's messages read
// while it's open. lib/messages.js has the calls.
import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchMessages, mediaUrls, subscribeToChat, markChatRead, sendMessage, deleteMessage, fetchMyUnreadCount, fetchCoachUnread } from './messages'

export function useChat(coachId, clientId, meId) {
  const [messages, setMessages] = useState([])
  const [urls, setUrls] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const urlsRef = useRef(urls)
  urlsRef.current = urls

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
    fetchMessages(coachId, clientId)
      .then((rows) => {
        if (cancelled) return
        setMessages(rows)
        setLoading(false)
        sign(rows)
        markChatRead(coachId, clientId).catch(() => {})
      })
      .catch(() => {
        if (!cancelled) {
          setError('Couldn’t load messages — pull down to try again.')
          setLoading(false)
        }
      })
    const unsubscribe = subscribeToChat(coachId, clientId, {
      onInsert: (row) => {
        setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]))
        sign([row])
        if (row.sender_id !== meId) markChatRead(coachId, clientId).catch(() => {})
      },
      onDelete: (id) => setMessages((prev) => prev.filter((m) => m.id !== id)),
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [coachId, clientId, meId, sign])

  const send = useCallback(
    async (body, media) => {
      const row = await sendMessage({ coachId, clientId, senderId: meId, body, media })
      if (!row) return null
      // A file just sent shows from the device straight away; its signed link
      // replaces this on the next load.
      if (media && row.media_path && !row.media_path.startsWith('data:')) {
        setUrls((prev) => ({ ...prev, [row.media_path]: URL.createObjectURL(media.blob) }))
      }
      setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]))
      return row
    },
    [coachId, clientId, meId]
  )

  const remove = useCallback(async (message) => {
    await deleteMessage(message)
    setMessages((prev) => prev.filter((m) => m.id !== message.id))
  }, [])

  // A dev-sample file is its own data: URL.
  const urlFor = useCallback((m) => (m.media_path?.startsWith('data:') ? m.media_path : urls[m.media_path] || null), [urls])

  return { messages, loading, error, send, remove, urlFor }
}

// The client's unread count (navbar, "From Leon" card). `refreshKey` — the
// navbar passes the page address — fetches again when it changes, so leaving
// the chat clears the badge.
export function useMyUnreadMessages(userId, enabled, refreshKey = null) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!enabled || !userId) return
    let cancelled = false
    fetchMyUnreadCount(userId).then((n) => { if (!cancelled) setCount(n) })
    return () => { cancelled = true }
  }, [userId, enabled, refreshKey])
  return count
}

// The coach's unread counts per client account; `refreshKey` as above.
export function useCoachUnread(coachId, enabled = true, refreshKey = null) {
  const [counts, setCounts] = useState({})
  useEffect(() => {
    if (!enabled || !coachId) return
    let cancelled = false
    fetchCoachUnread(coachId).then((c) => { if (!cancelled) setCounts(c) })
    return () => { cancelled = true }
  }, [coachId, enabled, refreshKey])
  return counts
}
