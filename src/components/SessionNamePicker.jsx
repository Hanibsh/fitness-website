import { useState, useRef, useEffect } from 'react'
import { Tag } from 'lucide-react'

// Common split labels — the user can pick one or type their own name.
const SESSION_TYPES = [
  'Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Full body',
  'Chest', 'Back', 'Shoulders', 'Arms',
  'Chest & triceps', 'Back & biceps', 'Legs & shoulders', 'Cardio',
]

// A combobox bound to the session name: free-typed value with a dropdown of
// suggestions filtered by what's typed.
export default function SessionNamePicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const q = (value || '').trim().toLowerCase()
  const matches = q ? SESSION_TYPES.filter((t) => t.toLowerCase().includes(q)) : SESSION_TYPES

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-2 bg-cream border border-border px-3 focus-within:border-text-primary transition-colors">
        <Tag className="w-4 h-4 text-text-light shrink-0" />
        <input
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Name this session — Push, Pull, Legs… (optional)"
          className="flex-1 min-w-0 bg-transparent py-2.5 text-text-primary text-[13px] outline-none"
        />
      </div>

      {open && matches.length > 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-border max-h-56 overflow-y-auto shadow-lg">
          {matches.map((t) => (
            <button
              key={t}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(t); setOpen(false) }}
              className="w-full text-left px-4 py-2.5 bg-transparent border-none border-b border-border cursor-pointer hover:bg-cream transition-colors text-[13px] text-text-primary"
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
