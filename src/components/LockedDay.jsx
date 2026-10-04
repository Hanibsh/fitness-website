import { rirLabel } from '../lib/program'
import { cardioOf, cardioLabel } from '../lib/cardio'
import { supersetLabels } from '../lib/workoutStats'

// One day of a split your coach sent: what to do, read-only. The editable
// version is DayEditor; this one only says it — movement, sets × reps, how hard,
// and the coach's note on the row.
export default function LockedDay({ day, unit = 'kg', weightKg = null }) {
  const groups = supersetLabels(day.exercises.filter((e) => e.kind !== 'cardio'))
  if (day.exercises.length === 0) {
    return (
      <div className="bg-white border border-border p-5 sm:p-6">
        <p className="text-[13px] text-text-muted">{day.kind === 'rest' ? 'Rest.' : 'Nothing planned for this day yet.'}</p>
      </div>
    )
  }
  return (
    <div className="bg-white border border-border divide-y divide-border">
      {day.exercises.map((ex) => {
        const cardio = ex.kind === 'cardio' ? cardioOf(ex) : null
        const badge = groups.get(ex.id)?.label
        const reps = ex.repRange ? (ex.repRange.low === ex.repRange.high ? `${ex.repRange.low}` : `${ex.repRange.low}–${ex.repRange.high}`) : ''
        const effort = rirLabel(ex.rirTarget)
        return (
          <div key={ex.id} className="px-5 sm:px-6 py-3.5">
            <div className="flex items-center gap-2">
              {badge && (
                <span className="shrink-0 inline-flex items-center justify-center text-[9px] font-semibold text-cream bg-text-primary px-1.5 py-0.5 tracking-wide">
                  {badge}
                </span>
              )}
              <p className="text-[14px] font-medium text-text-primary min-w-0 break-words">{ex.name}</p>
            </div>
            <p className="text-[12px] text-text-muted mt-0.5">
              {cardio ? cardioLabel(cardio, unit, weightKg) : [`${ex.sets} × ${reps || '—'}`, effort].filter(Boolean).join(' · ')}
            </p>
            {ex.note && <p className="text-[12px] text-text-secondary mt-1.5 break-words">{ex.note}</p>}
          </div>
        )
      })}
    </div>
  )
}
