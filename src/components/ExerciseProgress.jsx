import { useState, useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { buildSeries, metricById, METRICS, RANGES } from '../lib/workoutStats'
import ProgressChart from './ProgressChart'

function fmt(value, unit) {
  return `${Math.round(value).toLocaleString()} ${unit}`
}

function fullDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ExerciseProgress({ exerciseName, sessions, unit = 'kg' }) {
  const [metricId, setMetricId] = useState('e1rm')
  const [rangeId, setRangeId] = useState('all')
  const [hovered, setHovered] = useState(null)

  const metric = metricById(metricId)
  const unitLabel = metric.unit === 'kg' ? unit : metric.unit
  const series = useMemo(
    () => buildSeries(sessions, exerciseName, metricId, rangeId, unit),
    [sessions, exerciseName, metricId, rangeId, unit]
  )

  const active = hovered != null && series[hovered] ? series[hovered] : series[series.length - 1]
  const best = series.length ? Math.max(...series.map((p) => p.value)) : null
  const change = series.length >= 2 ? series[series.length - 1].value - series[0].value : null
  const pct = change !== null && series[0].value ? (change / series[0].value) * 100 : null

  const Trend = change === null || change === 0 ? Minus : change > 0 ? TrendingUp : TrendingDown
  const trendColor = change === null || change === 0 ? 'text-text-muted' : change > 0 ? 'text-green-600' : 'text-red-600'

  return (
    <div className="p-6 md:p-8 pt-8">
      <p className="text-[11px] uppercase tracking-wider text-text-light mb-1">Progress</p>
      <h2 className="font-heading text-2xl font-medium text-text-primary mb-6">{exerciseName}</h2>

      {/* metric toggle */}
      <div className="flex flex-wrap gap-2 mb-3">
        {METRICS.map((m) => (
          <button
            key={m.id}
            onClick={() => setMetricId(m.id)}
            className={`px-3 py-1.5 text-[12px] font-medium border cursor-pointer transition-colors ${
              m.id === metricId
                ? 'bg-text-primary text-cream border-text-primary'
                : 'bg-white text-text-muted border-border hover:border-border-hover'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* range toggle */}
      <div className="flex flex-wrap gap-1.5 mb-7">
        {RANGES.map((r) => (
          <button
            key={r.id}
            onClick={() => { setRangeId(r.id); setHovered(null) }}
            className={`px-2.5 py-1 text-[11px] font-medium border cursor-pointer transition-colors ${
              r.id === rangeId
                ? 'bg-cream-dark text-text-primary border-border-hover'
                : 'bg-white text-text-light border-border hover:border-border-hover'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {series.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border">
          <p className="text-[13px] text-text-muted">No data for this exercise in this range yet.</p>
          <p className="text-[12px] text-text-light mt-1">Log it in a session and it'll show up here.</p>
        </div>
      ) : (
        <>
          {/* summary */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-cream border border-border px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-text-light mb-1">Latest</p>
              <p className="text-[15px] font-medium text-text-primary">{fmt(series[series.length - 1].value, unitLabel)}</p>
            </div>
            <div className="bg-cream border border-border px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-text-light mb-1">Best</p>
              <p className="text-[15px] font-medium text-text-primary">{fmt(best, unitLabel)}</p>
            </div>
            <div className="bg-cream border border-border px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-text-light mb-1">Change</p>
              <p className={`text-[15px] font-medium flex items-center gap-1 ${trendColor}`}>
                <Trend className="w-3.5 h-3.5" />
                {change === null ? '—' : `${change > 0 ? '+' : ''}${Math.round(change).toLocaleString()}`}
                {pct !== null && change !== 0 && (
                  <span className="text-[11px] font-normal">({pct > 0 ? '+' : ''}{Math.round(pct)}%)</span>
                )}
              </p>
            </div>
          </div>

          {/* hovered/latest caption */}
          {active && (
            <p className="text-[12px] text-text-muted mb-2">
              <span className="text-text-primary font-medium">{fmt(active.value, unitLabel)}</span>
              {' · '}{fullDate(active.date)}
              {active.provisional && <span className="text-text-light"> · today, in progress</span>}
            </p>
          )}

          <div className="text-text-primary">
            <ProgressChart points={series} hoveredIndex={hovered} onHover={setHovered} />
          </div>

          {series.length === 1 && (
            <p className="text-[12px] text-text-light mt-3">Log this exercise at least twice to see a trend line.</p>
          )}
        </>
      )}
    </div>
  )
}
