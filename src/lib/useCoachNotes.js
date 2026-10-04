// Notes and targets, both sides (lib/coach.js has the calls):
//   useClientNotes / useClientTargets — the coach, about one linked client
//   useFromCoach                        — the client: what their coach sent them
//   useSessionComments                  — the client: comments on one session
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './auth'
import { useMyCoach } from './useMyCoach'
import {
  fetchClientNotes, addCoachNote, deleteCoachNote, fetchClientTargets, saveClientTargets,
  fetchMyNotes, markNotesRead, fetchMyTargets,
} from './coach'

export function useClientNotes(clientUserId) {
  const { user } = useAuth()
  const [notes, setNotes] = useState([])

  useEffect(() => {
    if (!clientUserId) return
    let cancelled = false
    fetchClientNotes(user?.id, clientUserId)
      .then((rows) => { if (!cancelled) setNotes(rows) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user, clientUserId])

  const add = useCallback(
    async (note) => {
      const row = await addCoachNote(user?.id, clientUserId, note)
      if (row) setNotes((prev) => [row, ...prev])
      return row
    },
    [user, clientUserId]
  )

  const remove = useCallback(
    async (id) => {
      await deleteCoachNote(user?.id, id)
      setNotes((prev) => prev.filter((n) => n.id !== id))
    },
    [user]
  )

  return { notes, addNote: add, removeNote: remove }
}

export function useClientTargets(clientUserId) {
  const { user } = useAuth()
  const [targets, setTargets] = useState(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!clientUserId) return
    let cancelled = false
    fetchClientTargets(user?.id, clientUserId)
      .then((t) => { if (!cancelled) { setTargets(t); setLoaded(true) } })
      .catch(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [user, clientUserId])

  const save = useCallback(
    async (next) => {
      await saveClientTargets(user?.id, clientUserId, next)
      setTargets(next)
    },
    [user, clientUserId]
  )

  return { targets, targetsLoaded: loaded, saveTargets: save }
}

// The client's side. `unread` is the set of notes that were new when this
// loaded — they're marked read on the server straight away (only where the
// "From Leon" card shows them, `markRead`), but keep their "new" dot for as
// long as this screen is open.
export function useFromCoach(enabled, { markRead = true } = {}) {
  const { user } = useAuth()
  const [notes, setNotes] = useState([])
  const [targets, setTargets] = useState(null)
  const [unread, setUnread] = useState(() => new Set())

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    Promise.all([fetchMyNotes(user?.id).catch(() => []), fetchMyTargets(user?.id).catch(() => null)]).then(([n, t]) => {
      if (cancelled) return
      setNotes(n)
      setTargets(t)
      const fresh = n.filter((x) => !x.read_at).map((x) => x.id)
      setUnread(new Set(fresh))
      if (markRead && fresh.length) markNotesRead(user?.id, fresh).catch(() => {})
    })
    return () => { cancelled = true }
  }, [enabled, user, markRead])

  return { notes, targets, unread }
}

// Just the coach's comments on your sessions, for the session summaries opened
// from the log and the calendar: { comments(sessionId), coachName }.
export function useSessionComments() {
  const { coach } = useMyCoach()
  const { notes } = useFromCoach(!!coach, { markRead: false })
  const comments = useCallback((sessionId) => notes.filter((n) => n.kind === 'session' && n.target_id === sessionId), [notes])
  return { comments, coachName: coach?.coach_name }
}
