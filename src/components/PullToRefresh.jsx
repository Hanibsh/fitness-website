import { useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'

// Pull down from the top of any page to reload the app — in the installed app
// only, where the phone has no pull-to-refresh of its own (a browser tab
// already does). Reloading also picks up a new deploy: navigations are
// network-first (vite.config.js).
//
// It stays out of the way: only from the very top of the page, never while a
// popup is open, never from a drag grip or an inner list that's scrolled, and
// only past a deliberate pull. A workout in progress is safe — the draft is
// saved on the device as it's typed.
//
// In local development, localStorage `leon_dev_ptr` = '1' turns it on in a
// normal tab so it can be tried.

const TRIGGER = 70 // px of (damped) pull that reloads
const MAX = 100

function enabled() {
  if (typeof window === 'undefined') return false
  const standalone = window.navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches
  if (standalone) return true
  if (!import.meta.env.DEV) return false
  try {
    return localStorage.getItem('leon_dev_ptr') === '1'
  } catch {
    return false
  }
}

// Whether a touch starting on `el` may begin a pull.
function canStartFrom(el) {
  if (window.scrollY > 0) return false
  if (document.querySelector('[role="dialog"]') || document.body.style.overflow === 'hidden') return false
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    if (n.matches?.('[aria-roledescription="sortable"], input[type="range"], textarea, [data-no-pull]')) return false
    if (n.scrollTop > 0) return false
  }
  return true
}

export default function PullToRefresh() {
  const [pull, setPull] = useState(0)
  const [reloading, setReloading] = useState(false)
  const start = useRef(null) // { x, y } of a touch that may become a pull
  const pullRef = useRef(0)

  useEffect(() => {
    if (!enabled()) return
    const set = (v) => {
      pullRef.current = v
      setPull(v)
    }
    function onStart(e) {
      if (e.touches.length !== 1 || !canStartFrom(e.target)) {
        start.current = null
        return
      }
      start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
    function onMove(e) {
      if (!start.current) return
      const dy = e.touches[0].clientY - start.current.y
      const dx = e.touches[0].clientX - start.current.x
      // A sideways swipe, an upward scroll, or the page has moved: not a pull.
      if (dy <= 0 || Math.abs(dx) > dy || window.scrollY > 0) {
        if (pullRef.current) set(0)
        if (dy < 0 || window.scrollY > 0) start.current = null
        return
      }
      set(Math.min(MAX, dy * 0.5))
    }
    function onEnd() {
      if (!start.current) return
      start.current = null
      if (pullRef.current >= TRIGGER) {
        setReloading(true)
        window.location.reload()
      } else {
        set(0)
      }
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    window.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  if (!pull && !reloading) return null
  const shown = reloading ? TRIGGER : pull
  const ready = reloading || pull >= TRIGGER
  return (
    <div
      className="fixed left-0 right-0 z-[60] flex justify-center pointer-events-none"
      style={{ top: `calc(env(safe-area-inset-top, 0px) + 56px + ${shown * 0.6}px)` }}
      aria-hidden={!reloading}
      role={reloading ? 'status' : undefined}
    >
      <span
        className="w-9 h-9 rounded-full bg-white border border-border flex items-center justify-center shadow-sm"
        style={{ opacity: Math.min(1, shown / TRIGGER) }}
      >
        <RefreshCw
          className={`w-4 h-4 ${ready ? 'text-text-primary' : 'text-text-light'} ${reloading ? 'animate-spin' : ''}`}
          style={reloading ? undefined : { transform: `rotate(${pull * 3}deg)` }}
        />
        {reloading && <span className="sr-only">Refreshing</span>}
      </span>
    </div>
  )
}
