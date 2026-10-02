import { MAX_FOCUS_MUSCLES } from '../lib/generatorConfig'
import { FOCUS_OPTIONS } from '../lib/profileFields'

// The muscles someone wants brought up: a pick of up to MAX_FOCUS_MUSCLES.
// Shared by the split wizard and the profile page, which stores the pick
// (`profiles.focus_muscles`) so every new split starts from it.
export default function FocusPicker({ value, onChange }) {
  function toggle(m) {
    if (value.includes(m)) onChange(value.filter((x) => x !== m))
    else if (value.length < MAX_FOCUS_MUSCLES) onChange([...value, m])
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {FOCUS_OPTIONS.map((m) => {
        const on = value.includes(m)
        const full = !on && value.length >= MAX_FOCUS_MUSCLES
        return (
          <button
            key={m}
            type="button"
            onClick={() => toggle(m)}
            disabled={full}
            aria-pressed={on}
            className={`px-2.5 py-1.5 text-[12px] font-medium border cursor-pointer transition-colors ${
              on
                ? 'bg-text-primary text-cream border-text-primary'
                : 'bg-white text-text-muted border-border hover:border-border-hover disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            {m}
          </button>
        )
      })}
    </div>
  )
}
