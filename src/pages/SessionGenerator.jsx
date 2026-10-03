import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Play, CalendarPlus, Check, Sparkles } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { fetchProfile } from '../lib/profile'
import { getHistory, getUnit } from '../lib/workoutStore'
import { fetchRemoteHistory } from '../lib/workoutRemote'
import { useInjuries } from '../lib/useInjuries'
import { useProgramsState } from '../lib/useProgramsState'
import { generateSession, swapProposedRow } from '../lib/generator'
import { SESSION_TYPES, VOLUME_PREFERENCES, DEFAULT_VOLUME_PREFERENCE, DEFAULT_EXPERIENCE } from '../lib/generatorConfig'
import { EXPERIENCE_LEVELS, EQUIPMENT_PRESETS } from '../lib/profileFields'
import { appendDay, copyDay, emptyProgram, placeDay, scheduleMode } from '../lib/program'
import { dayStats, donutRows } from '../lib/planStats'
import DayEditor from '../components/DayEditor'
import MuscleDonut from '../components/MuscleDonut'

// Generate a session: the split generator's questions, for one workout. Picks
// a kind of session (or lets the week pick — recommendSession), builds it with
// the same fillDay a split's days come from, sized against what the last 7
// days already did and what's still recovering (generateSession), and hands it
// to the log — or into a split, where it becomes an ordinary day.
//
// Reached from the dashboard's New workout chooser. Nothing is saved until
// Start or Save; edits (swaps, sets, added movements) live on the proposal the
// same way they do in the split wizard's preview.

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function SessionGenerator() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const programs = useProgramsState()
  const { programsState, loading: programsLoading } = programs
  const { injuries } = useInjuries()

  const [history, setHistory] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState('auto')
  const [volume, setVolume] = useState(DEFAULT_VOLUME_PREFERENCE)
  const volumeTouched = useRef(false)
  const [equipment, setEquipment] = useState('')
  const [experience, setExperience] = useState('')

  // History and profile, loaded the way every other surface loads them.
  useEffect(() => {
    let cancelled = false
    async function load() {
      let sessions = getHistory()
      let p = null
      if (user) {
        try { sessions = await fetchRemoteHistory(user.id) } catch { /* keep the local copy */ }
        try { p = await fetchProfile(user.id) } catch { /* a prefill, never a requirement */ }
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

  // The active split's volume setting is the default — the session should feel
  // like a day of the training you already do.
  const active = programsState?.programs?.find((p) => p.id === programsState.activeId) || null
  useEffect(() => {
    if (programsLoading || volumeTouched.current) return
    if (active?.settings?.volume) setVolume(active.settings.volume)
  }, [programsLoading, active])

  const answers = { volume, equipment: equipment || undefined, experience: experience || undefined }
  const key = JSON.stringify({ type, ...answers })
  const built = useMemo(
    () => (loading ? null : generateSession({ type, answers: JSON.parse(key), profile, sessions: history, injuries })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loading, key, profile, history, injuries]
  )

  // Edits on top of the proposal, kept per set of answers (as in the wizard).
  const [edits, setEdits] = useState({})
  const program = edits[key]?.base === built ? edits[key].program : built?.program
  const day = program?.days[0] || null
  function update(fn) {
    setEdits((prev) => {
      const kept = prev[key]?.base === built ? prev[key].program : built.program
      return { ...prev, [key]: { base: built, program: fn(kept) } }
    })
  }
  const swap = (dayId, rowId, choice) => update((p) => swapProposedRow(built, p, dayId, rowId, choice))
  const stats = useMemo(() => (day ? dayStats(day) : null), [day])

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(null) // { programId, name }

  function start() {
    navigate('/log', { state: { startSession: day } })
  }

  const labelCls = 'text-[11px] text-text-muted uppercase tracking-wider block mb-2'
  const cardCls = 'bg-white border border-border p-5 sm:p-7'
  const choice = (on, onClick, label, sub) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`px-2 py-2.5 text-[13px] font-medium border cursor-pointer transition-colors text-center leading-tight ${
        on ? 'bg-text-primary text-cream border-text-primary' : 'bg-white text-text-muted border-border hover:border-border-hover'
      }`}
    >
      {label}
      {sub && <span className={`block text-[10px] font-normal mt-0.5 ${on ? 'text-cream-60' : 'text-text-light'}`}>{sub}</span>}
    </button>
  )

  const recommended = built?.recommendation?.type || null
  const lighter = built?.trimmed || []
  const sets = stats ? stats.sets : 0

  return (
    <div className="pt-24 pb-24 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary no-underline text-[13px] mb-8 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
        </Link>
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-heading text-3xl sm:text-4xl font-medium text-text-primary mb-2 tracking-tight">Generate a session</h1>
          <p className="text-text-muted text-[14px] mb-8">One workout, built around your week.</p>

          {loading || !built ? (
            <p className="text-[13px] text-text-muted">Loading…</p>
          ) : (
            <div className="space-y-5">
              <section className={cardCls}>
                <h2 className="font-heading text-lg font-medium text-text-primary mb-4">What are you training?</h2>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {choice(type === 'auto', () => setType('auto'), 'Pick for me', recommended ? `→ ${recommended.label}` : null)}
                  {SESSION_TYPES.map((t) => choice(type === t.id, () => setType(t.id), t.label))}
                </div>
                {type === 'auto' && built.recommendation?.reason && (
                  <p className="text-[12px] text-text-muted mt-3 leading-relaxed">
                    <Sparkles className="inline w-3.5 h-3.5 mr-1 align-[-2px]" />
                    {built.recommendation.reason}
                  </p>
                )}
              </section>

              <section className={cardCls}>
                <h2 className="font-heading text-lg font-medium text-text-primary mb-4">You and your gym</h2>
                <label className={labelCls}>Volume</label>
                <div className="grid grid-cols-3 gap-2 mb-5">
                  {VOLUME_PREFERENCES.map((p) => choice(volume === p.value, () => { volumeTouched.current = true; setVolume(p.value) }, p.label, p.sub))}
                </div>
                <label className={labelCls}>Equipment</label>
                <div className="grid grid-cols-2 gap-2 mb-5">
                  {EQUIPMENT_PRESETS.map((eq) => choice((equipment || 'gym') === eq.value, () => setEquipment(eq.value), eq.label))}
                </div>
                <label className={labelCls}>Training age</label>
                <div className="grid grid-cols-3 gap-2">
                  {EXPERIENCE_LEVELS.map((e) => choice((experience || DEFAULT_EXPERIENCE) === e.value, () => setExperience(e.value), e.label, e.sub))}
                </div>
              </section>

              {day && (
                <section className={cardCls}>
                  <h2 className="font-heading text-lg font-medium text-text-primary mb-1">{day.name}</h2>
                  <p className="text-[12px] text-text-light mb-4">
                    {sets} set{sets === 1 ? '' : 's'} · {stats.exercises} exercise{stats.exercises === 1 ? '' : 's'}
                    {stats.coreSets ? ` + ${stats.coreSets} abs` : ''} · {stats.load.label}
                  </p>
                  {lighter.length > 0 && (
                    <p className="text-[12px] text-text-muted mb-4 leading-relaxed">
                      Lighter today:{' '}
                      {[
                        lighter.filter((x) => x.why === 'done').map((x) => x.muscle.toLowerCase()).join(', '),
                        lighter.filter((x) => x.why === 'recovering').map((x) => x.muscle.toLowerCase()).join(', '),
                      ]
                        .map((list, i) => (list ? `${list} ${i === 0 ? '(trained this week)' : '(still recovering)'}` : null))
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                  {stats.muscles.length > 0 && (
                    <div className="mb-5">
                      <MuscleDonut items={donutRows(stats.muscles)} unitLabel="sets" compact />
                    </div>
                  )}
                  <DayEditor
                    program={program}
                    day={day}
                    update={update}
                    user={user}
                    notes="row"
                    sessions={history}
                    onSubstitute={swap}
                    unit={getUnit()}
                  />

                  <div className="flex flex-col sm:flex-row gap-2 mt-6">
                    <button
                      type="button"
                      onClick={start}
                      disabled={!day.exercises.length}
                      className="flex-1 inline-flex items-center justify-center gap-2 bg-text-primary text-cream font-medium py-3 border-none cursor-pointer text-[14px] hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Play className="w-4 h-4" /> Start session
                    </button>
                    <button
                      type="button"
                      onClick={() => setSaving((v) => !v)}
                      aria-expanded={saving}
                      className="flex-1 inline-flex items-center justify-center gap-2 bg-white text-text-muted hover:text-text-primary font-medium py-3 border border-border hover:border-border-hover cursor-pointer text-[14px] transition-colors"
                    >
                      <CalendarPlus className="w-4 h-4" /> Save to a split
                    </button>
                  </div>
                  {saving && (
                    <SaveToSplit
                      day={day}
                      programs={programs}
                      sessionName={built.type.label}
                      saved={saved}
                      onSaved={setSaved}
                    />
                  )}
                </section>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}

// Where a generated session goes to become part of a split. A rotation takes
// it as one more day; a fixed week has exactly seven slots, so it goes ON a
// weekday — replacing what's there, which each button names. Or it starts a
// split of its own. Every save is a fresh copy (copyDay), so the same session
// can go into more than one split.
function SaveToSplit({ day, programs, sessionName, saved, onSaved }) {
  const { programsState, saveProgram, addRoutine } = programs
  const list = [...(programsState?.programs || [])].sort((a, b) => (b.id === programsState.activeId) - (a.id === programsState.activeId))

  function into(program, index = null) {
    const copy = copyDay(day)
    const next = index == null ? appendDay(program, copy) : placeDay(program, index, copy)
    saveProgram({ ...next, updatedAt: Date.now() })
    onSaved({ programId: program.id, name: program.name, dayId: copy.id })
  }
  function asNewSplit() {
    const p = emptyProgram(`${sessionName} split`)
    p.days = [copyDay(day)]
    addRoutine(p)
    onSaved({ programId: p.id, name: p.name, dayId: p.days[0].id })
  }

  if (saved) {
    return (
      <div className="mt-4 border border-border bg-cream p-4 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[13px] text-text-primary inline-flex items-center gap-1.5">
          <Check className="w-4 h-4" /> Saved to {saved.name}
        </p>
        <Link to={`/split/${saved.programId}`} className="text-[12px] font-medium text-text-secondary hover:text-text-primary no-underline">
          Open split →
        </Link>
      </div>
    )
  }

  return (
    <div className="mt-4 border border-border divide-y divide-border">
      {list.map((p) => {
        const weekly = scheduleMode(p) === 'weekly'
        const isActive = p.id === programsState.activeId
        return (
          <div key={p.id} className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-[13px] font-medium text-text-primary break-words min-w-0">{p.name}</p>
              {isActive && <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wider text-cream bg-text-primary px-1.5 py-0.5">Active</span>}
            </div>
            {weekly ? (
              <>
                <p className="text-[11px] text-text-light mb-2">Put it on — replaces that day:</p>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                  {p.days.map((d, i) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => into(p, i)}
                      title={`Replace ${d.name} on ${WEEKDAYS[i]}`}
                      className="px-1 py-1.5 text-center bg-white border border-border hover:border-text-primary cursor-pointer transition-colors leading-tight"
                    >
                      <span className="block text-[12px] font-medium text-text-primary">{WEEKDAYS[i]}</span>
                      <span className="block text-[9px] text-text-light truncate">{d.kind === 'rest' ? 'Rest' : d.name}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => into(p)}
                className="text-[12px] font-medium text-text-muted hover:text-text-primary bg-white border border-border hover:border-border-hover px-3 py-1.5 cursor-pointer transition-colors"
              >
                Add as a new day
              </button>
            )}
          </div>
        )
      })}
      <div className="p-4">
        <button
          type="button"
          onClick={asNewSplit}
          className="text-[12px] font-medium text-text-muted hover:text-text-primary bg-white border border-border hover:border-border-hover px-3 py-1.5 cursor-pointer transition-colors"
        >
          Start a new split with it
        </button>
      </div>
    </div>
  )
}
