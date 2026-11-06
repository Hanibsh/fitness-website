import { useMemo, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { sessionStats } from '../lib/workoutStore'
import { sessionAvgRest, formatRest } from '../lib/workoutStats'
import { formatDuration, prDays, sessionHadPR, daysAgoLabel } from '../lib/dashboard'
import HistoryPager from './HistoryPager'

const PER_PAGE = 5

function formatDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

// Every logged workout, newest first, five to a page. The log page's History
// and the dashboard's Previous workouts card. `inCard` is for sitting inside a
// white Card: rows go cream so they still read as rows.
export default function PreviousWorkouts({ sessions, onOpen, inCard = false }) {
  const [page, setPage] = useState(1)
  const [seenCount, setSeenCount] = useState(sessions.length)
  const listRef = useRef(null)

  // A newly finished workout lands on page 1, so that's where to look for it.
  if (sessions.length !== seenCount) {
    setSeenCount(sessions.length)
    if (sessions.length > seenCount) setPage(1)
  }

  const sorted = useMemo(() => [...sessions].sort((a, b) => b.date - a.date), [sessions])
  const recordDays = useMemo(() => prDays(sessions), [sessions])
  // Clamped here rather than on delete, so losing the only workout on the last
  // page lands on the page before it, not on an empty one.
  const pages = Math.max(1, Math.ceil(sorted.length / PER_PAGE))
  const current = Math.min(page, pages)
  const shown = sorted.slice((current - 1) * PER_PAGE, current * PER_PAGE)

  function goToPage(next) {
    setPage(next)
    listRef.current?.scrollIntoView({ block: 'start' })
  }

  // Under the navbar, plus the card's padding and heading when there is one.
  const scrollMarginTop = `calc(${inCard ? '10.5rem' : '7rem'} + env(safe-area-inset-top, 0px))`

  return (
    <>
      <div ref={listRef} className="space-y-3" style={{ scrollMarginTop }}>
        {shown.map((session) => {
          const stats = sessionStats(session)
          const avgRest = formatRest(sessionAvgRest(session))
          const duration = formatDuration(session.durationMs)
          return (
            <div key={session.id} id={`session-${session.id}`} className={`${inCard ? 'bg-cream' : 'bg-white'} border border-border`}>
              <button
                onClick={() => onOpen(session)}
                className={`w-full flex items-center justify-between gap-3 ${inCard ? 'px-4' : 'px-6'} py-4 bg-transparent border-none cursor-pointer text-left`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[14px] font-medium text-text-primary">{daysAgoLabel(session.date) || formatDate(session.date)}</p>
                    {session.name && (
                      <span className={`text-[11px] font-medium text-text-secondary ${inCard ? 'bg-white' : 'bg-cream'} border border-border px-2 py-0.5 break-words min-w-0`}>
                        {session.name}
                      </span>
                    )}
                    {sessionHadPR(session, recordDays) && (
                      <span className="text-[10px] font-medium text-cream bg-text-primary px-1.5 py-0.5">PR</span>
                    )}
                  </div>
                  <p className="text-[12px] text-text-muted mt-0.5">
                    {stats.exercises} exercise{stats.exercises !== 1 ? 's' : ''} · {stats.sets} set{stats.sets !== 1 ? 's' : ''}
                    {stats.volume > 0 && ` · ${stats.volume.toLocaleString()} ${session.unit || 'kg'} volume`}
                    {duration && ` · ${duration}`}
                    {avgRest && ` · ${avgRest} avg rest`}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />
              </button>
            </div>
          )
        })}
      </div>

      {pages > 1 && <HistoryPager page={current} pages={pages} onChange={goToPage} />}
    </>
  )
}
