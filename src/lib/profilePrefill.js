// Seeds the calculators from the signed-in user's profile, so nobody retypes
// their sex, height, weight and age on every tool.
//
// Two vocabularies meet here. The profile stores a weight unit ('kg' | 'lbs')
// and a height in the matching system (cm with kg, inches with lbs); the
// calculators use a single 'metric' | 'imperial' toggle. This module is the
// bridge — prefills are always handed over in the calculator's vocabulary.
//
// Height needs no conversion, which is easy to misread as a bug: it's stored in
// the system its own unit implies, and callers set the calculator to that same
// system before filling it in. Only bodyweight converts, because it can also
// come from a weigh-in logged in the other unit.
//
// Prefill is a starting point, never a constraint: every value stays editable,
// and `usePrefill` is deliberately a read — it never writes back to the profile.

import { useEffect, useMemo, useRef } from 'react'
import { useAuth } from './auth'
import { getBodyweightLog } from './workoutStore'
import { convertWeight } from './workoutStats'

export function unitSystemFromProfile(unit) {
  return unit === 'lbs' ? 'imperial' : 'metric'
}

const weightUnitFor = (system) => (system === 'imperial' ? 'lbs' : 'kg')

export function ageFromBirthYear(birthYear) {
  if (birthYear == null || birthYear === '') return null
  const age = new Date().getFullYear() - Number(birthYear)
  return Number.isFinite(age) && age > 0 && age < 120 ? age : null
}

const round1 = (n) => Math.round(n * 10) / 10

// Best guess at current bodyweight in `unit`: the profile's value, else the most
// recent weigh-in. Mirrors WorkoutTracker's prefillBodyweight() fallback chain.
function bodyweightIn(profile, unit) {
  if (profile?.bodyweight != null && profile.bodyweight !== '') {
    return round1(convertWeight(Number(profile.bodyweight), profile.unit || 'kg', unit))
  }
  const log = getBodyweightLog()
  if (log.length) {
    const latest = [...log].sort((a, b) => b.date - a.date)[0]
    return round1(convertWeight(Number(latest.weight), latest.unit || 'kg', unit))
  }
  return null
}

// What a calculator should start with, in its own units. Every field is null
// when unknown, so callers can tell "no data" from a real zero.
//
//   ready      — the profile has loaded (false while signed out or in flight)
//   from       — true if anything was filled, for the "from your profile" hint
//   unitSystem — 'metric' | 'imperial', null when the user has no saved preference
export function usePrefill() {
  const { user, profile } = useAuth()

  return useMemo(() => {
    const empty = {
      ready: false, from: false, sex: null, unitSystem: null,
      height: null, weight: null, age: null,
    }
    if (!user || !profile) return empty

    const unitSystem = unitSystemFromProfile(profile.unit)
    const sex = profile.sex === 'male' || profile.sex === 'female' ? profile.sex : null
    // Profile height is already stored in the system its unit implies, so it
    // needs no conversion — it lands in a calculator on the same toggle.
    const height = profile.height != null && profile.height !== '' ? round1(Number(profile.height)) : null
    const weight = bodyweightIn(profile, weightUnitFor(unitSystem))
    const age = ageFromBirthYear(profile.birth_year)

    return {
      ready: true,
      from: !!(sex || height || weight || age),
      sex,
      unitSystem: profile.unit ? unitSystem : null,
      height,
      weight,
      age,
    }
  }, [user, profile])
}

// Runs `apply(prefill)` once, as soon as the profile is available — usually the
// calculator's first render, since auth loads the profile at app start.
//
// Returns `{ ...prefill, touch }`. Call `touch()` from any control that can't
// tell "untouched" from "user chose this" (the sex and unit toggles both start
// on a real value, not blank): once touched, the prefill stands down rather than
// yanking a choice back on a slow connection. Text inputs don't need it — seed
// them with a functional update that only fills when the field is still empty.
export function usePrefillEffect(apply) {
  const prefill = usePrefill()
  const done = useRef(false)
  const touched = useRef(false)
  const applyRef = useRef(apply)
  applyRef.current = apply

  useEffect(() => {
    if (!prefill.ready || done.current || touched.current) return
    done.current = true
    applyRef.current(prefill)
  }, [prefill])

  return { ...prefill, touch: () => { touched.current = true } }
}
