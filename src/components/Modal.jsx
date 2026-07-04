import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export default function Modal({ onClose, children, maxWidth = 'max-w-lg' }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  // Rendered through a portal to document.body so it's never trapped inside a
  // parent's stacking context (e.g. the fixed navbar). Outer scrolls; inner
  // centers when it fits and stays fully reachable when it's taller than the
  // viewport — the top is never clipped.
  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-text-primary/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative flex min-h-full items-center justify-center p-4">
        <div className={`relative bg-white border border-border shadow-xl w-full ${maxWidth} my-8`}>
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer z-10"
          >
            <X className="w-5 h-5" />
          </button>
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}
