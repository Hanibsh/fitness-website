import { useLayoutEffect, useRef } from 'react'
import { EASE_CSS, PILL_MS, prefersReducedMotion } from '../lib/motion'

// The button each row's pill was last in, so a new one knows where to slide
// in from. Holding the button (not its position) means it's measured fresh at
// the moment of the slide, whatever has moved since.
const lastButton = new Map()

// A padding box in viewport pixels — the area the pill fills inside a button.
function box(button) {
  const r = button.getBoundingClientRect()
  return { x: r.left + button.clientLeft, y: r.top + button.clientTop, w: button.clientWidth, h: button.clientHeight }
}

// The "selected" block in a row of toggle buttons, sliding to whichever one
// you tap instead of blinking across. Render it inside the active button only,
// with an `id` shared by that row (and no other row on the page); the button
// needs `relative` and its label `relative` too, so the text sits on top.
// `className` swaps the fill for a row whose selected state isn't the dark one.
//
// The slide is a FLIP: the pill is drawn in its new button, then a WAAPI
// animation starts it at the old button's spot and lets it travel home. That's
// a transform, so the GPU runs it — however long the tap's re-render took.
export default function ActivePill({ id, className = 'bg-text-primary' }) {
  const ref = useRef(null)
  // Where this pill slides in from, read once. A ref, so React's dev-mode
  // double run of the effect slides from the same place instead of finding
  // this very button already recorded as "last".
  const fromRef = useRef(undefined)

  useLayoutEffect(() => {
    const pill = ref.current
    const button = pill?.parentElement
    if (!button) return
    if (fromRef.current === undefined) fromRef.current = lastButton.get(id) ?? null
    const prev = fromRef.current
    lastButton.set(id, button)
    // Forget a row once its page is gone, rather than holding its buttons.
    const forget = () => queueMicrotask(() => {
      if (!button.isConnected && lastButton.get(id) === button) lastButton.delete(id)
    })
    if (!prev || prev === button || !prev.isConnected || prefersReducedMotion()) return forget

    const from = box(prev)
    const to = box(button)
    if (!to.w || !to.h) return forget
    // Above its neighbours while it travels, so it slides over them, not under.
    button.style.zIndex = '1'
    const anim = pill.animate(
      [
        { transform: `translate(${from.x - to.x}px, ${from.y - to.y}px) scale(${from.w / to.w}, ${from.h / to.h})` },
        { transform: 'none' },
      ],
      { duration: PILL_MS, easing: EASE_CSS },
    )
    anim.onfinish = () => { button.style.zIndex = '' }
    return () => {
      // Settled here, not in an oncancel handler: that event lands a beat
      // later and could clear the z-index a fresh slide has just set.
      anim.onfinish = null
      anim.cancel()
      button.style.zIndex = ''
      forget()
    }
  }, [id])

  return <span ref={ref} aria-hidden="true" className={`absolute inset-0 origin-top-left ${className}`} />
}
