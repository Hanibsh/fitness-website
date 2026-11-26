import { useEffect, useRef, useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import NumberField from './NumberField'

// A NumberField you can also step: ▲/▼ any time, the mouse wheel on PC and a
// vertical drag on a phone.
//
// Wheel and drag only act once the box is SELECTED. The log is a grid of these
// boxes, so a wheel that changed whatever the pointer happened to be over, or a
// swipe that started on one, would quietly rewrite numbers while you were only
// scrolling the page. Selected first, then it's yours to spin.
//
// From empty, the first step lands ON `start` (the grey suggestion) rather
// than past it: the grey number is what you'd get, and touching it makes it
// real. Later steps move from there.

const WHEEL_STEP = 40 // px of wheel travel per step (one mouse notch ≈ 100)
const DRAG_STEP = 14 // px of finger travel per step

const round = (n) => Math.round(n * 100) / 100

export default function StepperField({
  value,
  onValueChange,
  step = 1,
  min = 0,
  max = Infinity,
  start = null,
  wrapperClassName = '',
  // Room on the right for the arrows (more when a unit label sits there too).
  arrowPad = '!pr-5',
  // Drop the arrows on the narrowest phones (<360px), where a weight box is
  // too thin to show both them and "102.5". Typing and drag still work.
  compact = false,
  className = '',
  onFocus,
  onBlur,
  ...rest
}) {
  const wrapRef = useRef(null)
  const [focused, setFocused] = useState(false)
  // Latest props for the native listeners, which are bound once.
  const live = useRef({})
  live.current = { value, onValueChange, step, min, max, start, focused }

  function stepBy(dir, times = 1) {
    const { value: v, onValueChange: change, step: st, min: lo, max: hi, start: s } = live.current
    const blank = v === '' || v == null || !Number.isFinite(Number(v))
    let next
    if (blank) {
      const base = s != null && s !== '' && Number.isFinite(Number(s)) ? Number(s) : null
      next = base != null ? base + dir * st * (times - 1) : dir > 0 ? st * times : lo
    } else {
      next = Number(v) + dir * st * times
    }
    next = round(Math.min(hi, Math.max(lo, next)))
    if (String(next) !== String(v)) change(String(next), 'step')
  }

  // Wheel: native + non-passive, so the page doesn't scroll while you spin.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    let acc = 0
    const onWheel = (e) => {
      if (!live.current.focused) return
      e.preventDefault()
      acc += e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY
      if (Math.abs(acc) < WHEEL_STEP) return
      stepBy(acc < 0 ? 1 : -1)
      acc = 0
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
    // stepBy reads live.current, so binding once is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Drag (touch/pen only — a mouse drag is for selecting text).
  const drag = useRef(null)
  // Set after a drag that started on the arrows, so the click that ends it
  // doesn't add one more step.
  const dragged = useRef(false)
  function onPointerDown(e) {
    if (e.pointerType === 'mouse') return
    // The arrow strip drags any time; the box itself only once selected.
    if (!focused && !e.target.closest?.('[data-stepper-arrows]')) return
    drag.current = { y: e.clientY, id: e.pointerId, moved: 0 }
    dragged.current = false
  }
  function onPointerMove(e) {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const dy = d.y - e.clientY
    const steps = Math.trunc(dy / DRAG_STEP)
    if (steps === 0) return
    stepBy(steps > 0 ? 1 : -1, Math.abs(steps))
    d.y -= steps * DRAG_STEP
    d.moved += Math.abs(steps)
    dragged.current = true
  }
  const tap = (dir) => () => {
    if (dragged.current) { dragged.current = false; return }
    stepBy(dir)
  }
  function endDrag() { drag.current = null }

  // The arrows mustn't take focus: that would close the phone keyboard (or
  // open it) and drop the hint bar for the box you're in.
  const keepFocus = (e) => e.preventDefault()
  const arrowCls = 'flex-1 flex items-center justify-center bg-transparent border-none p-0 cursor-pointer text-text-light hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed'
  const num = Number(value)
  const has = value !== '' && value != null && Number.isFinite(num)

  return (
    <div
      ref={wrapRef}
      className={`relative min-w-0 ${wrapperClassName}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <NumberField
        {...rest}
        value={value}
        onValueChange={onValueChange}
        onFocus={(e) => { setFocused(true); onFocus?.(e) }}
        onBlur={(e) => { setFocused(false); endDrag(); onBlur?.(e) }}
        className={`${className} ${compact ? 'min-[360px]:!pr-5' : arrowPad}`}
        style={{ ...rest.style, touchAction: focused ? 'none' : undefined }}
      />
      <div data-stepper-arrows className={`absolute right-px top-px bottom-px w-4 flex-col ${compact ? 'hidden min-[360px]:flex' : 'flex'}`} style={{ touchAction: 'none' }}>
        <button
          type="button" tabIndex={-1} aria-label="Increase"
          onPointerDown={keepFocus} onMouseDown={keepFocus}
          onClick={tap(1)}
          disabled={has && num >= max}
          className={arrowCls}
        >
          <ChevronUp className="w-3 h-3" />
        </button>
        <button
          type="button" tabIndex={-1} aria-label="Decrease"
          onPointerDown={keepFocus} onMouseDown={keepFocus}
          onClick={tap(-1)}
          disabled={has && num <= min}
          className={arrowCls}
        >
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}
