import { useState, useEffect, useMemo, useCallback } from 'react'
import { TrendingUp, TrendingDown, Minus, Plus, X, ChevronRight, Lock } from 'lucide-react'
import {
  getBodyweightLog, makeBodyweightEntry, saveBodyweightEntry, deleteBodyweightEntry,
} from '../lib/workoutStore'
import { fetchRemoteBodyweight, upsertRemoteBodyweight, deleteRemoteBodyweight } from '../lib/workoutRemote'
import { BODYWEIGHT_RANGES, bodyweightSeries, convertWeight } from '../lib/workoutStats'
import ProgressChart from './ProgressChart'
import Modal from './Modal'
import AuthModal from './AuthModal'
import NumberField from './NumberField'
import FoodFields from './FoodFields'
import { devClientSample } from '../lib/coach'
import { weekStart } from '../lib/checkins'
import { foodForm, parseIntake, previousWeek, intakeLine, underFloor } from '../lib/weeklyLog'

// A bathroom scale — the kind you step on. Hand-rolled because lucide has no
// such icon: its `Scale` is a justice/balance scale and `Weight` is a kettlebell,
// neither of which is what a weigh-in means. Drawn on lucide's own 24x24,
// stroke-2 grid so it sits evenly beside the icons around it.
//
// A square platform with a dial. The dial is deliberately large and its needle
// diagonal: these render at 14-16px, where a smaller arc with an upright needle
// turned to mush and read as an omega rather than a gauge.
function ScaleIcon({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M6.5 16a5.5 5.5 0 0 1 11 0" />
      <path d="M12 16l3.5-4" />
    </svg>
  )
}

function fmt(value, unit) {
  return `${Math.round(value * 10) / 10} ${unit}`
}

function fullDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function isSameDay(a, b) {
  const x = new Date(a), y = new Date(b)
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate()
}

// Bodyweight tracking for the dashboard. Shows as a small tile (current weight
// + trend); tap it to open the full panel — chart, ranges, and logging.
// Local-first: guests store in localStorage; logged-in users sync to Supabase,
// falling back to local if the table isn't there yet.
//
// Given `weekly` (lib/useWeeklyLog.js), it's "Weight & food": the tile adds
// this week's food and the panel a Food block to log a week — measured
// against `targets` (lib/useDailyTargets.js pickTargets), with `sex` for the
// calorie floor.
//
// Given `entries`, it's someone else's weigh-ins (the coach's view of a
// client): read-only — nothing loaded, added or deleted.
export default function BodyweightTracker({ user, unit = 'kg', entries: given = null, weekly = null, targets = null, sex = null }) {
  const readOnly = given != null
  // The dev client sample logs to this device, signed out.
  const dev = !user && devClientSample()
  const title = weekly ? 'Weight & food' : 'Bodyweight'
  const [ownEntries, setEntries] = useState([])
  const entries = readOnly ? given : ownEntries
  const [rangeId, setRangeId] = useState('3m')
  const [hovered, setHovered] = useState(null)
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  // Whether we can talk to the remote table. Starts true for logged-in users;
  // flips off (→ local) the first time a remote call fails.
  const [remoteOk, setRemoteOk] = useState(!!user)

  // Bodyweight tracking requires an account (it syncs to your profile), so
  // logged-out visitors get a locked teaser that prompts login.
  const locked = !user && !readOnly && !dev

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (readOnly) return
      if (!user) { setEntries(dev ? getBodyweightLog() : []); return }
      try {
        const remote = await fetchRemoteBodyweight(user.id)
        if (!cancelled) { setEntries(remote); setRemoteOk(true) }
        return
      } catch {
        if (!cancelled) setRemoteOk(false)
      }
      if (!cancelled) setEntries(getBodyweightLog())
    }
    load()
    return () => { cancelled = true }
  }, [user, readOnly, dev])

  const useRemote = !!user && remoteOk

  const persist = useCallback(async (entry) => {
    if (useRemote) {
      try {
        await upsertRemoteBodyweight(user.id, entry)
        return
      } catch {
        // Remote unavailable (e.g. migration not run yet) — degrade to local.
        setRemoteOk(false)
      }
    }
    saveBodyweightEntry(entry)
  }, [useRemote, user])

  async function addEntry() {
    const w = Number(input)
    if (!(w > 0) || saving) return
    setSaving(true)
    // One weigh-in per day: reuse today's entry id so it updates instead of
    // stacking a second point on the same date.
    const today = entries.find((e) => isSameDay(e.date, Date.now()))
    const entry = today
      ? { ...today, weight: w, unit }
      : makeBodyweightEntry(w, unit)
    await persist(entry)
    setEntries((prev) => [entry, ...prev.filter((e) => e.id !== entry.id)].sort((a, b) => b.date - a.date))
    setInput('')
    setSaving(false)
  }

  async function removeEntry(id) {
    if (useRemote) {
      try {
        await deleteRemoteBodyweight(id)
      } catch {
        setRemoteOk(false)
        deleteBodyweightEntry(id)
      }
    } else {
      deleteBodyweightEntry(id)
    }
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  const series = useMemo(() => bodyweightSeries(entries, rangeId, unit), [entries, rangeId, unit])
  const recent = useMemo(() => [...entries].sort((a, b) => b.date - a.date).slice(0, 5), [entries])

  // Newest weigh-in overall (for the compact tile), normalised to display unit.
  const latest = useMemo(() => {
    if (!entries.length) return null
    const e = [...entries].sort((a, b) => b.date - a.date)[0]
    return Math.round(convertWeight(Number(e.weight), e.unit || 'kg', unit) * 10) / 10
  }, [entries, unit])

  const active = hovered != null && series[hovered] ? series[hovered] : series[series.length - 1]
  const change = series.length >= 2 ? series[series.length - 1].value - series[0].value : null
  // Weight loss is usually the goal, so down is "good" (green) here — the
  // inverse of the lift charts.
  const Trend = change === null || change === 0 ? Minus : change < 0 ? TrendingDown : TrendingUp
  const trendColor = change === null || change === 0 ? 'text-text-muted' : change < 0 ? 'text-green-600' : 'text-red-600'
  const rangeLabel = (BODYWEIGHT_RANGES.find((r) => r.id === rangeId) || {}).label
  const thisWeekLine = weekly ? intakeLine(weekly.entryFor(weekStart())) : ''

  return (
    <>
      {/* Compact tile — tap to open the panel (or prompt login when locked). */}
      <button
        onClick={() => (locked ? setAuthOpen(true) : setExpanded(true))}
        className="w-full text-left bg-white border border-border p-5 sm:p-6 hover:border-border-hover transition-colors cursor-pointer"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScaleIcon className="w-4 h-4 text-text-primary" />
            <h2 className="font-heading text-lg font-medium text-text-primary">{title}</h2>
          </div>
          {locked ? <Lock className="w-3.5 h-3.5 text-text-light" /> : <ChevronRight className="w-4 h-4 text-text-light" />}
        </div>
        {locked ? (
          <p className="text-[13px] text-text-muted mt-2">
            Track your weight over time and see your trend. <span className="text-text-primary font-medium">Log in to start →</span>
          </p>
        ) : latest != null ? (
          <div className="flex items-baseline gap-3 mt-3">
            <span className="font-heading text-2xl font-medium text-text-primary leading-none">{fmt(latest, unit)}</span>
            {change !== null && change !== 0 && (
              <span className={`text-[13px] font-medium flex items-center gap-1 ${trendColor}`}>
                <Trend className="w-3.5 h-3.5" />
                {change > 0 ? '+' : ''}{Math.round(change * 10) / 10} {unit}
                <span className="text-text-light font-normal">· {rangeLabel}</span>
              </span>
            )}
          </div>
        ) : (
          <p className="text-[13px] text-text-muted mt-2">{readOnly ? 'No weigh-ins yet.' : 'Tap to log your weight and track your trend.'}</p>
        )}
        {weekly && !locked && (
          <p className={`text-[12px] mt-2 ${thisWeekLine ? 'text-text-secondary' : 'text-text-muted'}`}>
            {thisWeekLine ? `This week: ${thisWeekLine}` : 'Log this week’s food'}
          </p>
        )}
      </button>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}

      {/* Expanded panel — full chart, ranges, logging, and history. */}
      {expanded && !locked && (
        <Modal onClose={() => setExpanded(false)} maxWidth="max-w-lg">
          <div className="p-6 sm:p-7">
            <div className="flex items-center gap-2 mb-5">
              <ScaleIcon className="w-4 h-4 text-text-primary" />
              <h2 className="font-heading text-xl font-medium text-text-primary">{title}</h2>
            </div>

            {/* add today's weight */}
            {!readOnly && (
              <div className="flex gap-2 mb-5">
                <div className="relative flex-1 max-w-[220px]">
                  <NumberField
                    value={input}
                    onValueChange={setInput}
                    onKeyDown={(e) => { if (e.key === 'Enter') addEntry() }}
                    placeholder={`Today's weight (${unit})`}
                    className="w-full bg-cream border border-border px-3 py-2 pr-10 text-[13px] text-text-primary outline-none focus:border-text-primary transition-colors"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-text-light pointer-events-none">{unit}</span>
                </div>
                <button
                  onClick={addEntry}
                  disabled={!(Number(input) > 0) || saving}
                  className="inline-flex items-center gap-1.5 bg-text-primary text-cream text-[13px] font-medium px-4 py-2 border-none cursor-pointer hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
            )}

            {weekly && !readOnly && <FoodBlock weekly={weekly} targets={targets} sex={sex} />}

            {series.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-border">
                <p className="text-[13px] text-text-muted">No weigh-ins in this range yet.</p>
                {!readOnly && <p className="text-[12px] text-text-light mt-1">Add today's weight above to start your chart.</p>}
              </div>
            ) : (
              <>
                {/* range toggle */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {BODYWEIGHT_RANGES.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => { setRangeId(r.id); setHovered(null) }}
                      className={`px-2.5 py-1 text-[11px] font-medium border cursor-pointer transition-colors ${
                        r.id === rangeId
                          ? 'bg-cream-dark text-text-primary border-border-hover'
                          : 'bg-white text-text-light border-border hover:border-border-hover'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>

                {/* summary */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-cream border border-border px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-text-light mb-1">Latest</p>
                    <p className="text-[15px] font-medium text-text-primary">{fmt(series[series.length - 1].value, unit)}</p>
                  </div>
                  <div className="bg-cream border border-border px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-text-light mb-1">Start</p>
                    <p className="text-[15px] font-medium text-text-primary">{fmt(series[0].value, unit)}</p>
                  </div>
                  <div className="bg-cream border border-border px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-text-light mb-1">Change</p>
                    <p className={`text-[15px] font-medium flex items-center gap-1 ${trendColor}`}>
                      <Trend className="w-3.5 h-3.5" />
                      {change === null ? '—' : `${change > 0 ? '+' : ''}${Math.round(change * 10) / 10}`}
                    </p>
                  </div>
                </div>

                {/* hovered/latest caption */}
                {active && (
                  <p className="text-[12px] text-text-muted mb-2">
                    <span className="text-text-primary font-medium">{fmt(active.value, unit)}</span>
                    {' · '}{fullDate(active.date)}
                  </p>
                )}

                <div className="text-text-primary">
                  <ProgressChart points={series} hoveredIndex={hovered} onHover={setHovered} />
                </div>

                {series.length === 1 && !readOnly && (
                  <p className="text-[12px] text-text-light mt-3">Log your weight on another day to see a trend line.</p>
                )}

                {/* recent entries */}
                {recent.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-border space-y-1.5">
                    {recent.map((e) => (
                      <div key={e.id} className="flex items-center justify-between text-[12px]">
                        <span className="text-text-secondary">{fullDate(e.date)}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-text-primary font-medium">{fmt(Number(e.weight), e.unit || unit)}</span>
                          {!readOnly && (
                            <button
                              onClick={() => removeEntry(e.id)}
                              aria-label="Delete weigh-in"
                              className="text-text-light hover:text-red-600 bg-transparent border-none cursor-pointer p-0.5"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  )
}

// A bar against a target: how close the week's average came. Never red —
// under or over, it's information, not a verdict.
function TargetBar({ label, value, target, unit }) {
  const pct = Math.min(100, Math.round((value / target) * 100))
  return (
    <div>
      <div className="flex justify-between items-baseline gap-2 text-[12px] mb-1">
        <span className="text-text-secondary">{label}</span>
        <span className="text-text-muted tabular-nums">
          <span className="text-text-primary font-medium">{value.toLocaleString('en-US')}</span> / {target.toLocaleString('en-US')} {unit}
        </span>
      </div>
      <div className="w-full h-2 bg-cream border border-border overflow-hidden">
        <div className="h-full bg-text-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// One week's food — this week, or last (a finished week often gets logged on
// Monday). The same entry the weekly check-in writes.
function FoodBlock({ weekly, targets, sex }) {
  const thisWeek = weekStart()
  const [key, setKey] = useState(thisWeek)
  const entry = weekly.entryFor(key)
  const [text, setText] = useState(() => foodForm(entry))
  const [error, setError] = useState(null)
  const [state, setState] = useState('idle') // 'saving' | 'saved'

  // Switching weeks, or the week arriving from the account, refills the form.
  useEffect(() => {
    setText(foodForm(entry))
    setError(null)
  }, [key, entry])

  async function save() {
    const parsed = parseIntake(text)
    setError(parsed.error)
    if (parsed.error) return
    setState('saving')
    await weekly.save({ weekStart: key, ...parsed.entry })
    setState('saved')
    setTimeout(() => setState((st) => (st === 'saved' ? 'idle' : st)), 2000)
  }

  const week = (k, label) => (
    <button
      type="button"
      onClick={() => setKey(k)}
      aria-pressed={key === k}
      className={`px-2.5 py-1 text-[11px] font-medium border-none cursor-pointer transition-colors ${
        key === k ? 'bg-text-primary text-cream' : 'bg-white text-text-muted hover:text-text-primary'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="mb-6 pb-5 border-b border-border">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-[13px] font-medium text-text-primary">Food</h3>
        <div className="flex border border-border">
          {week(thisWeek, 'This week')}
          {week(previousWeek(thisWeek), 'Last week')}
        </div>
      </div>
      <FoodFields value={text} onChange={(v) => { setText(v); setError(null) }} error={error} idPrefix="tile-food" />
      <div className="flex items-center gap-3 mt-3">
        <button
          type="button"
          onClick={save}
          disabled={state === 'saving'}
          className="bg-text-primary text-cream text-[13px] font-medium px-4 py-2 border-none cursor-pointer hover:bg-accent-hover transition-colors disabled:opacity-40"
        >
          {state === 'saving' ? 'Saving…' : 'Save'}
        </button>
        {state === 'saved' && <span className="text-[12px] text-text-muted">Saved</span>}
      </div>
      {targets && (entry?.calories != null || entry?.protein != null) && (
        <div className="space-y-2.5 mt-4">
          {targets.calories && entry?.calories != null && <TargetBar label="Calories" value={entry.calories} target={targets.calories} unit="cal" />}
          {targets.protein && entry?.protein != null && <TargetBar label="Protein" value={entry.protein} target={targets.protein} unit="g" />}
          <p className="text-[11px] text-text-light">{targets.from === 'coach' ? 'Targets from your coach' : 'Your targets, from your profile'}</p>
        </div>
      )}
      {underFloor(entry, sex) && (
        <p className="text-[12px] text-text-muted mt-3">Under the floor — eat a bit more, walk for the rest.</p>
      )}
    </div>
  )
}
