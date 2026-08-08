import { Link } from 'react-router-dom'
import { Dumbbell, Moon, Check, Play } from 'lucide-react'
import DayCard from './DayCard'
import StatusChip from './StatusChip'
import { dayStatusForDate } from '../lib/program'
import { dayStats, sessionStats } from '../lib/planStats'
import { formatDuration } from '../lib/dashboard'
import { reasonLabel } from '../lib/dayLog'

// The panel under the calendar, shared by the dashboard and /calendar (which
// used to carry near-identical copies of it).
//
// Every state gets the same card the split page uses, so "what's this day?"
// reads the same wherever you ask it. The one real difference is where the
// numbers come from: a day you've trained is summarised from the SESSION — real
// movements, real working sets — while a day still ahead is summarised from the
// plan. A done card that quietly showed the plan would be lying about the
// session you swapped an exercise out of.
// Copy for the states that have nothing to count.
const NOTES = {
  rest: 'Rest day in your schedule.',
  off: 'Marked off — nothing expected of you.',
  missed: 'This was due and never got logged.',
  // The rotation can only be traced back as far as the log proves it, so an
  // older date can be placed as "you didn't train" but not as which of the two
  // it was. Say that rather than guess — a rest day called a skip is a worse
  // answer than an honest shrug.
  unlogged: 'No workout logged — either a rest day or one you skipped.',
}

// A day you've already trained gets the short version — name, counts, how long —
// and one way in. Editing and deleting used to sit here as icon buttons next to
// a card body that ALSO went to the editor; both now live on the summary card,
// so this panel says what the day was and the card is where you act on it.
//
// `backTo`/`backLabel` are where the split's day page should send you when you
// open one from here. Without them it offers its own parent — the split
// overview — which on the dashboard means one tap in and four taps back out.
// The day page falls back to that parent, so a hard reload still has an exit.
export default function CalendarDayPanel({ selectedDay, program, annotations = [], sessions = [], dateFormat, onOpenSummary, backTo, backLabel }) {
  if (!selectedDay) return null

  const { date } = selectedDay
  const state = dayStatusForDate(program, date.getTime(), { sessions, annotations })
  const dayHref = program && state.day ? `/split/${program.id}/day/${state.day.id}` : null
  const backState = backTo ? { backTo, backLabel } : undefined

  // Straight into the logger with this day's plan already loaded. Today starts
  // now; a day you missed is logged against the date it was missed on, so the
  // split's rotation consumes that slot rather than today's. Deliberately not
  // offered on days still ahead — there's nothing to log yet — nor on a day
  // that's done, off, or a rest day.
  const startable = state.day && state.day.kind !== 'rest' && (state.status === 'today' || state.status === 'missed')
  const startState = startable
    ? { startPlannedDay: state.day.id, ...(state.status === 'missed' ? { sessionDate: date.getTime() } : {}) }
    : null

  return (
    <div className="mt-5 pt-5 border-t border-border">
      <p className="text-[13px] font-medium text-text-primary mb-3">
        {dateFormat ? dateFormat(date) : date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
      </p>

      {state.status === 'done' ? (
        <div className="space-y-2.5">
          {state.sessions.map((s) => {
            const stats = sessionStats(s)
            const duration = formatDuration(s.durationMs)
            return (
              <DayCard
                key={s.id}
                compact
                stats={stats}
                cta="Open summary"
                onOpen={onOpenSummary ? () => onOpenSummary(s) : undefined}
                linkLabel={`Open the summary for ${s.name || 'this workout'}`}
                note={stats.exercises === 0 ? 'Nothing was logged in this workout.' : null}
                header={
                  <>
                    <Check className="w-4 h-4 text-green-700 dark:text-green-400 shrink-0" />
                    <span className="flex-1 min-w-0 text-[14px] font-medium text-text-primary break-words">
                      {s.name || state.day?.name || 'Workout'}
                    </span>
                    <StatusChip tone="green">Done</StatusChip>
                  </>
                }
                footer={
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-light">
                    {duration && <span className="tabular-nums">{duration}</span>}
                    {/* Only when the session could be traced back to a split day
                        — dayForSession answers null rather than guessing. */}
                    {dayHref && (
                      <Link to={dayHref} state={backState} className="text-text-muted hover:text-text-primary no-underline">
                        View this day in your split →
                      </Link>
                    )}
                  </div>
                }
              />
            )
          })}
        </div>
      ) : state.status === 'none' ? (
        <p className="text-[12px] text-text-muted">No workout logged this day.</p>
      ) : (
        <DayCard
          stats={state.day && state.day.kind !== 'rest' ? dayStats(state.day) : null}
          to={state.status === 'rest' ? undefined : dayHref || undefined}
          linkState={backState}
          linkLabel={`Open ${state.day?.name || 'this day'} in your split`}
          footer={
            startState ? (
              <Link
                to="/log"
                state={startState}
                className="inline-flex items-center gap-1.5 bg-text-primary text-cream font-medium px-4 py-2 text-[13px] no-underline hover:bg-accent-hover transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                {state.status === 'today' ? 'Start today’s session' : 'Log this workout'}
              </Link>
            ) : null
          }
          chips={(state.day?.exercises || []).map((pe) => ({ key: pe.id, label: pe.name, suffix: `${pe.sets}×` }))}
          note={NOTES[state.status] ?? (state.day?.exercises?.length ? null : 'Nothing planned for this day yet.')}
          header={
            <>
              {state.day?.kind === 'rest' || state.status === 'rest' || state.status === 'unlogged' ? (
                <Moon className="w-4 h-4 text-text-light shrink-0" />
              ) : (
                <Dumbbell className="w-4 h-4 text-text-primary shrink-0" />
              )}
              <span className="flex-1 min-w-0 text-[14px] font-medium text-text-primary break-words">
                {state.status === 'rest' ? state.day?.name || 'Rest' : state.status === 'unlogged' ? 'Day off' : state.day?.name || 'Day off'}
              </span>
              {state.status === 'off' ? (
                <StatusChip tone="amber">{reasonLabel(state.annotation.reason)}</StatusChip>
              ) : state.status === 'missed' ? (
                <StatusChip tone="amber">Skipped</StatusChip>
              ) : state.status === 'unlogged' ? (
                <StatusChip tone="muted">Off</StatusChip>
              ) : state.status === 'today' ? (
                <StatusChip tone="dark">Today</StatusChip>
              ) : state.status === 'rest' ? (
                <StatusChip tone="muted">Rest</StatusChip>
              ) : (
                <StatusChip tone="muted">Upcoming</StatusChip>
              )}
            </>
          }
        />
      )}
    </div>
  )
}
