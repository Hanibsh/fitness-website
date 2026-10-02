// The coach's client list: load it, and every write path. Same shape of hook as
// useProgramsState — this device's copy is written immediately, the account's
// either after a pause (typing) or at once (adding, deleting).
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from './auth'
import { getClients, saveClients } from './workoutStore'
import { fetchRemoteClients, upsertRemoteClients } from './workoutRemote'
import { normalizeClient } from './clients'

export function useClientsState() {
  const { user } = useAuth()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const remoteTimer = useRef(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      let list = getClients()
      if (user) {
        try {
          const remote = await fetchRemoteClients(user.id)
          // The account has never held a list (or the table isn't there yet):
          // this device's copy is the truth, and it seeds the account.
          if (remote === null) {
            if (list.length) upsertRemoteClients(user.id, list).catch(() => {})
          } else {
            list = remote
            saveClients(list)
          }
        } catch {
          // keep this device's copy
        }
      }
      if (!cancelled) {
        setClients(list.map(normalizeClient))
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [user])

  const persist = useCallback(
    (next, { now = false } = {}) => {
      saveClients(next)
      if (!user) return
      clearTimeout(remoteTimer.current)
      const push = () => upsertRemoteClients(user.id, next).catch(() => {})
      if (now) push()
      else remoteTimer.current = setTimeout(push, 700)
    },
    [user]
  )

  // A client edit: `mutator` takes the client and returns the new one.
  const updateClient = useCallback(
    (id, mutator, opts) => {
      setClients((prev) => {
        const next = prev.map((c) => (c.id === id ? { ...mutator(c), updatedAt: Date.now() } : c))
        persist(next, opts)
        return next
      })
    },
    [persist]
  )

  const addClient = useCallback(
    (client) => {
      setClients((prev) => {
        const next = [...prev, client]
        persist(next, { now: true })
        return next
      })
    },
    [persist]
  )

  const deleteClient = useCallback(
    (id) => {
      setClients((prev) => {
        const next = prev.filter((c) => c.id !== id)
        persist(next, { now: true })
        return next
      })
    },
    [persist]
  )

  return { user, clients, loading, addClient, updateClient, deleteClient }
}

// Whether this account sees the coach area: `profiles.is_coach`, set by hand in
// the SQL editor. `checking` holds the page while the profile is still on its
// way, so the coach isn't bounced off their own page on a slow load.
//
// In local development only, localStorage `leon_dev_coach` = '1' stands in for
// the flag, so the area can be worked on without signing in. Production builds
// drop the branch entirely (import.meta.env.DEV is false at build time).
export function useCoachAccess() {
  const { loading, profileLoading, profile } = useAuth()
  let devCoach = false
  if (import.meta.env.DEV) {
    try {
      devCoach = localStorage.getItem('leon_dev_coach') === '1'
    } catch {
      // storage unavailable — no override
    }
  }
  return { checking: !devCoach && (loading || profileLoading), isCoach: devCoach || profile?.is_coach === true }
}
