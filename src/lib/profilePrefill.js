// Seeds the calculators from the signed-in user's profile, so nobody retypes
// their sex, height, weight, age, body fat, frame and habits on every tool.
//
// Two vocabularies meet here. The profile stores a weight unit ('kg' | 'lbs')
// and a height in the matching system (cm with kg, inches with lbs); the
// calculators use a single 'metric' | 'imperial' toggle. This module is the
// bridge — prefills are always handed over in the calculator's vocabulary.
//
// Height needs no conversion, which is easy to misread as a bug: it's stored in
// the system its own unit implies, and callers set the calculator to that same
// system before filling it in. Only bodyweight converts, because it can also
// come from a weigh-in logged in the other unit. Wrist and ankle follow
// height's rule exactly.
//
// Two values aren't on the profile at all: weekly training hours come from the
// logged sessions (the profile deliberately stopped asking for days/week and
// session length — the log knows), and TDEE is worked out from everything else
// with the TDEE calculator's own formula. Both need the session history, so
// they arrive in a second, opt-in step (see usePrefillEffect).
//
// Prefill is a starting point, never a constraint: every value stays editable,
// and `usePrefill` is deliberately a read — it never writes back to the profile.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './auth'
import { getBodyweightLog, getHistory } from './workoutStore'
import { fetchRemoteHistory } from './workoutRemote'
import { convertWeight } from './workoutStats'
import { estimateTdee } from './tdee'
import { GOAL_VALUES, BODY_FAT_BOUNDS, MAX_TRAINING_YEARS } from './profileFields'

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

// A profile number, or null when it's blank or junk.
const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))

export function trainingYearsFromStart(startYear) {
  const y = num(startYear)
  if (y == null) return null
  const years = new Date().getFullYear() - y
  return years >= 0 && years <= MAX_TRAINING_YEARS ? years : null
}

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

// How many hours a week you've been training lately, from the sessions you
// logged: the last 4 weeks, or since your first session if that's sooner.
// Sessions without a recorded duration (old or backfilled ones) count at the
// average length of the ones that have one, rather than as zero.
//
// Null when the log can't say: under 2 weeks of history, nothing logged in the
// window, or no durations at all. A quiet log isn't proof of a quiet month, so
// it never claims 0. Rounded to the nearest half hour.
const DAY_MS = 24 * 60 * 60 * 1000
const HOURS_WINDOW_DAYS = 28
const HOURS_MIN_HISTORY_DAYS = 14

export function weeklyTrainingHours(sessions, now = Date.now()) {
  if (!sessions?.length) return null
  const sinceFirst = (now - Math.min(...sessions.map((s) => s.date))) / DAY_MS
  if (sinceFirst < HOURS_MIN_HISTORY_DAYS) return null

  const recent = sessions.filter((s) => s.date > now - HOURS_WINDOW_DAYS * DAY_MS && s.date <= now)
  const timed = recent.filter((s) => s.durationMs > 0)
  if (!timed.length) return null

  // A log younger than the window starts ON a session, so it's missing the gap
  // that came before it — measured as-is, 3 sessions a week over 18 days reads
  // as 3.5. One average gap gets added back.
  const spanDays = sinceFirst >= HOURS_WINDOW_DAYS ? HOURS_WINDOW_DAYS : sinceFirst * (1 + 1 / recent.length)

  const avgMs = timed.reduce((sum, s) => sum + s.durationMs, 0) / timed.length
  const hours = (recent.length * avgMs) / 3600000 / (spanDays / 7)
  return Math.round(hours * 2) / 2
}

// What a calculator should start with, in its own units. Every field is null
// when unknown, so callers can tell "no data" from a real zero.
//
//   ready      — the profile has loaded (false while signed out or in flight)
//   from       — true if anything was filled, for the "from your profile" hint
//   unitSystem — 'metric' | 'imperial', null when the user has no saved preference
//   goal       — a GOAL_VALUES entry, null when unset
//   bodyFat    — a whole percent
//   vegan      — true/false from the saved diet, null when unset
//   years      — whole years since "Started training"
export function usePrefill() {
  const { user, profile } = useAuth()

  return useMemo(() => {
    const empty = {
      ready: false, from: false, sex: null, unitSystem: null,
      height: null, weight: null, age: null, goal: null,
      bodyFat: null, wrist: null, ankle: null, steps: null, vegan: null, years: null,
    }
    if (!user || !profile) return empty

    const unitSystem = unitSystemFromProfile(profile.unit)
    const sex = profile.sex === 'male' || profile.sex === 'female' ? profile.sex : null
    // Profile height is already stored in the system its unit implies, so it
    // needs no conversion — it lands in a calculator on the same toggle.
    const height = num(profile.height) != null ? round1(num(profile.height)) : null
    const weight = bodyweightIn(profile, weightUnitFor(unitSystem))
    const age = ageFromBirthYear(profile.birth_year)
    const goal = GOAL_VALUES.includes(profile.goal) ? profile.goal : null
    const bf = num(profile.body_fat)
    const bodyFat = bf != null && bf >= BODY_FAT_BOUNDS.min && bf <= BODY_FAT_BOUNDS.max ? Math.round(bf) : null
    // Same system as height, so no conversion either.
    const wrist = num(profile.wrist) != null ? round1(num(profile.wrist)) : null
    const ankle = num(profile.ankle) != null ? round1(num(profile.ankle)) : null
    const steps = num(profile.daily_steps) != null ? Math.round(num(profile.daily_steps)) : null
    const vegan = profile.diet === 'vegan' ? true : profile.diet === 'omnivore' ? false : null
    const years = trainingYearsFromStart(profile.training_start_year)

    return {
      ready: true,
      from: !!(sex || height || weight || age || wrist || ankle) ||
        bodyFat != null || steps != null || vegan != null || years != null,
      sex,
      unitSystem: profile.unit ? unitSystem : null,
      height,
      weight,
      age,
      goal,
      bodyFat,
      wrist,
      ankle,
      steps,
      vegan,
      years,
    }
  }, [user, profile])
}

// TDEE from the profile alone — only when every input the TDEE calculator would
// want is really known, because a guessed body fat or a missing step count
// moves the answer by hundreds of calories. Training hours count as known when
// the log could work them out.
function tdeeFromPrefill(p, hours) {
  if (!p.sex || p.age == null || p.weight == null || p.height == null) return null
  if (p.bodyFat == null || p.steps == null || hours == null) return null
  const metric = p.unitSystem !== 'imperial'
  const weightKg = metric ? p.weight : convertWeight(p.weight, 'lbs', 'kg')
  const heightCm = metric ? p.height : p.height * 2.54
  const { tdee } = estimateTdee({ weightKg, heightCm, age: p.age, sex: p.sex, bodyFat: p.bodyFat, workoutHours: hours, steps: p.steps })
  return Math.round(tdee)
}

// The log-derived half of the prefill: weekly training hours, and the TDEE that
// needs them. Loads the session history the way every other surface does —
// remote when signed in, this device's copy if that fails. Fetches nothing
// unless `enabled`, so calculators that don't need it don't pay for it.
function useLogPrefill(enabled, prefill) {
  const { user } = useAuth()
  const [log, setLog] = useState({ userId: null, hours: null })

  useEffect(() => {
    if (!enabled || !user) return
    let cancelled = false
    async function load() {
      let sessions
      try {
        sessions = await fetchRemoteHistory(user.id)
      } catch {
        sessions = getHistory()
      }
      if (!cancelled) setLog({ userId: user.id, hours: weeklyTrainingHours(sessions) })
    }
    load()
    return () => { cancelled = true }
  }, [enabled, user])

  return useMemo(() => {
    const ready = enabled && prefill.ready && !!user && log.userId === user.id
    if (!ready) return { ready: false, trainingHours: null, tdee: null }
    return { ready: true, trainingHours: log.hours, tdee: tdeeFromPrefill(prefill, log.hours) }
  }, [enabled, prefill, user, log])
}

// Runs `apply(prefill)` once, as soon as the profile is available — usually the
// calculator's first render, since auth loads the profile at app start.
//
// Returns `{ ...prefill, fromLog, touch }`. Call `touch()` from any control that
// can't tell "untouched" from "user chose this" (the sex and unit toggles both
// start on a real value, not blank): once touched, the prefill stands down
// rather than yanking a choice back on a slow connection. Text inputs don't
// need it — seed them with a functional update that only fills when the field
// is still empty.
//
// `applyLog`, when given, runs once the session history has loaded, with
// `{ trainingHours, tdee }` (either may be null). It's a separate step so the
// profile values never wait on a history fetch. It should only fill empty
// fields, so `touch()` doesn't stop it. `fromLog` is true once the log yielded
// training hours; `logTdee` is the TDEE it handed over, for callers to tell
// whether the field still shows it.
export function usePrefillEffect(apply, applyLog) {
  const prefill = usePrefill()
  const logPrefill = useLogPrefill(!!applyLog, prefill)
  const done = useRef(false)
  const logDone = useRef(false)
  const touched = useRef(false)
  const applyRef = useRef(apply)
  const applyLogRef = useRef(applyLog)
  applyRef.current = apply
  applyLogRef.current = applyLog

  useEffect(() => {
    if (!prefill.ready || done.current || touched.current) return
    done.current = true
    applyRef.current(prefill)
  }, [prefill])

  useEffect(() => {
    if (!logPrefill.ready || logDone.current || !applyLogRef.current) return
    logDone.current = true
    applyLogRef.current(logPrefill)
  }, [logPrefill])

  const fromLog = logPrefill.ready && logPrefill.trainingHours != null
  return { ...prefill, fromLog, logTdee: logPrefill.tdee, touch: () => { touched.current = true } }
}
