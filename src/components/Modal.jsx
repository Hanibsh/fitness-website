import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { ModalCloseContext } from '../lib/modalClose'

export default function Modal({ onClose, children, maxWidth = 'max-w-lg' }) {
  // Dismissing (✕, a tap outside, Esc) plays the exit, then tells the parent.
  // A parent that closes it directly — after a Save, say — unmounts it at once:
  // the action is done, and waiting on a fade would only feel slow.
  //
  // The fades are CSS (.modal-panel / .modal-backdrop in index.css), so they
  // run on the GPU. The backdrop dims without a blur: a blurred layer can't be
  // faded without redrawing the whole screen every frame.
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

  // The exit's animationend is what closes it; this backstop covers a tab in
  // the background, where animations don't run and so never end.
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

  // Rendered through a portal to document.body so it's never trapped inside a
  // parent's stacking context (e.g. the fixed navbar). Outer scrolls; inner
  // centers when it fits and stays fully reachable when it's taller than the
  // viewport — the top is never clipped.
  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto" role="dialog" aria-modal="true" data-closing={closing ? '' : undefined}>
      <div className="modal-backdrop fixed inset-0 bg-black/50" onClick={requestClose} aria-hidden="true" />
      {/* The top pad clears the iPhone status bar the home-screen app draws
          over the page (zero anywhere else). */}
      <div className="relative flex min-h-full items-center justify-center p-4" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}>
        <div
          className={`modal-panel relative bg-white border border-border shadow-xl w-full ${maxWidth} my-8`}
          onAnimationEnd={(e) => { if (closing && e.target === e.currentTarget) finishClose() }}
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
        </div>
      </div>
    </div>,
    document.body
  )
}
