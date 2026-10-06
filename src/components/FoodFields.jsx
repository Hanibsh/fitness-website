import NumberField from './NumberField'
import { INTAKE_BOUNDS } from '../lib/weeklyLog'

const FIELDS = [
  { key: 'calories', label: 'Calories a day', unit: 'cal', decimal: false },
  { key: 'protein', label: 'Protein a day', unit: 'g', decimal: false },
  { key: 'bodyFat', label: 'Body fat', unit: '%', decimal: true, hint: 'If you measured' },
]

// The weekly food fields — the week's average calories and protein a day, and
// body fat if measured. All optional. Shared by the check-in and the weigh-in
// panel, which both save the same week (lib/useWeeklyLog.js). `value` is
// lib/weeklyLog.js foodForm(); `error` is the key of a field out of bounds
// (parseIntake, same file).
export default function FoodFields({ value, onChange, error = null, idPrefix = 'food' }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {FIELDS.map((f) => (
        <div key={f.key} className="min-w-0">
          <label htmlFor={`${idPrefix}-${f.key}`} className="block text-[11px] text-text-muted mb-1 truncate">
            {f.label}
          </label>
          <div className="relative">
            <NumberField
              id={`${idPrefix}-${f.key}`}
              value={value[f.key]}
              onValueChange={(v) => onChange({ ...value, [f.key]: v })}
              decimal={f.decimal}
              placeholder={f.hint ? '—' : ''}
              aria-invalid={error === f.key || undefined}
              className={`w-full bg-cream border px-2.5 py-2 pr-8 text-[13px] text-text-primary outline-none focus:border-text-primary transition-colors ${
                error === f.key ? 'border-red-400' : 'border-border'
              }`}
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-text-light pointer-events-none">{f.unit}</span>
          </div>
          {error === f.key && (
            <p className="text-[11px] text-red-600 mt-1">
              {INTAKE_BOUNDS[f.key].min}–{INTAKE_BOUNDS[f.key].max.toLocaleString('en-US')}
            </p>
          )}
          {f.hint && error !== f.key && <p className="text-[10px] text-text-light mt-1">{f.hint}</p>}
        </div>
      ))}
    </div>
  )
}
