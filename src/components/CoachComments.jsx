import { useState } from 'react'
import { Send, X } from 'lucide-react'
import { NOTE_MAX } from '../lib/coach'

const fmt = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

// The coach's notes on one thing — a session, a check-in, or the client in
// general — and a box to add another. The client sees them on their
// dashboard's "From Leon" card.
export default function CoachComments({ notes, onAdd, onRemove, placeholder = 'Add a comment', label = 'Your comments' }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function send() {
    if (!text.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      await onAdd(text)
      setText('')
    } catch {
      setError('Didn’t send — try again.')
    }
    setBusy(false)
  }

  return (
    <div>
      {notes.length > 0 && (
        <>
          <p className="text-[11px] font-medium uppercase tracking-wider text-text-light mb-2">{label}</p>
          <div className="space-y-2 mb-3">
            {[...notes].reverse().map((n) => (
              <div key={n.id} className="flex items-start gap-2 bg-cream border border-border px-3 py-2">
                <p className="flex-1 min-w-0 text-[13px] text-text-secondary break-words whitespace-pre-line">{n.body}</p>
                <span className="shrink-0 text-[11px] text-text-light mt-0.5">
                  {fmt(n.created_at)}
                  {n.read_at ? ' · seen' : ''}
                </span>
                <button
                  onClick={() => onRemove(n.id).catch(() => {})}
                  aria-label="Delete comment"
                  className="shrink-0 text-text-light hover:text-red-600 bg-transparent border-none cursor-pointer p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="flex gap-2 items-end">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, NOTE_MAX))}
          rows={2}
          placeholder={placeholder}
          aria-label={placeholder}
          className="flex-1 min-w-0 bg-cream border border-border px-3 py-2 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors resize-y"
        />
        <button
          onClick={send}
          disabled={!text.trim() || busy}
          aria-label="Send"
          className="shrink-0 inline-flex items-center gap-1.5 bg-text-primary text-cream font-medium px-3 py-2.5 border-none cursor-pointer text-[13px] hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
      {error && <p className="text-[12px] text-red-600 mt-2">{error}</p>}
    </div>
  )
}
