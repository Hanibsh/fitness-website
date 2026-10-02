// "Back" for pages you can reach from anywhere.
//
// Most back links in the app follow the site's shape — a calculator goes back
// to Tools, a split's day to the split — because that's the only way in. A few
// places are a tap away from EVERY page (the top bar's Clients and your name,
// and Import, linked from more than one place), and a fixed back link there
// sends you somewhere you never were. Those remember the page you were on when
// you went in, and go back to that.
//
// An AREA is a set of path prefixes that count as one place: everything under
// /coach is the client area, so wandering from Clients into a client and back
// still returns to the page you started from, not to the client.
//
// Kept per tab (sessionStorage) so a reload keeps it; a page opened straight
// from a URL has nothing remembered and uses its fallback. Following a back
// link is marked (`state.returning`) so it doesn't count as stepping in: going
// Profile → Clients → "Back to your profile" leaves the profile's own back link
// on wherever you opened the profile from.
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from './auth'

const KEY = 'leon_return_paths'

export const AREAS = {
  coach: ['/coach'],
  account: ['/account', '/profile'],
  import: ['/import'],
}

const inArea = (path, prefixes) => prefixes.some((p) => path === p || path.startsWith(`${p}/`))

function readStore() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || '{}') || {}
  } catch {
    return {}
  }
}

function writeStore(store) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    // storage unavailable — back links fall back to their defaults
  }
}

// The page the tracker last saw. While a newly opened page renders, this is
// still the page you came FROM — the tracker's effect hasn't run yet — which
// is what lets the first render's back link already be right.
let lastSeen = null

// Mounted once, at the app root: notes the page you were on each time you
// step into an area from outside it.
export function useTrackReturnPaths() {
  const { pathname, search, state } = useLocation()
  const returning = !!state?.returning
  useEffect(() => {
    const from = lastSeen
    lastSeen = pathname + search
    if (!from || returning) return
    const fromPath = from.split('?')[0]
    let store = null
    for (const [area, prefixes] of Object.entries(AREAS)) {
      if (inArea(pathname, prefixes) && !inArea(fromPath, prefixes)) {
        store = store || readStore()
        store[area] = from
      }
    }
    if (store) writeStore(store)
  }, [pathname, search, returning])
}

// What a page is called in a "Back to …" link.
function labelFor(path, signedIn) {
  const p = path.split('?')[0]
  if (p === '/' || p === '/dashboard') return signedIn ? 'dashboard' : 'home'
  if (p === '/log') return 'workout log'
  if (p.startsWith('/split/')) return 'your split'
  if (p === '/calendar') return 'calendar'
  if (p.startsWith('/injuries')) return 'injuries'
  if (p === '/tools') return 'tools'
  if (p.startsWith('/tools/')) return 'the calculator'
  if (p.startsWith('/exercises')) return 'exercises'
  if (p === '/programs') return 'programs'
  if (p === '/contact') return 'contact'
  if (inArea(p, AREAS.account)) return 'your profile'
  if (inArea(p, AREAS.coach)) return 'clients'
  if (inArea(p, AREAS.import)) return 'import'
  return null
}

// { to, label, state } for an area's back link — where you came from, or
// `fallback` ({ to, label }). Just arrived from outside the area? Then that
// page. Otherwise what was remembered on the way in. Pass `state` to the Link.
export function useReturnLink(area, fallback) {
  const { state } = useLocation()
  const { user } = useAuth()
  const prefixes = AREAS[area]
  const fresh = !state?.returning && lastSeen && !inArea(lastSeen.split('?')[0], prefixes) ? lastSeen : null
  const from = fresh || readStore()[area]
  const back = from ? { to: from, label: `Back to ${labelFor(from, !!user) || 'where you were'}` } : fallback
  return { ...back, state: { returning: true } }
}
