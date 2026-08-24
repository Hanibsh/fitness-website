// Loading and saving injuries, in one place.
//
// The rest of the app does local-or-remote per page: each one loads inside its
// own effect and writes through its own `persistX` with a `remote…Ok` fallback
// flag. That's fine when a table has one consumer, but injuries have four (the
// calendar, the injury page, the logger and the dashboard) and four hand-copied
// versions of the same fallback logic is four places for it to drift.
//
// The fallback rule, once: signed in, try remote; the first failure (usually the
// migration not having been run yet) flips this session to local for good, so a
// broken table degrades to a working local-only feature instead of a dead page.
// `useAuth` is the same source the other pages read.

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import exercisesDb from '../data/exercises.json'
import { useAuth } from './auth'
import {
  getInjuries, saveInjury, deleteInjury,
  makeCheckin, addCheckin,
} from './workoutStore'
import { injuryRiskMap } from './injuries'
import { fetchRemoteInjuries, upsertRemoteInjury, deleteRemoteInjury } from './workoutRemote'

export function useInjuries() {
  const { user } = useAuth()
  const [injuries, setInjuries] = useState([])
  const [loading, setLoading] = useState(true)
  const [remoteOk, setRemoteOk] = useState(!!user)
  // Read inside callbacks that shouldn't re-create themselves every time the
  // flag flips — a changing `save` identity would restart effects downstream.
  const remoteOkRef = useRef(!!user)
  remoteOkRef.current = remoteOk

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      if (user) {
        try {
          const remote = await fetchRemoteInjuries(user.id)
          if (!cancelled) { setInjuries(remote); setRemoteOk(true) }
        } catch {
          if (!cancelled) { setInjuries(getInjuries()); setRemoteOk(false) }
        }
      } else {
        setInjuries(getInjuries())
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [user])

  // Upsert. Returns the saved injury so a caller can chain on it (create then
  // navigate to it, log a check-in then show the new pain).
  const save = useCallback(async (injury) => {
    if (user && remoteOkRef.current) {
      try {
        await upsertRemoteInjury(user.id, injury)
        setInjuries((prev) => [injury, ...prev.filter((i) => i.id !== injury.id)].sort((a, b) => b.startedAt - a.startedAt))
        return injury
      } catch {
        setRemoteOk(false)
      }
    }
    setInjuries(saveInjury(injury))
    return injury
  }, [user])

  const remove = useCallback(async (id) => {
    if (user && remoteOkRef.current) {
      try {
        await deleteRemoteInjury(id)
        setInjuries((prev) => prev.filter((i) => i.id !== id))
        return
      } catch {
        setRemoteOk(false)
      }
    }
    setInjuries(deleteInjury(id))
  }, [user])

  // One pain rating on one day. Same-day check-ins replace rather than stack
  // (addCheckin), so tapping 6 and then 4 leaves one honest number for the day.
  const checkin = useCallback((injury, pain, { note = '', date } = {}) =>
    save(addCheckin(injury, makeCheckin(pain, note, date))), [save])

  return { injuries, loading, save, remove, checkin, syncedRemotely: !!user && remoteOk }
}

// The exercise id → risk lookup the badges read, memoised per injury list.
// Separate from useInjuries so a screen that only wants to WARN doesn't also
// pull in the save/delete surface it has no business calling.
export function useInjuryRisk() {
  const { injuries } = useInjuries()
  return useMemo(() => injuryRiskMap(injuries, exercisesDb.exercises), [injuries])
}
