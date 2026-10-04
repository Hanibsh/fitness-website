// The client's side of coaching: who coaches this account (null when nobody
// does), and ending it. Used by the profile's Coach section and the dashboard.
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './auth'
import { fetchMyCoach, endLink } from './coach'

export function useMyCoach() {
  const { user, loading: authLoading } = useAuth()
  const [coach, setCoach] = useState(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      setCoach(await fetchMyCoach(user?.id))
    } catch {
      setCoach(null)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (!authLoading) reload()
  }, [authLoading, reload])

  const stop = useCallback(async () => {
    if (!coach) return
    await endLink(coach.link_id)
    await reload()
  }, [coach, reload])

  return { coach, coachLoading: loading, stopCoaching: stop, reloadCoach: reload }
}
