// A split as plain text, laid out the way Hani writes his own gym notes — so it
// pastes into a phone's Notes app, or a chat, and reads like something a person
// wrote rather than a report:
//
//   Upper A (Monday)
//
//   1. Incline Smith Press 40kg 6-10 6-10 6-10 (1-2 RIR)
//
//   2. Seated Leg Curl 10-15 10-15 + Cable Crunch 10-15 10-15 - slow negatives
//
// Reps are written once PER SET ("10 10" is two sets of ten), a superset shares
// one numbered line joined by " + ", a note trails after " - ", and rest days
// don't appear at all. Nothing is lined up with spaces: Notes uses a
// proportional font, so columns would only line up on a computer.
//
// Pure: no React, no storage. Everything about the person — profile, name, log
// history, notes — is handed in, so the same code exports your own split and a
// client's. buildExportModel gathers it all once; exportText renders it (and the
// Excel export reads the same model), so two formats can't disagree about what
// a split says. programImport.js reads this text back, so a change to the
// layout here is a change to what it has to parse.

import { GOALS, EXPERIENCE_LEVELS, EQUIPMENT_PRESETS, DIETS, cleanFocus } from './profileFields'
import { rirLabel, isOpenSlot, scheduleMode } from './program'
import { exerciseBlocks, canonicalExerciseId, convertWeight } from './workoutStats'
import { dayStats, bankIdFor } from './planStats'
import { getFullExercise, fmtRest } from './exerciseBank'
import { volumePreference, shapeById } from './generatorConfig'

export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// The heading the coach's notes go under, in a client's export.
export const COACH_NOTES_HEADING = 'Notes from Leon'
export const WEEKLY_SETS_HEADING = 'Weekly sets'

const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))
const trim1 = (n) => String(Math.round(n * 10) / 10)
const labelOf = (list, value) => list.find((o) => o.value === value)?.label || null
// The app writes ranges with an en dash ("1–2 RIR"); notes are typed on a
// phone keyboard, which has none. Plain hyphens, so the export reads like them.
const plain = (s) => (s || '').replace(/[–—]/g, '-')
// A note is one line in the export — a line break inside it would start what
// reads as a new exercise. Its own lines are kept apart with a comma, unless
// one already ends in punctuation.
const oneLine = (s) =>
  plain(s)
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .reduce((out, l) => (out ? `${out}${/[.,;:!?]$/.test(out) ? '' : ','} ${l}` : l), '')

// Same rule as ageFromBirthYear in profilePrefill.js, kept here so this module
// stays free of the auth/storage imports that one carries.
function ageFrom(birthYear, now) {
  const y = num(birthYear)
  if (y == null) return null
  const age = new Date(now).getFullYear() - y
  return age > 0 && age < 120 ? age : null
}

// Height, wrist and ankle are stored in the system the weight unit implies —
// centimetres with kg, inches with lbs — exactly as the profile page keeps them.
const lengthUnit = (unit) => (unit === 'lbs' ? 'in' : 'cm')
const weightUnit = (unit) => (unit === 'lbs' ? 'lbs' : 'kg')

// One entry per profile field the export can say. `line` groups fields that
// read better side by side ("Female · 28 years"); `text` returns null when the
// profile doesn't say — and a field that doesn't say is left out, never written
// as "Goal: —". `label` is what the export panel toggles it by.
export const PROFILE_EXPORT_FIELDS = [
  { key: 'sex', label: 'Sex', line: 'who', text: (p) => (p.sex === 'male' ? 'Male' : p.sex === 'female' ? 'Female' : null) },
  { key: 'age', label: 'Age', line: 'who', text: (p, now) => (ageFrom(p.birth_year, now) == null ? null : `${ageFrom(p.birth_year, now)} years`) },
  { key: 'height', label: 'Height', line: 'body', text: (p) => (num(p.height) == null ? null : `${trim1(num(p.height))} ${lengthUnit(p.unit)}`) },
  { key: 'bodyweight', label: 'Bodyweight', line: 'body', text: (p) => (num(p.bodyweight) == null ? null : `${trim1(num(p.bodyweight))} ${weightUnit(p.unit)}`) },
  { key: 'body_fat', label: 'Body fat', line: 'body', text: (p) => (num(p.body_fat) == null ? null : `${trim1(num(p.body_fat))}% body fat`) },
  { key: 'wrist', label: 'Wrist', line: 'frame', text: (p) => (num(p.wrist) == null ? null : `Wrist ${trim1(num(p.wrist))} ${lengthUnit(p.unit)}`) },
  { key: 'ankle', label: 'Ankle', line: 'frame', text: (p) => (num(p.ankle) == null ? null : `Ankle ${trim1(num(p.ankle))} ${lengthUnit(p.unit)}`) },
  { key: 'goal', label: 'Goal', line: 'goal', text: (p) => (labelOf(GOALS, p.goal) ? `Goal: ${labelOf(GOALS, p.goal)}` : null) },
  { key: 'experience_level', label: 'Experience', line: 'experience', text: (p) => (labelOf(EXPERIENCE_LEVELS, p.experience_level) ? `Experience: ${labelOf(EXPERIENCE_LEVELS, p.experience_level)}` : null) },
  { key: 'training_start_year', label: 'Training since', line: 'experience', text: (p) => (num(p.training_start_year) == null ? null : `training since ${num(p.training_start_year)}`) },
  { key: 'equipment', label: 'Equipment', line: 'equipment', text: (p) => (labelOf(EQUIPMENT_PRESETS, p.equipment) ? `Equipment: ${labelOf(EQUIPMENT_PRESETS, p.equipment)}` : null) },
  { key: 'focus', label: 'Bringing up', line: 'focus', text: (p) => (p.focus?.length ? `Bringing up: ${p.focus.join(', ')}` : null) },
  { key: 'daily_steps', label: 'Steps', line: 'steps', text: (p) => (num(p.daily_steps) == null ? null : `Steps: ${Math.round(num(p.daily_steps)).toLocaleString('en-US')} a day`) },
  { key: 'diet', label: 'Diet', line: 'diet', text: (p) => (labelOf(DIETS, p.diet) ? `Diet: ${labelOf(DIETS, p.diet)}` : null) },
  { key: 'injuries', label: 'Injuries', line: 'injuries', text: (p) => (p.injuries?.trim() ? `Injuries: ${oneLine(p.injuries)}` : null) },
]

// The heaviest working weight the log holds for this movement, from the most
// recent session that did it, in `unit` — "40kg", or "+10kg" for a bodyweight
// movement, where the number is what was ADDED to you. Null when the log has
// never seen it, or only ever logged it without a load.
function lastWeight(sessions, pe, unit) {
  const id = canonicalExerciseId(pe.exerciseId)
  const name = (pe.name || '').trim().toLowerCase()
  for (const session of sessions || []) {
    for (const ex of session.exercises || []) {
      if (ex.kind === 'cardio') continue
      const match = id && ex.exerciseId ? canonicalExerciseId(ex.exerciseId) === id : (ex.name || '').trim().toLowerCase() === name
      if (!match) continue
      const bodyweight = !!ex.bodyweight
      let best = null
      for (const s of ex.sets || []) {
        if (s.type === 'warmup') continue
        const sides = s.left ? [s.left, s.right].filter(Boolean) : [s]
        for (const side of sides) {
          if (!(Number(side.reps) > 0)) continue
          const w = num(bodyweight ? side.added : side.weight)
          if (w != null && (best == null || w > best)) best = w
        }
      }
      if (best == null || best === 0) return null
      const value = trim1(convertWeight(best, session.unit || 'kg', unit))
      return `${bodyweight && best > 0 ? '+' : ''}${value}${weightUnit(unit)}`
    }
  }
  return null
}

function repText(range) {
  if (!range) return null
  const low = num(range.low)
  const high = num(range.high)
  if (low == null && high == null) return null
  if (low == null || high == null || low === high) return `${low ?? high}`
  return `${low}-${high}`
}

// One planned row, as the export says it.
function partFor(pe, { sessions, unit, noteFor }) {
  const open = isOpenSlot(pe)
  const cardio = pe.kind === 'cardio'
  const sets = Math.max(1, Number(pe.sets) || 1)
  const reps = repText(pe.repRange)
  const db = getFullExercise(bankIdFor(pe))
  return {
    id: pe.id,
    name: pe.name,
    exerciseId: pe.exerciseId || null,
    // An open slot names the job ("Any vertical pull"); the generator's own
    // pick rides along as an example rather than an instruction.
    example: open ? getFullExercise(pe.slot?.suggestedId)?.name || null : null,
    kind: cardio ? 'cardio' : 'strength',
    sets,
    repRange: pe.repRange || null,
    reps: cardio || !reps ? [] : Array(sets).fill(reps),
    rir: plain(rirLabel(pe.rirTarget)) || null,
    rest: db?.restSeconds ? plain(fmtRest(db.restSeconds)) : null,
    note: oneLine(noteFor(pe)) || null,
    weight: cardio || open ? null : lastWeight(sessions, pe, unit),
  }
}

// What the week adds up to per muscle — the same weighted sets the day cards
// count, summed. A rotation that isn't seven days long is averaged to a week,
// since weekly is the only form the volume landmarks are graded in.
function weeklySetsFor(program, weekly) {
  const totals = {}
  for (const day of program.days) {
    if (day.kind === 'rest') continue
    for (const row of dayStats(day).muscles) totals[row.muscle] = (totals[row.muscle] || 0) + row.sets
  }
  const scale = weekly || !program.days.length ? 1 : 7 / program.days.length
  return Object.entries(totals)
    .map(([muscle, sets]) => ({ muscle, sets: Math.round(sets * scale) }))
    .filter((r) => r.sets >= 1)
    .sort((a, b) => b.sets - a.sets)
}

// "Upper / Lower · 4 days a week · Standard volume" — the shape when the split
// was generated (a hand-built one has none), how often, and the volume it was
// built at.
function programLine(program, weekly) {
  const train = program.days.filter((d) => d.kind !== 'rest').length
  if (!train) return null
  const settings = program.settings || {}
  const parts = []
  const shape = shapeById(settings.shape)
  if (shape) parts.push(shape.name)
  parts.push(weekly ? `${train} day${train === 1 ? '' : 's'} a week` : `${train} training day${train === 1 ? '' : 's'}, ${program.days.length}-day rotation`)
  if (settings.volume) parts.push(`${volumePreference(settings.volume).label} volume`)
  return parts.join(' · ')
}

// Everything the export can say about one split, gathered once.
//
//   profile   — a profiles row (or a client's profile, same keys). Optional.
//   forName   — who it's for; shown under the title.
//   sessions  — the log, newest first, for last-used weights. Pass [] for a
//               client: their weights live with them, not in your log.
//   unit      — the weight unit those weights are written in.
//   noteFor   — a planned row's note. Your own splits read the shared
//               per-movement notes; a client's split only its own rows.
//   extra     — custom "Label: value" lines (a client's profile extras).
//   injuries  — free text, said as one line.
//   coachNotes — free text under COACH_NOTES_HEADING.
export function buildExportModel({
  program,
  profile = null,
  forName = '',
  sessions = [],
  unit = 'kg',
  noteFor = (pe) => pe.note || '',
  extra = [],
  injuries = '',
  coachNotes = '',
  now = Date.now(),
}) {
  const weekly = scheduleMode(program) === 'weekly'
  // The split's own emphasis when it was generated with one (even "none"), the
  // profile's pick otherwise.
  const focus = Array.isArray(program.settings?.focus) ? program.settings.focus : cleanFocus(profile?.focus_muscles)
  const person = { ...(profile || {}), focus, injuries }

  const about = PROFILE_EXPORT_FIELDS.map((f) => ({ key: f.key, label: f.label, line: f.line, text: f.text(person, now) })).filter((f) => f.text)
  ;(extra || []).forEach((x, i) => {
    const label = (x?.label || '').trim()
    const value = oneLine(x?.value || '')
    if (!value) return
    about.push({ key: `extra-${i}`, label: label || value, line: `extra-${i}`, text: label ? `${label}: ${value}` : value })
  })

  const days = program.days
    .map((day, i) => ({ day, i }))
    .filter(({ day }) => day.kind !== 'rest')
    .map(({ day, i }) => ({
      id: day.id,
      name: (day.name || '').trim() || 'Training day',
      weekday: weekly ? WEEKDAY_NAMES[i] : null,
      rows: exerciseBlocks(day.exercises || []).map((block, b) => ({
        number: b + 1,
        parts: block.map((pe) => partFor(pe, { sessions, unit, noteFor })),
      })),
    }))

  return {
    title: (program.name || '').trim() || 'My split',
    forName: (forName || '').trim(),
    date: new Date(now).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    weekly,
    about,
    programLine: programLine(program, weekly),
    days,
    weeklySets: weeklySetsFor(program, weekly),
    coachNotes: (coachNotes || '').trim(),
  }
}

// What an export includes, before anyone has changed anything. `hidden` lists
// profile fields switched off.
export const DEFAULT_EXPORT_PREFS = {
  name: true,
  date: true,
  hidden: [],
  program: true,
  rir: true,
  rest: false,
  notes: true,
  weights: true,
  weeklySets: true,
  coachNotes: true,
}

export function partText(p, prefs = DEFAULT_EXPORT_PREFS) {
  const bits = [p.example ? `${p.name}, e.g. ${p.example}` : p.name]
  if (prefs.weights && p.weight) bits.push(p.weight)
  if (p.reps.length) bits.push(p.reps.join(' '))
  const bracket = [prefs.rir && p.rir, prefs.rest && p.rest && `rest ${p.rest}`].filter(Boolean)
  if (bracket.length) bits.push(`(${bracket.join(', ')})`)
  const text = bits.join(' ')
  return prefs.notes && p.note ? `${text} - ${p.note}` : text
}

// The profile lines that survive `prefs`, side-by-side fields joined.
export function aboutLines(model, prefs = DEFAULT_EXPORT_PREFS) {
  const hidden = new Set(prefs.hidden || [])
  const lines = new Map()
  for (const f of model.about) {
    if (hidden.has(f.key)) continue
    if (!lines.has(f.line)) lines.set(f.line, [])
    lines.get(f.line).push(f.text)
  }
  return [...lines.values()].map((parts) => {
    const line = parts.join(' · ')
    return line.charAt(0).toUpperCase() + line.slice(1)
  })
}

export function dayHeading(day) {
  return day.weekday ? `${day.name} (${day.weekday})` : day.name
}

export function exportText(model, prefs = DEFAULT_EXPORT_PREFS) {
  const sub = [prefs.name && model.forName && `For ${model.forName}`, prefs.date && model.date].filter(Boolean).join(' · ')
  // The top of the page — title, who it's about, the split's shape — is spaced
  // like a note's header: one blank line between blocks.
  const top = [
    [model.title, ...(sub ? [sub] : [])],
    aboutLines(model, prefs),
    prefs.program && model.programLine ? [model.programLine] : [],
  ]
    .filter((s) => s.length)
    .map((s) => s.join('\n'))
    .join('\n\n')

  // Then each day, two blank lines apart, a blank line between exercises —
  // the spacing of the note this is modelled on.
  const days = model.days.map((day) => {
    const rows = day.rows.map((r) => `${r.number}. ${r.parts.map((p) => partText(p, prefs)).join(' + ')}`)
    return [dayHeading(day), ...rows].join('\n\n')
  })
  const tail = []
  if (prefs.weeklySets && model.weeklySets.length) {
    tail.push(`${WEEKLY_SETS_HEADING}\n${model.weeklySets.map((r) => `${r.muscle} ${r.sets}`).join(' · ')}`)
  }
  if (prefs.coachNotes && model.coachNotes) tail.push(`${COACH_NOTES_HEADING}\n${model.coachNotes}`)

  return [top, ...days, ...tail].filter(Boolean).join('\n\n\n') + '\n'
}

// "Gym 15 - Sara.txt": the split's name, and who it's for when it's for
// someone. Characters a filesystem refuses are dropped rather than replaced.
export function exportFileName(model, ext, prefs = DEFAULT_EXPORT_PREFS) {
  const base = [model.title, prefs.name && model.forName].filter(Boolean).join(' - ')
  const safe = base.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim() || 'Split'
  return `${safe}.${ext}`
}
