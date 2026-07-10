import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search, SearchX } from 'lucide-react'
import { searchExercises } from '../lib/exerciseLibrary'

// Searchable exercise picker: filters the exercise library (plus the user's
// own previously-logged exercises, surfaced first) as you type. Picking is
// restricted to the library — no free-text custom exercises — so every logged
// exercise has real muscle data behind it and counts toward effective volume.
export default function ExercisePicker({ onSelect, recentNames = [], onlyCategory, excludeCategory, placeholder = 'Search for an exercise…' }) {
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

  // Scope the library to this section: a resistance picker hides cardio moves,
  // a cardio picker shows only cardio.
  let results = searchExercises(query, recentNames)
  if (onlyCategory) results = results.filter((m) => m.category === onlyCategory)
  if (excludeCategory) results = results.filter((m) => m.category !== excludeCategory)
  const matches = results.slice(0, 8)

  function pick(m) {
    onSelect(m.name, m.category, m.id)
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
          onKeyDown={(e) => { if (e.key === 'Enter' && matches[0]) { e.preventDefault(); pick(matches[0]) } }}
          maxLength={60}
          placeholder={placeholder}
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
              onClick={() => pick(m)}
              className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left bg-transparent border-none border-b border-border cursor-pointer hover:bg-cream transition-colors"
            >
              <span className="text-[13px] text-text-primary">{m.name}</span>
              <span className="text-[10px] uppercase tracking-wider text-text-light shrink-0">{m.category}</span>
            </button>
          ))}

          {matches.length === 0 && query.trim() && (
            <div className="flex items-start gap-2 px-4 py-3">
              <SearchX className="w-3.5 h-3.5 text-text-light shrink-0 mt-0.5" />
              <p className="text-[12px] text-text-light leading-relaxed">
                No exercise found for “{query.trim()}”. Try a different search — only exercises in the library can be logged.{' '}
                <Link to="/contact" className="text-text-secondary underline hover:text-text-primary">
                  Can’t find it? Message me and I’ll add it to the library.
                </Link>
              </p>
            </div>
          )}

          {matches.length === 0 && !query.trim() && (
            <p className="px-4 py-3 text-[12px] text-text-light">Start typing to search…</p>
          )}
        </div>
      )}
    </div>
  )
}
