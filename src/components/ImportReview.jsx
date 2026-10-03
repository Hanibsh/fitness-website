import { useMemo, useState } from 'react'
import { FileInput, Dumbbell, Moon, AlertTriangle } from 'lucide-react'
import ExercisePicker from './ExercisePicker'
import { parseExportText, resolveUnmatched, measuresInUnit } from '../lib/programImport'
import { PROFILE_EXPORT_FIELDS, WEEKDAY_NAMES, COACH_NOTES_HEADING } from '../lib/programExport'
import { supersetLabels } from '../lib/workoutStats'
import { cardioTargetText } from '../lib/cardio'

// Paste (or open) an exported split and see what it would bring in before
// anything is written: the split, day by day, and each profile field as
// "now → from the file" with its own tick. Nothing overwrites anything quietly —
// a field that already holds something different starts unticked.
//
// Used for your own account (/import) and for a client (their page). The
// caller decides what "import" writes; this only hands over what was chosen:
//
//   onImport({ program, profile, extra, injuries, coachNotes })
//
// `program` is null when the text held no days, `profile` only the ticked
// fields (converted into `currentProfile`'s units), and the last three are only
// passed for a client (`withExtras`) — your own profile has nowhere to put them.

// Export field key → the profile column(s) it reads back into.
const COLUMNS = { age: 'birth_year', focus: 'focus_muscles' }
const columnOf = (key) => COLUMNS[key] || key
const PROFILE_KEYS = PROFILE_EXPORT_FIELDS.filter((f) => f.key !== 'injuries')

// How a profile reads, field by field, in the export's own words.
function readable(profile) {
  if (!profile) return {}
  const p = { ...profile, focus: profile.focus_muscles }
  return Object.fromEntries(PROFILE_KEYS.map((f) => [f.key, f.value(p, Date.now())]))
}

export default function ImportReview({ currentProfile = null, canSaveProfile = true, withExtras = false, importLabel = 'Import', onImport }) {
  const [text, setText] = useState('')
  const [fileError, setFileError] = useState('')
  const [picks, setPicks] = useState({}) // unmatched row id → the movement picked for it
  const [ticks, setTicks] = useState({}) // profile field → ticked or not, where changed by hand
  const [name, setName] = useState(null) // null = the title in the text
  const [bring, setBring] = useState({ extra: true, injuries: true, coachNotes: true })

  function load(next) {
    setText(next)
    setPicks({})
    setTicks({})
    setName(null)
  }

  async function openFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setFileError('')
    try {
      load(await file.text())
    } catch {
      setFileError('That file couldn’t be read — try pasting its text instead.')
    }
  }

  const parsed = useMemo(() => parseExportText(text), [text])

  // The split as it will be saved: the text's version, with every picked
  // movement in place of the row it was picked for.
  const program = useMemo(() => {
    if (!parsed.program) return null
    let p = parsed.program
    for (const u of parsed.unmatched) if (picks[u.exId]) p = resolveUnmatched(p, u.dayIndex, u.exId, picks[u.exId])
    return name == null ? p : { ...p, name: name.slice(0, 60) }
  }, [parsed, picks, name])
  const unresolved = parsed.unmatched.filter((u) => !picks[u.exId])

  // The file's measurements, in the units the profile already uses.
  const unit = currentProfile?.unit || parsed.profile.unit || 'kg'
  const incoming = useMemo(() => measuresInUnit(parsed.profile, unit), [parsed, unit])
  const now = readable(currentProfile)
  const next = readable(incoming)
  const fields = PROFILE_KEYS.filter((f) => next[f.key] != null && next[f.key] !== '').map((f) => {
    const before = now[f.key]
    const same = before != null && String(before) === String(next[f.key])
    const clash = before != null && before !== '' && !same
    return { ...f, before, after: next[f.key], same, ticked: ticks[f.key] ?? !clash }
  })
  const changing = fields.filter((f) => !f.same)

  const hasExtras = withExtras && (parsed.extra.length > 0 || parsed.injuries || parsed.coachNotes)
  const nothing = text.trim() && !program && !changing.length && !hasExtras

  function submit() {
    const ticked = changing.filter((f) => f.ticked)
    const profile = {}
    for (const f of ticked) profile[columnOf(f.key)] = incoming[columnOf(f.key)]
    // Measurements are stored in the profile's unit system; say which one when
    // the profile never had one.
    if (!currentProfile?.unit && ticked.some((f) => ['height', 'bodyweight', 'wrist', 'ankle'].includes(f.key))) profile.unit = unit
    onImport({
      program: program || null,
      profile: canSaveProfile && Object.keys(profile).length ? profile : null,
      ...(withExtras
        ? {
            extra: bring.extra ? parsed.extra : [],
            injuries: bring.injuries ? parsed.injuries : '',
            coachNotes: bring.coachNotes ? parsed.coachNotes : '',
          }
        : {}),
    })
  }

  const labelCls = 'text-[11px] uppercase tracking-wider text-text-light block mb-2'
  const tick = (checked, onChange, label, sub) => (
    <label key={label} className="flex items-start gap-2.5 py-2 cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={onChange} className="w-4 h-4 mt-0.5 shrink-0 accent-text-primary cursor-pointer" />
      <span className="min-w-0 text-[13px] text-text-secondary break-words">
        {label}
        {sub && <span className="block text-[11px] text-text-light break-words">{sub}</span>}
      </span>
    </label>
  )

  return (
    <div className="space-y-5">
      <div>
        <label className={labelCls} htmlFor="import-text">Paste the text</label>
        <textarea
          id="import-text"
          value={text}
          onChange={(e) => load(e.target.value)}
          rows={text ? 6 : 10}
          placeholder={'Gym 15\nFor Sara · 2 Oct 2026\n\nUpper A (Monday)\n\n1. Hack Squat 6-10 6-10 (1-2 RIR)\n…'}
          className="w-full bg-cream border border-border px-3 py-2.5 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors resize-y"
        />
        <label className="inline-flex items-center gap-1.5 text-[12px] font-medium text-text-muted hover:text-text-primary cursor-pointer mt-2 transition-colors">
          <FileInput className="w-3.5 h-3.5" /> Or open a .txt file
          <input type="file" accept=".txt,text/plain" onChange={openFile} className="sr-only" />
        </label>
        {fileError && <p className="text-[12px] text-amber-600 mt-1">{fileError}</p>}
      </div>

      {nothing && (
        <p className="text-[13px] text-amber-600">
          No split or profile found in that text. It reads files made with Export as text — day names, then numbered
          exercises.
        </p>
      )}

      {program && (
        <div>
          <label className={labelCls} htmlFor="import-name">The split</label>
          <input
            id="import-name"
            value={program.name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-cream border border-border px-3 py-2 text-text-primary text-[14px] font-heading font-medium outline-none focus:border-text-primary transition-colors mb-2"
          />
          <p className="text-[11px] text-text-light mb-3">
            {program.days.length === 7 ? 'Fixed week' : `${program.days.length}-day rotation`} ·{' '}
            {program.days.filter((d) => d.kind !== 'rest').length} training days
            {program.days.length !== 7 && ' — a rotation comes back without its rest days, which the text leaves out (except ones holding cardio).'}
          </p>
          <div className="border border-border divide-y divide-border">
            {program.days.map((d, dayIndex) => {
              // A rest day shows only when it holds cardio.
              if (d.kind === 'rest' && !d.exercises.length) return null
              const pairs = supersetLabels(d.exercises)
              return (
                <div key={d.id} className="px-3 py-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    {d.kind === 'rest' ? <Moon className="w-3.5 h-3.5 text-text-light shrink-0" /> : <Dumbbell className="w-3.5 h-3.5 text-text-light shrink-0" />}
                    <span className="text-[13px] font-medium text-text-primary break-words">{d.kind === 'rest' ? 'Rest day · cardio' : d.name}</span>
                    {program.days.length === 7 && <span className="text-[11px] text-text-light">{WEEKDAY_NAMES[dayIndex]}</span>}
                  </div>
                  <ul className="list-none p-0 m-0 space-y-1">
                    {d.exercises.map((e) => {
                      const missing = parsed.unmatched.find((u) => u.exId === e.id) && !picks[e.id]
                      return (
                        <li key={e.id} className="text-[12px]">
                          <div className="flex items-baseline gap-2">
                            {pairs.get(e.id) && (
                              <span className="shrink-0 text-[9px] font-semibold text-cream bg-text-primary px-1 py-0.5">{pairs.get(e.id).label}</span>
                            )}
                            <span className={`min-w-0 break-words ${missing ? 'text-amber-600' : 'text-text-secondary'}`}>{e.name}</span>
                            <span className="text-text-light shrink-0 ml-auto tabular-nums">
                              {e.kind === 'cardio'
                                ? e.cardio ? cardioTargetText(e.cardio.target) : null
                                : `${e.sets} × ${e.repRange?.low}–${e.repRange?.high}`}
                            </span>
                          </div>
                          {missing && (
                            <div className="mt-1.5 mb-2">
                              <p className="flex items-start gap-1.5 text-[11px] text-amber-600 mb-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                                Not in the exercise list — pick the movement this means.
                              </p>
                              <ExercisePicker
                                onSelect={(n, category, exerciseId) => setPicks((prev) => ({ ...prev, [e.id]: { name: n, category, exerciseId } }))}
                                placeholder="Search for it…"
                              />
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {changing.length > 0 && (
        <div>
          <span className={labelCls}>Profile</span>
          {canSaveProfile ? (
            <div className="border border-border px-3 divide-y divide-border">
              {changing.map((f) =>
                tick(
                  f.ticked,
                  () => setTicks((prev) => ({ ...prev, [f.key]: !f.ticked })),
                  `${f.label}: ${f.after}`,
                  f.before != null && f.before !== '' ? `Now: ${f.before}` : 'Not set yet'
                )
              )}
            </div>
          ) : (
            <p className="text-[12px] text-text-light">
              The text also has profile details ({changing.map((f) => f.label.toLowerCase()).join(', ')}). Log in to
              save them to your profile — the split imports either way.
            </p>
          )}
        </div>
      )}

      {hasExtras && (
        <div>
          <span className={labelCls}>Also bring in</span>
          <div className="border border-border px-3 divide-y divide-border">
            {parsed.extra.length > 0 &&
              tick(bring.extra, () => setBring((b) => ({ ...b, extra: !b.extra })), 'Their own lines', parsed.extra.map((x) => (x.label ? `${x.label}: ${x.value}` : x.value)).join(' · '))}
            {parsed.injuries && tick(bring.injuries, () => setBring((b) => ({ ...b, injuries: !b.injuries })), 'Injuries', parsed.injuries)}
            {parsed.coachNotes &&
              tick(bring.coachNotes, () => setBring((b) => ({ ...b, coachNotes: !b.coachNotes })), COACH_NOTES_HEADING, parsed.coachNotes.split('\n')[0])}
          </div>
        </div>
      )}

      {(program || changing.length > 0 || hasExtras) && (
        <div>
          <button
            onClick={submit}
            disabled={unresolved.length > 0}
            className="w-full inline-flex items-center justify-center gap-2 bg-text-primary text-cream font-medium py-3 border-none cursor-pointer text-[14px] hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileInput className="w-4 h-4" /> {importLabel}
          </button>
          {unresolved.length > 0 && (
            <p className="text-[12px] text-amber-600 mt-2">
              Pick a movement for {unresolved.length === 1 ? 'the row' : `the ${unresolved.length} rows`} marked above first —
              a row with no movement behind it can&apos;t be counted toward any muscle.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
