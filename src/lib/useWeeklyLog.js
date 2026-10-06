// Your weekly food log (lib/weeklyLog.js has the shape): loaded, and saved
// one week at a time. Signed in, it's the account's (schema.sql weekly_log),
// falling back to this device if the table isn't there yet; the dev client
// sample keeps it on the device. A body fat for the newest week also becomes
// the profile's body fat, so the calculators stay current.
//
// One copy per page: the dashboard holds it and hands it to both the weigh-in
// tile and the check-in, so saving in one shows in the other.
import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from './auth'
import { devClientSample } from './coach'
import { getWeeklyLog, saveWeeklyEntry } from './workoutStore'
import { fetchRemoteWeeklyLog, upsertRemoteWeeklyLog } from './workoutRemote'
import { saveProfile } from './profile'
import { weekStart } from './checkins'

// A body fat typed on the profile page is a measurement too: it becomes this
// week's body fat in the weekly log, keeping whatever food the week already
// has, so it shows on the Progress charts. Falls back to this device when the
// account's log can't be reached, like the hook below.
export async function logBodyFatThisWeek(userId, bodyFat) {
  const week = weekStart()
  const merged = (rows) => ({ calories: null, protein: null, ...rows.find((e) => e.weekStart === week), weekStart: week, bodyFat })
  try {
    await upsertRemoteWeeklyLog(userId, merged(await fetchRemoteWeeklyLog(userId)))
  } catch {
    saveWeeklyEntry(merged(getWeeklyLog()))
  }
}

export function useWeeklyLog() {
  const { user } = useAuth()
  const enabled = !!user || devClientSample()
  const [entries, setEntries] = useState([])
  const [loaded, setLoaded] = useState(false)
  const remoteOk = useRef(true)
  const entriesRef = useRef(entries)
  entriesRef.current = entries

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const load = user
      ? fetchRemoteWeeklyLog(user.id).catch(() => {
          remoteOk.current = false
          return getWeeklyLog()
        })
      : Promise.resolve(getWeeklyLog())
    load.then((rows) => {
      if (cancelled) return
      setEntries(rows || [])
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [enabled, user])

  const entryFor = useCallback((weekStart) => entries.find((e) => e.weekStart === weekStart) || null, [entries])

  // Saves one week ({ weekStart, calories, protein, bodyFat }).
  const save = useCallback(
    async (entry) => {
      if (user && remoteOk.current) {
        try {
          await upsertRemoteWeeklyLog(user.id, entry)
        } catch {
          remoteOk.current = false
          saveWeeklyEntry(entry)
        }
      } else {
        saveWeeklyEntry(entry)
      }
      const newestFat = !entriesRef.current.some((e) => e.bodyFat != null && e.weekStart > entry.weekStart)
      setEntries((prev) =>
        [entry, ...prev.filter((e) => e.weekStart !== entry.weekStart)].sort((a, b) => b.weekStart.localeCompare(a.weekStart))
      )
      if (user && entry.bodyFat != null && newestFat) saveProfile(user.id, { body_fat: entry.bodyFat }).catch(() => {})
      return entry
    },
    [user]
  )

  return { enabled, loaded, entries, entryFor, save }
}
