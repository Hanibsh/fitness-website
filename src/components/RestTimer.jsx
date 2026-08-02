import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Timer, X, RotateCcw } from 'lucide-react'
import { formatRest, REST_STALE_SEC } from '../lib/workoutStats'
import { formatDuration } from '../lib/dashboard'

// The rest clock, as a bubble in the corner of the log.
//
// It used to be a banner pinned above the session name, which meant that by
// your third exercise it had scrolled away — the number you most want mid-set
// was the one you had to scroll up to read. Same corner-bubble treatment as
// QuickCalculator, on the opposite side so the two never fight for a thumb.
//
// It counts UP and never interrupts: no sound, no vibration, no notification.
// The exercise's rest target from the DB is drawn as a marker you pass, not a
// deadline you miss.

const REST_STALE_MS = REST_STALE_SEC * 1000

// "2:00–3:00", or "2:00" when the DB gives a single value. Null for movements
// with no target at all (cardio, custom entries, the supplemental list).
function formatTarget(targetSec) {
  if (!Array.isArray(targetSec) || !targetSec.length) return null
  const [min, max] = targetSec
  if (!min) return null
  return max && max !== min ? `${formatRest(min)}–${formatRest(max)}` : formatRest(min)
}

export default function RestTimer({
  anchorTs = null,
  targetSec = null,
  exerciseName = '',
  sessionStartTs = null,
  onReset,
  onDismiss,
}) {
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const fabRef = useRef(null)
  const panelRef = useRef(null)

  const elapsedMs = anchorTs ? now - anchorTs : null
  // A clock left running past the stale window isn't rest any more, it's a
  // session you walked away from. Fall back to the idle bubble rather than
  // showing a number nobody believes.
  const stale = elapsedMs == null || elapsedMs < 0 || elapsedMs > REST_STALE_MS
  const elapsedSec = stale ? null : Math.floor(elapsedMs / 1000)

  const targetMin = Array.isArray(targetSec) && targetSec[0] ? targetSec[0] : null
  const past = targetMin != null && elapsedSec != null && elapsedSec >= targetMin
  const progress = targetMin && elapsedSec != null ? Math.min(1, elapsedSec / targetMin) : 0

  // One tick a second, owned here rather than by the page. The whole reason
  // this is its own component: the old version's interval sat on WorkoutTracker,
  // so every second re-rendered the entire log — every exercise, every set row.
  // Idle and closed, there's nothing to count and the interval doesn't run.
  useEffect(() => {
    if (stale && !open) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [stale, open, anchorTs])

  // A backgrounded tab throttles or freezes the interval, and an installed PWA
  // is resumed rather than reloaded — so coming back to the app would otherwise
  // show whatever second it froze on. Resync the moment it's visible again,
  // the same way useLocalDay keeps the date honest.
  useEffect(() => {
    const sync = () => setNow(Date.now())
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('focus', sync)
    window.addEventListener('pageshow', sync)
    return () => {
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('focus', sync)
      window.removeEventListener('pageshow', sync)
    }
  }, [])

  const close = useCallback(() => setOpen(false), [])

  // Escape closes the panel — but the log is wall-to-wall weight and rep
  // fields, and Escape inside one of those belongs to the field, not to us.
  // Same bail-out as the calculator, including deferring to an open modal.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key !== 'Escape' || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target
      const tag = t?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) return
      if (document.querySelector('[aria-modal="true"]')) return
      close()
      e.preventDefault()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])

  // Focus follows the toggle both ways. On close it has to happen in an effect:
  // the bubble only mounts once `open` is false, so the ref is still null while
  // close() runs.
  const openedOnce = useRef(false)
  useEffect(() => {
    if (open) {
      openedOnce.current = true
      panelRef.current?.focus({ preventScroll: true })
    } else if (openedOnce.current) {
      fabRef.current?.focus({ preventScroll: true })
    }
  }, [open])

  const targetLabel = formatTarget(targetSec)
  const sessionLabel = sessionStartTs ? formatDuration(now - sessionStartTs) : null
  const display = elapsedSec == null ? '0:00' : formatRest(elapsedSec)

  const actionCls =
    'flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-[12px] bg-white border-none cursor-pointer text-text-secondary hover:bg-cream-dark active:bg-cream-dark transition-colors'

  // Portalled to body: the log wraps its content in a motion.div, and a
  // transform on an ancestor makes it the containing block for anything fixed.
  return createPortal(
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-label="Rest timer"
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ duration: 0.14 }}
            style={{ transformOrigin: 'bottom left' }}
            className="fixed bottom-4 left-4 z-[80] w-60 max-w-[calc(100vw-2rem)] bg-white border border-border shadow-xl outline-none"
          >
            <div className="flex items-start justify-between gap-2 px-3 pt-2.5 pb-2">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-wider text-text-light">Rest</p>
                {/* No aria-live here — a polite region on a clock announces
                    once a second, which is unusable. role=timer is enough. */}
                <p role="timer" className="font-heading text-2xl font-medium text-text-primary tabular-nums">
                  {display}
                </p>
              </div>
              <button
                onClick={close}
                aria-label="Minimize rest timer"
                className="shrink-0 text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer p-0.5 -mr-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-3 pb-3">
              {targetLabel ? (
                <>
                  <div className="h-0.5 bg-border">
                    <div
                      // Width only, never `transition-all`: this element is
                      // re-rendered once a second, and a colour transition
                      // restarted that often never finishes — it left the bar
                      // stuck on the previous theme's colour after a toggle.
                      className={`h-full transition-[width] duration-500 ${past ? 'bg-text-primary' : 'bg-text-light'}`}
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-text-muted mt-1.5">
                    {past ? 'Target reached' : `Target ${targetLabel}`}
                    {exerciseName ? <span className="text-text-light"> · {exerciseName}</span> : null}
                  </p>
                </>
              ) : (
                <p className="text-[11px] text-text-light">
                  {exerciseName ? `No rest target for ${exerciseName}` : 'No rest target for this exercise'}
                </p>
              )}

              {sessionLabel && (
                <p className="text-[11px] text-text-light mt-1">Session {sessionLabel}</p>
              )}
            </div>

            <div className="flex gap-px bg-border border-t border-border">
              <button onClick={onReset} className={actionCls}>
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
              <button
                onClick={() => {
                  onDismiss?.()
                  close()
                }}
                title="Hide until your next set"
                className={actionCls}
              >
                Hide
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!open && (
        <button
          ref={fabRef}
          onClick={() => {
            // Idle, the bubble IS the start button. The old banner only existed
            // once a set had been logged, so there was no way to time the rest
            // before your first working set.
            if (stale) onReset?.()
            setOpen(true)
          }}
          aria-label={stale ? 'Start rest timer' : 'Open rest timer'}
          title={stale ? 'Start rest timer' : `Resting ${display}`}
          className={
            stale
              ? 'fixed bottom-4 left-4 z-[80] w-12 h-12 rounded-full bg-text-primary text-cream border-none cursor-pointer shadow-lg inline-flex items-center justify-center hover:bg-accent-hover transition-colors'
              : `fixed bottom-4 left-4 z-[80] h-12 px-4 rounded-full bg-text-primary text-cream cursor-pointer shadow-lg inline-flex items-center gap-2 hover:bg-accent-hover transition-colors border-2 ${past ? 'border-cream' : 'border-transparent'}`
          }
        >
          <Timer className="w-5 h-5 shrink-0" />
          {!stale && <span className="font-heading text-[15px] font-medium tabular-nums">{display}</span>}
        </button>
      )}
    </>,
    document.body
  )
}
