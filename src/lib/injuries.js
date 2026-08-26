// Injuries — the model. Storage lives in workoutStore.js (getInjuries/saveInjury/
// deleteInjury) and workoutRemote.js for the Supabase mirror; this file is pure
// functions over the data, the same split dayLog.js has for day annotations.
//
// WHY AN INJURY ISN'T A DAY ANNOTATION
//
// A day annotation says "I couldn't train on the 14th". That's an event, and
// marking one SPENDS the day's split slot (SLOT_CONSUMING_REASONS in program.js).
// An injury is a condition with a lifespan: it opens, it hurts more or less over
// weeks, it changes what you should be doing the whole time, and then it closes.
// Writing one annotation per day of a three-week injury would burn twenty-one
// slots to say one thing, so the two stay separate and an annotation merely
// POINTS at an injury via `injuryId`.
//
// Shape:
//   { id, kind: 'joint'|'muscle', area, side, label, status,
//     startedAt, resolvedAt, note,
//     checkins: [{ id, date, pain, note }],   // newest-first
//     verdicts: { [exerciseId]: 'hurts'|'ok' } }

import { ATOM_TO_GROUP } from './engineConfig'
import {
  JOINT_AREAS, STRAIN_STRETCH_BOOST, STABILITY_FACTOR,
  JOINT_STRETCH_BOOST, JOINT_EQUIPMENT_FACTOR,
  STATUS_FACTOR, PAIN_FACTOR, DEFAULT_PAIN_WEIGHT, RISK_TIERS, RISK_FLOOR,
  REHAB_KINDS, REHAB_RECENT_DAYS,
} from './injuryConfig'

const DAY_MS = 86400000

export const INJURY_STATUSES = [
  { id: 'active', label: 'Active', blurb: 'It hurts and you are working around it.' },
  { id: 'managing', label: 'Managing', blurb: 'Improving — training it deliberately, still careful.' },
  { id: 'resolved', label: 'Resolved', blurb: 'Done. Stops affecting your programming.' },
]

export const SIDES = [
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
  { id: 'both', label: 'Both' },
  { id: null, label: 'N/A' },
]

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n))
}

function startOfDay(ts) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// ---- Naming ------------------------------------------------------------------

export function areaLabel(injury) {
  if (!injury) return ''
  return injury.kind === 'joint' ? JOINT_AREAS[injury.area]?.label || injury.area : injury.area
}

export function areaBlurb(injury) {
  if (!injury) return ''
  if (injury.kind !== 'joint') return 'A strain in the muscle itself.'
  return JOINT_AREAS[injury.area]?.blurb || ''
}

// What to call this injury in a sentence: their own label if they gave one,
// otherwise the area with its side ("Left knee"). Side leads because that's how
// people say it out loud.
export function injuryTitle(injury) {
  if (!injury) return ''
  if (injury.label?.trim()) return injury.label.trim()
  const area = areaLabel(injury)
  if (!injury.side || injury.side === 'both') {
    return injury.side === 'both' ? `Both ${area.toLowerCase()}s` : area
  }
  const side = injury.side === 'left' ? 'Left' : 'Right'
  return `${side} ${area.toLowerCase()}`
}

// ---- Lifespan ----------------------------------------------------------------

export function isOpen(injury) {
  return injury?.status === 'active' || injury?.status === 'managing'
}

export function openInjuries(injuries = []) {
  return injuries.filter(isOpen)
}

// Does this injury cover the given calendar day? Open injuries run to today and
// no further — an injury doesn't get to shade days that haven't happened.
export function injurySpansDay(injury, dayMs, now = Date.now()) {
  if (!injury) return false
  const day = startOfDay(dayMs)
  if (day < startOfDay(injury.startedAt)) return false
  const end = injury.resolvedAt ? startOfDay(injury.resolvedAt) : startOfDay(now)
  return day <= end
}

export function injuriesOnDay(injuries = [], dayMs, now = Date.now()) {
  return injuries.filter((i) => injurySpansDay(i, dayMs, now))
}

// Whole days from onset to resolution (or to now, while it's still open). Day
// one is the day it happened, so this is inclusive at both ends.
export function injuryDuration(injury, now = Date.now()) {
  if (!injury) return 0
  const end = injury.resolvedAt || now
  return Math.max(1, Math.round((startOfDay(end) - startOfDay(injury.startedAt)) / DAY_MS) + 1)
}

// ---- Check-ins ---------------------------------------------------------------

export function latestCheckin(injury) {
  if (!injury?.checkins?.length) return null
  return [...injury.checkins].sort((a, b) => b.date - a.date)[0]
}

export function latestPain(injury) {
  const c = latestCheckin(injury)
  return c ? c.pain : null
}

export function daysSinceCheckin(injury, now = Date.now()) {
  const c = latestCheckin(injury)
  if (!c) return null
  return Math.floor((startOfDay(now) - startOfDay(c.date)) / DAY_MS)
}

// Oldest-first {date, value} pairs for ProgressChart. The onset is prepended as
// an implicit point so a single check-in still draws a line you can read.
export function painPoints(injury) {
  const checkins = [...(injury?.checkins || [])].sort((a, b) => a.date - b.date)
  return checkins.map((c) => ({ date: c.date, value: c.pain, checkin: c }))
}

// Is it actually getting better? Compares the mean of the first and last third
// of the check-ins rather than first-vs-last, so one bad morning doesn't read as
// a relapse. Null until there's enough history to say anything honest.
export function painTrend(injury) {
  const points = painPoints(injury)
  if (points.length < 3) return null
  const n = Math.max(1, Math.round(points.length / 3))
  const mean = (arr) => arr.reduce((s, p) => s + p.value, 0) / arr.length
  const first = mean(points.slice(0, n))
  const last = mean(points.slice(-n))
  const delta = last - first
  if (Math.abs(delta) < 0.75) return { direction: 'flat', delta }
  return { direction: delta < 0 ? 'improving' : 'worsening', delta }
}

// ---- Rehab -------------------------------------------------------------------
//
// Kept apart from check-ins on purpose: a check-in is an observation, a rehab
// entry is an action. Folded together they'd make one list that answers neither
// question — and the pain chart would have gaps where you'd done the work.

export function rehabLabel(kind) {
  return REHAB_KINDS.find((k) => k.id === kind)?.label || 'Other'
}

export function lastRehab(injury) {
  if (!injury?.rehab?.length) return null
  return [...injury.rehab].sort((a, b) => b.date - a.date)[0]
}

export function daysSinceRehab(injury, now = Date.now()) {
  const last = lastRehab(injury)
  if (!last) return null
  return Math.floor((startOfDay(now) - startOfDay(last.date)) / DAY_MS)
}

// How many entries in the last `days`. Counts ENTRIES, not days: two physio
// sessions in a week are two facts, and collapsing them would flatter a week
// where you did less.
export function rehabCount(injury, days = REHAB_RECENT_DAYS, now = Date.now()) {
  const cutoff = startOfDay(now) - (days - 1) * DAY_MS
  return (injury?.rehab || []).filter((r) => startOfDay(r.date) >= cutoff).length
}

// ---- Risk --------------------------------------------------------------------

// Roll an exercise's muscle atoms up to engine muscles, keeping the HEAVIEST
// atom per group rather than summing them — the same rule effectiveWeeklyVolume
// uses, and for the same reason: two chest atoms on one press is one chest
// effort, not two.
function engineMuscleWeights(db) {
  const out = {}
  for (const [atom, weight] of Object.entries(db?.muscles || {})) {
    const group = ATOM_TO_GROUP[atom] || atom
    if (!(out[group] >= weight)) out[group] = weight
  }
  return out
}

// How much this movement loads the injured thing, IGNORING how bad the injury
// currently is (that's injuryWeight). A verdict short-circuits the whole model:
// if you've told us a movement hurts, no amount of anatomy reasoning gets to
// argue, and if you've cleared it, it's clear.
//
// DELIBERATELY NOT CLAMPED AT 1. 1.0 is "as bad as this area gets", but the
// value is allowed past it, and that headroom is load-bearing: the generator
// picks the best movement for a MUSCLE, so the penalty only changes anything if
// it separates candidates within that muscle. Clamping flattened every chest
// press to exactly 1.0 for a shoulder injury, the penalty subtracted the same
// number from all of them, and the generated split came out identical. Tiers
// clamp instead (riskTier), so the badge still tops out at "high".
export function injuryRisk(db, injury) {
  if (!db || !injury) return 0
  const verdict = injury.verdicts?.[db.id]
  if (verdict === 'hurts') return 1
  if (verdict === 'ok') return 0

  const weights = engineMuscleWeights(db)

  if (injury.kind === 'muscle') {
    const base = weights[injury.area] || 0
    if (!base) return 0
    // A strained muscle's problem is length under load, not stability or how
    // compound the lift is — so `stretchMediated` is the only modifier.
    return base * (1 + (STRAIN_STRETCH_BOOST[db.stretchMediated] ?? 0))
  }

  const area = JOINT_AREAS[injury.area]
  if (!area) return 0
  let base = 0
  for (const [muscle, w] of Object.entries(weights)) {
    const areaWeight = area.muscles[muscle] || 0
    if (areaWeight) base = Math.max(base, areaWeight * w)
  }
  if (!base) return 0

  // Multiplicative, so a boost scales a real risk instead of dragging an
  // incidental one into a tier that would make people distrust the badge.
  let factor = 1
  if (db.type === 'compound') factor += area.compoundBoost || 0
  if (db.axialLoading) factor += area.axialBoost || 0
  factor += JOINT_STRETCH_BOOST[db.stretchMediated] ?? 0
  factor *= STABILITY_FACTOR[db.stability] ?? 1
  factor *= JOINT_EQUIPMENT_FACTOR[db.equipment] ?? 1
  factor *= area.equipmentRelief?.[db.equipment] ?? 1
  return base * factor
}

// How much this injury counts right now — its status crossed with the last pain
// you reported. Separate from injuryRisk so the badge can say "this loads your
// shoulder" (a fact about the movement) while the generator penalty says how
// much to care (a fact about today).
export function injuryWeight(injury) {
  const status = STATUS_FACTOR[injury?.status] ?? 0
  if (!status) return 0
  const pain = latestPain(injury)
  const painWeight = pain == null
    ? DEFAULT_PAIN_WEIGHT
    : clamp(PAIN_FACTOR.floor + PAIN_FACTOR.perPoint * pain, 0, 1)
  return status * painWeight
}

// Tiers are where the uncapped risk gets clamped back to something a badge can
// say. Everything at or past 1.0 is simply "high" — the extra headroom exists to
// rank movements against each other, not to invent a fourth tier.
export function riskTier(risk) {
  if (risk >= RISK_TIERS.high) return 'high'
  if (risk >= RISK_TIERS.moderate) return 'moderate'
  if (risk >= RISK_TIERS.low) return 'low'
  return null
}

export const TIER_LABEL = { high: 'Likely to aggravate', moderate: 'Loads this area', low: 'Nearby' }

// The lookup both the badges and the generator read: exercise id → the worst
// thing any open injury has to say about it.
//
//   risk     — raw, for the badge and its tier
//   weighted — risk × how much that injury counts, for the scoring penalty
//   injury   — whichever one is driving it, so the badge can name it
//
// Built once per injury list and passed around rather than recomputed per
// exercise: fillDay scores the whole pool for every slot of every day.
export function injuryRiskMap(injuries = [], pool = []) {
  const map = new Map()
  const open = openInjuries(injuries)
  if (!open.length) return map
  const weights = new Map(open.map((i) => [i.id, injuryWeight(i)]))
  for (const db of pool) {
    let best = null
    for (const injury of open) {
      const risk = injuryRisk(db, injury)
      if (risk < RISK_FLOOR) continue
      const weighted = risk * (weights.get(injury.id) || 0)
      if (!best || weighted > best.weighted || (weighted === best.weighted && risk > best.risk)) {
        best = { exerciseId: db.id, risk, weighted, tier: riskTier(risk), injury }
      }
    }
    if (best) map.set(db.id, best)
  }
  return map
}

// Every movement an injury has something to say about, worst first — the
// "cleared movements" checklist on the injury page, and the source of the
// return-to-training picture. Verdicts are folded in, so a movement you cleared
// drops off and one you flagged jumps to the top.
export function implicatedExercises(injury, pool = [], { limit = 0, floor = RISK_FLOOR } = {}) {
  const rows = []
  for (const db of pool) {
    const risk = injuryRisk(db, injury)
    if (risk < floor) continue
    rows.push({ db, risk, tier: riskTier(risk), verdict: injury.verdicts?.[db.id] || null })
  }
  rows.sort((a, b) => b.risk - a.risk || a.db.name.localeCompare(b.db.name))
  return limit ? rows.slice(0, limit) : rows
}
