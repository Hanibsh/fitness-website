import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Calculator, X, Delete } from 'lucide-react'

// A four-function calculator that lives as a bubble in the corner of the log,
// for the arithmetic that comes up mid-session: plate math, total volume,
// converting a coach's percentage into a real number.
//
// It keeps one accumulator, so `2 + 2 =` leaves 4 on screen and the next
// operator picks that 4 back up as its left-hand side.

// Results come back through toPrecision to shake off binary-float noise
// (0.1 + 0.2 would otherwise read 0.30000000000000004). 12 digits is well
// inside a double's 15-17 and far past anything a barbell needs.
function fmt(n) {
  const r = Number(n.toPrecision(12))
  return Object.is(r, -0) ? '0' : String(r)
}

// Returns null for the one undefined case, which the caller turns into Error.
function apply(a, b, op) {
  switch (op) {
    case '+': return a + b
    case '−': return a - b
    case '×': return a * b
    case '÷': return b === 0 ? null : a / b
    default: return b
  }
}

const START = { display: '0', acc: null, op: null, history: '', fresh: true, error: false }

export default function QuickCalculator() {
  const [open, setOpen] = useState(false)
  const [calc, setCalc] = useState(START)
  const fabRef = useRef(null)
  const panelRef = useRef(null)

  // `fresh` marks a display the next digit should replace rather than extend:
  // true after =, after an operator, and at the start.
  const digit = useCallback((d) => {
    setCalc((p) => {
      const base = p.error ? START : p
      if (base.fresh || base.display === '0') return { ...base, display: d, fresh: false, error: false }
      if (base.display.replace(/[^0-9]/g, '').length >= 12) return base
      return { ...base, display: base.display + d, fresh: false }
    })
  }, [])

  const dot = useCallback(() => {
    setCalc((p) => {
      const base = p.error ? START : p
      if (base.fresh) return { ...base, display: '0.', fresh: false, error: false }
      return base.display.includes('.') ? base : { ...base, display: base.display + '.' }
    })
  }, [])

  const operator = useCallback((next) => {
    setCalc((p) => {
      if (p.error) return p
      const cur = parseFloat(p.display)
      // Pressing an operator twice in a row just swaps it — nothing new to fold in.
      if (p.op && !p.fresh) {
        const res = apply(p.acc, cur, p.op)
        if (res === null) return { ...START, error: true, display: 'Error' }
        return { ...p, acc: res, display: fmt(res), op: next, fresh: true, history: `${fmt(res)} ${next}` }
      }
      return { ...p, acc: cur, op: next, fresh: true, history: `${fmt(cur)} ${next}` }
    })
  }, [])

  const equals = useCallback(() => {
    setCalc((p) => {
      if (p.error) return p
      const cur = parseFloat(p.display)
      if (p.op == null) return { ...p, history: `${fmt(cur)} =`, fresh: true }
      const res = apply(p.acc, cur, p.op)
      if (res === null) return { ...START, error: true, display: 'Error' }
      return { display: fmt(res), acc: null, op: null, fresh: true, error: false, history: `${fmt(p.acc)} ${p.op} ${fmt(cur)} =` }
    })
  }, [])

  const back = useCallback(() => {
    setCalc((p) => {
      if (p.error) return START
      if (p.fresh) return p
      const next = p.display.slice(0, -1)
      return { ...p, display: next === '' || next === '-' ? '0' : next }
    })
  }, [])

  const clear = useCallback(() => setCalc(START), [])

  const close = useCallback(() => setOpen(false), [])

  // Physical keyboards drive the pad too, but the log page is wall-to-wall
  // weight and rep fields — anything typed into one of those is the user
  // logging a set, never calculator input.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target
      const tag = t?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) return
      // A modal covers the pad, so the pad shouldn't answer the keyboard from
      // under it — Escape belongs to the dialog on top, not to us.
      if (document.querySelector('[aria-modal="true"]')) return

      const k = e.key
      if (k >= '0' && k <= '9') digit(k)
      else if (k === '.' || k === ',') dot()
      else if (k === '+') operator('+')
      else if (k === '-') operator('−')
      else if (k === '*' || k === 'x' || k === 'X') operator('×')
      else if (k === '/') operator('÷')
      else if (k === 'Enter' || k === '=') equals()
      else if (k === 'Backspace') back()
      else if (k === 'Escape') close()
      else if (k === 'c' || k === 'C' || k === 'Delete') clear()
      else return
      e.preventDefault()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, digit, dot, operator, equals, back, clear, close])

  // Focus follows the toggle in both directions. On close it has to happen in
  // an effect, not in the handler: the bubble only mounts once `open` is false,
  // so the ref is still null while close() runs.
  const openedOnce = useRef(false)
  useEffect(() => {
    if (open) {
      openedOnce.current = true
      panelRef.current?.focus({ preventScroll: true })
    } else if (openedOnce.current) {
      fabRef.current?.focus({ preventScroll: true })
    }
  }, [open])

  // The two share everything but their text color, and that color can't be
  // overridden by appending a second utility — both compile to `color`, so the
  // stylesheet's order decides the winner, not the order in this string.
  const base = 'py-3.5 text-[15px] bg-white border-none cursor-pointer hover:bg-cream-dark active:bg-cream-dark transition-colors'
  const key = `${base} text-text-primary`
  const opKey = `${base} text-text-muted font-medium`

  // Portalled to body: the log wraps its content in a motion.div, and a
  // transform on an ancestor makes it the containing block for anything fixed.
  return createPortal(
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-label="Calculator"
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ duration: 0.14 }}
            style={{ transformOrigin: 'bottom right' }}
            className="fixed bottom-4 right-4 z-[80] w-60 max-w-[calc(100vw-2rem)] bg-white border border-border shadow-xl outline-none"
          >
            <div className="flex items-start justify-between gap-2 px-3 pt-2.5 pb-2">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-text-light h-4 truncate" aria-hidden="true">{calc.history}</p>
                <p className="font-heading text-2xl font-medium text-text-primary text-right truncate tabular-nums" aria-live="polite">
                  {calc.display}
                </p>
              </div>
              <button
                onClick={close}
                aria-label="Minimize calculator"
                className="shrink-0 text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer p-0.5 -mr-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-px bg-border border-t border-border">
              <button onClick={clear} className={`${opKey} col-span-2`}>C</button>
              <button onClick={back} aria-label="Delete last digit" className={`${opKey} inline-flex items-center justify-center`}>
                <Delete className="w-4 h-4" />
              </button>
              <button onClick={() => operator('÷')} className={opKey} aria-label="Divide">÷</button>

              {['7', '8', '9'].map((d) => <button key={d} onClick={() => digit(d)} className={key}>{d}</button>)}
              <button onClick={() => operator('×')} className={opKey} aria-label="Multiply">×</button>

              {['4', '5', '6'].map((d) => <button key={d} onClick={() => digit(d)} className={key}>{d}</button>)}
              <button onClick={() => operator('−')} className={opKey} aria-label="Subtract">−</button>

              {['1', '2', '3'].map((d) => <button key={d} onClick={() => digit(d)} className={key}>{d}</button>)}
              <button onClick={() => operator('+')} className={opKey} aria-label="Add">+</button>

              <button onClick={() => digit('0')} className={`${key} col-span-2`}>0</button>
              <button onClick={dot} className={key} aria-label="Decimal point">.</button>
              <button
                onClick={equals}
                aria-label="Equals"
                className="py-3.5 text-[15px] font-medium bg-text-primary text-cream border-none cursor-pointer hover:bg-accent-hover transition-colors"
              >
                =
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!open && (
        <button
          ref={fabRef}
          onClick={() => setOpen(true)}
          aria-label="Open calculator"
          title="Calculator"
          className="fixed bottom-4 right-4 z-[80] w-12 h-12 rounded-full bg-text-primary text-cream border-none cursor-pointer shadow-lg inline-flex items-center justify-center hover:bg-accent-hover transition-colors"
        >
          <Calculator className="w-5 h-5" />
        </button>
      )}
    </>,
    document.body
  )
}
