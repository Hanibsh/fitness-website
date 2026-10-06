import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Dumbbell, CalendarRange, ClipboardCheck, Trophy, ChevronRight, Copy, Check } from 'lucide-react'
import Modal from './Modal'
import SessionSummary from './SessionSummary'
import { isCard, splitShape } from '../lib/chatCards'
import { CHECKIN_QUESTIONS, weekLabel } from '../lib/checkins'
import { intakeLine } from '../lib/weeklyLog'
import { getFullExercise, primaryMuscles } from '../lib/exerciseBank'
import { sessionStats } from '../lib/workoutStore'
import { formatDuration } from '../lib/dashboard'
import { buildExportModel, partText, dayHeading, DEFAULT_EXPORT_PREFS } from '../lib/programExport'
import { scheduleMode } from '../lib/program'

const shortDate = (ts) => new Date(ts).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

// The frame every card shares: icon, title, one line under it, and an action.
function Frame({ icon: Icon, kicker, title, line, children, action }) {
  return (
    <div className="w-64 max-w-[66vw] bg-white border border-border text-left">
      <div className="px-3.5 pt-3 pb-2.5">
        <p className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-text-light">
          <Icon className="w-3.5 h-3.5" /> {kicker}
        </p>
        <p className="text-[14px] font-medium text-text-primary mt-1 break-words">{title}</p>
        {line && <p className="text-[12px] text-text-muted mt-0.5">{line}</p>}
        {children}
      </div>
      {action}
    </div>
  )
}

function ActionRow({ children, ...props }) {
  const cls =
    'w-full flex items-center justify-between gap-2 px-3.5 py-2.5 border-t border-border text-[13px] text-text-primary bg-transparent hover:bg-cream cursor-pointer no-underline transition-colors'
  return props.to ? (
    <Link className={cls} to={props.to} onClick={(e) => e.stopPropagation()}>
      {children} <ChevronRight className="w-4 h-4 text-text-light" />
    </Link>
  ) : (
    <button type="button" className={`${cls}`} onClick={(e) => { e.stopPropagation(); props.onClick() }}>
      {children} <ChevronRight className="w-4 h-4 text-text-light" />
    </button>
  )
}

// A shared split, read-only, laid out like the exported text: each day, its
// numbered movements. The reader can keep a copy (or, for a split the coach
// sent, open it where it already is).
export function SplitPreview({ program, footer, onClose }) {
  const model = useMemo(() => buildExportModel({ program }), [program])
  return (
    <Modal onClose={onClose} maxWidth="max-w-xl">
      <div className="p-6 sm:p-8">
        <h2 className="font-heading text-2xl font-medium text-text-primary pr-8 break-words">{model.title}</h2>
        {model.programLine && <p className="text-[13px] text-text-muted mt-1">{model.programLine}</p>}
        <SplitDays program={program} className="mt-6" />
        {footer && <div className="mt-6 pt-5 border-t border-border">{footer}</div>}
      </div>
    </Modal>
  )
}

// A split's days, each with its numbered movements — the export's text, laid
// out. Also the chat profile's Split tab.
export function SplitDays({ program, className = '' }) {
  const model = useMemo(() => buildExportModel({ program }), [program])
  const prefs = { ...DEFAULT_EXPORT_PREFS, weights: false }
  return (
    <div className={`space-y-6 ${className}`}>
      {model.days.map((day) => (
        <div key={day.id}>
          <h3 className="text-[13px] font-medium text-text-primary mb-2">{dayHeading(day)}</h3>
          <ol className="space-y-1.5 list-none p-0 m-0">
            {day.rows.map((r) => (
              <li key={r.number} className="text-[13px] text-text-secondary break-words">
                <span className="text-text-light tabular-nums">{r.number}.</span> {r.parts.map((p) => partText(p, prefs)).join(' + ')}
              </li>
            ))}
          </ol>
        </div>
      ))}
      {!model.days.length && <p className="text-[13px] text-text-muted">No days in it yet.</p>}
    </div>
  )
}

// A card's dialog is portaled out of the message, but React still bubbles its
// clicks up to the message — which would toggle its actions. Stop them here.
function Contained({ children }) {
  return (
    <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {children}
    </span>
  )
}

function CheckinGrid({ answers, food }) {
  return (
    <>
      <div className="grid grid-cols-3 gap-1 mt-2">
        {CHECKIN_QUESTIONS.map((q) => (
          <div key={q.key} className="bg-cream border border-border px-1 py-1 text-center">
            <p className="text-[9px] uppercase tracking-wider text-text-light truncate">{q.label}</p>
            <p className="text-[14px] font-medium text-text-primary">{answers?.[q.key] ?? '—'}</p>
          </div>
        ))}
      </div>
      {food && <p className="text-[12px] text-text-primary mt-2">{intakeLine(food)}</p>}
      {answers?.note && <p className="text-[13px] text-text-secondary mt-2 break-words whitespace-pre-line">{answers.note}</p>}
    </>
  )
}

// One shared thing in the chat. `mine`: you sent it. `saveSplit(program)` —
// keeps a copy of a split someone else shared, resolving to where it lives
// now; `sentSplitPath(id)` — where a split the coach sent sits on this side.
export default function ChatCard({ card, mine, saveSplit, sentSplitPath }) {
  const [open, setOpen] = useState(false)
  const [savedPath, setSavedPath] = useState(null)
  const [saveError, setSaveError] = useState('')

  if (!isCard(card)) {
    return <Frame icon={Dumbbell} kicker="Shared" title="This needs a newer version of the app" />
  }

  if (card.type === 'exercise') {
    const full = card.id ? getFullExercise(card.id) : null
    const muscles = full ? primaryMuscles(full).slice(0, 3).join(' · ') : card.category
    return (
      <Frame
        icon={Dumbbell}
        kicker="Exercise"
        title={full?.name || card.name}
        line={muscles}
        action={full ? <ActionRow to={`/exercises/${full.id}`}>Open</ActionRow> : null}
      />
    )
  }

  if (card.type === 'checkin') {
    return (
      <Frame icon={ClipboardCheck} kicker={card.updated ? 'Check-in updated' : 'Weekly check-in'} title={weekLabel(card.week_start)}>
        <CheckinGrid answers={card.answers} food={card.food} />
      </Frame>
    )
  }

  if (card.type === 'workout') {
    const s = card.session
    const stats = sessionStats(s)
    const duration = formatDuration(s.durationMs)
    const prs = card.prs || []
    return (
      <>
        <Frame
          icon={Dumbbell}
          kicker="Workout"
          title={s.name || 'Workout'}
          line={[shortDate(s.date), `${stats.sets} set${stats.sets === 1 ? '' : 's'}`, duration].filter(Boolean).join(' · ')}
          action={<ActionRow onClick={() => setOpen(true)}>View</ActionRow>}
        >
          {prs.length > 0 && (
            <p className="inline-flex items-center gap-1 text-[12px] text-text-primary mt-1.5">
              <Trophy className="w-3.5 h-3.5" /> {prs.length} personal best{prs.length === 1 ? '' : 's'}
            </p>
          )}
        </Frame>
        {open && (
          <Contained>
            <SessionSummary session={s} sharedPrs={prs} unit={s.unit || 'kg'} onClose={() => setOpen(false)} />
          </Contained>
        )}
      </>
    )
  }

  // split
  const program = card.program || { name: 'Split', days: [] }
  const { train, total } = splitShape(program)
  const sentHere = !mine && card.sent && sentSplitPath ? sentSplitPath(program.id) : null

  async function save() {
    setSaveError('')
    try {
      setSavedPath(await saveSplit(program))
    } catch {
      setSaveError('Couldn’t save it — try again.')
    }
  }

  let footer = null
  if (sentHere) {
    footer = (
      <Link to={sentHere} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-primary no-underline">
        Open in my splits <ChevronRight className="w-4 h-4" />
      </Link>
    )
  } else if (!mine && saveSplit) {
    footer = savedPath ? (
      <Link to={savedPath} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-primary no-underline">
        <Check className="w-4 h-4" /> Saved — open it <ChevronRight className="w-4 h-4" />
      </Link>
    ) : (
      <>
        <button
          type="button"
          onClick={save}
          className="inline-flex items-center gap-2 bg-text-primary text-cream font-medium px-4 py-2.5 border-none cursor-pointer text-[13px] hover:bg-accent-hover transition-colors"
        >
          <Copy className="w-4 h-4" /> Save a copy
        </button>
        {saveError && <p className="text-[12px] text-red-600 mt-2">{saveError}</p>}
      </>
    )
  }

  return (
    <>
      <Frame
        icon={CalendarRange}
        kicker={card.sent ? 'New split' : 'Split'}
        title={program.name}
        line={train ? `${train} training day${train === 1 ? '' : 's'}${scheduleMode(program) === 'weekly' ? ' a week' : ` · ${total}-day rotation`}` : 'No days yet'}
        action={<ActionRow onClick={() => setOpen(true)}>View</ActionRow>}
      />
      {open && (
        <Contained>
          <SplitPreview program={program} footer={footer} onClose={() => setOpen(false)} />
        </Contained>
      )}
    </>
  )
}
