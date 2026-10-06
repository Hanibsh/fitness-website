// Your own progress data, for the Progress page and the chat's profile panel:
// sessions, weigh-ins, day annotations and the weekly food log — the
// account's when signed in, this device's on any failure (or signed out) —
// and the calories and protein to aim for: `coach`'s targets when they set
// them (pass useMyCoach's coach, or null), else the profile's own.
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from './auth'
import { useFromCoach } from './useCoachNotes'
import { useDailyTargets, pickTargets } from './useDailyTargets'
import { getHistory, getUnit, getBodyweightLog, getDayAnnotations, getWeeklyLog } from './workoutStore'
import { fetchRemoteHistory, fetchRemoteBodyweight, fetchRemoteDayAnnotations, fetchRemoteWeeklyLog } from './workoutRemote'

const mine = (user, remote, local) => (user ? remote(user.id).catch(() => local()) : Promise.resolve(local()))
const NONE = []

export function useMyProgressData(coach = null) {
  const { user } = useAuth()
  const { targets: coachTargets } = useFromCoach(!!coach, { markRead: false })
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      mine(user, fetchRemoteHistory, getHistory),
      mine(user, fetchRemoteBodyweight, getBodyweightLog),
      mine(user, fetchRemoteDayAnnotations, getDayAnnotations),
      mine(user, fetchRemoteWeeklyLog, getWeeklyLog),
    ]).then(([sessions, bodyweight, annotations, weekly]) => {
      if (!cancelled) setData({ sessions: sessions || [], bodyweight: bodyweight || [], annotations: annotations || [], weekly: weekly || [] })
    })
    return () => { cancelled = true }
  }, [user])

  const sessions = data?.sessions || NONE
  const now = useMemo(() => Date.now(), [])
  const own = useDailyTargets(sessions, now)

  return {
    loading: !data,
    sessions,
    bodyweight: data?.bodyweight || NONE,
    annotations: data?.annotations || NONE,
    weekly: data?.weekly || NONE,
    targets: pickTargets(coachTargets, own.result),
    unit: getUnit(),
  }
}
