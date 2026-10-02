// Total daily energy expenditure, shared by the TDEE calculator and the calorie
// deficit guide (which estimates TDEE from the profile instead of asking for
// it), so the two can never quote different numbers for the same person.
//
// BMR is Katch-McArdle (driven by lean mass) plus Mifflin-St Jeor's small sex
// constant; the TDEE page explains the choice. Steps and lifting are NET of
// rest, like everything in lib/cardio, because BMR already counts resting burn.

import { netKcalPerStep } from './cardio'

// Lifting's cost as a gross MET (moderate-to-vigorous resistance training).
// One of those METs is just resting, which BMR already counts, so only the
// rest goes into the exercise slice — the same net rule as steps and cardio.
export const WORKOUT_MET = 6.3

// All inputs metric. `workoutHours` is per week, `steps` per day; both may be 0.
export function estimateTdee({ weightKg, heightCm, age, sex, bodyFat, workoutHours = 0, steps = 0 }) {
  const lbm = weightKg * (1 - bodyFat / 100)
  const sexConstant = sex === 'male' ? 5 : -161
  const bmrRaw = 370 + 21.6 * lbm + sexConstant
  const ageDecline = age > 60 ? 0.007 * (age - 60) : 0
  const bmr = bmrRaw * (1 - ageDecline)

  const kcalPerStep = netKcalPerStep(weightKg, heightCm, sex)
  const neat = steps * kcalPerStep
  const exercise = (workoutHours / 7) * (WORKOUT_MET - 1) * weightKg
  const tef = 0.1 * (bmr + neat + exercise)
  const tdee = bmr + neat + exercise + tef

  return { lbm, bmrRaw, bmr, kcalPerStep, neat, exercise, tef, tdee }
}
