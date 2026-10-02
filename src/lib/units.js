// Typed measurements carried across a unit switch. A number someone typed is a
// measurement, not a label: switching from kg to lbs has to turn 80 into 176.4,
// or the same body quietly gets lighter or heavier.
//
// Text in, text out — these work on what's in an input. Anything that isn't a
// number yet (empty, half-typed) is handed back untouched.

import { convertWeight } from './workoutStats'

const round1 = (n) => Math.round(n * 10) / 10
const valid = (v) => v !== '' && v != null && Number.isFinite(Number(v))

// kg ⇄ lbs, to one decimal.
export function convertMassText(v, toImperial) {
  if (!valid(v)) return v
  return String(round1(convertWeight(Number(v), toImperial ? 'kg' : 'lbs', toImperial ? 'lbs' : 'kg')))
}

// cm ⇄ inches. Inches keep two decimals so switching back lands on the same
// centimetres (180 → 70.87 → 180, where one decimal would come back as 180.1).
export function convertLengthText(v, toImperial) {
  if (!valid(v)) return v
  const n = Number(v)
  return String(toImperial ? Math.round((n / 2.54) * 100) / 100 : round1(n * 2.54))
}
