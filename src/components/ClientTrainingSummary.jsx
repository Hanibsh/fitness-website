import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import MiniStat from './MiniStat'
import StatusChip from './StatusChip'
import CompareChart from './CompareChart'
import RangeTabs from './RangeTabs'
import { planAdherence } from '../lib/dashboardInsights'
import { lastWorkoutLabel, noTrainingFlag, weightTrend } from '../lib/coachStats'
import { compareStoreKey } from '../lib/progress'
import { useProgressLines } from '../lib/useProgressLines'

const TREND_ICON = { up: TrendingUp, down: TrendingDown, flat: Minus }
const NONE = []

// A linked client's week at a glance: on their page (ClientDetail), with the
// whole picture one tap away, and heading that picture (ClientTraining,
// `hideOpen`). `withChart` adds Compare under the numbers — any of their
// lines side by side (ClientDetail).
export default function ClientTrainingSummary({ clientId, data, loading, hideOpen = false, withChart = false }) {
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
          {withChart && <Compare clientId={clientId} data={data} unit={unit} />}
        </>
      )}
    </section>
  )
}

// Two to four of their lines on one chart — a lift's strength, bodyweight,
// body fat, calories — over a range you pick. Each client keeps their own picks.
function Compare({ clientId, data, unit }) {
  const [rangeId, setRangeId] = useState('3m')
  const { lifts, liftSeries, metrics } = useProgressLines({ sessions: data.sessions, bodyweight: data.bodyweight, weekly: data.weekly || NONE, unit, rangeId })
  return (
    <div className="border-t border-border mt-6 pt-6">
      {lifts.length + metrics.filter((m) => m.ever).length > 0 ? (
        <>
          <RangeTabs value={rangeId} onChange={setRangeId} className="mb-5" />
          <CompareChart metrics={metrics} lifts={lifts} liftSeries={liftSeries} unit={unit} storeKey={compareStoreKey(clientId)} forClient />
        </>
      ) : (
        <p className="text-[13px] text-text-muted">The chart shows once they log lifts, weigh-ins or food.</p>
      )}
    </div>
  )
}
