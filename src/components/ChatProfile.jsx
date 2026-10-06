import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Play } from 'lucide-react'
import Modal from './Modal'
import ProgressView from './ProgressView'
import { SplitDays } from './ChatCard'
import { todayPlan } from '../lib/program'
import { CHECKIN_QUESTIONS } from '../lib/checkins'

const TABS = [
  { id: 'progress', label: 'Progress' },
  { id: 'split', label: 'Split' },
  { id: 'checkins', label: 'Check-ins' },
  { id: 'media', label: 'Media' },
]
const CHECKIN_WEEKS = 6

const longDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString()

function TodayLine({ program, annotations, sessions }) {
  const plan = useMemo(() => {
    const now = Date.now()
    return todayPlan(program, { now, annotations, trainedToday: sessions.some((s) => sameDay(s.date, now)) })
  }, [program, annotations, sessions])
  const text = {
    train: plan.day && `Today: ${plan.day.name}`,
    rest: 'Today: rest',
    done: 'Trained today',
    off: 'Today: marked off',
  }[plan.status]
  return text ? <p className="text-[13px] text-text-muted mt-0.5">{text}</p> : null
}

function SplitTab({ program, openPath, annotations, sessions }) {
  if (!program) return <p className="text-[13px] text-text-muted">No split yet.</p>
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-medium text-text-primary break-words">{program.name || 'Split'}</h3>
          <TodayLine program={program} annotations={annotations} sessions={sessions} />
        </div>
        {openPath && (
          <Link to={openPath} className="shrink-0 inline-flex items-center gap-1 text-[13px] font-medium text-text-secondary hover:text-text-primary no-underline">
            Open <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>
      <SplitDays program={program} className="mt-5" />
    </div>
  )
}

// The last few weeks side by side, newest on the right: each question's 1–5
// across the weeks reads as its trend.
function CheckinsTab({ checkins, replyPath }) {
  const weeks = useMemo(
    () => [...checkins].sort((a, b) => a.week_start.localeCompare(b.week_start)).slice(-CHECKIN_WEEKS),
    [checkins]
  )
  if (!weeks.length) return <p className="text-[13px] text-text-muted">No check-ins yet.</p>
  const latest = weeks[weeks.length - 1]
  const head = (iso) => {
    const [y, m, d] = iso.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    return { day: date.getDate(), month: date.toLocaleDateString('en-GB', { month: 'short' }) }
  }
  return (
    <div>
      <table className="w-full table-fixed border-collapse text-center">
        <thead>
          <tr>
            <th className="w-[30%]" />
            {weeks.map((w) => {
              const h = head(w.week_start)
              return (
                <th key={w.week_start} className="pb-1.5 text-[10px] font-normal text-text-light leading-tight">
                  {h.day}
                  <br />
                  {h.month}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {CHECKIN_QUESTIONS.map((q) => (
            <tr key={q.key} className="border-t border-border">
              <th scope="row" className="py-2 pr-1 text-left text-[11px] font-normal text-text-secondary truncate">{q.label}</th>
              {weeks.map((w, i) => (
                <td
                  key={w.week_start}
                  className={`py-2 text-[13px] tabular-nums ${i === weeks.length - 1 ? 'font-medium text-text-primary' : 'text-text-muted'}`}
                >
                  {w.answers?.[q.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {latest.answers?.note && (
        <p className="text-[13px] text-text-secondary mt-4 bg-cream border border-border px-3 py-2.5 break-words whitespace-pre-line">{latest.answers.note}</p>
      )}
      {replyPath && (
        <Link to={replyPath} className="inline-flex items-center gap-1 mt-4 text-[13px] font-medium text-text-secondary hover:text-text-primary no-underline">
          Reply on their page <ChevronRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  )
}

function MediaTab({ media, onOpen }) {
  if (!media.length) return <p className="text-[13px] text-text-muted">No photos or videos yet.</p>
  return (
    <div className="grid grid-cols-3 gap-1">
      {media.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onOpen(m)}
          aria-label={m.type === 'video' ? 'Open video' : 'Open photo'}
          className="relative block aspect-square overflow-hidden bg-cream border-none p-0 cursor-pointer"
        >
          {m.url &&
            (m.type === 'video' ? (
              <video src={m.url} preload="metadata" muted playsInline className="w-full h-full object-cover pointer-events-none" />
            ) : (
              <img src={m.url} alt="" loading="lazy" className="w-full h-full object-cover" />
            ))}
          {m.type === 'video' && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="w-8 h-8 rounded-full bg-text-primary text-cream flex items-center justify-center">
                <Play className="w-4 h-4" />
              </span>
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// About the person a chat is with — or, for the client, about themselves:
// their progress, split, check-ins, and what's been shared in the chat.
//
//   about: { since, sinceLabel, sessions, bodyweight, unit, loading, program,
//            annotations, splitPath, checkins, checkinsPath }
//   media: [{ id, type, url, date }], newest first (from the chat)
export default function ChatProfile({ name, about, media, onClose }) {
  const [tab, setTab] = useState('progress')
  const [viewing, setViewing] = useState(null)
  const { sessions = [], bodyweight = [], annotations = [], checkins = [] } = about

  return (
    <Modal onClose={onClose} maxWidth="max-w-xl">
      <div className="p-5 sm:p-8">
        {viewing ? (
          <>
            <button
              type="button"
              onClick={() => setViewing(null)}
              className="inline-flex items-center gap-1.5 text-[13px] text-text-muted hover:text-text-primary bg-transparent border-none cursor-pointer p-0 mb-4"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            {viewing.type === 'video' ? (
              <video src={viewing.url} controls playsInline autoPlay className="block w-full max-h-[70vh] bg-black" />
            ) : (
              <img src={viewing.url} alt="Shared photo" className="block w-full max-h-[70vh] object-contain bg-cream" />
            )}
            <p className="text-[11px] text-text-light mt-2">{longDate(viewing.date)}</p>
          </>
        ) : (
          <>
            <h2 className="font-heading text-2xl font-medium text-text-primary pr-8 break-words">{name}</h2>
            {about.since && (
              <p className="text-[13px] text-text-muted mt-0.5">
                {about.sinceLabel} {longDate(about.since)}
              </p>
            )}
            <div className="flex border border-border mt-5 mb-6" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 min-w-0 px-1 py-2 text-[12px] sm:text-[13px] font-medium border-none cursor-pointer transition-colors ${
                    tab === t.id ? 'bg-text-primary text-cream' : 'bg-white text-text-muted hover:text-text-primary'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {tab === 'progress' &&
              (about.loading ? (
                <p className="text-[13px] text-text-muted">Loading…</p>
              ) : (
                <ProgressView sessions={sessions} bodyweight={bodyweight} unit={about.unit} />
              ))}
            {tab === 'split' &&
              (about.loading ? (
                <p className="text-[13px] text-text-muted">Loading…</p>
              ) : (
                <SplitTab program={about.program} openPath={about.splitPath} annotations={annotations} sessions={sessions} />
              ))}
            {tab === 'checkins' && <CheckinsTab checkins={checkins} replyPath={about.checkinsPath} />}
            {tab === 'media' && <MediaTab media={media} onOpen={(m) => m.url && setViewing(m)} />}
          </>
        )}
      </div>
    </Modal>
  )
}
