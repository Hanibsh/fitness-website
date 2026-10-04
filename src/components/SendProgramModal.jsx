import { useState } from 'react'
import { Send } from 'lucide-react'
import Modal from './Modal'

// Sending one of a client's programs to their linked account — or, once it's
// out there, stopping. A sent program is locked on their side and every edit
// here reaches them.
export default function SendProgramModal({ program, clientName, isSent, onSend, onStop, onClose }) {
  const [makeActive, setMakeActive] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const name = clientName || 'them'

  async function run(fn) {
    setBusy(true)
    setError('')
    try {
      await fn()
      onClose()
    } catch {
      setError('That didn’t work — try again.')
      setBusy(false)
    }
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-sm">
      <div className="p-7">
        {isSent ? (
          <>
            <h3 className="font-heading text-xl font-medium text-text-primary mb-2 pr-8 break-words">Live on {name}’s account</h3>
            <p className="text-[13px] text-text-muted mb-6 leading-relaxed">Your edits reach {name}. Stop, and the split stays theirs to change.</p>
            {error && <p className="text-[12px] text-red-600 mb-3">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => run(onStop)}
                disabled={busy}
                className="flex-1 bg-white text-red-600 font-medium py-3 border border-border hover:border-red-300 cursor-pointer text-[14px] transition-colors disabled:opacity-50"
              >
                Stop sending
              </button>
              <button onClick={onClose} className="px-5 text-text-muted hover:text-text-primary bg-white border border-border hover:border-border-hover cursor-pointer text-[13px] transition-colors">
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="font-heading text-xl font-medium text-text-primary mb-2 pr-8 break-words">Send “{program.name}”?</h3>
            <p className="text-[13px] text-text-muted mb-5 leading-relaxed">It shows up in {name}’s splits. Only you can edit it.</p>
            <label className="flex items-start gap-3 cursor-pointer mb-6">
              <input
                type="checkbox"
                checked={makeActive}
                onChange={(e) => setMakeActive(e.target.checked)}
                className="mt-0.5 w-4 h-4 shrink-0 accent-text-primary cursor-pointer"
              />
              <span className="text-[13px] text-text-secondary">Make it their current split</span>
            </label>
            {error && <p className="text-[12px] text-red-600 mb-3">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => run(() => onSend(makeActive))}
                disabled={busy}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-text-primary text-cream font-medium py-3 border-none cursor-pointer text-[14px] hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" /> {busy ? 'Sending…' : 'Send'}
              </button>
              <button onClick={onClose} className="px-5 text-text-muted hover:text-text-primary bg-white border border-border hover:border-border-hover cursor-pointer text-[13px] transition-colors">
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
