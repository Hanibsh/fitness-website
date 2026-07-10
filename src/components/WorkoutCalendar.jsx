import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { plannedDayForDate } from '../lib/program'

// Month grid that highlights workout days by split colour, marks today, lets
// you page between months, and calls onSelectDay when a day is tapped. When
// the active program is passed, upcoming planned training days get an EMPTY
// (outlined) circle — done days keep their filled dots.
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

export default function WorkoutCalendar({ sessions, onSelectDay, selectedDate, program = null }) {
  const today = new Date()
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() })

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
        <span className="text-[13px] font-medium text-text-primary">{monthLabel}</span>
        <button
          onClick={() => shift(1)}
          aria-label="Next month"
          className="text-text-muted hover:text-text-primary bg-transparent border-none cursor-pointer p-1"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="text-center text-[10px] uppercase tracking-wider text-text-light py-1">
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <span key={`e${i}`} />
          const date = new Date(view.year, view.month, day)
          const daySessions = byDay.get(day) || []
          const isToday = sameDay(date, today)
          const isSelected = selectedDate && sameDay(date, selectedDate)
          const hasWorkout = daySessions.length > 0
          // Program projection: an upcoming planned training day gets an empty
          // circle — unless the day already has a logged workout (filled wins).
          const planned = !hasWorkout && program ? plannedDayForDate(program, date.getTime()) : null
          const plannedTrain = planned && planned.kind === 'train' ? planned : null
          return (
            <button
              key={day}
              onClick={() => onSelectDay(date, daySessions)}
              aria-label={`${date.toLocaleDateString()}${hasWorkout ? `, ${daySessions.length} workout${daySessions.length > 1 ? 's' : ''}` : ''}${plannedTrain ? `, planned: ${plannedTrain.name}` : ''}`}
              className={`aspect-square flex flex-col items-center justify-center gap-0.5 text-[12px] cursor-pointer border transition-colors ${
                isSelected
                  ? 'border-text-primary bg-cream-dark'
                  : isToday
                    ? 'border-text-primary/40 bg-white'
                    : 'border-transparent hover:border-border'
              } ${hasWorkout ? 'text-text-primary font-medium' : 'text-text-muted'}`}
            >
              <span>{day}</span>
              <span className="flex items-center gap-0.5 h-1.5">
                {hasWorkout
                  ? daySessions.slice(0, 3).map((s, j) => (
                      <span key={j} className={`w-1 h-1 rounded-full ${splitColor(s.name)}`} />
                    ))
                  : plannedTrain && <span className={`w-1.5 h-1.5 rounded-full border ${splitBorderColor(plannedTrain.name)}`} />}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
