// Profile field options — the single source of truth for the training-profile
// choices a user makes on the profile page. Kept here (pure data) so the future
// program generator and the calculators can reuse the exact same values/labels
// without the strings drifting apart.
//
// Goal is deliberately body-composition direction only (no "strength"/"endurance"
// modes) — the app is hypertrophy-only by design; goal tunes nutrition + volume
// posture, not the program type.

import { AT_HOME_EQUIPMENT, ALL_EQUIPMENT } from '../data/equipmentGroups'
import { ENGINE_MUSCLES } from './engineConfig'
import { MAX_FOCUS_MUSCLES, PROGRAMMED_MUSCLES } from './generatorConfig'

export const GOALS = [
  { value: 'lose_fat', label: 'Lose fat' },
  { value: 'gain_muscle', label: 'Gain muscle' },
  { value: 'recomp', label: 'Recomposition' },
  { value: 'maintain', label: 'Maintain' },
]

// Training age — years of consistent training, self-selected as a tier. The tier
// predicts programming needs better than raw calendar time does, and since each
// one states its own year range, it IS the answer to "how long have you been
// training": a separate duration input asked the same question twice, so it's
// gone (2026-07-17), along with days/week and time per session. The schedule
// someone actually trains is observable from their logged sessions and routine;
// asking them to also declare it invited the two to disagree. Don't reintroduce
// them without a consumer that needs the stated intent over the real behaviour.
export const EXPERIENCE_LEVELS = [
  { value: 'beginner', label: 'Beginner', sub: '0–2 years' },
  { value: 'intermediate', label: 'Intermediate', sub: '3–5 years' },
  { value: 'advanced', label: 'Advanced', sub: '6+ years' },
]

// Equipment presets map onto the exercise DB's `equipment` values. `includes` is
// what the future generator filters the exercise pool against; tune freely here.
// Only the two ends of the range are offered — "Home gym" and "Dumbbells only"
// were dropped (2026-07-17) as middle grounds nobody picked cleanly.
export const EQUIPMENT_PRESETS = [
  { value: 'gym', label: 'Full gym', includes: ALL_EQUIPMENT },
  { value: 'bodyweight', label: 'Bodyweight', includes: AT_HOME_EQUIPMENT },
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

// Muscles to bring up (`profiles.focus_muscles`): the split generator's focus,
// kept on the profile so every new split starts from it. Offered over the
// muscles a split actually programs first, then anything else the engine
// tracks, so "I want bigger forearms" is sayable — naming one is what gets it
// its own slot.
export const FOCUS_OPTIONS = [...PROGRAMMED_MUSCLES, ...ENGINE_MUSCLES.filter((m) => !PROGRAMMED_MUSCLES.includes(m))]

// A stored or passed-in pick, cleaned: known muscles only, no repeats, at most
// MAX_FOCUS_MUSCLES. A profile row written by an older build can't break it.
export function cleanFocus(list) {
  return [...new Set(Array.isArray(list) ? list : [])].filter((m) => ENGINE_MUSCLES.includes(m)).slice(0, MAX_FOCUS_MUSCLES)
}
