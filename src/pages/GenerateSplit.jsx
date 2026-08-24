import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Dumbbell, Moon, Wand2 } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useProgramsState } from '../lib/useProgramsState'
import { getHistory } from '../lib/workoutStore'
import { fetchRemoteHistory } from '../lib/workoutRemote'
import { fetchProfile } from '../lib/profile'
import { generateProgram } from '../lib/generator'
import { setProgramName } from '../lib/program'
import {
  DAYS_PER_WEEK_OPTIONS, DEFAULT_DAYS_PER_WEEK, DEFAULT_WEEKDAYS, MAX_FOCUS_MUSCLES,
  SESSION_MINUTES_OPTIONS, DEFAULT_SESSION_MINUTES, DEFAULT_EXPERIENCE, PROGRAMMED_MUSCLES,
} from '../lib/generatorConfig'
import { ENGINE_MUSCLES } from '../lib/engineConfig'
import { EXPERIENCE_LEVELS, EQUIPMENT_PRESETS } from '../lib/profileFields'

// Build me a split.
//
// Four questions and a full preview. Everything the generator needs that the app
// already knows — experience, equipment, and the volume and movements in your
// logged sessions — is filled in for you and stays editable; everything it
// can't know is asked. Nothing is written until "Create split", the same
// promise BuildSplitModal makes: a routine the user never asked for is not a
// feature.
//
// The page owns no training logic at all. It collects answers, hands them to
// generateProgram (src/lib/generator.js) and renders what comes back.

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

// Focus is offered over the muscles a split actually programs, plus anything
// else the engine tracks, so "I want bigger forearms" is sayable — naming one
// is what gets it its own slot.
const FOCUS_OPTIONS = [...PROGRAMMED_MUSCLES, ...ENGINE_MUSCLES.filter((m) => !PROGRAMMED_MUSCLES.includes(m))]

export default function GenerateSplit() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { addRoutine } = useProgramsState()

  const [history, setHistory] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const [daysPerWeek, setDaysPerWeek] = useState(DEFAULT_DAYS_PER_WEEK)
  const [schedule, setSchedule] = useState('weekly')
  const [weekdays, setWeekdays] = useState(DEFAULT_WEEKDAYS[DEFAULT_DAYS_PER_WEEK])
  const [focus, setFocus] = useState([])
  const [experience, setExperience] = useState('')
  const [equipment, setEquipment] = useState('')
  const [sessionMinutes, setSessionMinutes] = useState(DEFAULT_SESSION_MINUTES)
  const [name, setName] = useState('')

  // History and profile, loaded the way every other surface loads them: remote
  // when signed in, this device's copy otherwise.
  useEffect(() => {
    let cancelled = false
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
  }, [user])

  // Changing the frequency re-spreads the training days, unless the user has
  // already placed exactly that many themselves.
  function chooseDays(n) {
    setDaysPerWeek(n)
    if (weekdays.length !== n) setWeekdays([...DEFAULT_WEEKDAYS[n]])
  }

  function toggleWeekday(d) {
    setWeekdays((prev) => {
      if (prev.includes(d)) return prev.length > 2 ? prev.filter((x) => x !== d) : prev
      return [...prev, d].sort((a, b) => a - b)
    })
  }

  function toggleFocus(m) {
    setFocus((prev) => {
      if (prev.includes(m)) return prev.filter((x) => x !== m)
      return prev.length >= MAX_FOCUS_MUSCLES ? prev : [...prev, m]
    })
  }

  // The proposal. Recomputed on every answer — the generator is pure and cheap,
  // so the preview below is always the split the button would create.
  const built = useMemo(() => {
    if (loading) return null
    return generateProgram({
      answers: {
        daysPerWeek,
        schedule,
        weekdays: weekdays.length === daysPerWeek ? weekdays : null,
        focus,
        experience: experience || undefined,
        equipment: equipment || undefined,
        sessionMinutes,
      },
      profile,
      sessions: history,
    })
  }, [loading, daysPerWeek, schedule, weekdays, focus, experience, equipment, sessionMinutes, profile, history])

  const weekdayMismatch = schedule === 'weekly' && weekdays.length !== daysPerWeek

  function create() {
    if (!built) return
    const program = name.trim() ? setProgramName(built.program, name.trim()) : built.program
    addRoutine(program)
    navigate(`/split/${program.id}`)
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
    <div className="pt-28 pb-24 px-6">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate('/log/split')}
          className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary bg-transparent border-none cursor-pointer text-[13px] mb-10 p-0 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to training splits
        </button>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-heading text-4xl font-medium text-text-primary mb-3">Generate a split</h1>
          <p className="text-text-muted text-[15px] mb-10 leading-relaxed">
            Answer four questions and the exercise database does the rest — every muscle on two to three
            sessions a week, the ones you want to bring up trained more often and first, and each day filled
            with whatever buys the most growth for the fatigue it can still afford.
          </p>

          {loading ? (
            <p className="text-[13px] text-text-muted">Loading…</p>
          ) : (
            <div className="space-y-6">
              {/* ---- 1. How often ------------------------------------------- */}
              <section className={cardCls}>
                <h2 className={headCls}>How often do you train?</h2>
                <p className="text-[12px] text-text-light mb-5">Days a week you can reliably get to a session.</p>
                <div className="grid grid-cols-5 gap-2 mb-6">
                  {DAYS_PER_WEEK_OPTIONS.map((n) => choice(daysPerWeek === n, () => chooseDays(n), `${n}`, 'days'))}
                </div>

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
                  Up to {MAX_FOCUS_MUSCLES}. A focus muscle gets more weekly volume, an extra session where the
                  week has room for one, and the front of every day it appears in — done last and tired is most
                  of why a muscle lags. Leave it empty for a balanced split.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {FOCUS_OPTIONS.map((m) => {
                    const on = focus.includes(m)
                    const full = !on && focus.length >= MAX_FOCUS_MUSCLES
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => toggleFocus(m)}
                        disabled={full}
                        aria-pressed={on}
                        className={`px-2.5 py-1.5 text-[12px] font-medium border cursor-pointer transition-colors ${
                          on
                            ? 'bg-text-primary text-cream border-text-primary'
                            : 'bg-white text-text-muted border-border hover:border-border-hover disabled:opacity-40 disabled:cursor-not-allowed'
                        }`}
                      >
                        {m}
                      </button>
                    )
                  })}
                </div>
              </section>

              {/* ---- 3. You and your gym ------------------------------------- */}
              <section className={cardCls}>
                <h2 className={headCls}>You and your gym</h2>
                <p className="text-[12px] text-text-light mb-5">
                  {profile?.experience_level || profile?.equipment
                    ? 'Filled in from your profile — change either just for this split.'
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

                <label className={labelCls}>Equipment</label>
                <div className="grid grid-cols-2 gap-2 mb-6">
                  {EQUIPMENT_PRESETS.map((eq) => choice((equipment || 'gym') === eq.value, () => setEquipment(eq.value), eq.label))}
                </div>

                <label className={labelCls}>Time per session</label>
                <div className="grid grid-cols-5 gap-2">
                  {SESSION_MINUTES_OPTIONS.map((m) => choice(sessionMinutes === m, () => setSessionMinutes(m), `${m}`, 'min'))}
                </div>
              </section>

              {/* ---- 4. The proposal ----------------------------------------- */}
              {built && <Preview built={built} name={name} setName={setName} onCreate={create} />}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}

// The split as it will be created: every day, every movement, and what the week
// adds up to per muscle. Shown in full before anything is written — a plan you
// can't see the consequences of isn't a plan, it's a surprise.
function Preview({ built, name, setName, onCreate }) {
  const { summary } = built
  const cardCls = 'bg-white border border-border p-6 sm:p-8'
  const trained = summary.volume.filter((v) => v.sets > 0)
  const maxSets = Math.max(1, ...trained.map((v) => v.sets))
  // Two different reasons a planned muscle can end up with nothing, and they
  // deserve different sentences: the library has no movement for it at this
  // equipment level, or it simply didn't fit in the time available.
  const unavailable = summary.volume.filter((v) => v.target != null && v.sets === 0 && !v.available)
  const squeezed = summary.volume.filter((v) => v.target != null && v.sets === 0 && v.available)

  return (
    <section className={cardCls}>
      <h2 className="font-heading text-xl font-medium text-text-primary mb-1">Your split</h2>
      <p className="text-[12px] text-text-light mb-6">
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
                      {d.sets} sets · {d.load.label.toLowerCase()}
                    </span>
                  )}
                </div>
                {d.kind === 'rest' ? (
                  <p className="text-[11px] text-text-light mt-0.5">Rest</p>
                ) : (
                  <ul className="mt-1.5 space-y-0.5 list-none p-0 m-0">
                    {d.exercises.map((e) => (
                      <li key={e.id} className="flex items-baseline gap-2 text-[12px]">
                        <span className="text-text-secondary break-words min-w-0">{e.name}</span>
                        <span className="text-text-light shrink-0 ml-auto tabular-nums">
                          {e.sets} × {e.repRange.low}–{e.repRange.high}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

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
              {squeezed.map((m) => m.muscle).join(', ')} didn&apos;t fit in {summary.sessionMinutes} minutes —
              a longer session or another training day would make room.
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
        <Wand2 className="w-4 h-4" /> Create this split
      </button>
      <p className="text-[11px] text-text-light mt-3 leading-relaxed">
        Nothing is saved until you tap Create — and every day, movement, set and rep range is editable
        afterwards.
      </p>
    </section>
  )
}
