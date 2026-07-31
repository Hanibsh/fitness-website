import { Link } from 'react-router-dom'
import { Pencil, Trash2, Dumbbell, Moon, Check } from 'lucide-react'
import DayCard from './DayCard'
import StatusChip from './StatusChip'
import { dayStatusForDate } from '../lib/program'
import { dayStats, sessionStats, workingSetCount } from '../lib/planStats'
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

export default function CalendarDayPanel({ selectedDay, program, annotations = [], sessions = [], dateFormat, onEditSession, onDeleteSession }) {
  if (!selectedDay) return null

  const { date } = selectedDay
  const state = dayStatusForDate(program, date.getTime(), { sessions, annotations })
  const dayHref = program && state.day ? `/split/${program.id}/day/${state.day.id}` : null

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
                stats={stats}
                cta="Open this workout"
                to="/log"
                linkState={{ editSessionId: s.id }}
                linkLabel={`Open ${s.name || 'this workout'} in the log`}
                chips={s.exercises.map((ex) => ({ key: ex.id, label: ex.name, suffix: `${workingSetCount(ex)}×` }))}
                note={stats.exercises === 0 ? 'Nothing was logged in this workout.' : null}
                header={
                  <>
                    <Check className="w-4 h-4 text-green-700 dark:text-green-400 shrink-0" />
                    <span className="flex-1 min-w-0 text-[14px] font-medium text-text-primary break-words">
                      {s.name || state.day?.name || 'Workout'}
                    </span>
                    <StatusChip tone="green">Done</StatusChip>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => onEditSession(s)}
                        aria-label={`Edit ${s.name || 'workout'}`}
                        title="Edit this workout"
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-cream bg-text-primary px-2.5 py-1 border-none cursor-pointer hover:bg-accent-hover transition-colors"
                      >
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                      <button
                        onClick={() => onDeleteSession(s)}
                        aria-label={`Delete ${s.name || 'workout'}`}
                        title="Delete this workout"
                        className="text-text-light hover:text-red-600 bg-transparent border-none cursor-pointer p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                }
                footer={
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-light">
                    {duration && <span className="tabular-nums">{duration}</span>}
                    {/* Only when the session could be traced back to a split day
                        — dayForSession answers null rather than guessing. */}
                    {dayHref && (
                      <Link to={dayHref} className="text-text-muted hover:text-text-primary no-underline">
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
          linkLabel={`Open ${state.day?.name || 'this day'} in your split`}
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
