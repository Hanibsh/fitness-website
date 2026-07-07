import { useState, useEffect, useMemo, useCallback } from 'react'
import { Scale, TrendingUp, TrendingDown, Minus, Plus, X } from 'lucide-react'
import {
  getBodyweightLog, makeBodyweightEntry, saveBodyweightEntry, deleteBodyweightEntry,
} from '../lib/workoutStore'
import { fetchRemoteBodyweight, upsertRemoteBodyweight, deleteRemoteBodyweight } from '../lib/workoutRemote'
import { BODYWEIGHT_RANGES, bodyweightSeries } from '../lib/workoutStats'
import ProgressChart from './ProgressChart'

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

// Bodyweight tracking card for the dashboard. Local-first: guests store in
// localStorage; logged-in users sync to Supabase, falling back to local if the
// table isn't there yet (mirrors how the rest of the store degrades).
export default function BodyweightTracker({ user, unit = 'kg' }) {
  const [entries, setEntries] = useState([])
  const [rangeId, setRangeId] = useState('3m')
  const [hovered, setHovered] = useState(null)
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  // Whether we can talk to the remote table. Starts true for logged-in users;
  // flips off (→ local) the first time a remote call fails.
  const [remoteOk, setRemoteOk] = useState(!!user)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (user) {
        try {
          const remote = await fetchRemoteBodyweight(user.id)
          if (!cancelled) { setEntries(remote); setRemoteOk(true) }
          return
        } catch {
          if (!cancelled) setRemoteOk(false)
        }
      }
      if (!cancelled) setEntries(getBodyweightLog())
    }
    load()
    return () => { cancelled = true }
  }, [user])

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

  const active = hovered != null && series[hovered] ? series[hovered] : series[series.length - 1]
  const change = series.length >= 2 ? series[series.length - 1].value - series[0].value : null
  // Weight loss is usually the goal, so down is "good" (green) here — the
  // inverse of the lift charts.
  const Trend = change === null || change === 0 ? Minus : change < 0 ? TrendingDown : TrendingUp
  const trendColor = change === null || change === 0 ? 'text-text-muted' : change < 0 ? 'text-green-600' : 'text-red-600'

  return (
    <div className="bg-white border border-border p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Scale className="w-4 h-4 text-text-primary" />
        <h2 className="font-heading text-lg font-medium text-text-primary">Bodyweight</h2>
      </div>

      {/* add today's weight */}
      <div className="flex gap-2 mb-5">
        <div className="relative flex-1 max-w-[220px]">
          <input
            type="number"
            min="0"
            step="0.1"
            inputMode="decimal"
            value={input}
            onChange={(e) => {
              const v = e.target.value
              if (v !== '' && (!Number.isFinite(Number(v)) || Number(v) < 0)) return
              setInput(v)
            }}
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

      {series.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-border">
          <p className="text-[13px] text-text-muted">No weigh-ins in this range yet.</p>
          <p className="text-[12px] text-text-light mt-1">Add today's weight above to start your chart.</p>
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

          {series.length === 1 && (
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
                    <button
                      onClick={() => removeEntry(e.id)}
                      aria-label="Delete weigh-in"
                      className="text-text-light hover:text-red-600 bg-transparent border-none cursor-pointer p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
