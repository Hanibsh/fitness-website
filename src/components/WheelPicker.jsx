import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// A box that opens a wheel picker: the phone-alarm kind, a column of numbers
// you spin until the one you want sits in the middle band.
//
// Phone: a sheet slides up from the bottom. PC: a small panel opens under the
// box, and the mouse wheel turns it one number per notch.
//
// Closing with Done (or tapping outside) keeps the number in the band, but only
// if you moved it or the box was empty. An empty box opens on its grey
// suggestion, so opening it and tapping Done takes that suggestion. A box
// that's already filled and only peeked at stays exactly as it was. That
// matters for heights like 66.9 in, which the whole-number wheel can't show.
// Escape closes without changing anything.

const ITEM = 40 // px per row
const ROWS = 5 // rows visible; the middle one is the pick

function nearestIndex(values, v) {
  if (v == null || v === '' || !Number.isFinite(Number(v))) return 0
  const n = Number(v)
  let best = 0
  for (let i = 1; i < values.length; i++) {
    if (Math.abs(values[i] - n) < Math.abs(values[best] - n)) best = i
  }
  return best
}

function WheelColumn({ values, initialIndex, suffix = '', label, onIndex, autoFocus }) {
  const ref = useRef(null)
  const [idx, setIdx] = useState(initialIndex)
  const target = useRef(null) // where wheel/keys are heading mid-animation
  const settle = useRef(null)

  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollTop = initialIndex * ITEM
    if (autoFocus) ref.current?.focus({ preventScroll: true })
    // Only on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const clamp = (i) => Math.max(0, Math.min(values.length - 1, i))

  function goTo(i) {
    const next = clamp(i)
    target.current = next
    clearTimeout(settle.current)
    settle.current = setTimeout(() => { target.current = null }, 300)
    ref.current?.scrollTo({ top: next * ITEM, behavior: 'smooth' })
  }

  function onScroll() {
    const i = clamp(Math.round(ref.current.scrollTop / ITEM))
    if (i !== idx) { setIdx(i); onIndex(i) }
  }

  // One number per mouse-wheel notch. Left to itself the browser would scroll
  // ~2.5 rows a notch and snap wherever it lands.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let acc = 0
    const onWheel = (e) => {
      e.preventDefault()
      acc += e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY
      if (Math.abs(acc) < 30) return
      const base = target.current ?? Math.round(el.scrollTop / ITEM)
      goTo(base + (acc > 0 ? 1 : -1))
      acc = 0
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.length])

  function onKeyDown(e) {
    const base = target.current ?? idx
    if (e.key === 'ArrowDown') { e.preventDefault(); goTo(base + 1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); goTo(base - 1) }
  }

  return (
    <div
      ref={ref}
      tabIndex={0}
      role="spinbutton"
      aria-label={label}
      aria-valuenow={values[idx]}
      aria-valuetext={`${values[idx]}${suffix}`}
      onScroll={onScroll}
      onKeyDown={onKeyDown}
      className="relative z-[1] w-24 overflow-y-scroll overscroll-contain snap-y snap-mandatory outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ height: ITEM * ROWS }}
    >
      <div style={{ height: ITEM * 2 }} aria-hidden="true" />
      {values.map((v, i) => (
        <div
          key={v}
          onClick={() => goTo(i)}
          className={`snap-center flex items-center justify-center cursor-pointer select-none tabular-nums ${i === idx ? 'text-text-primary text-[22px] font-medium' : 'text-text-light text-[18px]'}`}
          style={{ height: ITEM }}
        >
          {v}{suffix}
        </div>
      ))}
      <div style={{ height: ITEM * 2 }} aria-hidden="true" />
    </div>
  )
}

function WheelPopup({ anchor, title, columns, onDone, onCancel, onClear }) {
  const picks = useRef(columns.map((c) => c.initialIndex))
  const phone = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 639px)').matches
  const panelRef = useRef(null)
  const [pos, setPos] = useState(null)

  // The log re-renders every second (rest timer), handing down new callbacks
  // each time. Read them through a ref so the listeners bind once.
  const cb = useRef({})
  cb.current = { onDone, onCancel }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); cb.current.onCancel() }
      if (e.key === 'Enter') { e.preventDefault(); cb.current.onDone(picks.current) }
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [])

  // PC: sit under the box, or above it when there's no room below.
  useLayoutEffect(() => {
    if (phone || !anchor || !panelRef.current) return
    const a = anchor.getBoundingClientRect()
    const p = panelRef.current.getBoundingClientRect()
    const gap = 6
    let top = a.bottom + gap
    if (top + p.height > window.innerHeight - 8) top = Math.max(8, a.top - gap - p.height)
    const left = Math.max(8, Math.min(window.innerWidth - p.width - 8, a.left))
    setPos({ top, left })
  }, [phone, anchor])

  const header = (
    <div className="flex items-center justify-between gap-4 mb-2">
      <span className="text-[13px] font-medium text-text-primary">{title}</span>
      <div className="flex items-center gap-3">
        {onClear && (
          <button type="button" onClick={onClear} className="text-[13px] text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer p-0">
            Clear
          </button>
        )}
        <button type="button" onClick={() => onDone(picks.current)} className="text-[13px] font-medium text-text-primary bg-transparent border-none cursor-pointer p-0">
          Done
        </button>
      </div>
    </div>
  )

  const wheels = (
    <div className="relative flex justify-center gap-2">
      <div
        className="absolute left-0 right-0 bg-cream-dark border-y border-border pointer-events-none"
        style={{ top: ITEM * 2, height: ITEM }}
        aria-hidden="true"
      />
      {columns.map((c, ci) => (
        <WheelColumn
          key={ci}
          values={c.values}
          initialIndex={c.initialIndex}
          suffix={c.suffix}
          label={c.label}
          autoFocus={ci === 0}
          onIndex={(i) => { picks.current[ci] = i }}
        />
      ))}
    </div>
  )

  return createPortal(
    <div className="fixed inset-0 z-[110]" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className={`fixed inset-0 ${phone ? 'bg-black/40' : ''}`}
        onClick={() => onDone(picks.current)}
        aria-hidden="true"
      />
      {phone ? (
        <div
          className="fixed left-0 right-0 bottom-0 bg-white border-t border-border px-4 pt-3"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
        >
          {header}
          {wheels}
        </div>
      ) : (
        <div
          ref={panelRef}
          className="fixed bg-white border border-border shadow-xl px-4 pt-3 pb-3"
          style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, minWidth: 220 }}
        >
          {header}
          {wheels}
        </div>
      )}
    </div>,
    document.body
  )
}

// The box itself. `columns`: [{ values, current, suffix, label }], where
// `current` is the number to open on (the value, or the grey suggestion when
// empty). `onPick` gets one number per column.
export default function WheelField({
  columns,
  display,
  placeholder = '',
  blank,
  title,
  onPick,
  onClear,
  className = '',
  ...rest
}) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef(null)
  const cols = columns.map((c) => ({ ...c, initialIndex: nearestIndex(c.values, c.current) }))

  function close() {
    setOpen(false)
    btnRef.current?.focus({ preventScroll: true })
  }

  return (
    <>
      <button
        type="button"
        ref={btnRef}
        data-wheel-trigger=""
        {...rest}
        onClick={() => setOpen(true)}
        className={`${className} text-left cursor-pointer truncate`}
      >
        {blank ? <span className="text-text-light">{placeholder}</span> : display}
      </button>
      {open && (
        <WheelPopup
          anchor={btnRef.current}
          title={title}
          columns={cols}
          onCancel={close}
          onClear={onClear ? () => { onClear(); close() } : null}
          onDone={(picks) => {
            const moved = picks.some((p, i) => p !== cols[i].initialIndex)
            if (blank || moved) onPick(picks.map((p, i) => cols[i].values[p]))
            close()
          }}
        />
      )}
    </>
  )
}

export const range = (lo, hi, step = 1) => {
  const out = []
  for (let v = lo; v <= hi + 1e-9; v += step) out.push(Math.round(v * 100) / 100)
  return out
}
