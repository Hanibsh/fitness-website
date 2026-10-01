import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import UnitHelp from '../../components/UnitHelp'
import PrefillNote from '../../components/PrefillNote'
import { usePrefillEffect } from '../../lib/profilePrefill'
import { CARDIO_ACTIVITIES, activityById, netKcalPerMin, kmhToMs, kmhToMph, mphToKmh } from '../../lib/cardio'

const inputBounds = {
  weight: { metric: { min: 20, max: 300 }, imperial: { min: 44, max: 660 } },
  kcal: { min: 10, max: 2000 },
  minutes: { min: 1, max: 300 },
}

// The setting each activity is compared at in "Same burn, other ways": its
// default speed or watts, or its easiest Compendium level.
const typicalParams = (a) => a.kind === 'speed'
  ? { speedKmh: a.speedKmh.default, gradePct: 0 }
  : a.kind === 'watts' ? { watts: a.watts.default } : { level: 0 }

const typicalLabel = (a, unit) => a.kind === 'speed'
  ? `${speedText(a.speedKmh.default, unit)}, flat`
  : a.kind === 'watts' ? `${a.watts.default} W` : a.levels[0].label.toLowerCase()

const round1 = (n) => Math.round(n * 10) / 10
const speedNum = (kmh, unit) => round1(unit === 'imperial' ? kmhToMph(kmh) : kmh)
const speedText = (kmh, unit) => `${speedNum(kmh, unit)} ${unit === 'imperial' ? 'mph' : 'km/h'}`
const speedInUnit = (kmh, unit) => String(speedNum(kmh, unit))

export default function CardioCalculator() {
  const [unit, setUnit] = useState('metric')
  const [weight, setWeight] = useState('')
  const [activityId, setActivityId] = useState('walk')
  const [speed, setSpeed] = useState(speedInUnit(activityById.walk.speedKmh.default, 'metric'))
  const [grade, setGrade] = useState('0')
  const [watts, setWatts] = useState(String(activityById.bike.watts.default))
  const [level, setLevel] = useState(0)
  const [mode, setMode] = useState('burn')
  const [kcalGoal, setKcalGoal] = useState('250')
  const [minutesDone, setMinutesDone] = useState('30')

  const prefill = usePrefillEffect((p) => {
    if (p.unitSystem) {
      setUnit(p.unitSystem)
      setSpeed((v) => (p.unitSystem === 'imperial' && v !== '' ? speedInUnit(parseFloat(v), 'imperial') : v))
    }
    if (p.weight != null) setWeight((v) => (v === '' ? String(p.weight) : v))
  })

  const activity = activityById[activityId]

  function pickActivity(a) {
    setActivityId(a.id)
    setLevel(0)
    if (a.kind === 'speed') {
      setSpeed(speedInUnit(a.speedKmh.default, unit))
      setGrade(String(a.grade.default))
    }
  }

  function pickUnit(next) {
    prefill.touch()
    if (next === unit) return
    // Carry the typed speed across so the walk itself doesn't change.
    const s = parseFloat(speed)
    if (s) setSpeed(String(round1(next === 'imperial' ? kmhToMph(s) : mphToKmh(s))))
    setUnit(next)
  }

  // Validate everything the current activity and mode read; the first problem
  // wins, and results only show once there is none.
  const w = parseFloat(weight)
  const weightKg = unit === 'imperial' ? w * 0.453592 : w
  const speedKmh = unit === 'imperial' ? mphToKmh(parseFloat(speed)) : parseFloat(speed)
  const gradePct = parseFloat(grade) || 0
  const wattsN = parseFloat(watts)
  const goal = parseFloat(kcalGoal)
  const mins = parseFloat(minutesDone)
  const weightRange = inputBounds.weight[unit]
  const weightUnitLabel = unit === 'imperial' ? 'lbs' : 'kg'
  const speedUnitLabel = unit === 'imperial' ? 'mph' : 'km/h'

  let error = ''
  if (!w) error = 'Enter your weight to see results.'
  else if (w < weightRange.min || w > weightRange.max) error = `Weight should be between ${weightRange.min} and ${weightRange.max} ${weightUnitLabel}.`
  else if (activity.kind === 'speed') {
    const lo = activity.speedKmh.min, hi = activity.speedKmh.max
    if (!speedKmh || speedKmh < lo - 0.05 || speedKmh > hi + 0.05) error = `${activity.label} speed should be between ${speedText(lo, unit)} and ${speedText(hi, unit)}.`
    else if (gradePct < 0 || gradePct > activity.grade.max) error = `Incline should be between 0 and ${activity.grade.max}%.`
  } else if (activity.kind === 'watts') {
    if (!wattsN || wattsN < activity.watts.min || wattsN > activity.watts.max) error = `Watts should be between ${activity.watts.min} and ${activity.watts.max}.`
  }
  if (!error && mode === 'burn' && (!goal || goal < inputBounds.kcal.min || goal > inputBounds.kcal.max)) error = `Calories should be between ${inputBounds.kcal.min} and ${inputBounds.kcal.max}.`
  if (!error && mode === 'time' && (!mins || mins < inputBounds.minutes.min || mins > inputBounds.minutes.max)) error = `Minutes should be between ${inputBounds.minutes.min} and ${inputBounds.minutes.max}.`

  const params = activity.kind === 'speed' ? { speedKmh, gradePct } : activity.kind === 'watts' ? { watts: wattsN } : { level }
  const perMin = error ? 0 : netKcalPerMin(activityId, params, weightKg)
  const minutes = mode === 'burn' ? goal / perMin : mins
  const burned = mode === 'burn' ? goal : perMin * mins
  const distanceKm = activity.kind === 'speed' ? (speedKmh * minutes) / 60 : null

  const others = error ? [] : CARDIO_ACTIVITIES.map(a => {
    const rate = netKcalPerMin(a.id, typicalParams(a), weightKg)
    return { a, value: mode === 'burn' ? Math.round(goal / rate) : Math.round(rate * mins) }
  })
  const maxOther = Math.max(...others.map(o => o.value), 1)

  const toggle = (active, onClick, label) => (
    <button onClick={onClick} className={`flex-1 py-3 text-[13px] font-medium border cursor-pointer transition-colors ${active ? 'bg-text-primary text-cream border-text-primary' : 'bg-white text-text-muted border-border hover:border-border-hover'}`}>{label}</button>
  )
  const fieldLabel = 'text-[11px] text-text-muted uppercase tracking-wider block mb-2'
  const fieldInput = 'w-full bg-cream border border-border px-4 py-3 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors'

  return (
    <div className="pt-28 pb-24 px-6">
      <div className="max-w-2xl mx-auto">
        <Link to="/tools" className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary no-underline text-[13px] mb-10 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to tools
        </Link>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-heading text-4xl font-medium text-text-primary mb-3">Cardio calculator</h1>
          <p className="text-text-muted text-[15px] mb-10">How long a walk, run, ride or swim takes to burn the calories you're after — or what a session you've done actually burned.</p>

          <div className="bg-white border border-border p-5 sm:p-9 space-y-7">
            <div className="flex gap-3 items-center">
              {toggle(unit === 'metric', () => pickUnit('metric'), 'Metric (kg, km/h)')}
              {toggle(unit === 'imperial', () => pickUnit('imperial'), 'Imperial (lbs, mph)')}
              <UnitHelp />
            </div>
            <PrefillNote from={prefill.from} />

            <div>
              <label className={fieldLabel}>Weight ({weightUnitLabel})</label>
              <input type="number" min={weightRange.min} max={weightRange.max} value={weight} onChange={e => setWeight(e.target.value)} placeholder={unit === 'metric' ? '80' : '176'} className={fieldInput} />
            </div>

            <div>
              <p className={fieldLabel}>Activity</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {CARDIO_ACTIVITIES.map(a => (
                  <button key={a.id} type="button" aria-pressed={activityId === a.id} onClick={() => pickActivity(a)} className={`px-2 py-3 text-[13px] font-medium border cursor-pointer transition-colors ${activityId === a.id ? 'bg-text-primary text-cream border-text-primary' : 'bg-white text-text-muted border-border hover:border-border-hover'}`}>{a.label}</button>
                ))}
              </div>
            </div>

            {activity.kind === 'speed' && (
              <div className="grid grid-cols-2 gap-4 items-end">
                <div>
                  <label className={fieldLabel}>Speed ({speedUnitLabel})</label>
                  <input type="number" step={0.1} value={speed} onChange={e => setSpeed(e.target.value)} className={fieldInput} />
                </div>
                <div>
                  <label className={fieldLabel}>Incline (%)</label>
                  <input type="number" min={0} max={activity.grade.max} step={0.5} value={grade} onChange={e => setGrade(e.target.value)} placeholder="0" className={fieldInput} />
                </div>
              </div>
            )}
            {activity.kind === 'watts' && (
              <div>
                <label className={fieldLabel}>Power (watts)</label>
                <input type="number" min={activity.watts.min} max={activity.watts.max} step={5} value={watts} onChange={e => setWatts(e.target.value)} className={fieldInput} />
                <p className="text-[11px] text-text-light mt-2">Most bikes show watts on the console. Around 100 W is a steady, conversational ride for most people.</p>
              </div>
            )}
            {activity.kind === 'level' && activity.levels.length > 1 && (
              <div>
                <p className={fieldLabel}>Effort</p>
                <div className="flex gap-2">
                  {activity.levels.map((l, i) => (
                    <button key={l.label} type="button" aria-pressed={level === i} onClick={() => setLevel(i)} className={`flex-1 px-1.5 py-2.5 border cursor-pointer transition-colors ${level === i ? 'bg-text-primary border-text-primary' : 'bg-white border-border hover:border-border-hover'}`}>
                      <span className={`block text-[13px] font-medium ${level === i ? 'text-cream' : 'text-text-muted'}`}>{l.label}</span>
                      <span className={`block text-[10px] ${level === i ? 'text-cream-70' : 'text-text-light'}`}>{l.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex gap-3">
                {toggle(mode === 'burn', () => setMode('burn'), 'Burn a target')}
                {toggle(mode === 'time', () => setMode('time'), 'Session I did')}
              </div>
              {mode === 'burn' ? (
                <div>
                  <label className={fieldLabel}>Calories to burn</label>
                  <input type="number" min={inputBounds.kcal.min} max={inputBounds.kcal.max} step={50} value={kcalGoal} onChange={e => setKcalGoal(e.target.value)} className={fieldInput} />
                </div>
              ) : (
                <div>
                  <label className={fieldLabel}>Minutes</label>
                  <input type="number" min={inputBounds.minutes.min} max={inputBounds.minutes.max} step={5} value={minutesDone} onChange={e => setMinutesDone(e.target.value)} className={fieldInput} />
                </div>
              )}
            </div>

            {error && <p className="text-[13px] text-text-muted">{error}</p>}
          </div>

          {!error && (
            <>
              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-5 sm:p-9">
                <h2 className="font-heading text-xl font-medium text-text-primary mb-6">Your result</h2>
                <div className="bg-text-primary p-5 text-center mb-4">
                  <p className="text-[11px] uppercase tracking-wider mb-1.5 text-cream-70">{mode === 'burn' ? `To burn ${Math.round(burned)} cal` : `In ${Math.round(minutes)} min`}</p>
                  <p className="text-4xl font-medium text-cream">{mode === 'burn' ? Math.round(minutes) : Math.round(burned)}</p>
                  <p className="text-[11px] text-cream-50">{mode === 'burn' ? 'minutes' : 'extra calories burned'}</p>
                </div>
                <div className={`grid gap-2 sm:gap-4 ${distanceKm != null ? 'grid-cols-3' : 'grid-cols-1'}`}>
                  <div className="bg-cream border border-border px-2 py-4 sm:p-4 text-center">
                    <p className="text-[10px] sm:text-[11px] uppercase sm:tracking-wider text-text-muted mb-1">Burn rate</p>
                    <p className="text-xl font-medium text-text-primary">{round1(perMin)}</p>
                    <p className="text-[10px] text-text-light">cal/min</p>
                  </div>
                  {distanceKm != null && (
                    <>
                      <div className="bg-cream border border-border px-2 py-4 sm:p-4 text-center">
                        <p className="text-[10px] sm:text-[11px] uppercase sm:tracking-wider text-text-muted mb-1">Distance</p>
                        <p className="text-xl font-medium text-text-primary">{round1(unit === 'imperial' ? kmhToMph(distanceKm) : distanceKm)}</p>
                        <p className="text-[10px] text-text-light">{unit === 'imperial' ? 'miles' : 'km'}</p>
                      </div>
                      <div className="bg-cream border border-border px-2 py-4 sm:p-4 text-center">
                        <p className="text-[10px] sm:text-[11px] uppercase sm:tracking-wider text-text-muted mb-1">Speed</p>
                        <p className="text-xl font-medium text-text-primary">{round1(kmhToMs(speedKmh))}</p>
                        <p className="text-[10px] text-text-light">m/s</p>
                      </div>
                    </>
                  )}
                </div>
                <p className="text-[12px] text-text-light mt-4 leading-relaxed">These are extra calories, on top of what you'd burn sitting still — the number to add to your day. Machine and watch displays usually show the bigger, total number.</p>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-5 sm:p-9">
                <h2 className="font-heading text-xl font-medium text-text-primary mb-2">{mode === 'burn' ? 'Same burn, other ways' : 'The same time, other ways'}</h2>
                <p className="text-text-muted text-[13px] mb-6">{mode === 'burn' ? `Minutes to burn ${Math.round(burned)} cal` : `Calories burned in ${Math.round(mins)} min`} at an easy, typical setting for each.</p>
                <div className="space-y-4">
                  {others.map(({ a, value }) => (
                    <div key={a.id}>
                      <div className="flex justify-between gap-3 text-[13px] mb-1.5">
                        <span className="text-text-primary">{a.label} <span className="text-text-light text-[11px]">· {typicalLabel(a, unit)}</span></span>
                        <span className="text-text-muted shrink-0">{value} {mode === 'burn' ? 'min' : 'cal'}</span>
                      </div>
                      <div className="w-full h-2 bg-cream border border-border overflow-hidden">
                        <div className={`h-full ${a.id === activityId ? 'bg-series-2' : 'bg-series-1'}`} style={{ width: `${(value / maxOther) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </>
          )}

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-5 sm:p-9">
            <h2 className="font-heading text-xl font-medium text-text-primary mb-6">How this calculator works</h2>
            <div className="space-y-6">
              <div>
                <p className="text-[13px] font-medium text-text-primary mb-1.5">Why walking is the move</p>
                <p className="text-[13px] text-text-muted leading-relaxed">If you want to lose fat faster, moving more beats eating less. Walking is the easiest place to start: it costs almost nothing in recovery, so it doesn't eat into your lifting, and you can do it every day. Harder cardio burns more per minute, but large amounts of it — running especially — can blunt muscle gains a little when stacked on top of lifting (Wilson et al. 2012), while walking and cycling interfere the least. Incline walking is a good middle ground: close to a jog's burn per minute, with walking's low impact.</p>
              </div>
              <div>
                <p className="text-[13px] font-medium text-text-primary mb-1.5">Extra calories, not total</p>
                <p className="text-[13px] text-text-muted leading-relaxed">Every number here is net: the calories you burn above what you'd burn sitting still for the same time. Your resting burn is already counted in your TDEE, so adding the total would count it twice and make cardio look 15–30% better than it is.</p>
              </div>
              <div>
                <p className="text-[13px] font-medium text-text-primary mb-1.5">Walking, running and cycling — ACSM equations</p>
                <p className="text-[13px] text-text-muted leading-relaxed">These use the American College of Sports Medicine's metabolic equations, which work straight from speed, incline and power. Walking costs about 0.1 ml of oxygen per kg per metre on the flat, plus 1.8 per metre of climb; running costs about double on the flat (0.2), plus 0.9 for climbing; cycling costs 1.8 ml per kg·m of work, plus the cost of pedalling itself. Every litre of oxygen is about 5 calories. Walking speeds are limited to {speedNum(activityById.walk.speedKmh.min, unit)}–{speedText(activityById.walk.speedKmh.max, unit)} and running to {speedNum(activityById.run.speedKmh.min, unit)}–{speedText(activityById.run.speedKmh.max, unit)}, the ranges these equations were built for.</p>
              </div>
              <div>
                <p className="text-[13px] font-medium text-text-primary mb-1.5">Everything else — the 2024 Compendium</p>
                <p className="text-[13px] text-text-muted leading-relaxed">Rowing, elliptical, stair climber, swimming and jump rope use MET values from the 2024 Adult Compendium of Physical Activities (Herrmann et al.), the standard research reference for the energy cost of activities. One MET is your resting burn, so we take one off each value before converting it to calories.</p>
              </div>
              <div>
                <p className="text-[13px] font-medium text-text-primary mb-1.5">How accurate is it?</p>
                <p className="text-[13px] text-text-muted leading-relaxed">Expect it to be within roughly 10–20% for most people. Fitness, technique, body size and how hard you're really pushing all shift the real number, and treadmill handrails or a sloppy rowing stroke cut it a lot. Treat it as a planning number, then let your weight trend over a few weeks tell you if it's working.</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
