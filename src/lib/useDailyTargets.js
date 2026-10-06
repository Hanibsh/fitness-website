// The TDEE calculator's own calorie and protein targets, worked out from the
// profile and the logged training — only when every input it needs is really
// known (same rule as the calculators' prefill). Shared by the dashboard's
// Daily targets card and the weekly food log, so they quote the same numbers.
import { useMemo } from 'react'
import { usePrefill, weeklyTrainingHours, tdeeFromPrefill } from './profilePrefill'
import { calorieTargets, GOAL_DEFAULT_TARGET, DEFAULT_TARGET } from './calorieTargets'
import { proteinRange, macroSplit } from './macros'
import { convertWeight } from './workoutStats'

// { p (the prefill), hours, result: { tdee, target, protein } | null }
export function useDailyTargets(sessions, now) {
  const p = usePrefill()
  const hours = useMemo(() => weeklyTrainingHours(sessions, now), [sessions, now])
  const result = useMemo(() => {
    if (!p.ready) return null
    const tdee = tdeeFromPrefill(p, hours)
    if (tdee == null) return null
    const metric = p.unitSystem !== 'imperial'
    const weightKg = metric ? p.weight : convertWeight(p.weight, 'lbs', 'kg')
    const target = calorieTargets({ tdee, weightKg, sex: p.sex })[GOAL_DEFAULT_TARGET[p.goal] ?? DEFAULT_TARGET]
    const protein = proteinRange({ lbmKg: weightKg * (1 - p.bodyFat / 100), bodyFat: p.bodyFat, trainingHours: hours, age: p.age, vegan: !!p.vegan })
    const split = macroSplit({ kcal: target.kcal, posture: target.posture, weightKg, sex: p.sex, protein })
    return { tdee, target, protein: Math.round(split.protein.target) }
  }, [p, hours])
  return { p, hours, result }
}

// The calories and protein a day to aim for: the coach's targets when they
// set them, else the profile's own. { calories, protein, from: 'coach' |
// 'profile' } or null.
export function pickTargets(coachTargets, own) {
  const n = (v) => (Number(v) > 0 ? Math.round(Number(v)) : null)
  const coach = { calories: n(coachTargets?.calories), protein: n(coachTargets?.protein) }
  if (coach.calories || coach.protein) return { ...coach, from: 'coach' }
  if (own) return { calories: own.target.kcal, protein: own.protein, from: 'profile' }
  return null
}
