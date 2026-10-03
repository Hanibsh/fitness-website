import { useLayoutEffect, useRef } from 'react'
import { WAVE_STEP } from '../lib/motion'

// Items that come into view together — a page's first screen, a row scrolled
// up into view — ripple in one after another, in page order, instead of
// landing all at once. That ripple is the wave: left to right across a row of
// a grid, top to bottom down a phone's single column. Capped, so a fast scroll
// past many items never leaves the last one waiting.
const BATCH_WINDOW_MS = 80
const MAX_STEPS = 4
let batchStart = -Infinity
let batchIndex = 0
function nextDelay() {
  const now = performance.now()
  if (now - batchStart > BATCH_WINDOW_MS) {
    batchStart = now
    batchIndex = 0
  }
  return Math.min(batchIndex++, MAX_STEPS) * WAVE_STEP
}

// One observer for every card on the page, not one each. It fires the moment
// a card's first pixel is on screen, so the rise is under way as it scrolls in
// rather than trailing behind.
const onEnter = new WeakMap()
let observer = null
function observe(el, callback) {
  if (!observer) {
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        observer.unobserve(entry.target)
        onEnter.get(entry.target)?.()
        onEnter.delete(entry.target)
      }
    })
  }
  onEnter.set(el, callback)
  observer.observe(el)
  return () => {
    observer.unobserve(el)
    onEnter.delete(el)
  }
}

// Rises and fades in the first time it scrolls into view. Once only: scrolling
// back up shows it as it was, not a replay. The motion itself is CSS
// ([data-reveal] in index.css) — this only decides when, and the delay.
//
// Wrap a grid's items, or a page's cards. Pass `className="grid"` when the
// wrapper is itself a grid item and the card inside should keep stretching to
// the row's height.
export default function Reveal({ children, className }) {
  const ref = useRef(null)

  // Before first paint, so a card below the fold never flashes in and back out.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    el.dataset.reveal = 'pending'
    // Done: drop the attribute so nothing lingers on the card. Its own
    // animation only — a child's animationend bubbles up here too.
    const settle = (e) => {
      if (e.target !== el) return
      el.removeAttribute('data-reveal')
      el.style.animationDelay = ''
      el.removeEventListener('animationend', settle)
    }
    el.addEventListener('animationend', settle)
    const stop = observe(el, () => {
      el.style.animationDelay = `${nextDelay()}s`
      el.dataset.reveal = 'in'
    })
    return () => {
      stop()
      el.removeEventListener('animationend', settle)
    }
  }, [])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
