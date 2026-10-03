import { useState, useRef, useEffect, useId } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { searchNames } from '../lib/exerciseLibrary'
import SearchField from './SearchField'

// A dropdown of exercise names you can type into — the stand-in for a native
// <select> once the list is long enough to scroll (everything someone has ever
// logged). Same search as everywhere else, so "rdl" finds the Romanian
// deadlift here too.
//
// Keyboard: ↑/↓ move, Enter picks, Esc clears the text first and closes on the
// second press — and that Esc never reaches a modal underneath, so closing the
// list doesn't also throw away the goals you were editing.
// `tone` is the trigger's fill: cream on a white card, white on a cream one.
export default function ExerciseSelect({ value, options, onChange, ariaLabel = 'Select exercise', tone = 'cream', className = '' }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const boxRef = useRef(null)
  const triggerRef = useRef(null)
  const listRef = useRef(null)
  const listId = useId()

  const matches = searchNames(options, query)

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  // Keep the highlighted row on screen as the arrow keys walk the list.
  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  function openList() {
    setQuery('')
    // Start on the current pick, so Enter straight away is a no-op, not a change.
    setActive(Math.max(0, options.indexOf(value)))
    setOpen(true)
  }

  function close() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  function pick(name) {
    onChange(name)
    close()
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, matches.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (matches[active]) pick(matches[active])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      close()
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openList())}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${ariaLabel}: ${value || 'none'}`}
        className={`w-full flex items-center justify-between gap-2 ${tone === 'white' ? 'bg-white' : 'bg-cream'} border border-border px-3 py-2 text-[13px] text-text-primary text-left cursor-pointer outline-none focus:border-text-primary hover:border-border-hover transition-colors`}
      >
        <span className="min-w-0 truncate">{value || 'Pick an exercise'}</span>
        <ChevronDown className={`w-4 h-4 text-text-light shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 left-0 mt-1 w-full min-w-[16rem] max-w-[calc(100vw-2rem)] bg-white border border-border shadow-lg">
          <div className="p-2 border-b border-border">
            <SearchField
              value={query}
              onChange={(v) => { setQuery(v); setActive(0) }}
              onKeyDown={onKeyDown}
              placeholder={`Search ${options.length} exercises…`}
              padY="py-2"
              autoFocus
              aria-controls={listId}
              aria-activedescendant={matches[active] ? `${listId}-${active}` : undefined}
            />
          </div>
          <ul ref={listRef} id={listId} role="listbox" aria-label={ariaLabel} className="list-none m-0 p-0 max-h-64 overflow-y-auto">
            {matches.map((name, i) => (
              <li
                key={name}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={name === value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(name)}
                onMouseEnter={() => setActive(i)}
                className={`flex items-center justify-between gap-2 px-3 py-2.5 text-[13px] text-text-primary cursor-pointer border-b border-border last:border-b-0 ${
                  i === active ? 'bg-cream' : ''
                }`}
              >
                <span className="min-w-0 break-words">{name}</span>
                {name === value && <Check className="w-3.5 h-3.5 text-text-light shrink-0" />}
              </li>
            ))}
            {!matches.length && (
              <li className="px-3 py-3 text-[12px] text-text-light">
                Nothing you’ve logged matches “{query.trim()}”.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
