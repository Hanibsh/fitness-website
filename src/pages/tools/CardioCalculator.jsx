import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import UnitHelp from '../../components/UnitHelp'
import PrefillNote from '../../components/PrefillNote'
import { usePrefillEffect } from '../../lib/profilePrefill'
import { convertMassText } from '../../lib/units'
import {
  CARDIO_ACTIVITIES, activityById, netKcalPerMin, netKcalPerMinFromHR, HR_BOUNDS, OUTDOOR_RUN_FROM_KMH,
  stairLevelToSpm, stairSpmToLevel, strokeById, splitToWatts, wattsToSplit,
  durationParts, formatDuration, kmhToMs, kmhToMph, mphToKmh,
} from '../../lib/cardio'

const inputBounds = {
  weight: { metric: { min: 20, max: 300 }, imperial: { min: 44, max: 660 } },
  age: { min: 15, max: 90 },
  kcal: { min: 10, max: 2000 },
  minutes: { min: 1, max: 300 },
}

const rowing = activityById.row
const stairs = activityById.stairs

// The setting each activity is compared at in "Same burn, other ways": its
// default speed, watts or level, or its easiest Compendium entry.
function typicalParams(a) {
  switch (a.kind) {
    case 'speed': return { speedKmh: a.speedKmh.default, gradePct: 0 }
    case 'watts':
    case 'row': return { watts: a.watts.default }
    case 'steps': return { spm: stairLevelToSpm(a.level.default) }
    case 'stroke': return { stroke: a.strokes[0].id, level: 0 }
    default: return { level: 0 }
  }
}

function typicalLabel(a, unit) {
  switch (a.kind) {
    case 'speed': return `${speedText(a.speedKmh.default, unit)}, flat`
    case 'watts':
    case 'row': return `${a.watts.default} W`
    case 'steps': return `level ${a.level.default}`
    case 'stroke': return `${a.strokes[0].label.toLowerCase()}, ${a.strokes[0].levels[0].label.toLowerCase()}`
    default: return a.levels[0].label.toLowerCase()
  }
}

const round1 = (n) => Math.round(n * 10) / 10
const speedNum = (kmh, unit) => round1(unit === 'imperial' ? kmhToMph(kmh) : kmh)
const speedText = (kmh, unit) => `${speedNum(kmh, unit)} ${unit === 'imperial' ? 'mph' : 'km/h'}`
const speedInUnit = (kmh, unit) => String(speedNum(kmh, unit))

// A rowing split as the monitor shows it ("2:05"), and back to seconds.
function splitText(sec) {
  const s = Math.round(sec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
function parseSplit(text) {
  const m = /^\s*(\d{1,2}):([0-5]?\d(?:\.\d+)?)\s*$/.exec(text)
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN
}

export default function CardioCalculator() {
  const [unit, setUnit] = useState('metric')
  const [weight, setWeight] = useState('')
  const [mode, setMode] = useState('burn')
  const [kcalGoal, setKcalGoal] = useState('250')
  const [minutesDone, setMinutesDone] = useState('30')
  const [activityId, setActivityId] = useState('walk')
  const [useHR, setUseHR] = useState(false)
  const [speed, setSpeed] = useState(speedInUnit(activityById.walk.speedKmh.default, 'metric'))
  const [grade, setGrade] = useState('0')
  const [outdoors, setOutdoors] = useState(false)
  const [watts, setWatts] = useState(String(activityById.bike.watts.default))
  const [rowBy, setRowBy] = useState('watts')
  const [rowWatts, setRowWatts] = useState(String(rowing.watts.default))
  const [rowSplit, setRowSplit] = useState(splitText(wattsToSplit(rowing.watts.default)))
  const [stairBy, setStairBy] = useState('level')
  const [stairLevel, setStairLevel] = useState(String(stairs.level.default))
  const [stairSpm, setStairSpm] = useState(String(Math.round(stairLevelToSpm(stairs.level.default))))
  const [stroke, setStroke] = useState('free')
  const [level, setLevel] = useState(0)
  const [hr, setHr] = useState('')
  const [age, setAge] = useState('')
  const [sex, setSex] = useState('male')

  const prefill = usePrefillEffect((p) => {
    if (p.unitSystem) {
      setUnit(p.unitSystem)
      setSpeed((v) => (p.unitSystem === 'imperial' && v !== '' ? speedInUnit(parseFloat(v), 'imperial') : v))
    }
    if (p.weight != null) setWeight((v) => (v === '' ? String(p.weight) : v))
    if (p.age != null) setAge((v) => (v === '' ? String(p.age) : v))
    if (p.sex) setSex(p.sex)
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
    // Carry the typed weight and speed across, so neither the person nor the
    // walk changes — 80 kg is 176.4 lbs, not 80 lbs.
    setWeight((v) => convertMassText(v, next === 'imperial'))
    const s = parseFloat(speed)
    if (s) setSpeed(String(round1(next === 'imperial' ? kmhToMph(s) : mphToKmh(s))))
    setUnit(next)
  }

  // Switching how a machine is described carries the effort across, so the
  // same row or climb shows in the other unit.
  function pickRowBy(next) {
    if (next === rowBy) return
    if (next === 'split') {
      const w = parseFloat(rowWatts)
      if (w > 0) setRowSplit(splitText(wattsToSplit(w)))
    } else {
      const sec = parseSplit(rowSplit)
      if (sec > 0) setRowWatts(String(Math.round(splitToWatts(sec))))
    }
    setRowBy(next)
  }

  function pickStairBy(next) {
    if (next === stairBy) return
    if (next === 'spm') {
      const l = parseFloat(stairLevel)
      if (l) setStairSpm(String(Math.round(stairLevelToSpm(l))))
    } else {
      const s = parseFloat(stairSpm)
      if (s) setStairLevel(String(Math.min(stairs.level.max, Math.max(stairs.level.min, Math.round(stairSpmToLevel(s))))))
    }
    setStairBy(next)
  }

  function pickStroke(id) {
    setStroke(id)
    setLevel((l) => Math.min(l, strokeById(activity, id).levels.length - 1))
  }

  // Validate everything the current activity and mode read; the first problem
  // wins, and results only show once there is none.
  const w = parseFloat(weight)
  const weightKg = unit === 'imperial' ? w * 0.453592 : w
  const speedKmh = unit === 'imperial' ? mphToKmh(parseFloat(speed)) : parseFloat(speed)
  const gradePct = parseFloat(grade) || 0
  const wattsN = parseFloat(watts)
  const rowSplitSec = parseSplit(rowSplit)
  const rowWattsN = rowBy === 'watts' ? parseFloat(rowWatts) : splitToWatts(rowSplitSec)
  const stairLevelN = parseFloat(stairLevel)
  const stairSpmN = stairBy === 'level' ? stairLevelToSpm(stairLevelN) : parseFloat(stairSpm)
  const hrN = parseFloat(hr)
  const ageN = parseFloat(age)
  const goal = parseFloat(kcalGoal)
  const mins = parseFloat(minutesDone)
  const weightRange = inputBounds.weight[unit]
  const weightUnitLabel = unit === 'imperial' ? 'lbs' : 'kg'
  const speedUnitLabel = unit === 'imperial' ? 'mph' : 'km/h'

  let error = ''
  if (!w) error = 'Enter your weight to see results.'
  else if (w < weightRange.min || w > weightRange.max) error = `Weight should be between ${weightRange.min} and ${weightRange.max} ${weightUnitLabel}.`
  else if (mode === 'burn' && (!goal || goal < inputBounds.kcal.min || goal > inputBounds.kcal.max)) error = `Calories should be between ${inputBounds.kcal.min} and ${inputBounds.kcal.max}.`
  else if (mode === 'time' && (!mins || mins < inputBounds.minutes.min || mins > inputBounds.minutes.max)) error = `Minutes should be between ${inputBounds.minutes.min} and ${inputBounds.minutes.max}.`
  else if (useHR) {
    if (!ageN) error = 'Enter your age to estimate from heart rate.'
    else if (ageN < inputBounds.age.min || ageN > inputBounds.age.max) error = `Age should be between ${inputBounds.age.min} and ${inputBounds.age.max}.`
    else if (!hrN) error = 'Enter your average heart rate.'
    else if (hrN < HR_BOUNDS.min || hrN > HR_BOUNDS.max) error = `Average heart rate should be between ${HR_BOUNDS.min} and ${HR_BOUNDS.max} bpm.`
  } else if (activity.kind === 'speed') {
    const lo = activity.speedKmh.min, hi = activity.speedKmh.max
    if (!speedKmh || speedKmh < lo - 0.05 || speedKmh > hi + 0.05) error = `${activity.label} speed should be between ${speedText(lo, unit)} and ${speedText(hi, unit)}.`
    else if (gradePct < 0 || gradePct > activity.grade.max) error = `Incline should be between 0 and ${activity.grade.max}%.`
  } else if (activity.kind === 'watts') {
    if (!wattsN || wattsN < activity.watts.min || wattsN > activity.watts.max) error = `Watts should be between ${activity.watts.min} and ${activity.watts.max}.`
  } else if (activity.kind === 'row') {
    const { min, max } = activity.watts
    if (rowBy === 'split' && !(rowSplitSec > 0)) error = 'Enter your split as minutes:seconds, like 2:05.'
    else if (rowBy === 'split' && (rowWattsN < min || rowWattsN > max)) error = `Split should be between ${splitText(wattsToSplit(max))} and ${splitText(wattsToSplit(min))} per 500 m.`
    else if (!rowWattsN || rowWattsN < min || rowWattsN > max) error = `Watts should be between ${min} and ${max}.`
  } else if (activity.kind === 'steps') {
    if (stairBy === 'level' && (!stairLevelN || stairLevelN < activity.level.min || stairLevelN > activity.level.max)) error = `Level should be between ${activity.level.min} and ${activity.level.max}.`
    else if (stairBy === 'spm' && (!stairSpmN || stairSpmN < activity.spm.min || stairSpmN > activity.spm.max)) error = `Steps per minute should be between ${activity.spm.min} and ${activity.spm.max}.`
  }

  let params = { level }
  if (activity.kind === 'speed') params = { speedKmh, gradePct, outdoors }
  else if (activity.kind === 'watts') params = { watts: wattsN }
  else if (activity.kind === 'row') params = { watts: rowWattsN }
  else if (activity.kind === 'steps') params = { spm: stairSpmN }
  else if (activity.kind === 'stroke') params = { stroke, level }

  let perMin = 0
  if (!error) {
    perMin = useHR
      ? netKcalPerMinFromHR({ hr: hrN, weightKg, age: ageN, sex })
      : netKcalPerMin(activityId, params, weightKg)
    // Keytel's equation is fitted on exercise; at a low heart rate for a
    // heavier body it falls to rest or below and stops meaning anything.
    if (useHR && perMin < 1) error = "At that heart rate the formula can't tell exercise from resting. Use your machine's settings instead."
  }
  const minutes = mode === 'burn' ? goal / perMin : mins
  const burned = mode === 'burn' ? goal : perMin * mins
  const distanceKm = activity.kind === 'speed' && !useHR ? (speedKmh * minutes) / 60 : null
  const timeShown = durationParts(minutes)

  const others = error ? [] : CARDIO_ACTIVITIES.map(a => {
    const rate = netKcalPerMin(a.id, typicalParams(a), weightKg)
    return { a, value: mode === 'burn' ? goal / rate : Math.round(rate * mins) }
  })
  const maxOther = Math.max(...others.map(o => o.value), 1)

  const toggle = (active, onClick, label) => (
    <button type="button" aria-pressed={active} onClick={onClick} className={`flex-1 py-3 text-[13px] font-medium border cursor-pointer transition-colors ${active ? 'bg-text-primary text-cream border-text-primary' : 'bg-white text-text-muted border-border hover:border-border-hover'}`}>{label}</button>
  )
  const chip = (active, onClick, label, sub) => (
    <button key={label} type="button" aria-pressed={active} onClick={onClick} className={`flex-1 px-1.5 py-2.5 border cursor-pointer transition-colors ${active ? 'bg-text-primary border-text-primary' : 'bg-white border-border hover:border-border-hover'}`}>
      <span className={`block text-[13px] font-medium ${active ? 'text-cream' : 'text-text-muted'}`}>{label}</span>
      {sub && <span className={`block text-[10px] ${active ? 'text-cream-70' : 'text-text-light'}`}>{sub}</span>}
    </button>
  )
  const fieldLabel = 'text-[11px] text-text-muted uppercase tracking-wider block mb-2'
  const fieldInput = 'w-full bg-cream border border-border px-4 py-3 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors'
  const hint = 'text-[11px] text-text-light mt-2 leading-relaxed'

  const effortLevels = activity.kind === 'stroke' ? strokeById(activity, stroke).levels : activity.levels

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

            <div className="space-y-4">
              <p className={fieldLabel}>What do you want to know?</p>
              <div className="flex gap-3 -mt-2">
                {toggle(mode === 'burn', () => setMode('burn'), 'Calories → time')}
                {toggle(mode === 'time', () => setMode('time'), 'Time → calories')}
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
                  {mins >= 60 && <p className={hint}>That's {formatDuration(mins)}.</p>}
                </div>
              )}
            </div>

            <div>
              <p className={fieldLabel}>Activity</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {CARDIO_ACTIVITIES.map(a => (
                  <button key={a.id} type="button" aria-pressed={activityId === a.id} onClick={() => pickActivity(a)} className={`px-2 py-3 text-[13px] font-medium border cursor-pointer transition-colors ${activityId === a.id ? 'bg-text-primary text-cream border-text-primary' : 'bg-white text-text-muted border-border hover:border-border-hover'}`}>{a.label}</button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <p className={fieldLabel}>Estimate from</p>
              <div className="flex gap-3 -mt-2">
                {toggle(!useHR, () => setUseHR(false), 'Settings')}
                {toggle(useHR, () => setUseHR(true), 'Heart rate')}
              </div>

              {useHR ? (
                <div className="space-y-4">
                  <div className="flex gap-3">
                    {toggle(sex === 'male', () => { prefill.touch(); setSex('male') }, 'Male')}
                    {toggle(sex === 'female', () => { prefill.touch(); setSex('female') }, 'Female')}
                  </div>
                  <div className="grid grid-cols-2 gap-4 items-end">
                    <div>
                      <label className={fieldLabel}>Age</label>
                      <input type="number" min={inputBounds.age.min} max={inputBounds.age.max} value={age} onChange={e => setAge(e.target.value)} placeholder="25" className={fieldInput} />
                    </div>
                    <div>
                      <label className={fieldLabel}>Avg heart rate (bpm)</label>
                      <input type="number" min={HR_BOUNDS.min} max={HR_BOUNDS.max} value={hr} onChange={e => setHr(e.target.value)} placeholder="130" className={fieldInput} />
                    </div>
                  </div>
                  <p className={hint}>Your average for the session, from a watch or chest strap. It works on any machine, which helps when the console has no watts or its levels don't mean the same thing between brands.</p>
                </div>
              ) : (
                <>
                  {activity.kind === 'speed' && (
                    <div className="space-y-4">
                      {activity.id === 'run' && (
                        <div className="flex gap-3">
                          {toggle(!outdoors, () => setOutdoors(false), 'Treadmill')}
                          {toggle(outdoors, () => setOutdoors(true), 'Outdoors')}
                        </div>
                      )}
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
                      {activity.id === 'run' && outdoors && (
                        <p className={hint}>Outdoors adds the air resistance a treadmill doesn't have, worth about 1% incline from {speedText(OUTDOOR_RUN_FROM_KMH, unit)} up. Slower than that, the two come out the same.</p>
                      )}
                      {activity.id === 'walk' && gradePct > 0 && (
                        <p className={hint}>Assumes your hands are off the rails. A light touch costs little, but leaning back on them cuts the burn a lot.</p>
                      )}
                    </div>
                  )}

                  {activity.kind === 'watts' && (
                    <div>
                      <label className={fieldLabel}>Power (watts)</label>
                      <input type="number" min={activity.watts.min} max={activity.watts.max} step={5} value={watts} onChange={e => setWatts(e.target.value)} className={fieldInput} />
                      <p className={hint}>Most bikes show watts on the console. Around 100 W is a steady, conversational ride for most people. No watts on yours? Use heart rate instead.</p>
                    </div>
                  )}

                  {activity.kind === 'row' && (
                    <div className="space-y-4">
                      <div className="flex gap-3">
                        {toggle(rowBy === 'watts', () => pickRowBy('watts'), 'Watts')}
                        {toggle(rowBy === 'split', () => pickRowBy('split'), 'Split /500 m')}
                      </div>
                      {rowBy === 'watts' ? (
                        <div>
                          <label className={fieldLabel}>Average watts</label>
                          <input type="number" min={activity.watts.min} max={activity.watts.max} step={5} value={rowWatts} onChange={e => setRowWatts(e.target.value)} className={fieldInput} />
                        </div>
                      ) : (
                        <div>
                          <label className={fieldLabel}>Average split (min:sec per 500 m)</label>
                          <input type="text" inputMode="decimal" value={rowSplit} onChange={e => setRowSplit(e.target.value)} placeholder="2:30" className={fieldInput} />
                        </div>
                      )}
                      <p className={hint}>
                        {rowWattsN > 0 && (rowBy === 'watts' ? `That's a ${splitText(wattsToSplit(rowWattsN))} split. ` : `That's ${Math.round(rowWattsN)} W. `)}
                        The damper setting doesn't change this: it changes how heavy each stroke feels, and watts already count the work you did.
                      </p>
                    </div>
                  )}

                  {activity.kind === 'steps' && (
                    <div className="space-y-4">
                      <div className="flex gap-3">
                        {toggle(stairBy === 'level', () => pickStairBy('level'), 'Level')}
                        {toggle(stairBy === 'spm', () => pickStairBy('spm'), 'Steps/min')}
                      </div>
                      {stairBy === 'level' ? (
                        <div>
                          <label className={fieldLabel}>Level ({activity.level.min}–{activity.level.max})</label>
                          <input type="number" min={activity.level.min} max={activity.level.max} step={1} value={stairLevel} onChange={e => setStairLevel(e.target.value)} className={fieldInput} />
                        </div>
                      ) : (
                        <div>
                          <label className={fieldLabel}>Steps per minute</label>
                          <input type="number" min={activity.spm.min} max={activity.spm.max} step={1} value={stairSpm} onChange={e => setStairSpm(e.target.value)} className={fieldInput} />
                        </div>
                      )}
                      <p className={hint}>
                        On a StairMaster the level is your stepping speed. Your bodyweight is the resistance, so there's no separate setting for it.
                        {stairBy === 'level' && stairSpmN > 0 && ` Level ${round1(stairLevelN)} is about ${Math.round(stairSpmN)} steps a minute. If your console shows steps per minute, that's more exact.`}
                        {' '}Leaning on the rails takes weight off your legs and cuts the burn.
                      </p>
                    </div>
                  )}

                  {activity.kind === 'stroke' && (
                    <div>
                      <p className={fieldLabel}>Stroke</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {activity.strokes.map(s => (
                          <button key={s.id} type="button" aria-pressed={stroke === s.id} onClick={() => pickStroke(s.id)} className={`px-2 py-2.5 text-[13px] font-medium border cursor-pointer transition-colors ${stroke === s.id ? 'bg-text-primary text-cream border-text-primary' : 'bg-white text-text-muted border-border hover:border-border-hover'}`}>{s.label}</button>
                        ))}
                      </div>
                    </div>
                  )}

                  {(activity.kind === 'level' || activity.kind === 'stroke') && effortLevels.length > 1 && (
                    <div>
                      <p className={fieldLabel}>Effort</p>
                      <div className="flex gap-2">
                        {effortLevels.map((l, i) => chip(level === i, () => setLevel(i), l.label, l.sub))}
                      </div>
                      {activity.id === 'elliptical' && (
                        <p className={hint}>Resistance levels and console watts aren't the same from one brand to the next, so this goes by effort. Heart rate is more exact if you have it.</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {error && <p className="text-[13px] text-text-muted">{error}</p>}
          </div>

          {!error && (
            <>
              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-5 sm:p-9">
                <h2 className="font-heading text-xl font-medium text-text-primary mb-6">Your result</h2>
                <div className="bg-text-primary p-5 text-center mb-4">
                  <p className="text-[11px] uppercase tracking-wider mb-1.5 text-cream-70">{mode === 'burn' ? `To burn ${Math.round(burned)} cal` : `In ${formatDuration(minutes)}`}</p>
                  <p className="text-4xl font-medium text-cream">{mode === 'burn' ? timeShown.value : Math.round(burned)}</p>
                  <p className="text-[11px] text-cream-50">{mode === 'burn' ? (timeShown.unit === 'hr' ? 'hr:min' : 'minutes') : 'extra calories burned'}</p>
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
                <p className="text-text-muted text-[13px] mb-6">{mode === 'burn' ? `Time to burn ${Math.round(burned)} cal` : `Calories burned in ${formatDuration(mins)}`} at an easy, typical setting for each.</p>
                <div className="space-y-4">
                  {others.map(({ a, value }) => (
                    <div key={a.id}>
                      <div className="flex justify-between gap-3 text-[13px] mb-1.5">
                        <span className="text-text-primary">{a.label} <span className="text-text-light text-[11px]">· {typicalLabel(a, unit)}</span></span>
                        <span className="text-text-muted shrink-0">{mode === 'burn' ? formatDuration(value) : `${value} cal`}</span>
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
                <p className="text-[13px] text-text-muted leading-relaxed">These use the American College of Sports Medicine's metabolic equations, which work straight from speed, incline and power. Walking costs about 0.1 ml of oxygen per kg per metre on the flat, plus 1.8 per metre of climb; running costs about double on the flat (0.2), plus 0.9 for climbing; cycling costs 1.8 ml per kg·m of work, plus the cost of pedalling itself. Every litre of oxygen is about 5 calories. Walking speeds are limited to {speedNum(activityById.walk.speedKmh.min, unit)}–{speedText(activityById.walk.speedKmh.max, unit)} and running to {speedNum(activityById.run.speedKmh.min, unit)}–{speedText(activityById.run.speedKmh.max, unit)}, the ranges these equations were built for. Running outside from {speedText(OUTDOOR_RUN_FROM_KMH, unit)} up gets an extra 1% incline for air resistance (Jones & Doust 1996).</p>
              </div>
              <div>
                <p className="text-[13px] font-medium text-text-primary mb-1.5">Stair climber — the cost of the climb</p>
                <p className="text-[13px] text-text-muted leading-relaxed">A stair climber's level is its speed. Your bodyweight is the load, so it has no separate resistance setting. StairMaster's StepMill and Gauntlet run {stairs.spm.min}–{stairs.spm.max} steps a minute across levels {stairs.level.min}–{stairs.level.max} on 8-inch (20 cm) steps, and we space the levels evenly across that range. What it costs is lifting your body: the ACSM charges 1.8 ml of oxygen per kg for every metre you climb. That lands right on the Compendium's 9.3 METs for a general stair-climber session at about 79 steps a minute (around level 8), so the two sources agree.</p>
              </div>
              <div>
                <p className="text-[13px] font-medium text-text-primary mb-1.5">Rowing — Concept2's formula</p>
                <p className="text-[13px] text-text-muted leading-relaxed">Rowing uses the formula Concept2 builds into its monitor: about 4 calories burned for every calorie of work you put into the handle, plus a fixed cost for moving your body up and down the slide. Concept2 scales that cost to your weight (1.714 cal an hour per lb). Your split and your watts are the same number in different units (watts = 2.80 ÷ seconds-per-metre³). The damper only changes how heavy each stroke feels. Watts already count the work, so it isn't an input.</p>
              </div>
              <div>
                <p className="text-[13px] font-medium text-text-primary mb-1.5">Heart rate — Keytel et al. 2005</p>
                <p className="text-[13px] text-text-muted leading-relaxed">With heart rate on, the estimate comes from Keytel et al.'s equations, which predict calories from heart rate, weight, age and sex, with one equation for men and one for women. They were built on steady exercise, so they need a working heart rate ({HR_BOUNDS.min}–{HR_BOUNDS.max} bpm). Use it when your machine's settings don't translate between brands, like an elliptical's resistance levels or a spin bike with no watts readout.</p>
              </div>
              <div>
                <p className="text-[13px] font-medium text-text-primary mb-1.5">Everything else — the 2024 Compendium</p>
                <p className="text-[13px] text-text-muted leading-relaxed">Elliptical, swimming (by stroke) and jump rope use MET values from the 2024 Adult Compendium of Physical Activities (Herrmann et al.), the standard research reference for the energy cost of activities. One MET is your resting burn, so we take one off each value before converting it to calories.</p>
              </div>
              <div>
                <p className="text-[13px] font-medium text-text-primary mb-1.5">How accurate is it?</p>
                <p className="text-[13px] text-text-muted leading-relaxed">Expect it to be within roughly 10–20% for most people. Fitness, technique, body size and how hard you're really pushing all shift the real number, and leaning on handrails cuts it a lot. Treat it as a planning number, then let your weight trend over a few weeks tell you if it's working.</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
