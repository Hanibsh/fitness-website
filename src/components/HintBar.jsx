import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Repeat } from 'lucide-react'

// "Same as last time", for the set you're typing into, reachable by thumb.
//
// The per-set version of that used to be bound to the Enter key, on the theory
// that a phone's Return key IS the ✓ your thumb is already on. That's true on
// Android and false on iOS: a numeric keypad there has no Return key at all,
// so iOS bolts its own ⌃ ⌄ ✓ bar above the keyboard — and that ✓ only dismisses
// the keyboard. It dispatches no key event, so the handler could never fire and
// per-set autofill was simply unreachable on an iPhone.
//
// So it gets a real control: a strip that rides just above the keyboard while
// you're in a set that still has a suggestion waiting.

export default function HintBar({ label, onTake }) {
  // How much of the window the keyboard is covering. visualViewport is the only
  // thing that reports this; it shrinks when the keyboard opens while
  // window.innerHeight doesn't. Zero when there's no keyboard, and zero on
  // Android, where the keyboard resizes the layout viewport too and the two
  // heights stay in step — so this must never be used to decide WHETHER to
  // show the bar, only where to put it.
  const [keyboard, setKeyboard] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setKeyboard(Math.max(0, window.innerHeight - (vv.height + vv.offsetTop)))
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return createPortal(
    <AnimatePresence>
      {label && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.12 }}
          style={{ bottom: keyboard }}
          className="fixed left-0 right-0 z-[85] px-3 pb-2"
        >
          <button
            type="button"
            // Without this the input blurs on touch-down, which both closes the
            // keyboard under us and loses track of which set was being typed
            // into — by the time the click landed there'd be nothing to fill.
            // Preventing the default here keeps focus put; the click still fires.
            onPointerDown={(e) => e.preventDefault()}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onTake}
            className="w-full inline-flex items-center justify-center gap-2 bg-text-primary text-cream border-none cursor-pointer shadow-lg py-3 px-4 text-[13px] font-medium"
          >
            <Repeat className="w-4 h-4 shrink-0" />
            <span className="truncate">Use {label}</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
