// The lines a progress view draws over one range — the Progress page, the
// coach's Progress tab, the chat profile panel (all ProgressView) and the
// Compare chart on the coach's client page read the same ones.
import { useCallback, useMemo } from 'react'
import { buildSeries, bodyweightSeries, metricById } from './workoutStats'
import { liftsByUse } from './progress'
import { weeklySeries, leanMassSeries } from './weeklyLog'

const DAY = 86400000

// One range for the whole view. Each id is one the lift and bodyweight series
// both know (workoutStats RANGES / BODYWEIGHT_RANGES).
export const PROGRESS_RANGES = [
  { id: '1m', label: '1M', days: 30 },
  { id: '3m', label: '3M', days: 91 },
  { id: '6m', label: '6M', days: 182 },
  { id: '1y', label: '1Y', days: 365 },
  { id: 'all', label: 'All', days: Infinity },
]

// `lifts`: logged lift names, most-trained first; `liftSeries(name)`: that
// lift's est. 1RM points. `metrics`: what Compare can draw besides lifts —
// every body and food line, [{ id, label, unit, points, ever }]; `ever`: this
// person has logged it at all, in or out of this range.
export function useProgressLines({ sessions = [], bodyweight = [], weekly = [], unit = 'kg', rangeId = '3m' }) {
  const range = PROGRESS_RANGES.find((r) => r.id === rangeId) || PROGRESS_RANGES[1]
  const now = useMemo(() => Date.now(), [])
  const cutoff = range.days === Infinity ? 0 : now - range.days * DAY

  const lifts = useMemo(() => liftsByUse(sessions), [sessions])
  const weightPoints = useMemo(() => bodyweightSeries(bodyweight, range.id, unit), [bodyweight, range.id, unit])
  const food = useMemo(
    () => ({
      fat: weeklySeries(weekly, 'bodyFat', cutoff),
      lean: leanMassSeries(weekly, bodyweight, unit, cutoff),
      calories: weeklySeries(weekly, 'calories', cutoff),
      protein: weeklySeries(weekly, 'protein', cutoff),
    }),
    [weekly, bodyweight, unit, cutoff]
  )
  const liftSeries = useCallback((name) => buildSeries(sessions, name, metricById('e1rm'), range.id, unit), [sessions, range.id, unit])
  const metrics = useMemo(
    () =>
      [
        { id: 'bw', label: 'Bodyweight', unit, points: weightPoints, ever: bodyweight.length > 0 },
        { id: 'fat', label: 'Body fat', unit: '%', points: food.fat, ever: weeklySeries(weekly, 'bodyFat').length > 0 },
        { id: 'lean', label: 'Lean mass', unit, points: food.lean, ever: leanMassSeries(weekly, bodyweight, unit).length > 0 },
        { id: 'cal', label: 'Calories', unit: 'cal', points: food.calories, ever: weeklySeries(weekly, 'calories').length > 0 },
        { id: 'protein', label: 'Protein', unit: 'g', points: food.protein, ever: weeklySeries(weekly, 'protein').length > 0 },
      ],
    [weightPoints, food, weekly, bodyweight, unit]
  )

  return { range, now, cutoff, lifts, weightPoints, food, liftSeries, metrics }
}
