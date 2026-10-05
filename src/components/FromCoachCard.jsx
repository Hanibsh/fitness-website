import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle, ClipboardCheck, Check, MessagesSquare } from 'lucide-react'
import MiniStat from './MiniStat'

const fmt = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const SHOWN = 3
// As many columns as there are targets, from sm up (static for Tailwind).
const COLS = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4', 5: 'sm:grid-cols-5' }

// A coached client's dashboard opens on this instead of the coaching ad: the
// coach's targets, their latest notes and comments, and the weekly check-in.
export default function FromCoachCard({ coachName = 'Leon', notes, unread, targets, sessions, checkin = null, unreadMessages = 0 }) {
  const [all, setAll] = useState(false)
  const sessionName = useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions])

  const t = targets || {}
  const stats = [
    t.goalWeight && { label: 'Goal weight', value: `${t.goalWeight} ${t.unit || 'kg'}` },
    t.calories && { label: 'Calories', value: Number(t.calories).toLocaleString('en-US') },
    t.protein && { label: 'Protein', value: `${t.protein} g` },
    t.carbs && { label: 'Carbs', value: `${t.carbs} g` },
    t.fat && { label: 'Fat', value: `${t.fat} g` },
  ].filter(Boolean)

  // What a note is about, and when: "On Upper A · 2 Oct" (the workout's
  // date), "Check-in reply · 4 Oct", or just the date.
  const about = (n) => {
    if (n.kind === 'session') {
      const s = sessionName.get(n.target_id)
      return s ? `On ${s.name || 'your workout'} · ${fmt(new Date(s.date).toISOString())}` : `On a workout · ${fmt(n.created_at)}`
    }
    if (n.kind === 'checkin') return `Check-in reply · ${fmt(n.created_at)}`
    return fmt(n.created_at)
  }

  const shown = all ? notes : notes.slice(0, SHOWN)

  return (
    <div className="bg-white border border-border p-5 sm:p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 shrink-0 rounded-full bg-text-primary flex items-center justify-center">
          <MessageCircle className="w-4 h-4 text-cream" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-text-light">Your coach</p>
          <h2 className="font-heading text-lg font-medium text-text-primary">From {coachName}</h2>
        </div>
        <Link
          to="/messages"
          className="ml-auto shrink-0 inline-flex items-center gap-1.5 text-[13px] font-medium text-text-primary bg-white border border-border hover:border-border-hover px-3 py-2 no-underline transition-colors"
        >
          <MessagesSquare className="w-4 h-4" /> Chat
          {unreadMessages > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-text-primary text-cream text-[10px] font-medium inline-flex items-center justify-center" aria-label={`${unreadMessages} unread`}>
              {unreadMessages}
            </span>
          )}
        </Link>
      </div>

      {stats.length > 0 && (
        <div className={`grid grid-cols-2 ${COLS[stats.length]} gap-2.5 mb-4`}>
          {stats.map((s) => <MiniStat key={s.label} label={s.label} value={s.value} />)}
        </div>
      )}

      {notes.length === 0 ? (
        <p className="text-[13px] text-text-muted">No notes yet.</p>
      ) : (
        <div className="space-y-2">
          {shown.map((n) => (
            <div key={n.id} className="bg-cream border border-border px-3 py-2.5">
              <div className="flex items-center gap-2 mb-0.5">
                {unread.has(n.id) && <span className="w-2 h-2 rounded-full bg-text-primary shrink-0" aria-label="New" />}
                <span className="text-[11px] text-text-light">{about(n)}</span>
              </div>
              <p className="text-[13px] text-text-secondary break-words whitespace-pre-line">{n.body}</p>
            </div>
          ))}
          {notes.length > SHOWN && (
            <button
              onClick={() => setAll((v) => !v)}
              className="text-[12px] font-medium text-text-muted hover:text-text-primary bg-transparent border-none cursor-pointer p-0 transition-colors"
            >
              {all ? 'Show less' : `Show all ${notes.length}`}
            </button>
          )}
        </div>
      )}

      {checkin && (
        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[13px] text-text-secondary flex items-center gap-1.5">
            {checkin.done ? <Check className="w-4 h-4 text-text-muted" /> : <ClipboardCheck className="w-4 h-4 text-text-muted" />}
            {checkin.done ? 'Check-in done this week' : 'Weekly check-in due'}
          </p>
          <button
            onClick={checkin.open}
            className={`inline-flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 cursor-pointer transition-colors ${
              checkin.done
                ? 'text-text-muted hover:text-text-primary bg-white border border-border hover:border-border-hover'
                : 'bg-text-primary text-cream border-none hover:bg-accent-hover'
            }`}
          >
            {checkin.done ? 'Edit' : 'Check in'}
          </button>
        </div>
      )}
    </div>
  )
}
