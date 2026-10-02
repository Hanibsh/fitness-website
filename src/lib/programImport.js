// Reading an exported split back in — the reverse of programExport.js.
//
// The import file IS the text export: no hidden code, no extra block, so what
// someone pastes into Notes stays as clean as Hani's own notes. That works
// because we wrote the format, so every line has one reading:
//
//   Gym 15                                   ← title (the split's name)
//   For Sara · 2 Oct 2026                    ← optional
//   Female · 28 years                        ← profile lines, " · " between fields
//   Upper / Lower · 4 days a week · Standard volume   ← the split's shape
//   Upper A (Monday)                         ← a day; a weekday means a fixed week
//   1. Hack Squat 40kg 6-10 6-10 (1-2 RIR) - record yourself + Leg Raises 10-15
//   3. Incline Walk 20 min (5 km/h, 10% incline, about 185 cal)   ← cardio
//   Rest day (Wednesday)                     ← a rest day holding cardio
//   Weekly sets / Notes from Leon            ← trailing sections
//
// An exercise line is read left to right: the movement's name (matched against
// the exercise library, longest name first — DB names already contain " - " and
// brackets), an optional weight (ignored: weights live in the log), one rep
// token per set, an optional bracket of RIR / failure / rest, an optional note,
// and " + " before a superset partner. Anything the library doesn't know is
// returned in `unmatched` for the person importing to pick, because a split row
// with no DB movement behind it has no muscles to count.
//
// A cardio movement reads differently: its target ("20 min", "250 cal"), then a
// bracket of settings — km/h or mph, % incline, outdoors, W, level, a stroke,
// an effort. The "about …" estimate in there is ignored and worked out again.
//
// Pure: no React, no storage.

import { GOALS, EXPERIENCE_LEVELS, EQUIPMENT_PRESETS, DIETS, cleanFocus } from './profileFields'
import { createPlannedExercise, createDay, emptyProgram } from './program'
import { newSupersetId, convertWeight } from './workoutStats'
import { exercisePool, exerciseIdForName } from './exerciseLibrary'
import { getFullExercise } from './exerciseBank'
import { PATTERNS, patternPhrase } from '../data/movementPatterns'
import { VOLUME_PREFERENCES, DAYS_PER_WEEK_OPTIONS, shapesFor } from './generatorConfig'
import { primaryMuscleOf } from './generator'
import { WEEKDAY_NAMES, COACH_NOTES_HEADING, WEEKLY_SETS_HEADING, REST_DAY_HEADING } from './programExport'
import { activityById, activityForMovement, defaultCardioParams, DEFAULT_CARDIO_TARGET, mphToKmh } from './cardio'

const EXERCISE_LINE = /^(\d+)\.\s+(.*)$/
const WEEKDAY_HEADER = new RegExp(`^(.*?)\\s*\\((${WEEKDAY_NAMES.join('|')})\\)$`, 'i')
const PROGRAM_LINE = /(\d+) days? a week|(\d+) training days?, (\d+)-day rotation/i
const DATE_ONLY = /^\d{1,2} [A-Za-z]{3,9} \d{4}$/
const FOR_LINE = /^For (.+?)(?: · (\d{1,2} [A-Za-z]{3,9} \d{4}))?$/

// ---- Names ----------------------------------------------------------------------

// Everything the picker offers, longest name first, so "Seated Cable Row, Wide
// Grip" is tried before "Seated Cable Row".
let NAMES = null
function nameIndex() {
  if (!NAMES) {
    NAMES = exercisePool([])
      .map((m) => ({ name: m.name, lower: m.name.toLowerCase(), id: m.id || null, category: m.category }))
      .sort((a, b) => b.lower.length - a.lower.length)
  }
  return NAMES
}

// Open-slot phrases ("Any vertical pull"), longest first for the same reason.
let PHRASES = null
function phraseIndex() {
  if (!PHRASES) {
    PHRASES = PATTERNS.map((p) => ({ id: p.id, lower: patternPhrase(p.id).toLowerCase() })).sort((a, b) => b.lower.length - a.lower.length)
  }
  return PHRASES
}

const endsWord = (s, at) => at >= s.length || /[\s,(]/.test(s[at])
const starts = (s, prefix) => s.toLowerCase().startsWith(prefix) && endsWord(s, prefix.length)

function matchName(s) {
  for (const n of nameIndex()) if (starts(s, n.lower)) return { ...n, rest: s.slice(n.lower.length) }
  return null
}

function matchPhrase(s) {
  for (const p of phraseIndex()) if (starts(s, p.lower)) return { pattern: p.id, rest: s.slice(p.lower.length) }
  return null
}

// Could a superset partner start here? Used to tell " + Cable Crunch" (a
// partner) from a " + " someone typed inside a note.
const partStarts = (s) => !!(matchPhrase(s) || matchName(s))

// ---- One exercise line -------------------------------------------------------------

const WEIGHT = /^\s+[+-]?\d+(?:[.,]\d+)?\s?(?:kg|lbs)(?=\s|$)/i
const CARDIO_TARGET = /^\s+(\d+(?:[.,]\d+)?)\s?(min|cal)(?=\s|$|\()/i
const REPS = /^\s+(\d+)(?:-(\d+))?(?=\s|$|\()/
const BRACKET = /^\s*\(([^)]*)\)/

// A row's name when it isn't one the library knows: the text before its first
// rep (or weight) token, so "my cable thing 10 10" asks about "my cable thing".
function rawName(s) {
  const m = s.match(/^(.+?)(?=\s+(?:[+-]?\d+(?:[.,]\d+)?\s?(?:kg|lbs)\s+)?\d+(?:-\d+)?(?:\s|\(|$))/i)
  const name = (m ? m[1] : s.split(/\s+-\s+|\s*\(/)[0]).trim()
  return { name, rest: s.slice(s.indexOf(name) + name.length) }
}

function parsePart(text) {
  let s = text
  let head
  const phrase = matchPhrase(s)
  if (phrase) {
    s = phrase.rest
    let example = null
    if (/^, e\.g\. /i.test(s)) {
      example = matchName(s.slice(7))
      if (example) s = example.rest
    }
    head = { open: true, pattern: phrase.pattern, example }
  } else {
    const known = matchName(s)
    if (known) {
      s = known.rest
      head = { open: false, match: known }
    } else {
      // Not a name the library has as written — maybe an older name for one it
      // does (exerciseIdForName walks renamed ids forward), maybe a typo.
      const raw = rawName(s)
      s = raw.rest
      const id = exerciseIdForName(raw.name)
      const db = getFullExercise(id)
      head = db ? { open: false, match: { name: db.name, id: db.id, category: db.category } } : { open: false, match: null, raw: raw.name }
    }
  }

  // A cardio movement: its target per session, then its settings.
  if (head.match?.category === 'Cardio') {
    let target = null
    let m = s.match(CARDIO_TARGET)
    if (m) {
      target = { by: m[2].toLowerCase() === 'cal' ? 'kcal' : 'minutes', value: toNum(m[1]) }
      s = s.slice(m[0].length)
    }
    let settings = []
    m = s.match(BRACKET)
    if (m) {
      settings = m[1].split(/,\s*/).map((t) => t.trim()).filter(Boolean)
      s = s.slice(m[0].length)
    }
    return { head, reps: [], rir: null, failure: false, cardio: { target, settings }, ...noteAndNext(s) }
  }

  let m = s.match(WEIGHT)
  if (m) s = s.slice(m[0].length)
  const reps = []
  while ((m = s.match(REPS))) {
    reps.push({ low: Number(m[1]), high: Number(m[2] ?? m[1]) })
    s = s.slice(m[0].length)
  }

  let rir = null
  let failure = false
  m = s.match(BRACKET)
  if (m && /RIR|failure|rest/i.test(m[1])) {
    s = s.slice(m[0].length)
    for (const item of m[1].split(/,\s*/)) {
      const r = item.match(/^(\d+)(?:-(\d+))?\s*RIR$/i)
      if (r) rir = { low: Number(r[1]), high: Number(r[2] ?? r[1]) }
      else if (/last set to failure/i.test(item)) failure = true
    }
  }

  return { head, reps, rir, failure, ...noteAndNext(s) }
}

// Whatever's left up to the next partner is the note — " - record yourself",
// or loose words someone typed after the reps.
function noteAndNext(s) {
  let boundary = -1
  for (let i = s.indexOf(' + '); i !== -1; i = s.indexOf(' + ', i + 1)) {
    if (partStarts(s.slice(i + 3))) { boundary = i; break }
  }
  const tail = boundary === -1 ? s : s.slice(0, boundary)
  const note = tail.replace(/^\s*-\s*/, '').trim()
  const next = boundary === -1 ? null : s.slice(boundary + 3)
  return { note, next }
}

// A cardio row's settings back from the words the export wrote. Starts from
// the movement's own defaults, so a hand-typed "Running 30 min" with no
// bracket still makes a whole row.
function cardioFrom(name, { target, settings }) {
  const activity = activityForMovement(name)
  if (!activity) return null
  const a = activityById[activity]
  const params = defaultCardioParams(activity, name)
  const round1 = (n) => Math.round(n * 10) / 10
  const levels = a.kind === 'stroke' ? null : a.levels
  for (const token of settings) {
    const t = token.toLowerCase()
    let m
    if (/^about /.test(t)) continue
    if ((m = t.match(/^([\d.]+)\s?km\/h$/))) params.speedKmh = toNum(m[1])
    else if ((m = t.match(/^([\d.]+)\s?mph$/))) params.speedKmh = round1(mphToKmh(toNum(m[1])))
    else if ((m = t.match(/^([\d.]+)% incline$/))) params.gradePct = toNum(m[1])
    else if (t === 'outdoors' && activity === 'run') params.outdoors = true
    else if ((m = t.match(/^(\d+)\s?w$/))) params.watts = Number(m[1])
    else if ((m = t.match(/^level ([\d.]+)$/))) params.level = toNum(m[1])
    else if ((m = t.match(/^(\d+) steps\/min$/))) { delete params.level; params.spm = Number(m[1]) }
    else if (a.kind === 'stroke') {
      const stroke = a.strokes.find((s) => s.label.toLowerCase() === t)
      if (stroke) params.stroke = stroke.id
      const current = a.strokes.find((s) => s.id === params.stroke) || a.strokes[0]
      const i = current.levels.findIndex((l) => l.label.toLowerCase() === t)
      if (i !== -1) params.level = i
    } else if (levels) {
      const i = levels.findIndex((l) => l.label.toLowerCase() === t)
      if (i !== -1) params.level = i
    }
  }
  // A speed with no incline named is flat — the export writes it whenever it's there.
  if (a.kind === 'speed' && !settings.some((t) => /% incline$/i.test(t)) && settings.some((t) => /km\/h$|mph$/i.test(t))) params.gradePct = 0
  return { activity, params, target: target || { ...DEFAULT_CARDIO_TARGET } }
}

// A parsed part as a planned row — the same shape the generator writes, so an
// imported split edits, swaps and grades like a generated one.
function plannedFrom(part) {
  const { head, reps, rir, failure, note } = part
  if (part.cardio) {
    const name = head.match.name
    return createPlannedExercise(name, { kind: 'cardio', sets: 1, repRange: null, note, cardio: cardioFrom(name, part.cardio) })
  }
  const sets = reps.length || undefined
  const repRange = reps.length ? { low: Math.min(...reps.map((r) => r.low)), high: Math.max(...reps.map((r) => r.high)) } : undefined
  const rirTarget = rir || failure ? { low: rir?.low ?? '', high: rir?.high ?? '', ...(failure ? { lastSetFailure: true } : {}) } : null
  const base = { sets, repRange, rirTarget, note }
  Object.keys(base).forEach((k) => base[k] === undefined && delete base[k])

  if (head.open) {
    const db = head.example?.id ? getFullExercise(head.example.id) : null
    return createPlannedExercise(patternPhrase(head.pattern), {
      ...base,
      exerciseId: null,
      slot: { pattern: head.pattern, muscle: db ? primaryMuscleOf(db) : null, pinned: false, suggestedId: db?.id || null },
    })
  }
  if (!head.match) return { ...createPlannedExercise(head.raw || 'Unknown exercise', base), unmatched: true }
  const db = head.match.id ? getFullExercise(head.match.id) : null
  return createPlannedExercise(db?.name || head.match.name, {
    ...base,
    exerciseId: db?.id || null,
    kind: head.match.category === 'Cardio' ? 'cardio' : 'strength',
    slot: db?.pattern ? { pattern: db.pattern, muscle: primaryMuscleOf(db), pinned: false, suggestedId: db.id } : null,
  })
}

function parseExerciseLine(body) {
  const rows = []
  let rest = body
  while (rest != null) {
    const part = parsePart(rest)
    rows.push(plannedFrom(part))
    rest = part.next
  }
  if (rows.length > 1) {
    const id = newSupersetId()
    rows.forEach((r) => { r.supersetId = id })
  }
  return rows
}

// ---- Profile lines ------------------------------------------------------------------

const byLabel = (list, label) => list.find((o) => o.label.toLowerCase() === label.trim().toLowerCase())?.value || null
const unitOfLength = (u) => (u.toLowerCase() === 'in' ? 'lbs' : 'kg')
const unitOfWeight = (u) => (u.toLowerCase() === 'lbs' ? 'lbs' : 'kg')
const toNum = (s) => Number(String(s).replace(',', '.'))

// One " · "-separated field. Returns true when it was a profile field.
function readToken(tok, out, now) {
  let m
  const t = tok.trim()
  if ((m = t.match(/^(male|female)$/i))) return (out.profile.sex = m[1].toLowerCase()), true
  if ((m = t.match(/^(\d{1,3}) years?$/i))) return (out.profile.birth_year = new Date(now).getFullYear() - Number(m[1])), true
  if ((m = t.match(/^([\d.,]+) ?(cm|in)$/i))) return (out.profile.height = toNum(m[1])), (out.units.push(unitOfLength(m[2]))), true
  if ((m = t.match(/^([\d.,]+) ?(kg|lbs)$/i))) return (out.profile.bodyweight = toNum(m[1])), (out.units.push(unitOfWeight(m[2]))), true
  if ((m = t.match(/^([\d.,]+)% body fat$/i))) return (out.profile.body_fat = toNum(m[1])), true
  if ((m = t.match(/^(wrist|ankle) ([\d.,]+) ?(cm|in)$/i))) return (out.profile[m[1].toLowerCase()] = toNum(m[2])), (out.units.push(unitOfLength(m[3]))), true
  if ((m = t.match(/^training since (\d{4})$/i))) return (out.profile.training_start_year = Number(m[1])), true
  if ((m = t.match(/^goal: (.+)$/i)) && byLabel(GOALS, m[1])) return (out.profile.goal = byLabel(GOALS, m[1])), true
  if ((m = t.match(/^experience: (.+)$/i)) && byLabel(EXPERIENCE_LEVELS, m[1])) return (out.profile.experience_level = byLabel(EXPERIENCE_LEVELS, m[1])), true
  if ((m = t.match(/^equipment: (.+)$/i)) && byLabel(EQUIPMENT_PRESETS, m[1])) return (out.profile.equipment = byLabel(EQUIPMENT_PRESETS, m[1])), true
  if ((m = t.match(/^diet: (.+)$/i)) && byLabel(DIETS, m[1])) return (out.profile.diet = byLabel(DIETS, m[1])), true
  if ((m = t.match(/^steps: ([\d,.]+) a day$/i))) return (out.profile.daily_steps = Number(m[1].replace(/[,.]/g, ''))), true
  if ((m = t.match(/^bringing up: (.+)$/i))) {
    const focus = cleanFocus(m[1].split(/,\s*/))
    if (focus.length) return (out.profile.focus_muscles = focus), true
  }
  return false
}

function readAboutLine(line, out, now) {
  let m
  if ((m = line.match(/^injuries: (.+)$/i))) return void (out.injuries = m[1].trim())
  const tokens = line.split(' · ')
  // A line is a profile line only if EVERY field on it reads as one — otherwise
  // it's someone's own line ("Sleep: 6 hours") and is kept whole.
  const trial = { profile: {}, units: [] }
  if (tokens.every((t) => readToken(t, trial, now))) {
    Object.assign(out.profile, trial.profile)
    out.units.push(...trial.units)
    return
  }
  m = line.match(/^([^:]{1,40}):\s+(.+)$/)
  out.extra.push(m ? { label: m[1].trim(), value: m[2].trim() } : { label: '', value: line.trim() })
}

function readProgramLine(line, trainCount) {
  const settings = {}
  for (const tok of line.split(' · ')) {
    const v = VOLUME_PREFERENCES.find((p) => tok.trim().toLowerCase() === `${p.label.toLowerCase()} volume`)
    if (v) settings.volume = v.value
  }
  // A shape name means something only at its own day count ("Upper / Lower"
  // is a 4-day shape and a 2-day one).
  const name = line.split(' · ')[0].trim().toLowerCase()
  for (const n of [trainCount, ...DAYS_PER_WEEK_OPTIONS]) {
    const shape = shapesFor(n).find((sh) => sh.name.toLowerCase() === name)
    if (shape) {
      settings.shape = shape.id
      break
    }
  }
  return settings
}

// ---- The whole text ------------------------------------------------------------------

export function parseExportText(input, { now = Date.now() } = {}) {
  const lines = String(input || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[–—]/g, '-')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
  const out = { title: '', forName: '', profile: {}, units: [], extra: [], injuries: '', coachNotes: '', program: null, unmatched: [] }

  const nonEmpty = lines.map((l, i) => ({ l, i })).filter((x) => x.l.trim())
  if (!nonEmpty.length) return out
  let k = 0
  out.title = nonEmpty[k++].l.trim()
  const sub = nonEmpty[k]?.l.trim()
  let m
  if (sub && (m = sub.match(FOR_LINE))) {
    out.forName = m[1].trim()
    k++
  } else if (sub && DATE_ONLY.test(sub)) {
    k++
  }

  // The trailing sections end the days.
  const sectionAt = (x) => x.l.trim() === WEEKLY_SETS_HEADING || x.l.trim() === COACH_NOTES_HEADING
  const rest = nonEmpty.slice(k)
  const end = rest.findIndex(sectionAt)
  const body = end === -1 ? rest : rest.slice(0, end)

  // Where the days begin: the first line that's a day heading — a weekday in
  // brackets, or the line right above an exercise.
  const isExercise = (x) => EXERCISE_LINE.test(x.l.trim())
  let first = body.findIndex((x, j) => !isExercise(x) && (WEEKDAY_HEADER.test(x.l.trim()) || (body[j + 1] && isExercise(body[j + 1]))))
  if (first === -1) first = body.length

  let programLine = null
  for (const x of body.slice(0, first)) {
    const line = x.l.trim()
    if (!programLine && PROGRAM_LINE.test(line)) programLine = line
    else readAboutLine(line, out, now)
  }

  const headers = []
  for (const x of body.slice(first)) {
    const line = x.l.trim()
    if ((m = line.match(EXERCISE_LINE))) {
      if (!headers.length) headers.push({ name: 'Training day', weekday: null, rows: [] })
      headers[headers.length - 1].rows.push(...parseExerciseLine(m[2]))
    } else {
      const wd = line.match(WEEKDAY_HEADER)
      headers.push({
        name: (wd ? wd[1] : line).trim() || 'Training day',
        weekday: wd ? WEEKDAY_NAMES.findIndex((d) => d.toLowerCase() === wd[2].toLowerCase()) : null,
        rows: [],
      })
    }
  }

  // Trailing sections: weekly sets are worked out again from the split, so
  // they're skipped; the coach's notes are kept, line breaks and all.
  if (end !== -1) {
    const notesAt = rest.findIndex((x) => x.l.trim() === COACH_NOTES_HEADING)
    if (notesAt !== -1) {
      const fromLine = rest[notesAt].i + 1
      out.coachNotes = lines.slice(fromLine).join('\n').trim()
    }
  }

  // Measurements come in one unit system; the first one named decides it.
  if (out.units.length) out.profile.unit = out.units[0]

  if (headers.length) {
    const program = emptyProgram(out.title || 'Imported split')
    const weekdays = headers.map((h) => h.weekday)
    const weekly = weekdays.every((w) => w != null && w >= 0) && new Set(weekdays).size === weekdays.length
    // "Rest day" over nothing but cardio is a rest day holding it.
    const isRest = (h) => h.name.toLowerCase() === REST_DAY_HEADING.toLowerCase() && h.rows.length > 0 && h.rows.every((r) => r.kind === 'cardio')
    const train = (h) => (isRest(h) ? { ...createDay('rest'), exercises: h.rows } : { ...createDay('train', h.name), exercises: h.rows })
    // A fixed week comes back on its weekdays with rest days in between. A
    // rotation can't: the text leaves rest days out, so only its training
    // days return.
    program.days = weekly
      ? WEEKDAY_NAMES.map((_, i) => {
          const h = headers.find((x) => x.weekday === i)
          return h ? train(h) : createDay('rest')
        })
      : headers.map(train)
    // A shape is named for its training days; rest days holding cardio don't count.
    const settings = programLine ? readProgramLine(programLine, headers.filter((h) => !isRest(h)).length) : {}
    if (settings.volume) {
      program.settings = {
        volume: settings.volume,
        ...(out.profile.experience_level ? { experience: out.profile.experience_level } : {}),
        focus: out.profile.focus_muscles || [],
        shape: settings.shape || null,
      }
    }
    program.days.forEach((d, dayIndex) =>
      d.exercises.forEach((e) => {
        if (e.unmatched) out.unmatched.push({ dayIndex, exId: e.id, raw: e.name })
      })
    )
    out.program = program
  }
  delete out.units
  return out
}

// Swap an unmatched row for the movement picked in its place, keeping what the
// text said about sets, reps, effort and note.
export function resolveUnmatched(program, dayIndex, exId, { name, category, exerciseId }) {
  const db = getFullExercise(exerciseId)
  return {
    ...program,
    days: program.days.map((d, i) =>
      i !== dayIndex
        ? d
        : {
            ...d,
            exercises: d.exercises.map((e) => {
              if (e.id !== exId) return e
              const { unmatched: _unmatched, ...row } = e
              return {
                ...row,
                name: db?.name || name,
                exerciseId: exerciseId || null,
                kind: category === 'Cardio' ? 'cardio' : 'strength',
                slot: db?.pattern ? { pattern: db.pattern, muscle: primaryMuscleOf(db), pinned: false, suggestedId: db.id } : null,
              }
            }),
          }
    ),
  }
}

// The measurements in `profile` re-expressed in `unit`, the way the profile
// page converts them — so importing "150 lbs" into a kg profile stores 68 kg,
// not 150 kg.
export function measuresInUnit(profile, unit) {
  const from = profile.unit || unit
  if (!unit || from === unit) return { ...profile, unit: unit || from }
  const round1 = (n) => Math.round(n * 10) / 10
  const length = (v) => (v == null ? v : unit === 'lbs' ? Math.round((v / 2.54) * 100) / 100 : round1(v * 2.54))
  const out = { ...profile, unit }
  if (profile.bodyweight != null) out.bodyweight = round1(convertWeight(profile.bodyweight, from, unit))
  for (const key of ['height', 'wrist', 'ankle']) if (profile[key] != null) out[key] = length(profile[key])
  return out
}
