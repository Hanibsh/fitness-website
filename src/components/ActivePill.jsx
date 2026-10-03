import { motion } from 'framer-motion'
import { PILL_SPRING } from '../lib/motion'

// The dark "selected" block in a row of toggle buttons, sliding to whichever
// one you tap instead of blinking across. Render it inside the active button
// only, with an `id` shared by that row (and no other row on the page); the
// button needs `relative` and its label `relative` too, so the text sits on top.
// `className` swaps the fill for a row whose selected state isn't the dark one.
export default function ActivePill({ id, className = 'bg-text-primary' }) {
  return (
    <motion.span
      layoutId={id}
      aria-hidden="true"
      className={`absolute inset-0 ${className}`}
      transition={PILL_SPRING}
    />
  )
}
