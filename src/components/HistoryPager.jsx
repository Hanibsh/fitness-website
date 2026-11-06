import { ChevronLeft, ChevronRight } from 'lucide-react'

const BUTTON = 'min-w-11 h-11 px-2.5 inline-flex items-center justify-center bg-white border border-border text-[13px] font-medium text-text-primary cursor-pointer hover:border-border-hover transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-border'

// 1  <  2 / 6  >  End. Pages count from 1, and 1 is the newest.
export default function HistoryPager({ page, pages, onChange }) {
  const onFirst = page <= 1
  const onLast = page >= pages
  return (
    <nav aria-label="Workout history pages" className="mt-5 flex items-center justify-center gap-1.5">
      <button type="button" className={BUTTON} disabled={onFirst} onClick={() => onChange(1)} aria-label="First page, newest workouts">
        1
      </button>
      <button type="button" className={BUTTON} disabled={onFirst} onClick={() => onChange(page - 1)} aria-label="Previous page">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span aria-live="polite" aria-label={`Page ${page} of ${pages}`} className="min-w-14 text-center text-[13px] text-text-secondary tabular-nums">
        {page} / {pages}
      </span>
      <button type="button" className={BUTTON} disabled={onLast} onClick={() => onChange(page + 1)} aria-label="Next page">
        <ChevronRight className="w-4 h-4" />
      </button>
      <button type="button" className={BUTTON} disabled={onLast} onClick={() => onChange(pages)} aria-label="Last page, oldest workouts">
        End
      </button>
    </nav>
  )
}
