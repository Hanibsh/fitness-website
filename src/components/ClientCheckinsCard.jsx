import { useState } from 'react'
import { ClipboardCheck } from 'lucide-react'
import CoachComments from './CoachComments'
import { CHECKIN_QUESTIONS, weekLabel } from '../lib/checkins'
import { useClientCheckins, useClientNotes } from '../lib/useCoachNotes'

const SHOWN = 3

// A linked client's weekly check-ins, newest first, each with a reply box.
// Sits on the client's page (ClientDetail).
export default function ClientCheckinsCard({ clientName, clientUserId }) {
  const checkins = useClientCheckins(clientUserId)
  const { notes, addNote, removeNote } = useClientNotes(clientUserId)
  const [all, setAll] = useState(false)
  const shown = all ? checkins : checkins.slice(0, SHOWN)

  return (
    <section className="bg-white border border-border p-5 sm:p-7">
      <h2 className="font-heading text-xl font-medium text-text-primary mb-1 flex items-center gap-2">
        <ClipboardCheck className="w-4 h-4" /> Check-ins
      </h2>
      {checkins.length === 0 ? (
        <p className="text-[13px] text-text-muted mt-3">None yet. {clientName || 'They'} can check in from their dashboard.</p>
      ) : (
        <div className="space-y-6 mt-4">
          {shown.map((c) => (
            <div key={c.id}>
              <p className="text-[13px] font-medium text-text-primary mb-2">{weekLabel(c.week_start)}</p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mb-2">
                {CHECKIN_QUESTIONS.map((q) => (
                  <div key={q.key} className="bg-cream border border-border px-2 py-1.5 text-center">
                    <p className="text-[9px] uppercase tracking-wider text-text-light truncate">{q.label}</p>
                    <p className="text-[15px] font-medium text-text-primary">{c.answers?.[q.key] ?? '—'}</p>
                  </div>
                ))}
              </div>
              {c.answers?.note && <p className="text-[13px] text-text-secondary mb-3 break-words whitespace-pre-line">{c.answers.note}</p>}
              <CoachComments
                notes={notes.filter((n) => n.kind === 'checkin' && n.target_id === c.id)}
                onAdd={(body) => addNote({ kind: 'checkin', targetId: c.id, body })}
                onRemove={removeNote}
                placeholder="Reply"
                label="Your reply"
              />
            </div>
          ))}
          {checkins.length > SHOWN && (
            <button
              onClick={() => setAll((v) => !v)}
              className="text-[12px] font-medium text-text-muted hover:text-text-primary bg-transparent border-none cursor-pointer p-0 transition-colors"
            >
              {all ? 'Show less' : `Show all ${checkins.length}`}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
