// Calorie targets per goal, from a TDEE. Shared by the TDEE calculator and the
// dashboard's Daily targets card, so the two can never quote different numbers
// for the same person.

export const loseSpeeds = [
  { id: 'lose-slow', label: 'Slow', percent: 0.25 },
  { id: 'lose-moderate', label: 'Moderate', percent: 0.5 },
  { id: 'lose-fast', label: 'Fast', percent: 1 },
]

export const gainOptions = [
  { id: 'gain-lean', label: 'Lean bulk', sub: 'minimal fat gain', delta: 200 },
  { id: 'gain-normal', label: 'Normal bulk', sub: 'moderate fat gain', delta: 500 },
]

// `posture` is how the macro split leans for this target (see lib/macros) —
// the slow fat-loss recomp is still a deficit, so it eats like a cut.
export const recompOptions = [
  { id: 'recomp-maintain', label: 'Maintain', delta: 0, posture: 'recomp' },
  { id: 'recomp-muscle', label: 'Muscle-gain focus', delta: 150, posture: 'recomp' },
  { id: 'recomp-fat', label: 'Fat-loss focus', percent: 0.35, posture: 'cut' },
]

// Which target a profile goal starts on, before anyone taps a card.
export const GOAL_DEFAULT_TARGET = { lose_fat: 'lose-moderate', gain_muscle: 'gain-lean', recomp: 'recomp-maintain' }
export const DEFAULT_TARGET = 'recomp-maintain'

const deficitKcal = (weightKg, percent) => Math.round((weightKg * (percent / 100) * 7700) / 7)

// No deficit target goes below this. Under it, protein, vitamins and the rest
// get genuinely hard to cover; past this point a faster pace has to come from
// moving more, not eating less.
export const CALORIE_FLOOR = { male: 1500, female: 1400 }

// A deficit target held at the floor. `moveKcal` is the part of the deficit the
// floor stops eating from covering, which has to be burned with extra movement.
function deficitTarget(tdee, weightKg, percent, sex) {
  const ideal = tdee - deficitKcal(weightKg, percent)
  const kcal = Math.max(ideal, CALORIE_FLOOR[sex])
  return { kcal, floored: kcal > ideal, moveKcal: kcal - ideal }
}

// Every calorie target, keyed by id, so the calculator's cards, its macro split
// and the dashboard read the same numbers.
export function calorieTargets({ tdee, weightKg, sex }) {
  const list = [
    ...loseSpeeds.map(s => ({ id: s.id, name: `${s.label} cut`, ...deficitTarget(tdee, weightKg, s.percent, sex), posture: 'cut' })),
    ...gainOptions.map(g => ({ id: g.id, name: g.label, kcal: tdee + g.delta, posture: 'bulk' })),
    ...recompOptions.map(r => ({ id: r.id, name: `Recomp (${r.label.toLowerCase()})`, ...(r.percent ? deficitTarget(tdee, weightKg, r.percent, sex) : { kcal: tdee + r.delta }), posture: r.posture })),
  ]
  return Object.fromEntries(list.map(t => [t.id, t]))
}
