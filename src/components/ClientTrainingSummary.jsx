import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import MiniStat from './MiniStat'
import StatusChip from './StatusChip'
import { planAdherence } from '../lib/dashboardInsights'
import { lastWorkoutLabel, noTrainingFlag, weightTrend } from '../lib/coachStats'

const TREND_ICON = { up: TrendingUp, down: TrendingDown, flat: Minus }

// A linked client's week at a glance: on their page (ClientDetail), with the
// whole picture one tap away, and heading that picture (ClientTraining,
// `hideOpen`).
export default function ClientTrainingSummary({ clientId, data, loading, hideOpen = false }) {
  const now = useMemo(() => Date.now(), [])
  const unit = data?.profile?.unit === 'lbs' ? 'lbs' : 'kg'
  const adherence = useMemo(
    () => (data ? planAdherence(data.sessions, data.annotations, data.program, now) : null),
    [data, now]
  )
  const trend = useMemo(() => (data ? weightTrend(data.bodyweight, unit, { now }) : null), [data, unit, now])
  const idle = data ? noTrainingFlag(data.sessions, now) : null
  const Trend = trend?.dir ? TREND_ICON[trend.dir] : null

  return (
    <section className="bg-white border border-border p-5 sm:p-7">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="font-heading text-xl font-medium text-text-primary">{hideOpen ? 'At a glance' : 'Their training'}</h2>
        {!hideOpen && (
          <Link
            to={`/coach/${clientId}/training`}
            className="inline-flex items-center gap-1 text-[13px] font-medium text-text-secondary hover:text-text-primary no-underline transition-colors"
          >
            Open <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>
      {loading || !data ? (
        <p className="text-[13px] text-text-muted">Loading…</p>
      ) : (
        <>
          {idle != null && (
            <div className="mb-3">
              <StatusChip tone="amber">{idle} days no training</StatusChip>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <MiniStat label="Last workout" value={lastWorkoutLabel(data.sessions, now) || '—'} />
            <MiniStat
              label="This week"
              value={adherence?.week.planned ? `${adherence.week.trained} of ${adherence.week.planned}` : '—'}
              sub={adherence ? 'sessions' : 'no split'}
            />
            <MiniStat
              label="Last 4 weeks"
              value={adherence?.month.pct != null ? `${adherence.month.pct}%` : '—'}
              sub="on plan"
            />
            <MiniStat
              label="Bodyweight"
              value={trend?.latest != null ? `${trend.latest} ${unit}` : '—'}
              sub={
                Trend ? (
                  <span className="inline-flex items-center gap-1">
                    <Trend className="w-3 h-3" />
                    {trend.change > 0 ? '+' : ''}
                    {trend.change} · 2 wk
                  </span>
                ) : null
              }
            />
          </div>
        </>
      )}
    </section>
  )
}
