// A split as an Excel workbook — the same export model the text is written
// from (programExport.js), laid out as three tabs: Program, About, Weekly sets.
//
// The spreadsheet library is loaded only when someone asks for a workbook, so
// it costs nothing on any page until then. `write-excel-file/universal` builds
// the file entirely in the browser (MIT-licensed, no server, no account).

import { dayHeading, COACH_NOTES_HEADING, DEFAULT_EXPORT_PREFS } from './programExport'

export const LOG_WEEKS = 8

const bold = (value) => ({ value, fontWeight: 'bold' })

// The workbook's tabs as plain data — separate from the writing so it can be
// checked without producing a file.
export function workbookSheets(model, prefs = DEFAULT_EXPORT_PREFS) {
  // Program: one row per exercise. Columns follow the export's chips, so a
  // workbook never carries something the text left out. A cardio row puts its
  // target ("20 min", "250 cal") under Reps, and its settings and estimate in
  // a Cardio column that only appears when the split has cardio.
  const hasCardio = model.days.some((d) => d.rows.some((r) => r.parts.some((p) => p.cardio)))
  const cols = [
    { key: 'day', head: 'Day', width: 22 },
    { key: 'n', head: '#', width: 5 },
    { key: 'name', head: 'Exercise', width: 42 },
    { key: 'sets', head: 'Sets', width: 6 },
    { key: 'reps', head: 'Reps', width: 9 },
    prefs.rir && { key: 'rir', head: 'RIR', width: 26 },
    prefs.weights && { key: 'weight', head: 'Last weight', width: 12 },
    hasCardio && { key: 'cardio', head: 'Cardio', width: 34 },
    prefs.rest && { key: 'rest', head: 'Rest', width: 12 },
    prefs.notes && { key: 'note', head: 'Notes', width: 40 },
    ...(prefs.logColumns ? Array.from({ length: LOG_WEEKS }, (_, i) => ({ key: `w${i}`, head: `Week ${i + 1}`, width: 12 })) : []),
  ].filter(Boolean)

  const sub = [prefs.name && model.forName && `For ${model.forName}`, prefs.date && model.date].filter(Boolean).join(' · ')
  const program = [[bold(model.title)]]
  if (sub) program.push([{ value: sub }])
  program.push([])
  program.push(cols.map((c) => bold(c.head)))
  model.days.forEach((day, d) => {
    if (d > 0) program.push([])
    let first = true
    for (const row of day.rows) {
      row.parts.forEach((p, i) => {
        // "2a", "2b" — a superset's parts share the text export's line number.
        const n = row.parts.length > 1 ? `${row.number}${String.fromCharCode(97 + i)}` : `${row.number}`
        const cell = {
          day: first ? bold(dayHeading(day)) : null,
          n: { value: n },
          name: { value: p.example ? `${p.name}, e.g. ${p.example}` : p.name },
          sets: p.kind === 'cardio' ? null : { value: p.sets, type: Number },
          reps: p.cardio ? { value: p.cardio.target } : p.reps[0] ? { value: p.reps[0] } : null,
          cardio: p.cardio && (p.cardio.settings || p.cardio.estimate)
            ? { value: [p.cardio.settings, p.cardio.estimate].filter(Boolean).join(' · ') }
            : null,
          rir: p.rir ? { value: p.rir } : null,
          weight: p.weight ? { value: p.weight } : null,
          rest: p.rest ? { value: p.rest } : null,
          note: p.note ? { value: p.note } : null,
        }
        program.push(cols.map((c) => cell[c.key] ?? null))
        first = false
      })
    }
  })

  // About: what the text's top block says, one field to a row.
  const hidden = new Set(prefs.hidden || [])
  const about = [[bold('Field'), bold('Value')]]
  for (const f of model.about) if (!hidden.has(f.key)) about.push([{ value: f.label }, { value: f.value }])
  if (prefs.program && model.programLine) about.push([{ value: 'Split' }, { value: model.programLine }])
  if (prefs.coachNotes && model.coachNotes) about.push([{ value: COACH_NOTES_HEADING }, { value: model.coachNotes, wrap: true }])

  const sheets = [
    { data: program, sheet: 'Program', columns: cols.map((c) => ({ width: c.width })), stickyRowsCount: sub ? 4 : 3 },
  ]
  if (about.length > 1) sheets.push({ data: about, sheet: 'About', columns: [{ width: 18 }, { width: 60 }] })
  if (prefs.weeklySets && model.weeklySets.length) {
    sheets.push({
      data: [[bold('Muscle'), bold('Sets per week')], ...model.weeklySets.map((r) => [{ value: r.muscle }, { value: r.sets, type: Number }])],
      sheet: 'Weekly sets',
      columns: [{ width: 18 }, { width: 14 }],
    })
  }
  return sheets
}

export async function workbookBlob(model, prefs = DEFAULT_EXPORT_PREFS) {
  const { default: writeExcelFile } = await import('write-excel-file/universal')
  return writeExcelFile(workbookSheets(model, prefs)).toBlob()
}
