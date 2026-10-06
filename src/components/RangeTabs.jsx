import { PROGRESS_RANGES } from '../lib/useProgressLines'

// 1M · 3M · 6M · 1Y · All — the one range a progress view is drawn over.
export default function RangeTabs({ value, onChange, className = '' }) {
  return (
    <div className={`flex border border-border ${className}`} role="group" aria-label="Time range">
      {PROGRESS_RANGES.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => onChange(r.id)}
          aria-pressed={r.id === value}
          className={`flex-1 py-1.5 text-[12px] font-medium border-none cursor-pointer transition-colors ${
            r.id === value ? 'bg-text-primary text-cream' : 'bg-white text-text-muted hover:text-text-primary'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}
