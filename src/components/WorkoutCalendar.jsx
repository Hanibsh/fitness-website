import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { dayStatusesForRange } from '../lib/program'
import { REASON_COLOR, STATUS_MARKER } from '../lib/calendarMarkers'

// Month grid that highlights workout days by split colour, marks today, lets
// you page between months, and calls onSelectDay when a day is tapped.
//
// Every day the schedule can speak about gets a marker, so no month is ever
// blank: a logged workout is a filled dot in its split colour, a planned
// training day an outlined one, a rest day a quiet dot, and a day you skipped a
// hollow square. When `annotations` is passed, a day you marked off
// (sick/injury/travel/rest/other) gets its reason colour, shown alongside the
// workout dots since a day can be both trained and annotated.
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

// Colour a day by the (first) workout's split, falling back to a neutral dot.
function splitColor(name) {
  const n = (name || '').toLowerCase()
  if (n.includes('push')) return 'bg-blue-500'
  if (n.includes('pull')) return 'bg-green-500'
  if (n.includes('leg')) return 'bg-orange-500'
  if (n.includes('upper')) return 'bg-purple-500'
  if (n.includes('lower')) return 'bg-teal-500'
  if (n.includes('cardio')) return 'bg-red-500'
  return 'bg-text-primary'
}

// Border twin of splitColor, for the planned (not-yet-done) outline circles.
function splitBorderColor(name) {
  const n = (name || '').toLowerCase()
  if (n.includes('push')) return 'border-blue-500'
  if (n.includes('pull')) return 'border-green-500'
  if (n.includes('leg')) return 'border-orange-500'
  if (n.includes('upper')) return 'border-purple-500'
  if (n.includes('lower')) return 'border-teal-500'
  if (n.includes('cardio')) return 'border-red-500'
  return 'border-text-muted'
}

function sameDay(a, b) {
  const da = new Date(a)
  const db = new Date(b)
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate()
}

export default function WorkoutCalendar({ sessions, onSelectDay, selectedDate, program = null, annotations = [], size = 'sm' }) {
  const today = new Date()
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() })
  const lg = size === 'lg'

  // Map day-of-month -> sessions on that day, for the viewed month.
  const byDay = useMemo(() => {
    const map = new Map()
    for (const s of sessions) {
      const d = new Date(s.date)
      if (d.getFullYear() === view.year && d.getMonth() === view.month) {
        const key = d.getDate()
        if (!map.has(key)) map.set(key, [])
        map.get(key).push(s)
      }
    }
    return map
  }, [sessions, view])

  const firstDow = new Date(view.year, view.month, 1).getDay()
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate()

  // What the schedule says about each day of the viewed month — resolved once
  // for the whole month rather than per cell, and by the same function the day
  // panel and the summary card use, so the three can't disagree.
  const statusByDay = useMemo(() => {
    if (!program) return null
    return dayStatusesForRange(program, {
      start: new Date(view.year, view.month, 1).getTime(),
      end: new Date(view.year, view.month, daysInMonth).getTime(),
      sessions,
      annotations,
    })
  }, [program, sessions, annotations, view, daysInMonth])

  const cells = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  const monthLabel = new Date(view.year, view.month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  function shift(delta) {
    setView((v) => {
      const m = v.month + delta
      return { year: v.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 }
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => shift(-1)}
          aria-label="Previous month"
          className="text-text-muted hover:text-text-primary bg-transparent border-none cursor-pointer p-1"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className={`font-medium text-text-primary ${lg ? 'text-[15px]' : 'text-[13px]'}`}>{monthLabel}</span>
        <button
          onClick={() => shift(1)}
          aria-label="Next month"
          className="text-text-muted hover:text-text-primary bg-transparent border-none cursor-pointer p-1"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className={`grid grid-cols-7 mb-1 ${lg ? 'gap-1.5' : 'gap-1'}`}>
        {WEEKDAYS.map((d, i) => (
          <span key={i} className={`text-center uppercase tracking-wider text-text-light py-1 ${lg ? 'text-[11px]' : 'text-[10px]'}`}>
            {d}
          </span>
        ))}
      </div>

      <div className={`grid grid-cols-7 ${lg ? 'gap-1.5' : 'gap-1'}`}>
        {cells.map((day, i) => {
          if (day === null) return <span key={`e${i}`} />
          const date = new Date(view.year, view.month, day)
          const daySessions = byDay.get(day) || []
          const isToday = sameDay(date, today)
          const isSelected = selectedDate && sameDay(date, selectedDate)
          const hasWorkout = daySessions.length > 0
          const state = statusByDay?.get(date.getTime()) || null
          const annotation = state?.annotation || null
          // One marker per schedule state, and only when the day isn't already
          // showing workout dots — a logged session outranks whatever was planned.
          const plannedTrain = !hasWorkout && (state?.status === 'upcoming' || state?.status === 'today') ? state.day : null
          const quiet = !hasWorkout && !annotation && (state?.status === 'rest' ? 'rest' : state?.status === 'missed' ? 'skipped' : state?.status === 'unlogged' ? 'unlogged' : null)
          return (
            <button
              key={day}
              onClick={() => onSelectDay(date, daySessions)}
              aria-label={`${date.toLocaleDateString()}${hasWorkout ? `, ${daySessions.length} workout${daySessions.length > 1 ? 's' : ''}` : ''}${annotation ? `, ${annotation.reason}` : ''}${plannedTrain ? `, planned: ${plannedTrain.name}` : ''}${quiet === 'rest' ? ', rest day' : quiet === 'skipped' ? ', skipped' : quiet === 'unlogged' ? ', no workout' : ''}`}
              className={`flex flex-col items-center justify-center gap-0.5 cursor-pointer border transition-colors ${lg ? 'min-h-16 text-[13px]' : 'aspect-square text-[12px]'} ${
                isSelected
                  ? 'border-text-primary bg-cream-dark'
                  : isToday
                    ? 'border-accent-soft bg-white'
                    : 'border-transparent hover:border-border'
              } ${hasWorkout ? 'text-text-primary font-medium' : 'text-text-muted'}`}
            >
              <span>{day}</span>
              <span className={`flex items-center gap-0.5 ${lg ? 'h-2' : 'h-1.5'}`}>
                {hasWorkout &&
                  daySessions.slice(0, lg ? 4 : 3).map((s, j) => (
                    <span key={j} className={`rounded-full ${lg ? 'w-1.5 h-1.5' : 'w-1 h-1'} ${splitColor(s.name)}`} />
                  ))}
                {!annotation && plannedTrain && (
                  <span className={`rounded-full border ${lg ? 'w-2 h-2' : 'w-1.5 h-1.5'} ${splitBorderColor(plannedTrain.name)}`} />
                )}
                {quiet && <span className={`${lg ? 'w-1.5 h-1.5' : 'w-1 h-1'} ${STATUS_MARKER[quiet]}`} />}
                {annotation && <span className={`${lg ? 'w-1.5 h-1.5' : 'w-1 h-1'} ${REASON_COLOR[annotation.reason] || REASON_COLOR.other}`} />}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
