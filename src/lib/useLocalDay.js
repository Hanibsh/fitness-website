// Today's date, as a local-midnight timestamp, kept fresh while the page stays
// open.
//
// Every "what's up today?" read (todayPlan, the calendar projection) starts from
// a timestamp taken at render. On a laptop that's fine — the tab gets reloaded.
// An installed PWA is RESUMED rather than reloaded, so a screen left open
// overnight keeps answering with yesterday's date, and any surface that mounted
// fresh disagrees with it. Feeding this value into those reads (and into their
// memo deps, which is where a stale answer really gets pinned) makes the day
// roll over on its own.
//
// Checked when the app comes back to the foreground and once a minute otherwise;
// the state only changes when the calendar day actually does, so a page that
// stays open all day re-renders exactly once, at midnight.
import { useState, useEffect } from 'react'

function startOfDay(ts) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function useLocalDay() {
  const [day, setDay] = useState(() => startOfDay(Date.now()))

  useEffect(() => {
    const check = () => setDay((prev) => {
      const now = startOfDay(Date.now())
      return now === prev ? prev : now
    })
    const id = setInterval(check, 60000)
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    window.addEventListener('pageshow', check)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
      window.removeEventListener('pageshow', check)
    }
  }, [])

  return day
}
