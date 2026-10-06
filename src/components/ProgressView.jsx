import { useEffect, useMemo, useState } from 'react'
import { TrendingUp } from 'lucide-react'
import MiniStat from './MiniStat'
import ExerciseSelect from './ExerciseSelect'
import ProgressChart from './ProgressChart'
import { buildSeries, bodyweightSeries, metricById } from '../lib/workoutStats'
import { recentPRs } from '../lib/dashboard'
import { weightTrend } from '../lib/coachStats'
import { liftsByUse } from '../lib/progress'
import { intakeAverages, bodyFatTrend, weeklySeries, leanMassSeries } from '../lib/weeklyLog'

const DAY = 86400000

// One range for the whole view. Each id is one the lift and bodyweight series
// both know (workoutStats RANGES / BODYWEIGHT_RANGES).
const PROGRESS_RANGES = [
  { id: '1m', label: '1M', days: 30 },
  { id: '3m', label: '3M', days: 91 },
  { id: '6m', label: '6M', days: 182 },
  { id: '1y', label: '1Y', days: 365 },
  { id: 'all', label: 'All', days: Infinity },
]

const round1 = (v) => Math.round(v * 10) / 10
const signed = (v) => `${v > 0 ? '+' : ''}${v.toLocaleString('en-US')}`
// "2,275 cal", "81.4 kg", "18.5%"
const withUnit = (v, unit) => `${round1(v).toLocaleString('en-US')}${unit === '%' ? '%' : ` ${unit}`}`
const shortDate = (ts) => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })

// A line chart with its headline: the hovered point, else the latest, and the
// change across the range. `target` draws the dashed line; `sub` is one line
// under the title.
function Chart({ title, points, unit, empty, target = null, sub = null }) {
  const [hovered, setHovered] = useState(null)
  useEffect(() => setHovered(null), [points])
  const shown = hovered != null && points[hovered] ? points[hovered] : points[points.length - 1]
  const change = points.length >= 2 ? round1(points[points.length - 1].value - points[0].value) : null
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <div className="min-w-0">
          <h3 className="text-[11px] font-medium uppercase tracking-wider text-text-light">{title}</h3>
          {sub && <p className="text-[11px] text-text-light mt-0.5">{sub}</p>}
        </div>
        {shown && (
          <p className="shrink-0 text-[12px] text-text-muted tabular-nums text-right">
            <span className="text-text-primary font-medium">{withUnit(shown.value, unit)}</span>
            {hovered != null
              ? ` · ${shortDate(shown.date)}`
              : change != null && change !== 0
                ? ` · ${signed(change)}`
                : ''}
          </p>
        )}
      </div>
      {points.length ? (
        <ProgressChart points={points} hoveredIndex={hovered} onHover={setHovered} target={target} />
      ) : (
        <p className="text-[13px] text-text-muted py-8 text-center border border-dashed border-border">{empty}</p>
      )}
    </div>
  )
}

// How someone's training and body are going over one chosen range: a few
// numbers, then strength, bodyweight, body fat, lean mass, calories and protein
// on the same timeline. The Progress page, the coach's Progress tab and the
// chat profile panel all show this.
//
// `weekly`: their weekly food log (lib/weeklyLog.js); `targets`: calories and
// protein a day to aim for (lib/useDailyTargets.js pickTargets), or null.
export default function ProgressView({ sessions = [], bodyweight = [], weekly = [], targets = null, unit = 'kg' }) {
  const [rangeId, setRangeId] = useState('3m')
  const range = PROGRESS_RANGES.find((r) => r.id === rangeId)
  const now = useMemo(() => Date.now(), [])
  const cutoff = range.days === Infinity ? 0 : now - range.days * DAY

  const lifts = useMemo(() => liftsByUse(sessions), [sessions])
  const [lift, setLift] = useState('')
  useEffect(() => {
    if (lifts.length && !lifts.includes(lift)) setLift(lifts[0])
  }, [lifts, lift])

  const stats = useMemo(() => {
    const workouts = sessions.filter((s) => s.date >= cutoff).length
    const prs = recentPRs(sessions, unit, Infinity).filter((p) => p.date >= cutoff).length
    const weight = weightTrend(bodyweight, unit, { days: range.days === Infinity ? 36500 : range.days, now })
    return { workouts, prs, weight, intake: intakeAverages(weekly, cutoff), fat: bodyFatTrend(weekly, cutoff) }
  }, [sessions, bodyweight, weekly, unit, cutoff, range, now])
  const vsTarget = (target, unitLabel) => (target ? `target ${target.toLocaleString('en-US')}${unitLabel}` : 'a day')

  const strength = useMemo(
    () => (lift ? buildSeries(sessions, lift, metricById('e1rm'), rangeId, unit) : []),
    [sessions, lift, rangeId, unit]
  )
  const weightPoints = useMemo(() => bodyweightSeries(bodyweight, rangeId, unit), [bodyweight, rangeId, unit])
  const food = useMemo(
    () => ({
      fat: weeklySeries(weekly, 'bodyFat', cutoff),
      lean: leanMassSeries(weekly, bodyweight, unit, cutoff),
      calories: weeklySeries(weekly, 'calories', cutoff),
      protein: weeklySeries(weekly, 'protein', cutoff),
    }),
    [weekly, bodyweight, unit, cutoff]
  )
  const targetLine = (n, unitLabel) => (n ? `Dashed: target ${withUnit(n, unitLabel)}` : null)

  return (
    <div>
      <div className="flex border border-border mb-5" role="group" aria-label="Time range">
        {PROGRESS_RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRangeId(r.id)}
            aria-pressed={r.id === rangeId}
            className={`flex-1 py-1.5 text-[12px] font-medium border-none cursor-pointer transition-colors ${
              r.id === rangeId ? 'bg-text-primary text-cream' : 'bg-white text-text-muted hover:text-text-primary'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-7">
        <MiniStat label="Workouts" value={stats.workouts} />
        <MiniStat label="PRs" value={stats.prs} />
        <MiniStat
          label="Bodyweight"
          value={stats.weight.latest != null ? `${stats.weight.latest} ${unit}` : '—'}
          sub={stats.weight.change != null && stats.weight.change !== 0 ? `${signed(stats.weight.change)} ${unit}` : null}
        />
        <MiniStat
          label="Body fat"
          value={stats.fat.latest != null ? `${stats.fat.latest}%` : '—'}
          sub={stats.fat.change != null && stats.fat.change !== 0 ? `${signed(stats.fat.change)}%` : null}
        />
        <MiniStat
          label="Calories"
          value={stats.intake.calories != null ? stats.intake.calories.toLocaleString('en-US') : '—'}
          sub={vsTarget(targets?.calories, '')}
        />
        <MiniStat
          label="Protein"
          value={stats.intake.protein != null ? `${stats.intake.protein} g` : '—'}
          sub={vsTarget(targets?.protein, ' g')}
        />
      </div>

      <div className="space-y-7">
        <div>
          {lifts.length > 0 && (
            <ExerciseSelect value={lift} options={lifts} onChange={setLift} ariaLabel="Lift to chart" className="w-full mb-3" />
          )}
          <Chart
            title={<span className="inline-flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Est. 1RM</span>}
            points={strength}
            unit={unit}
            empty={lifts.length ? 'No sets of this lift in this range.' : 'No lifts logged yet.'}
          />
        </div>
        <Chart title="Bodyweight" points={weightPoints} unit={unit} empty="No weigh-ins in this range." />
        <Chart title="Body fat" points={food.fat} unit="%" empty="No body fat logged in this range." />
        <Chart
          title="Lean mass"
          sub="Weight minus fat, on weeks you logged body fat"
          points={food.lean}
          unit={unit}
          empty="Needs body fat and a weigh-in in the same week."
        />
        <Chart
          title="Calories a day"
          sub={targetLine(targets?.calories, 'cal')}
          points={food.calories}
          unit="cal"
          target={targets?.calories || null}
          empty="No calories logged in this range."
        />
        <Chart
          title="Protein a day"
          sub={targetLine(targets?.protein, 'g')}
          points={food.protein}
          unit="g"
          target={targets?.protein || null}
          empty="No protein logged in this range."
        />
      </div>
    </div>
  )
}
