import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import Modal from './Modal'
import { MUSCLE_GROUPS } from '../lib/dashboard'
import { createBlock } from '../lib/blocks'

// Timestamp <-> the YYYY-MM-DD a date input wants, pinned to noon local so it
// never lands on a day boundary (tz-safe).
function toInputDate(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function fromInputDate(value) {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0).getTime()
}

// Create / edit one specialization block: a name, the focus muscle group(s), a
// start date, and an optional end date (ongoing until then).
export default function BlockModal({ block, onSave, onDelete, onClose }) {
  const [name, setName] = useState(block?.name || '')
  const [focus, setFocus] = useState(new Set(block?.focusMuscles || []))
  const [start, setStart] = useState(toInputDate(block?.startDate || Date.now()))
  const [ongoing, setOngoing] = useState(block ? block.endDate == null : true)
  const [end, setEnd] = useState(toInputDate(block?.endDate || Date.now()))

  function toggleMuscle(m) {
    setFocus((prev) => {
      const next = new Set(prev)
      if (next.has(m)) next.delete(m); else next.add(m)
      return next
    })
  }

  function save() {
    const focusMuscles = MUSCLE_GROUPS.filter((m) => focus.has(m))
    if (!focusMuscles.length) return
    const startDate = fromInputDate(start)
    const endDate = ongoing ? null : fromInputDate(end)
    const cleanName = name.trim() || `${focusMuscles.join(' + ')} focus`
    if (block) {
      onSave({ ...block, name: cleanName.slice(0, 60), focusMuscles, startDate, endDate })
    } else {
      onSave(createBlock({ name: cleanName, focusMuscles, startDate, endDate }))
    }
  }

  const canSave = focus.size > 0
  const dateInput = 'bg-cream border border-border px-3 py-2 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors'

  return (
    <Modal onClose={onClose} maxWidth="max-w-md">
      <div className="p-7">
        <h3 className="font-heading text-xl font-medium text-text-primary mb-5">{block ? 'Edit block' : 'New specialization block'}</h3>

        <div className="mb-5">
          <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-2">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Back + arms focus"
            aria-label="Block name"
            className={`${dateInput} w-full`}
          />
        </div>

        <div className="mb-5">
          <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-2">Focus muscles</label>
          <div className="flex flex-wrap gap-2">
            {MUSCLE_GROUPS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => toggleMuscle(m)}
                aria-pressed={focus.has(m)}
                className={`px-3 py-1.5 text-[12px] font-medium border cursor-pointer transition-colors ${
                  focus.has(m) ? 'bg-text-primary text-cream border-text-primary' : 'bg-white text-text-muted border-border hover:border-border-hover'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          {!canSave && <p className="text-[11px] text-text-light mt-2">Pick at least one muscle to specialize.</p>}
        </div>

        <div className="flex flex-wrap gap-5 mb-6">
          <div>
            <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-2">Start</label>
            <input type="date" value={start} max={toInputDate(Date.now())} onChange={(e) => setStart(e.target.value)} className={dateInput} aria-label="Block start date" />
          </div>
          <div>
            <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-2">End</label>
            <label className="flex items-center gap-2 text-[13px] text-text-secondary cursor-pointer mb-2">
              <input type="checkbox" checked={ongoing} onChange={(e) => setOngoing(e.target.checked)} className="w-4 h-4 accent-text-primary cursor-pointer" />
              Ongoing
            </label>
            {!ongoing && (
              <input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} className={dateInput} aria-label="Block end date" />
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={save}
            disabled={!canSave}
            className="flex-1 bg-text-primary text-cream font-medium py-3 border-none cursor-pointer text-[14px] hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {block ? 'Save block' : 'Start block'}
          </button>
          {block && onDelete && (
            <button
              onClick={() => onDelete(block.id)}
              aria-label="Delete block"
              className="px-4 text-text-light hover:text-red-600 bg-white border border-border hover:border-border-hover cursor-pointer transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="px-5 text-text-muted hover:text-text-primary bg-white border border-border hover:border-border-hover cursor-pointer text-[13px] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  )
}
