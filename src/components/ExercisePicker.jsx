import { useState, useRef, useEffect } from 'react'
import { Plus, Search } from 'lucide-react'
import { MOVEMENTS } from '../lib/movements'

// Searchable exercise picker: filters the movement library as you type, and
// always offers to add whatever you typed as a custom exercise if it's not a
// listed movement.
export default function ExercisePicker({ onSelect }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const q = query.trim().toLowerCase()
  const matches = (q ? MOVEMENTS.filter((m) => m.name.toLowerCase().includes(q)) : MOVEMENTS).slice(0, 8)
  const exact = MOVEMENTS.some((m) => m.name.toLowerCase() === q)

  function pick(name) {
    const trimmed = name.trim()
    if (!trimmed) return
    onSelect(trimmed)
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-2 bg-cream border border-border px-3 focus-within:border-text-primary transition-colors">
        <Search className="w-4 h-4 text-text-light shrink-0" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === 'Enter' && query.trim()) { e.preventDefault(); pick(query) } }}
          placeholder="Search or add an exercise…"
          className="flex-1 min-w-0 bg-transparent py-3 text-text-primary text-[13px] outline-none"
        />
      </div>

      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-border max-h-64 overflow-y-auto shadow-lg">
          {matches.map((m) => (
            <button
              key={m.name}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(m.name)}
              className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left bg-transparent border-none border-b border-border cursor-pointer hover:bg-cream transition-colors"
            >
              <span className="text-[13px] text-text-primary">{m.name}</span>
              <span className="text-[10px] uppercase tracking-wider text-text-light shrink-0">{m.category}</span>
            </button>
          ))}

          {q && !exact && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(query)}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-left bg-cream border-none cursor-pointer hover:bg-cream-dark transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-text-primary shrink-0" />
              <span className="text-[13px] text-text-primary">Add “{query.trim()}” as a custom exercise</span>
            </button>
          )}

          {matches.length === 0 && !q && (
            <p className="px-4 py-3 text-[12px] text-text-light">Start typing to search…</p>
          )}
        </div>
      )}
    </div>
  )
}
