// Profile field options — the single source of truth for the training-profile
// choices a user makes on the profile page. Kept here (pure data) so the future
// program generator and the calculators can reuse the exact same values/labels
// without the strings drifting apart.
//
// Goal is deliberately body-composition direction only (no "strength"/"endurance"
// modes) — the app is hypertrophy-only by design; goal tunes nutrition + volume
// posture, not the program type.

export const GOALS = [
  { value: 'lose_fat', label: 'Lose fat' },
  { value: 'gain_muscle', label: 'Gain muscle' },
  { value: 'recomp', label: 'Recomp' },
  { value: 'maintain', label: 'Maintain' },
]

// Self-selected training tier. Research is consistent that the tier predicts
// programming needs better than raw calendar time, so this is the real signal —
// and since each tier already states its year range, it IS the answer to "how
// long have you been training". A separate duration input asked the same
// question twice, so it's gone (2026-07-17), along with days/week and time per
// session. The schedule the user actually trains is observable from their logged
// sessions and routine; asking them to also declare it invited the two to
// disagree. Don't reintroduce them without a consumer that needs the stated
// intent rather than the real behaviour.
export const EXPERIENCE_LEVELS = [
  { value: 'beginner', label: 'Beginner', sub: '< 1 yr' },
  { value: 'intermediate', label: 'Intermediate', sub: '1–3 yrs' },
  { value: 'advanced', label: 'Advanced', sub: '3+ yrs' },
]

// Equipment presets map onto the exercise DB's five `equipment` values
// (free weight / machine / cable / bodyweight / resistance band). `includes` is
// what the future generator filters the exercise pool against; tune freely here.
export const EQUIPMENT_PRESETS = [
  { value: 'gym', label: 'Full gym', includes: ['free weight', 'machine', 'cable', 'bodyweight', 'resistance band'] },
  { value: 'home', label: 'Home gym', includes: ['free weight', 'bodyweight', 'resistance band'] },
  { value: 'dumbbells', label: 'Dumbbells only', includes: ['free weight', 'bodyweight'] },
  { value: 'bodyweight', label: 'Bodyweight', includes: ['bodyweight', 'resistance band'] },
]

// Value allow-lists (for validation / matching a stored value back to an option).
export const GOAL_VALUES = GOALS.map((g) => g.value)
export const EXPERIENCE_VALUES = EXPERIENCE_LEVELS.map((e) => e.value)
export const EQUIPMENT_VALUES = EQUIPMENT_PRESETS.map((e) => e.value)

// The concrete DB equipment values a preset unlocks (used by the generator later).
export function equipmentValuesFor(preset) {
  return EQUIPMENT_PRESETS.find((p) => p.value === preset)?.includes || []
}

// Height bounds by weight-unit (kg pairs with cm, lbs with in) — matched to the
// TDEE/FFMI calculators so a profile height is a valid calculator input.
export const HEIGHT_BOUNDS = {
  kg: { min: 100, max: 250, label: 'cm' },
  lbs: { min: 39, max: 98, label: 'in' },
}

// Age bounds (matched to the calculators); birth-year range is derived from these.
export const AGE_BOUNDS = { min: 10, max: 100 }
