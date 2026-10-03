import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { DURATION, EASE } from '../lib/motion'
import { ModalCloseContext } from '../lib/modalClose'

export default function Modal({ onClose, children, maxWidth = 'max-w-lg' }) {
  // Dismissing (✕, a tap outside, Esc) plays the exit, then tells the parent.
  // A parent that closes it directly — after a Save, say — unmounts it at once:
  // the action is done, and waiting on a fade would only feel slow.
  const [closing, setClosing] = useState(false)
  const onCloseRef = useRef(onClose)
  const closedRef = useRef(false)
  useEffect(() => { onCloseRef.current = onClose })

  const finishClose = useCallback(() => {
    if (closedRef.current) return
    closedRef.current = true
    onCloseRef.current()
  }, [])
  const requestClose = useCallback(() => setClosing(true), [])

  // The exit's completion is what closes it; this backstop covers the rare
  // frame where the animation never reports back (a backgrounded tab).
  useEffect(() => {
    if (!closing) return
    const t = setTimeout(finishClose, 400)
    return () => clearTimeout(t)
  }, [closing, finishClose])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') requestClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [requestClose])

  const transition = { duration: closing ? DURATION.fast : DURATION.base, ease: EASE }

  // Rendered through a portal to document.body so it's never trapped inside a
  // parent's stacking context (e.g. the fixed navbar). Outer scrolls; inner
  // centers when it fits and stays fully reachable when it's taller than the
  // viewport — the top is never clipped.
  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto" role="dialog" aria-modal="true">
      <motion.div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={requestClose}
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: closing ? 0 : 1 }}
        transition={transition}
      />
      {/* The top pad clears the iPhone status bar the home-screen app draws
          over the page (zero anywhere else). */}
      <div className="relative flex min-h-full items-center justify-center p-4" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}>
        <motion.div
          className={`relative bg-white border border-border shadow-xl w-full ${maxWidth} my-8`}
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={closing ? { opacity: 0, y: 8, scale: 0.98 } : { opacity: 1, y: 0, scale: 1 }}
          transition={transition}
          onAnimationComplete={() => { if (closing) finishClose() }}
        >
          <button
            onClick={requestClose}
            aria-label="Close"
            className="absolute top-4 right-4 text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer z-10"
          >
            <X className="w-5 h-5" />
          </button>
          <ModalCloseContext.Provider value={requestClose}>
            {children}
          </ModalCloseContext.Provider>
        </motion.div>
      </div>
    </div>,
    document.body
  )
}
