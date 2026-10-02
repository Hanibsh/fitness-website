import { useState, useMemo, useEffect, useRef } from 'react'
import { Check, Dumbbell, FileText, Moon, Pencil, Plus, RefreshCw, Repeat, Undo2, Wand2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useProgramsState } from '../lib/useProgramsState'
import { fetchProfile, saveProfile } from '../lib/profile'
import FocusPicker from './FocusPicker'
import MuscleDonut from './MuscleDonut'
import ExportModal from './ExportModal'
import SlotSwapPanel from './SlotSwapPanel'
import DayEditor from './DayEditor'
import CardioFields from './CardioFields'
import { generateProgram, swapProposedRow, summarizeProposal } from '../lib/generator'
import { useInjuries } from '../lib/useInjuries'
import { setProgramName, setDayName, isOpenSlot, rirLabel, splitRefresh, withoutStaleFocus } from '../lib/program'
import { getHistory, saveExerciseNote, getExerciseNotesMap } from '../lib/workoutStore'
import { fetchRemoteHistory, upsertRemoteExerciseNotes } from '../lib/workoutRemote'
import { donutRows } from '../lib/planStats'
import { supersetLabels } from '../lib/workoutStats'
import { usePlanPerson } from '../lib/profilePrefill'
import { applyCardioPlan, cardioPlanFrom, cardioPlanOn, weeklyCardio, plannedDayCount, DEFAULT_CARDIO_PLAN } from '../lib/cardioPlan'
import { cardioTargetText, cardioSettingsText, cardioCounterpartText } from '../lib/cardio'
import {
  DAYS_PER_WEEK_OPTIONS, DEFAULT_DAYS_PER_WEEK, DEFAULT_WEEKDAYS, MAX_FOCUS_MUSCLES,
  DEFAULT_EXPERIENCE, shapesFor,
  VOLUME_PREFERENCES, DEFAULT_VOLUME_PREFERENCE, volumePreference,
  CORE_PLACEMENTS, DEFAULT_CORE_PLACEMENT, corePlacement } from '../lib/generatorConfig'
import { EXPERIENCE_LEVELS, EQUIPMENT_PRESETS, cleanFocus } from '../lib/profileFields'

// The split generator's questions and its preview, with no page around them.
//
// Lives as a component rather than a page because it has two homes: the
// Programs page ("Build me a split", /programs?start=build) and the coach's
// client area (/coach/:clientId/generate). Those want different framing around
// it — your own split, or someone else's — but neither should own a second copy
// of the wizard.
//
// It owns no training logic at all. It collects answers, hands them to
// generateProgram (src/lib/generator.js) and renders what comes back. Nothing is
// written until "Create this split", the same promise BuildSplitModal makes: a
// routine the user never asked for is not a feature.

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Volume tier → bar colour. Same mapping the dashboard uses, so a muscle that
// reads green here reads green there once the split is being trained.
const TIER_BAR = {
  under: 'bg-amber-400',
  prime: 'bg-green-500',
  solid: 'bg-green-500',
  taxing: 'bg-amber-400',
  excess: 'bg-red-500',
}

const LOAD_DOT = { fresh: 'bg-green-500', moderate: 'bg-amber-400', high: 'bg-red-500' }

// A client with no profile yet still plans with THEIR (unknown) weight, never yours.
const NO_PROFILE = {}


//
// It also writes programs for the coach's clients (`client` + `onCreate`, from
// the coach area). Then the client is the person: their profile seeds the
// answers, there's no log history to read (theirs isn't here) and no injuries
// of yours (the page scopes them away — InjuryScope), your active split never
// reopens anything, and Create hands the program to `onCreate` instead of
// adding it to your own splits.
export default function SplitWizard({ client = null, onCreate = null }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { addRoutine, programsState, loading: programsLoading } = useProgramsState()

  const [history, setHistory] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const [daysPerWeek, setDaysPerWeek] = useState(DEFAULT_DAYS_PER_WEEK)
  const [schedule, setSchedule] = useState('weekly')
  const [weekdays, setWeekdays] = useState(DEFAULT_WEEKDAYS[DEFAULT_DAYS_PER_WEEK])
  const [focus, setFocus] = useState([])
  // The profile's pick seeds the wizard; once changed here, the profile never
  // overrides it again this visit. Saved back to the profile on create.
  const focusTouched = useRef(false)
  function chooseFocus(next) {
    focusTouched.current = true
    setFocus(next)
  }
  const [experience, setExperience] = useState('')
  const [volume, setVolume] = useState(DEFAULT_VOLUME_PREFERENCE)
  // Picked by hand this visit? Then the active split's setting never overrides it.
  const volumeTouched = useRef(false)
  function chooseVolume(v) {
    volumeTouched.current = true
    setVolume(v)
  }
  // Where the abs go — supersetted or last. Same reopen rule as volume.
  const [core, setCore] = useState(DEFAULT_CORE_PLACEMENT)
  const coreTouched = useRef(false)
  function chooseCore(v) {
    coreTouched.current = true
    setCore(v)
  }
  // Cardio on lifting days and on rest days, each its own amount. Laid over
  // the generated week rather than fed into it (applyCardioPlan): it changes no
  // lifting, so changing it never plans a new week. Same reopen rule as volume.
  const [cardio, setCardio] = useState(DEFAULT_CARDIO_PLAN)
  const cardioTouched = useRef(false)
  function chooseCardio(kind, patch) {
    cardioTouched.current = true
    setCardio((c) => ({ ...c, [kind]: { ...c[kind], ...patch } }))
  }
  const [equipment, setEquipment] = useState('')
  const [openSlots, setOpenSlots] = useState(false)
  // null = "pick for me": pickTemplate takes the recommended shape for the count.
  const [shape, setShape] = useState(null)
  const [name, setName] = useState('')
  // Open injuries steer the picks — a bad shoulder pushes overhead pressing down
  // the ranking without removing it (PENALTIES.injury in generatorConfig).
  const { injuries } = useInjuries()

  // History and profile, loaded the way every other surface loads them: remote
  // when signed in, this device's copy otherwise. A client brings their own
  // profile and has no history here.
  const clientProfile = client?.profile || null
  useEffect(() => {
    let cancelled = false
    if (client) {
      setHistory([])
      setProfile(clientProfile)
      if (clientProfile?.experience_level) setExperience(clientProfile.experience_level)
      if (clientProfile?.equipment) setEquipment(clientProfile.equipment)
      setLoading(false)
      return
    }
    async function load() {
      let sessions = getHistory()
      let p = null
      if (user) {
        try {
          sessions = await fetchRemoteHistory(user.id)
        } catch {
          /* keep the local copy */
        }
        try {
          p = await fetchProfile(user.id)
        } catch {
          /* profile is a prefill, never a requirement */
        }
      }
      if (cancelled) return
      setHistory(sessions)
      setProfile(p)
      if (p?.experience_level) setExperience(p.experience_level)
      if (p?.equipment) setEquipment(p.equipment)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [user, client, clientProfile])

  // The split the log follows now, and — once it has run the months it was
  // built for — how long it's been going and what it brought up.
  const active = useMemo(
    () => (client ? null : programsState?.programs?.find((p) => p.id === programsState.activeId) || null),
    [client, programsState]
  )
  const refresh = useMemo(() => splitRefresh(active), [active])

  // Reopen on what the ACTIVE split was generated with — volume and the abs
  // always (the profile has no such fields), training age only when the
  // profile didn't say. Focus and shape never reopen from the split: they're
  // its emphasis, and a new split is the moment to choose that again.
  //
  // The profile's focus pick seeds the wizard here rather than in load(), so
  // the active split is known first. That pick was saved FROM the active split,
  // so once it's due for a change the muscles it already brought up are left
  // out (withoutStaleFocus) — reopening on them would quietly hand back the
  // emphasis the note at the top suggests moving on from.
  useEffect(() => {
    if (programsLoading || loading) return
    if (profile?.focus_muscles && !focusTouched.current) {
      setFocus(withoutStaleFocus(cleanFocus(profile.focus_muscles), refresh))
    }
    const settings = active?.settings
    if (!settings) return
    if (settings.volume && !volumeTouched.current) setVolume(settings.volume)
    if (settings.core && !coreTouched.current) setCore(corePlacement(settings.core))
    if (settings.cardio && !cardioTouched.current) setCardio(cardioPlanFrom(settings.cardio))
    if (settings.experience && !profile?.experience_level) setExperience((e) => e || settings.experience)
  }, [programsLoading, loading, active, refresh, profile])

  // Changing the frequency re-spreads the training days, unless the user has
  // already placed exactly that many themselves.
  function chooseDays(n) {
    // A shape id belongs to one day count ('bro-5' means nothing at 4 days), so
    // changing the count hands the choice back to "pick for me" rather than
    // silently falling through to whatever pickTemplate defaults to.
    setShape(null)
    setDaysPerWeek(n)
    if (weekdays.length !== n) setWeekdays([...DEFAULT_WEEKDAYS[n]])
  }

  function toggleWeekday(d) {
    setWeekdays((prev) => {
      if (prev.includes(d)) return prev.length > 2 ? prev.filter((x) => x !== d) : prev
      return [...prev, d].sort((a, b) => a - b)
    })
  }

  // The proposal. Recomputed on every answer — the generator is pure and cheap,
  // so the preview below is always the split the button would create.
  //
  // Each week is kept by the answers that produced it, so switching an answer
  // back hands back the SAME week — same row ids — and the edits made on it
  // (below) come back with it rather than being thrown away by a tap spent
  // looking at "Higher". Profile, history and injuries settle once, at load;
  // when they change, every kept week is stale and goes.
  const answers = {
    daysPerWeek,
    schedule,
    weekdays: weekdays.length === daysPerWeek ? weekdays : null,
    focus,
    experience: experience || undefined,
    volume,
    core,
    equipment: equipment || undefined,
    shape: shape || undefined,
    openSlots,
  }
  const answersKey = JSON.stringify(answers)
  const weeks = useRef({ inputs: null, byAnswers: new Map() })
  const built = useMemo(() => {
    if (loading) return null
    const kept = weeks.current
    if (!kept.inputs || kept.inputs.profile !== profile || kept.inputs.history !== history || kept.inputs.injuries !== injuries) {
      weeks.current = { inputs: { profile, history, injuries }, byAnswers: new Map() }
    }
    const hit = weeks.current.byAnswers.get(answersKey)
    if (hit) return hit
    const week = generateProgram({ answers: JSON.parse(answersKey), profile, sessions: history, injuries })
    weeks.current.byAnswers.set(answersKey, week)
    return week
  }, [loading, answersKey, profile, history, injuries])

  // Everything edited in the preview — swaps, added and removed movements,
  // sets, supersets, notes — on top of the proposal, per week. Tied to the
  // week it was made on, so a week planned again from scratch never inherits
  // edits made to rows that are no longer the same rows.
  //
  // The cardio plan is laid over both: the week as proposed, and any edits. A
  // draft remembers the plan it was last laid with, and a changed plan swaps in
  // its own rows (applyCardioPlan) — so changing the cardio never throws away a
  // swap or a set made below it.
  const [edits, setEdits] = useState({})
  const draft = edits[answersKey]
  const edited = !!built && draft?.base === built
  const proposedProgram = useMemo(() => (built ? applyCardioPlan(built.program, cardio) : null), [built, cardio])
  const program = useMemo(
    () => (edited ? (draft.cardio === cardio ? draft.program : applyCardioPlan(draft.program, cardio)) : proposedProgram),
    [edited, draft, cardio, proposedProgram]
  )
  const summary = useMemo(() => (built ? summarizeProposal(built, program) : null), [built, program])
  function update(fn) {
    setEdits((prev) => {
      const kept = prev[answersKey]?.base === built ? prev[answersKey] : null
      const current = kept ? (kept.cardio === cardio ? kept.program : applyCardioPlan(kept.program, cardio)) : applyCardioPlan(built.program, cardio)
      return { ...prev, [answersKey]: { base: built, program: fn(current), cardio } }
    })
  }
  // Whose weight turns minutes into calories: the client's, or yours.
  const person = usePlanPerson(client ? client.profile || NO_PROFILE : null)
  const swap = (dayId, rowId, choice) => update((p) => swapProposedRow(built, p, dayId, rowId, choice))
  function undoEdits() {
    setEdits((prev) => {
      const next = { ...prev }
      delete next[answersKey]
      return next
    })
  }

  const weekdayMismatch = schedule === 'weekly' && weekdays.length !== daysPerWeek

  function create() {
    if (!built) return
    const named = name.trim() ? setProgramName(program, name.trim()) : program
    if (onCreate) return onCreate(named, { focus })
    addRoutine(named)
    fileDraftNotes(named)
    // The muscles they're bringing up live on the profile, so the next split
    // starts from them. Best effort: the split is what they asked for, and a
    // failed profile write must never stand between them and it.
    const saved = cleanFocus(profile?.focus_muscles)
    if (user && (saved.length !== focus.length || saved.some((m, i) => m !== focus[i]))) {
      saveProfile(user.id, { focus_muscles: focus.length ? focus : null }).catch(() => {})
    }
    navigate(`/split/${named.id}`)
  }

  // Notes typed in the preview stayed on their rows, so nothing was written
  // before Create. On your own split a note belongs to the movement — what the
  // split editor and the logger read — so that's where they go now, exactly as
  // if they'd been typed in the editor. A client's split keeps them on its rows.
  function fileDraftNotes(created) {
    let filed = false
    for (const day of created.days) {
      for (const row of day.exercises || []) {
        if (!row.note?.trim() || isOpenSlot(row)) continue
        saveExerciseNote(row, row.note)
        filed = true
      }
    }
    if (filed && user) upsertRemoteExerciseNotes(user.id, getExerciseNotesMap()).catch(() => {})
  }

  const labelCls = 'text-[11px] text-text-muted uppercase tracking-wider block mb-2'
  const cardCls = 'bg-white border border-border p-6 sm:p-8'
  const headCls = 'font-heading text-xl font-medium text-text-primary mb-1'

  const choice = (active, onClick, label, sub) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-2 py-2.5 text-[13px] font-medium border cursor-pointer transition-colors text-center leading-tight ${
        active ? 'bg-text-primary text-cream border-text-primary' : 'bg-white text-text-muted border-border hover:border-border-hover'
      }`}
    >
      {label}
      {sub && <span className={`block text-[10px] font-normal mt-0.5 ${active ? 'text-cream-60' : 'text-text-light'}`}>{sub}</span>}
    </button>
  )

  return (
    <>
      {loading ? (
        <p className="text-[13px] text-text-muted">Loading…</p>
      ) : (
        <div className="space-y-6">
          {refresh && <RefreshNote refresh={refresh} />}

          {/* ---- 1. How often ------------------------------------------- */}
          <section className={cardCls}>
            <h2 className={headCls}>How often do you train?</h2>
            <p className="text-[12px] text-text-light mb-5">Days a week you can reliably get to a session.</p>
            <div className="grid grid-cols-5 gap-2 mb-6">
              {DAYS_PER_WEEK_OPTIONS.map((n) => choice(daysPerWeek === n, () => chooseDays(n), `${n}`, 'days'))}
            </div>

            <label className={labelCls}>Shape</label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {choice(shape === null, () => setShape(null), 'Pick for me', 'The one that trains you best')}
              {shapesFor(daysPerWeek).map((sh) => choice(shape === sh.id, () => setShape(sh.id), sh.name))}
            </div>
            {/* What the chosen shape costs, in its own words. The bro splits say
                outright that a muscle trained once a week takes less weekly
                volume — the user should read that before choosing, not discover
                it in the amber bars afterwards. */}
            <p className="text-[12px] text-text-light mb-5 leading-relaxed">
              {(shapesFor(daysPerWeek).find((sh) => sh.id === shape) || shapesFor(daysPerWeek)[0]).note}
            </p>

            <label className={labelCls}>Schedule</label>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {choice(schedule === 'weekly', () => setSchedule('weekly'), 'Fixed week', 'Same weekdays, always')}
              {choice(schedule === 'rotation', () => setSchedule('rotation'), 'Rotation', 'Days wait if you miss one')}
            </div>

            {schedule === 'weekly' ? (
              <>
                <label className={labelCls}>Which days</label>
                <div className="grid grid-cols-7 gap-1.5">
                  {WEEKDAYS.map((d, i) => choice(weekdays.includes(i), () => toggleWeekday(i), d))}
                </div>
                <p className={`text-[12px] mt-2 ${weekdayMismatch ? 'text-amber-600' : 'text-text-light'}`}>
                  {weekdayMismatch
                    ? `Pick ${daysPerWeek} day${daysPerWeek !== 1 ? 's' : ''} — using a sensible spread until you do.`
                    : 'Rest days fill the gaps. Missing one never shifts the rest of the week.'}
                </p>
              </>
            ) : (
              <p className="text-[12px] text-text-light">
                A rotating cycle: your workouts wait for you, so a missed day moves the plan forward rather
                than skipping a session.
              </p>
            )}
          </section>

          {/* ---- 2. Focus ------------------------------------------------ */}
          <section className={cardCls}>
            <h2 className={headCls}>Anything you want to bring up?</h2>
            <p className="text-[12px] text-text-light mb-5">
              Up to {MAX_FOCUS_MUSCLES}. A muscle you bring up is trained first in the day, while you&apos;re
              fresh, and on more days of the week — not with more sets piled onto one session. The week&apos;s
              total stays the same: the other muscles give back what it gains.
              {client ? ` Saved to ${client.name || 'their'} profile when you save the split.` : user ? ' Saved to your profile when you create the split.' : ''} Leave it empty for a balanced
              split.
            </p>
            <FocusPicker value={focus} onChange={chooseFocus} />
          </section>

          {/* ---- 3. You and your gym ------------------------------------- */}
          <section className={cardCls}>
            <h2 className={headCls}>You and your gym</h2>
            <p className="text-[12px] text-text-light mb-5">
              {profile?.experience_level || profile?.equipment
                ? `Filled in from ${client ? `${client.name || 'their'}'s` : 'your'} profile — change either just for this split.`
                : 'Used to filter the exercise pool and set how much volume to start you on.'}
            </p>

            <label className={labelCls}>Training age</label>
            <div className="grid grid-cols-3 gap-2 mb-6">
              {EXPERIENCE_LEVELS.map((e) =>
                choice(
                  (experience || DEFAULT_EXPERIENCE) === e.value,
                  () => setExperience(e.value),
                  e.label,
                  e.sub
                )
              )}
            </div>

            {/* Separate from training age on purpose: fewer, harder sets is a
                valid way to train at any experience level, so it's a choice
                rather than something experience decides for you. */}
            <label className={labelCls}>Volume</label>
            <div className="grid grid-cols-3 gap-2 mb-2">
              {VOLUME_PREFERENCES.map((p) => choice(volume === p.value, () => chooseVolume(p.value), p.label, p.sub))}
            </div>
            <p className="text-[12px] text-text-light mb-6 leading-relaxed">{volumePreference(volume).note}</p>

            {/* Ab work sits outside the volume setting (CORE_CATEGORY): it
                costs next to nothing in fatigue, so it's a question of where it
                goes, not of how much room it takes. */}
            <label className={labelCls}>Abs</label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {CORE_PLACEMENTS.map((p) => choice(core === p.value, () => chooseCore(p.value), p.label, p.sub))}
            </div>
            <p className="text-[12px] text-text-light mb-6 leading-relaxed">
              Ab sets don&apos;t count toward the day&apos;s sets — they cost next to nothing in fatigue.
            </p>

            <label className={labelCls}>Equipment</label>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {EQUIPMENT_PRESETS.map((eq) => choice((equipment || 'gym') === eq.value, () => setEquipment(eq.value), eq.label))}
            </div>
            <p className="text-[12px] text-text-light leading-relaxed">
              {(equipment || 'gym') === 'gym'
                ? 'At a full gym the picks lean on stimulus-to-fatigue, loadability and stability — the things a rack, a machine and a cable actually give you. Bands and movements you can’t add weight to are left out.'
                : 'Bodyweight and bands only. Nothing that needs a gym will appear.'}
            </p>

            {/* Whether the split names a movement or names the JOB. Either way
                every row keeps its movement path and can be reopened later —
                this only decides what the split says on the day it's created. */}
            <label className={labelCls}>Movements</label>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {choice(!openSlots, () => setOpenSlots(false), 'Pick for me', 'A movement in every slot')}
              {choice(openSlots, () => setOpenSlots(true), 'Leave open', 'Choose in the gym')}
            </div>
            <p className="text-[12px] text-text-light leading-relaxed">
              {openSlots
                ? 'Every row prescribes a movement path and a set target — “any vertical pull, 3 × 6–10” — and you pick the movement when you get there. The volume is planned the same either way; only the machine is left undecided.'
                : 'Every row names a movement. Swap any of them in the preview below before you save, or later — before or during a session.'}
            </p>
          </section>

          {/* ---- 4. Cardio ---------------------------------------------- */}
          {built && (
            <CardioSection
              plan={cardio}
              onChange={chooseCardio}
              program={program}
              person={person}
              client={client}
              signedIn={!!user}
            />
          )}

          {/* ---- 5. The proposal ----------------------------------------- */}
          {built && (
            <Preview
              base={proposedProgram}
              program={program}
              summary={summary}
              history={history}
              edited={edited}
              update={update}
              onSwap={swap}
              onUndoEdits={undoEdits}
              name={name}
              setName={setName}
              onCreate={create}
              client={client}
              person={person}
            />
          )}
        </div>
      )}
    </>
  )
}

// The active split has run the three to four months it was built for. Said
// once, at the top, in the shape of the dashboard's nudges — and that's all it
// does. It names no new muscle and picks nothing below: what to bring up next is
// theirs to choose, and choosing the same emphasis again is one tap away.
function RefreshNote({ refresh }) {
  const { weeks, focus, shape } = refresh
  // What it brought up, on what shape — each half only when the split recorded
  // it. A split from before focus was stored says nothing about focus at all.
  const emphasis = focus == null ? null : focus.length ? `${focus.join(' + ')} focus` : 'balanced'
  const last = [emphasis, shape?.name].filter(Boolean).join(', on ')
  return (
    <div className="bg-white border border-border p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <RefreshCw className="w-4 h-4 text-text-light shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-text-primary break-words">Your split has run {weeks} weeks</p>
          <p className="text-[12px] text-text-light mt-0.5 leading-relaxed break-words">
            Programs like this are built for three to four months, so this is a good time to switch the emphasis:
            bring up something new, or try a different shape.
            {last && ` Last time: ${last}${focus?.length ? ' — not picked for you this time.' : '.'}`}
          </p>
        </div>
      </div>
    </div>
  )
}

// The Cardio question: two independent halves, after lifting and on rest days,
// each with its own activity, settings, amount per session and number of days.
// Both on is every day; either can have more than the other.
const CARDIO_HALVES = [
  {
    kind: 'lifting',
    title: 'On lifting days',
    hint: (some) =>
      some
        ? 'Last thing after the weights, on the days with the least leg work — walking, stairs, bikes and rowers are leg work too, so this keeps them off leg day.'
        : 'Last thing after the weights, every lifting day.',
  },
  {
    kind: 'rest',
    title: 'On rest days',
    hint: () => 'Optional on the day: skip it and nothing moves — the rest day still passes on its own.',
  },
]

function CardioSection({ plan, onChange, program, person, client, signedIn }) {
  const available = {
    lifting: program.days.filter((d) => d.kind !== 'rest').length,
    rest: program.days.filter((d) => d.kind === 'rest').length,
  }
  const week = weeklyCardio(program, person.weightKg)
  const weekly = program.days.length === 7
  const pill = (active) =>
    `min-w-9 px-2.5 py-1.5 text-[12px] font-medium border cursor-pointer transition-colors ${
      active ? 'bg-text-primary text-cream border-text-primary' : 'bg-white text-text-muted border-border hover:border-border-hover'
    }`
  const amount = (w) =>
    [
      w.minutes ? `${Math.round(w.minutes).toLocaleString('en-US')} min` : null,
      w.kcal ? `${(Math.round(w.kcal / 5) * 5).toLocaleString('en-US')} cal` : null,
    ].filter(Boolean).join(' and ')

  return (
    <section className="bg-white border border-border p-6 sm:p-8">
      <h2 className="font-heading text-xl font-medium text-text-primary mb-1">Cardio</h2>
      <p className="text-[12px] text-text-light mb-5 leading-relaxed">
        Optional. Set it per session, in minutes or calories — after lifting, on rest days, or both, with more on one
        than the other if you like. Walking and cycling cost your lifting the least.
      </p>
      <div className="space-y-3">
        {CARDIO_HALVES.map(({ kind, title, hint }) => {
          const half = plan[kind]
          const days = plannedDayCount(half, available[kind])
          return (
            <div key={kind} className="border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] font-medium text-text-primary">{title}</p>
                {available[kind] > 0 && (
                  <div className="flex gap-1.5">
                    <button type="button" aria-pressed={!half.on} onClick={() => onChange(kind, { on: false })} className={pill(!half.on)}>Off</button>
                    <button type="button" aria-pressed={half.on} onClick={() => onChange(kind, { on: true })} className={pill(half.on)}>On</button>
                  </div>
                )}
              </div>
              {available[kind] === 0 ? (
                <p className="text-[12px] text-text-light mt-1">This week has no rest days.</p>
              ) : (
                half.on && (
                  <div className="mt-4 space-y-4">
                    <CardioFields
                      value={half}
                      onChange={(next) => onChange(kind, { activity: next.activity, params: next.params, target: next.target })}
                      unit={person.unit}
                      weightKg={person.weightKg}
                      chooseActivity
                      label={title}
                    />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-text-light mb-1.5">
                        {kind === 'rest' ? 'Rest days' : 'Lifting days'} {weekly ? 'a week' : 'per rotation'}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {Array.from({ length: available[kind] }, (_, i) => i + 1).map((n) => (
                          <button
                            key={n}
                            type="button"
                            aria-pressed={days === n}
                            onClick={() => onChange(kind, { days: n === available[kind] ? null : n })}
                            className={pill(days === n)}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="text-[12px] text-text-light leading-relaxed">{hint(days < available[kind])}</p>
                  </div>
                )
              )}
            </div>
          )
        })}
      </div>
      {week.total.sessions > 0 && (
        <p className="text-[12px] text-text-secondary mt-4 leading-relaxed">
          {weekly ? 'Every week' : 'Every rotation'}: {week.total.sessions} session{week.total.sessions === 1 ? '' : 's'}
          {week.lifting.sessions > 0 && week.rest.sessions > 0 ? ` (${week.lifting.sessions} after lifting, ${week.rest.sessions} on rest days)` : ''}
          {amount(week.total) ? `, about ${amount(week.total)} in all.` : '.'}
        </p>
      )}
      {cardioPlanOn(plan) && !person.weightKg && (
        <p className="text-[12px] text-text-light mt-2 leading-relaxed">
          {client
            ? `Add ${client.name ? `${client.name}'s` : 'their'} bodyweight to their profile to see calories beside minutes.`
            : signedIn
              ? 'Add your bodyweight to your profile to see calories beside minutes.'
              : 'Log your bodyweight to see calories beside minutes.'}
        </p>
      )}
    </section>
  )
}


// The split as it will be created: every day, every movement, and what the week
// adds up to per muscle. Shown in full before anything is written — a plan you
// can't see the consequences of isn't a plan, it's a surprise.
const signed = (n) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`)

function FocusTrade({ trade }) {
  const grew = trade.totalSets - trade.totalSetsBefore
  const lead = trade.raised.length > 1 ? 'taking turns to open the day' : 'first in the day'
  return (
    <div className="mb-4 text-[12px] leading-relaxed">
      <p className="text-[11px] uppercase tracking-wider text-text-light mb-1.5">Bringing up</p>
      {trade.raised.map((r) => (
        <span key={r.muscle} className="block text-text-secondary">
          <span className="text-text-primary font-medium">{r.muscle}</span>: {r.sessions} session
          {r.sessions === 1 ? '' : 's'} a week{r.sessions > r.sessionsBefore ? ` (was ${r.sessionsBefore})` : ''}, {lead},{' '}
          <span className="tabular-nums">
            {r.setsBefore} → {r.sets} sets
          </span>
          .
        </span>
      ))}
      {/* Credit, not sets: swapping a press for a raise also moves what the
          press gave the chest and front delts, so these can add up to more than
          the focus gained. The week's own total is the line below. */}
      {trade.paid.length > 0 && (
        <span className="block text-text-light mt-1">
          Elsewhere in the week:{' '}
          <span className="tabular-nums">
            {trade.paid.slice(0, 4).map((p) => `${p.muscle} ${signed(p.change)}`).join(' · ')}
          </span>
          .
        </span>
      )}
      {grew > 0 ? (
        <span className="block text-amber-600 mt-1">
          This week holds {grew} more set{grew === 1 ? '' : 's'} than it would without the focus: the other
          muscles are already at their minimum, so none could give any up.
        </span>
      ) : (
        <span className="block text-text-light tabular-nums">
          Week total: {trade.totalSetsBefore} → {trade.totalSets} sets.
        </span>
      )}
    </div>
  )
}

function Preview({ base, program, summary, history, edited, update, onSwap, onUndoEdits, name, setName, onCreate, client, person }) {
  const [exporting, setExporting] = useState(false)
  // The row whose swap panel is open — one at a time, as in the split editor.
  const [swapOpenFor, setSwapOpenFor] = useState(null)
  // The days open in the full editor. A set, not one at a time: comparing two
  // days while moving work between them is the point of editing a week.
  const [editing, setEditing] = useState(() => new Set())
  const toggleEditing = (id) =>
    setEditing((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  // The real plan rows behind the summary's, for the editor and the swap panel
  // to work on, and what the generator first put in each, to mark what's changed.
  const days = new Map(program.days.map((d) => [d.id, d]))
  const rows = new Map(program.days.flatMap((d) => d.exercises.map((e) => [e.id, e])))
  const proposed = new Map(base.days.flatMap((d) => d.exercises.map((e) => [e.id, e.exerciseId])))
  const cardCls = 'bg-white border border-border p-6 sm:p-8'
  const trained = summary.volume.filter((v) => v.sets > 0)
  const maxSets = Math.max(1, ...trained.map((v) => v.sets))
  // Two different reasons a planned muscle can end up with nothing, and they
  // deserve different sentences: the library has no movement for it at this
  // equipment level, or it simply didn't fit in the time available.
  // The same rows the bars below are drawn from, rolled up to the chart's twelve
  // groups — so the donut and the bars are one dataset drawn twice, already
  // normalised to a week by summarize.
  const weekDonut = donutRows(summary.volume)
  const unavailable = summary.volume.filter((v) => v.target != null && v.sets === 0 && !v.available)
  const squeezed = summary.volume.filter((v) => v.target != null && v.sets === 0 && v.available)
  // Each day's superset labels (A1/A2), by day id.
  const pairs = new Map(summary.days.map((d) => [d.id, supersetLabels(d.exercises)]))

  return (
    <section className={cardCls}>
      <h2 className="font-heading text-xl font-medium text-text-primary mb-1">{client?.name ? `${client.name}'s split` : 'Your split'}</h2>
      <p className="text-[12px] text-text-light mb-6">
        {summary.shape ? `${summary.shape.name} · ` : ''}
        {summary.shapeLabel}
        {summary.focus.length ? ` · ${summary.focus.join(' + ')} focus` : ''}
        {summary.fromHistory
          ? ` · volume and rep ranges taken from your last ${summary.historySessions} session${summary.historySessions !== 1 ? 's' : ''}`
          : ''}
      </p>

      <div className="border border-border divide-y divide-border mb-7">
        {summary.days.map((d, i) => (
          <div key={d.id} className="px-3 py-3">
            <div className="flex items-start gap-3">
              {d.kind === 'rest' ? (
                <Moon className="w-3.5 h-3.5 text-text-light shrink-0 mt-0.5" />
              ) : (
                <Dumbbell className="w-3.5 h-3.5 text-text-light shrink-0 mt-0.5" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-[13px] font-medium text-text-primary break-words">
                    {d.weekday || `Day ${i + 1}`}
                  </span>
                  {d.kind !== 'rest' && <span className="text-[12px] text-text-secondary break-words">{d.name}</span>}
                  {d.kind !== 'rest' && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-text-light ml-auto shrink-0">
                      <span className={`w-1.5 h-1.5 rounded-full ${LOAD_DOT[d.load.level]}`} />
                      {d.sets} sets{d.coreSets > 0 ? ` + ${d.coreSets} abs` : ''} · {d.load.label.toLowerCase()}
                    </span>
                  )}
                </div>
                {d.kind === 'rest' && (
                  <p className="text-[11px] text-text-light mt-0.5">{d.exercises.length ? 'Rest · optional cardio' : 'Rest'}</p>
                )}
                <>
                  {/* What this day is FOR, at a glance. The exercise list below
                      says what you will do; this says what it adds up to — which
                      is the question a day name like "Lower A" only half
                      answers. */}
                  {d.kind !== 'rest' && d.donut?.length > 0 && (
                    <div className="mt-2">
                      <MuscleDonut items={d.donut} unitLabel="sets" compact />
                    </div>
                  )}
                  {!editing.has(d.id) && (
                  <>
                  {d.exercises.length > 0 && (
                  <ul className="mt-2 space-y-1 list-none p-0 m-0">
                    {d.exercises.map((e) => {
                      const row = rows.get(e.id)
                      const added = !proposed.has(e.id)
                      const changed = added || proposed.get(e.id) !== row?.exerciseId
                      // What the small caps line says: the path a committed
                      // row fills, so the shape of the day is readable even
                      // when every line names a machine (an open row already
                      // says its path as its name), and whether it's still the
                      // generator's pick.
                      const tag = [
                        e.pattern && !e.open && e.pattern.replace(/-/g, ' '),
                        changed && (added ? 'added' : proposed.get(e.id) ? 'swapped' : 'chosen'),
                      ].filter(Boolean).join(' · ')
                      return (
                        <li key={e.id} className="text-[12px]">
                          <div className="flex items-baseline gap-2">
                            {/* A1/A2: the abs paired with the day's lightest
                                movement — the same badge the split page shows. */}
                            {pairs.get(d.id)?.get(e.id) && (
                              <span className="shrink-0 text-[9px] font-semibold text-cream bg-text-primary px-1 py-0.5">
                                {pairs.get(d.id).get(e.id).label}
                              </span>
                            )}
                            <span className="text-text-secondary break-words min-w-0">
                              {e.name}
                              {tag && (
                                <span className={`block text-[10px] uppercase tracking-wider ${changed ? 'text-text-secondary' : 'text-text-light'}`}>
                                  {tag}
                                </span>
                              )}
                              {/* The effort target, on its own line — "1–2 RIR,
                                  last set to failure" is too long to share the
                                  narrow sets column on a phone. */}
                              {rirLabel(e.rirTarget) && (
                                <span className={`block text-[11px] ${e.rirTarget?.lastSetFailure ? 'text-text-secondary' : 'text-text-light'}`}>
                                  {rirLabel(e.rirTarget)}
                                </span>
                              )}
                              {/* A cardio row's settings and the other half of
                                  its target — "5 km/h, 10% incline · about
                                  185 cal" — under its name, like the effort
                                  line under a lift. */}
                              {e.cardio && (
                                <span className="block text-[11px] text-text-light">
                                  {[cardioSettingsText(e.cardio, person.unit), cardioCounterpartText(e.cardio, person.weightKg)].filter(Boolean).join(' · ')}
                                </span>
                              )}
                            </span>
                            <span className="text-text-light shrink-0 ml-auto tabular-nums">
                              {e.kind === 'cardio'
                                ? e.cardio ? cardioTargetText(e.cardio.target) : null
                                : `${e.sets} × ${e.repRange?.low ?? ''}–${e.repRange?.high ?? ''}`}
                            </span>
                            {/* A full-size tap target that takes up only a line
                                of height: the negative margins hand the rest
                                back to the row. */}
                            {row && (
                              <button
                                type="button"
                                onClick={() => setSwapOpenFor(swapOpenFor === e.id ? null : e.id)}
                                aria-label={e.open ? `Choose a movement for ${e.name}` : `Swap ${e.name}`}
                                aria-pressed={swapOpenFor === e.id}
                                title={e.open ? 'Choose a movement' : 'Swap for a similar movement'}
                                className={`shrink-0 self-start w-8 h-8 -my-[7px] inline-flex items-center justify-center bg-transparent border-none cursor-pointer p-0 transition-colors ${
                                  swapOpenFor === e.id ? 'text-text-primary' : 'text-text-light hover:text-text-primary'
                                }`}
                              >
                                <Repeat className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          {/* Out over the day's icon column (w-3.5 + gap-3): on
                              a phone the list needs every pixel it can get. */}
                          {swapOpenFor === e.id && row && (
                            <div className="mt-2 mb-2 -ml-[26px]">
                              <SlotSwapPanel
                                planned={row}
                                program={program}
                                dayId={d.id}
                                sessions={history}
                                initialLimit={5}
                                onPick={(o) => {
                                  onSwap(d.id, e.id, o)
                                  setSwapOpenFor(null)
                                }}
                                onCancel={() => setSwapOpenFor(null)}
                              />
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleEditing(d.id)}
                    className="inline-flex items-center gap-1.5 min-h-8 mt-1 bg-transparent border-none cursor-pointer p-0 text-[12px] text-text-muted hover:text-text-primary transition-colors"
                  >
                    {d.kind === 'rest' && !d.exercises.length ? (
                      <><Plus className="w-3.5 h-3.5" /> Add cardio</>
                    ) : (
                      <><Pencil className="w-3.5 h-3.5" /> Edit day</>
                    )}
                  </button>
                  </>
                  )}
                </>
              </div>
            </div>
            {/* The split editor's own day editor, on the draft: add, remove,
                reorder, sets and reps, supersets, notes. Everything above and
                below — this day's sets and donut, the week's volume and paths —
                is measured from the same draft, so it moves as you type. Full
                width of the card: the inputs need it on a phone. Notes stay on
                their rows until Create, and "Learn more" is left out — leaving
                the page would lose the split. */}
            {editing.has(d.id) && days.get(d.id) && (
              <div className="mt-3">
                {d.kind !== 'rest' && (
                  <>
                    <label className="block text-[10px] uppercase tracking-wider text-text-light mb-1" htmlFor={`day-name-${d.id}`}>
                      Day name
                    </label>
                    <input
                      id={`day-name-${d.id}`}
                      value={days.get(d.id).name}
                      onChange={(ev) => update((p) => setDayName(p, d.id, ev.target.value))}
                      className="w-full bg-cream border border-border px-3 py-2 text-text-primary text-[14px] outline-none focus:border-text-primary transition-colors mb-3"
                    />
                  </>
                )}
                <DayEditor
                  program={program}
                  day={days.get(d.id)}
                  update={update}
                  notes="row"
                  sessions={history}
                  onSubstitute={onSwap}
                  learnMore={false}
                  unit={person.unit}
                  weightKg={person.weightKg}
                  cardioOnly={d.kind === 'rest'}
                />
                <button
                  type="button"
                  onClick={() => toggleEditing(d.id)}
                  className="inline-flex items-center gap-1.5 min-h-8 mt-2 bg-transparent border-none cursor-pointer p-0 text-[12px] text-text-muted hover:text-text-primary transition-colors"
                >
                  <Check className="w-3.5 h-3.5" /> Done
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Edits are the user's, on a proposal still being shaped by the answers
          above — said once, beside the way back. */}
      {edited && (
        <div className="flex items-start gap-3 -mt-4 mb-7">
          <p className="min-w-0 flex-1 text-[12px] text-text-light leading-relaxed">
            You&apos;ve edited this split. Changing an answer above shows a new week — switch it back and your
            edits return.
          </p>
          <button
            type="button"
            onClick={onUndoEdits}
            className="shrink-0 inline-flex items-center gap-1 min-h-8 -mt-1.5 bg-transparent border-none cursor-pointer p-0 text-[12px] text-text-muted hover:text-text-primary transition-colors"
          >
            <Undo2 className="w-3.5 h-3.5" /> Undo all edits
          </button>
        </div>
      )}

      {/* The week as one picture, before the per-muscle detail below it. A
          rotation whose cycle is not 7 days long is an AVERAGE, and it says so:
          the volume landmarks are all weekly, so weekly is the only form that
          can be graded — but an averaged number must never read as a literal
          one. */}
      {weekDonut.length > 0 && (
        <>
          <p className="text-[11px] uppercase tracking-wider text-text-light mb-3">
            {summary.schedule === 'weekly' ? 'Every week' : `Average week · ${summary.cycleLength}-day rotation`}
          </p>
          <div className="mb-7">
            <MuscleDonut items={weekDonut} unitLabel="sets per week" />
          </div>
        </>
      )}

      {/* Weekly volume per muscle, graded on the same curve the dashboard uses.
          Everything the week produces is listed, including what the compounds
          pick up along the way — a plan that only reports what it aimed at is
          hiding half of what it did. */}
      <p className="text-[11px] uppercase tracking-wider text-text-light mb-3">Weekly volume</p>
      {/* Label and numbers on one line, bar underneath — a fixed label column
          plus a fixed number column leaves a 320px screen no room at all for
          the bar between them. */}
      <div className="space-y-2 mb-3">
        {trained.map((v) => (
          <div key={v.muscle}>
            <div className="flex items-baseline gap-2">
              <span className={`text-[12px] truncate min-w-0 ${v.focus ? 'text-text-primary font-medium' : 'text-text-secondary'}`}>
                {v.muscle}
                {v.focus && <span className="text-text-light font-normal"> · focus</span>}
              </span>
              <span className="text-[11px] text-text-light shrink-0 ml-auto tabular-nums">
                {v.sets} set{v.sets === 1 ? '' : 's'} · {v.sessions}×
              </span>
            </div>
            <span className="block h-1.5 bg-border mt-1">
              <span className={`block h-full ${TIER_BAR[v.status] || 'bg-green-500'}`} style={{ width: `${(100 * v.sets) / maxSets}%` }} />
            </span>
          </div>
        ))}
      </div>
      {/* What the week trains is one question; HOW it trains it is another, and
          the bars above cannot answer the second. A chest number that adds up
          entirely out of flat presses is a week with no incline path in it —
          which reads as fine on the muscle chart and is not fine. */}
      {summary.patterns?.length > 0 && (
        <>
          <p className="text-[11px] uppercase tracking-wider text-text-light mb-2 mt-6">Movement paths</p>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 list-none p-0 m-0 mb-3">
            {summary.patterns.map((pt) => (
              <li key={pt.id} className="text-[12px] text-text-secondary">
                {pt.label}
                <span className="text-text-light tabular-nums"> {pt.sets}</span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-text-light mb-6 leading-relaxed">
            Weekly sets down each resistance path. Every one of these is a choice you can change — a slot asks
            for the path, not the machine.
          </p>
        </>
      )}

      {/* What bringing a muscle up did, measured against the same week built
          without it — the macro tool's trade, for muscles: what it gained, who
          paid, and the week's total, which stays put. */}
      {summary.focusTrade && <FocusTrade trade={summary.focusTrade} />}

      {/* Asked for a muscle to be brought up and the shape couldn't do it. Said
          here, beside the volume it did get, rather than left for the reader to
          work out by counting the day cards. */}
      {summary.focusShortfall?.length > 0 && (
        <p className="text-[12px] text-amber-600 mb-3 leading-relaxed">
          {summary.focusShortfall.map((f) => (
            <span key={f.muscle} className="block">
              {f.muscle} stays at {f.sessions} session{f.sessions === 1 ? '' : 's'} a week
              {f.reason === 'days'
                ? ` — you train ${summary.daysPerWeek} days.`
                : ' — no other day in this shape trains that half of the body. It still leads on the days it has.'}
            </span>
          ))}
        </p>
      )}

      <p className="text-[11px] text-text-light mb-6 leading-relaxed">
        Graded on the same curve as your dashboard: green is a productive dose, amber is under the useful
        minimum or past the point it pays for itself.
        {unavailable.length > 0 && (
          <>
            {' '}
            <span className="text-amber-600">
              The library has no {unavailable.map((m) => m.muscle.toLowerCase()).join(' or ')} movement for the
              equipment you picked, so there&apos;s none in the split.
            </span>
          </>
        )}
        {squeezed.length > 0 && (
          <>
            {' '}
            <span className="text-amber-600">
              {squeezed.map((m) => m.muscle).join(', ')} didn&apos;t make the cut — another training day would
              make room for {squeezed.length === 1 ? 'it' : 'them'}.
            </span>
          </>
        )}
      </p>

      <label className="block text-[11px] uppercase tracking-wider text-text-light mb-1.5" htmlFor="gen-name">
        Name
      </label>
      <input
        id="gen-name"
        value={name}
        placeholder={summary.focus.length ? `${summary.focus.slice(0, 2).join(' + ')} focus` : `${summary.daysPerWeek}-day split`}
        onChange={(e) => setName(e.target.value.slice(0, 60))}
        className="w-full bg-cream border border-border px-3 py-2 text-text-primary text-[14px] outline-none focus:border-text-primary transition-colors mb-5"
      />

      <button
        onClick={onCreate}
        className="w-full inline-flex items-center justify-center gap-2 bg-text-primary text-cream font-medium py-3 border-none cursor-pointer text-[14px] hover:bg-accent-hover transition-colors"
      >
        <Wand2 className="w-4 h-4" /> {client ? `Save to ${client.name || 'this client'}` : 'Create this split'}
      </button>
      {/* The proposal exports as it stands, name and all — no need to save a
          split just to send it to someone. */}
      <button
        onClick={() => setExporting(true)}
        className="w-full inline-flex items-center justify-center gap-2 bg-white text-text-muted hover:text-text-primary font-medium py-2.5 mt-2 border border-border hover:border-border-hover cursor-pointer text-[13px] transition-colors"
      >
        <FileText className="w-4 h-4" /> Export as text or Excel
      </button>
      <p className="text-[11px] text-text-light mt-3 leading-relaxed">
        Nothing is saved until you tap {client ? 'Save' : 'Create'}. Swap any movement above first with{' '}
        <Repeat className="inline w-3 h-3 align-[-2px]" aria-label="the swap button" /> — and every day, movement, set and
        rep range stays editable afterwards.
      </p>
      {exporting && (
        <ExportModal
          program={name.trim() ? setProgramName(program, name.trim()) : program}
          client={client}
          onClose={() => setExporting(false)}
        />
      )}
    </section>
  )
}
