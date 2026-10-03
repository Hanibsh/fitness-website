import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { DURATION, EASE } from '../lib/motion'

// A fold that slides open and shut instead of jumping. Drop-in for
// `{open && <div>…</div>}`: keep padding, borders and margins on the child, not
// on this wrapper, or they'd still show when it's folded to zero height.
//
// Clips only while it moves — once open, overflow goes back to visible, so a
// focus ring or a dropdown inside isn't cut off at the edge.
//
// The app-wide reduced-motion setting (main.jsx) only stills transforms; height
// isn't one, so this checks for itself and snaps instead.
export default function Collapse({ open, id, children }) {
  const reduce = useReducedMotion()
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="collapse"
          id={id}
          initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
          animate={{ height: 'auto', opacity: 1, transitionEnd: { overflow: 'visible' } }}
          exit={{ height: 0, opacity: 0, overflow: 'hidden', transition: { duration: reduce ? 0 : DURATION.fast, ease: EASE } }}
          transition={{ duration: reduce ? 0 : DURATION.base, ease: EASE }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
