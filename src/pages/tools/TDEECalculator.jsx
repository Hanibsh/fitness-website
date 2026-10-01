import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Minus, Plus, Lock, LockOpen } from 'lucide-react'
import { Link } from 'react-router-dom'
import UnitHelp from '../../components/UnitHelp'
import PrefillNote from '../../components/PrefillNote'
import { bodyFatBounds, nearestBodyFatLabel } from '../../lib/bodyFat'
import { usePrefillEffect } from '../../lib/profilePrefill'
import { asset } from '../../lib/assets'
import { proteinRange, macroSplit, macroLimits, shiftMacro, MACRO_STEP_PCT, FAT_CEILING_PCT, CARB_NOTE_BELOW_G } from '../../lib/macros'
import { macroFoods, foodKcal } from '../../data/macroFoods'
import { CARDIO_PRESETS, netKcalPerMin, netKcalPerStep, kmhToMph } from '../../lib/cardio'

const loseSpeeds = [
  { id: 'lose-slow', label: 'Slow', percent: 0.25 },
  { id: 'lose-moderate', label: 'Moderate', percent: 0.5 },
  { id: 'lose-fast', label: 'Fast', percent: 1 },
]

const gainOptions = [
  { id: 'gain-lean', label: 'Lean bulk', sub: 'minimal fat gain', delta: 200 },
  { id: 'gain-normal', label: 'Normal bulk', sub: 'moderate fat gain', delta: 500 },
]

// `posture` is how the macro split leans for this target (see lib/macros) —
// the slow fat-loss recomp is still a deficit, so it eats like a cut.
const recompOptions = [
  { id: 'recomp-maintain', label: 'Maintain', delta: 0, posture: 'recomp' },
  { id: 'recomp-muscle', label: 'Muscle-gain focus', delta: 150, posture: 'recomp' },
  { id: 'recomp-fat', label: 'Fat-loss focus', percent: 0.35, posture: 'cut' },
]

// Which target a profile goal starts on, before anyone taps a card.
const GOAL_DEFAULT_TARGET = { lose_fat: 'lose-moderate', gain_muscle: 'gain-lean', recomp: 'recomp-maintain' }
const DEFAULT_TARGET = 'recomp-maintain'

const deficitKcal = (weightKg, percent) => Math.round((weightKg * (percent / 100) * 7700) / 7)

// No deficit target goes below this. Under it, protein, vitamins and the rest
// get genuinely hard to cover; past this point a faster pace has to come from
// moving more, not eating less.
const CALORIE_FLOOR = { male: 1500, female: 1400 }

// Lifting's cost as a gross MET (moderate-to-vigorous resistance training).
// One of those METs is just resting, which BMR already counts, so only the
// rest goes into the exercise slice — the same net rule as steps and cardio.
const WORKOUT_MET = 6.3

// A deficit target held at the floor. `moveKcal` is the part of the deficit the
// floor stops eating from covering, which has to be burned with extra movement.
function deficitTarget(tdee, weightKg, percent, sex) {
  const ideal = tdee - deficitKcal(weightKg, percent)
  const kcal = Math.max(ideal, CALORIE_FLOOR[sex])
  return { kcal, floored: kcal > ideal, moveKcal: kcal - ideal }
}

// Every calorie target on the page, keyed by id, so the cards and the macro
// split read the same numbers.
function calorieTargets({ tdee, weightKg, sex }) {
  const list = [
    ...loseSpeeds.map(s => ({ id: s.id, name: `${s.label} cut`, ...deficitTarget(tdee, weightKg, s.percent, sex), posture: 'cut' })),
    ...gainOptions.map(g => ({ id: g.id, name: g.label, kcal: tdee + g.delta, posture: 'bulk' })),
    ...recompOptions.map(r => ({ id: r.id, name: `Recomp (${r.label.toLowerCase()})`, ...(r.percent ? deficitTarget(tdee, weightKg, r.percent, sex) : { kcal: tdee + r.delta }), posture: r.posture })),
  ]
  return Object.fromEntries(list.map(t => [t.id, t]))
}

const macroMeta = {
  protein: { label: 'Protein', color: 'bg-series-1', kcalPerG: 4 },
  carbs: { label: 'Carbs', color: 'bg-series-2', kcalPerG: 4 },
  fat: { label: 'Fat', color: 'bg-series-3', kcalPerG: 9 },
}

const inputBounds = {
  age: { min: 10, max: 100 },
  weight: { metric: { min: 20, max: 300 }, imperial: { min: 44, max: 660 } },
  height: { metric: { min: 100, max: 250 }, imperial: { min: 39, max: 98 } },
  workoutHours: { min: 0, max: 40 },
  stepsPerDay: { min: 0, max: 50000 },
}

// Walking levers use the same net walking cost as the cardio calculator and
// the step-based NEAT estimate, so all three agree.
const neatLevers = [
  { label: 'Walk 30 min more (5 km/h)', calc: (r) => 30 * netKcalPerMin('walk', { speedKmh: 5, gradePct: 0 }, r.weightKg) },
  { label: 'Stand 2 hours more instead of sitting', calc: (r) => 18 * (r.weightKg / 70) },
  { label: 'General more active lifestyle (+2,000 steps/day)', calc: (r) => 2000 * r.kcalPerStep },
]

export default function TDEECalculator() {
  const [unit, setUnit] = useState('metric')
  const [sex, setSex] = useState('male')
  const [bodyFat, setBodyFat] = useState(bodyFatBounds.male.default)
  const [age, setAge] = useState('')
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [workoutHours, setWorkoutHours] = useState('')
  const [stepsPerDay, setStepsPerDay] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [targetId, setTargetId] = useState(null)
  const [burnChoice, setBurnChoice] = useState(250)
  // A hand-adjusted split, as calories per macro, for one target only:
  // switching targets (or recalculating) falls back to the suggestion.
  const [adjust, setAdjust] = useState({ target: null, kcal: null })
  const [locked, setLocked] = useState([])

  // Seed from the profile. Unit goes first: a height in cm would fail the
  // imperial bounds. Text fields only fill while still empty, so a value typed
  // before the profile arrived survives.
  const prefill = usePrefillEffect((p) => {
    if (p.goal) setTargetId((v) => v ?? GOAL_DEFAULT_TARGET[p.goal])
    if (p.unitSystem) setUnit(p.unitSystem)
    if (p.sex) { setSex(p.sex); setBodyFat(bodyFatBounds[p.sex].default) }
    if (p.age != null) setAge((v) => (v === '' ? String(p.age) : v))
    if (p.weight != null) setWeight((v) => (v === '' ? String(p.weight) : v))
    if (p.height != null) setHeight((v) => (v === '' ? String(p.height) : v))
  })

  function calculate() {
    const w = parseFloat(weight), h = parseFloat(height), a = parseInt(age)
    const hours = parseFloat(workoutHours) || 0
    const steps = parseFloat(stepsPerDay) || 0
    if (!w || !h || !a) {
      setError('Enter your age, weight, and height to calculate.')
      setResult(null)
      return
    }

    const weightRange = inputBounds.weight[unit]
    const heightRange = inputBounds.height[unit]
    const weightUnitLabel = unit === 'imperial' ? 'lbs' : 'kg'
    const heightUnitLabel = unit === 'imperial' ? 'in' : 'cm'

    if (a < inputBounds.age.min || a > inputBounds.age.max) {
      setError(`Age should be between ${inputBounds.age.min} and ${inputBounds.age.max}.`)
      setResult(null)
      return
    }
    if (w < weightRange.min || w > weightRange.max) {
      setError(`Weight should be between ${weightRange.min} and ${weightRange.max} ${weightUnitLabel}.`)
      setResult(null)
      return
    }
    if (h < heightRange.min || h > heightRange.max) {
      setError(`Height should be between ${heightRange.min} and ${heightRange.max} ${heightUnitLabel}.`)
      setResult(null)
      return
    }
    if (hours < inputBounds.workoutHours.min || hours > inputBounds.workoutHours.max) {
      setError(`Workout hours should be between ${inputBounds.workoutHours.min} and ${inputBounds.workoutHours.max}.`)
      setResult(null)
      return
    }
    if (steps < inputBounds.stepsPerDay.min || steps > inputBounds.stepsPerDay.max) {
      setError(`Steps per day should be between ${inputBounds.stepsPerDay.min} and ${inputBounds.stepsPerDay.max}.`)
      setResult(null)
      return
    }
    setError('')
    setAdjust({ target: null, kcal: null })

    const weightKg = unit === 'imperial' ? w * 0.453592 : w

    const lbm = weightKg * (1 - bodyFat / 100)
    const sexConstant = sex === 'male' ? 5 : -161
    const bmrRaw = 370 + 21.6 * lbm + sexConstant
    const ageDecline = a > 60 ? 0.007 * (a - 60) : 0
    const bmr = bmrRaw * (1 - ageDecline)

    const heightCm = unit === 'imperial' ? h * 2.54 : h
    const kcalPerStep = netKcalPerStep(weightKg, heightCm, sex)
    const neat = steps * kcalPerStep
    const exercise = (hours / 7) * (WORKOUT_MET - 1) * weightKg
    const tef = 0.1 * (bmr + neat + exercise)
    const tdee = bmr + neat + exercise + tef

    setResult({
      lbm: Math.round(lbm),
      lbmKg: lbm,
      ageAdjustment: Math.round(bmrRaw - bmr),
      bmr: Math.round(bmr),
      neat: Math.round(neat),
      exercise: Math.round(exercise),
      tef: Math.round(tef),
      tdee: Math.round(tdee),
      weightKg,
      kcalPerStep,
      age: a,
      sex,
      protein: proteinRange({ lbmKg: lbm, bodyFat, trainingHours: hours, age: a }),
    })
  }

  const toggle = (active, onClick, label) => (
    <button onClick={onClick} className={`flex-1 py-3 text-[13px] font-medium border cursor-pointer transition-colors ${active ? 'bg-text-primary text-cream border-text-primary' : 'bg-white text-text-muted border-border hover:border-border-hover'}`}>{label}</button>
  )

  // Series slots in order — the four components are different things, not
  // degrees of one thing, so each gets its own hue rather than a step of a grey
  // ramp (which buried TEF against the card and made BMR and NEAT twins).
  const breakdown = result ? [
    { label: 'BMR', value: result.bmr, color: 'bg-series-1', typicalRange: '50-70%' },
    { label: 'NEAT', value: result.neat, color: 'bg-series-2', typicalRange: '5-20%' },
    { label: 'Exercise', value: result.exercise, color: 'bg-series-3', typicalRange: '5-15%' },
    { label: 'TEF', value: result.tef, color: 'bg-series-4', typicalRange: '10-15%' },
  ] : []

  const targets = result ? calorieTargets(result) : null
  const selected = targets ? targets[targetId ?? DEFAULT_TARGET] : null
  const split = selected ? macroSplit({ kcal: selected.kcal, posture: selected.posture, weightKg: result.weightKg, sex: result.sex, protein: result.protein }) : null
  const suggestedKcal = split ? Object.fromEntries(Object.entries(macroMeta).map(([key, m]) => [key, split[key].target * m.kcalPerG])) : null
  const currentKcal = split && adjust.target === selected.id && adjust.kcal ? adjust.kcal : suggestedKcal
  const adjusted = currentKcal !== suggestedKcal
  const limits = split ? macroLimits(split, { kcal: selected.kcal, lbmKg: result.lbmKg }) : null
  const macroStep = selected ? selected.kcal * MACRO_STEP_PCT : 0
  const nudged = (key, dir) => shiftMacro(currentKcal, limits, key, dir * macroStep, locked)
  const nudge = (key, dir) => {
    const next = nudged(key, dir)
    if (next) setAdjust({ target: selected.id, kcal: next })
  }
  const toggleLock = (key) => setLocked(l => (l.includes(key) ? l.filter(k => k !== key) : [...l, key]))
  const macros = split ? Object.entries(macroMeta).map(([key, m]) => {
    const target = Math.round(currentKcal[key] / m.kcalPerG)
    return { key, ...m, target, diff: target - Math.round(split[key].target), min: Math.round(split[key].min), max: Math.round(split[key].max), kcal: target * m.kcalPerG }
  }) : []
  // Why a button stopped working: one line per macro sitting on a limit.
  const atLow = (key) => currentKcal[key] - limits[key].lo < 1
  const atHigh = (key) => limits[key].hi - currentKcal[key] < 1
  const carbsLow = split && currentKcal.carbs / 4 < CARB_NOTE_BELOW_G
  const limitNotes = split ? [
    atLow('protein') && 'Protein is at the bottom of your range. Going lower starts to cost muscle.',
    atHigh('protein') && 'Protein is at its ceiling. Past this it gets burned as fuel, not built into muscle.',
    atLow('fat') && 'Fat is at your essential minimum.',
    atHigh('fat') && `Fat is at ${Math.round(FAT_CEILING_PCT * 100)}% of your calories, the most this goes.`,
    atLow('carbs') && !carbsLow && `Carbs are at ${CARB_NOTE_BELOW_G}g, the lowest this goes. That's roughly what your brain alone runs on.`,
  ].filter(Boolean) : []
  const macroKcal = macros.reduce((sum, m) => sum + m.kcal, 0)
  // Grams per unit of bodyweight, in the unit the person typed their weight in.
  const perBodyweight = (grams) => unit === 'imperial'
    ? `${(grams / (result.weightKg / 0.453592)).toFixed(2)} g/lb`
    : `${(grams / result.weightKg).toFixed(1)} g/kg`

  // The "burn more" box: a few set amounts, plus the selected target's floor
  // gap when it has one. A remembered "gap" choice falls back once it's gone.
  const burnOptions = [200, 250, 300].map(v => ({ value: v, label: `${v} cal` }))
  if (selected?.floored) burnOptions.push({ value: 'gap', label: `Gap ${selected.moveKcal}` })
  const burn = burnOptions.some(o => o.value === burnChoice) ? burnChoice : 250
  const burnKcal = burn === 'gap' ? selected.moveKcal : burn
  const speedLabel = (kmh) => unit === 'imperial' ? `${(Math.round(kmhToMph(kmh) * 10) / 10)} mph` : `${kmh} km/h`
  const cardioRows = result ? CARDIO_PRESETS.map(p => ({
    id: p.id,
    label: p.label,
    detail: p.params.watts ? `${p.params.watts} W` : `${speedLabel(p.params.speedKmh)}${p.params.gradePct ? `, ${p.params.gradePct}% incline` : ', flat'}`,
    minutes: Math.round(burnKcal / netKcalPerMin(p.activity, p.params, result.weightKg)),
  })) : []

  // A tappable calorie target; the selected one drives the macro split.
  const targetCard = (id, title, sub) => {
    const on = selected?.id === id
    return (
      <button key={id} type="button" aria-pressed={on} onClick={() => setTargetId(id)} className={`px-1.5 py-4 sm:p-4 text-center border cursor-pointer transition-colors ${on ? 'bg-text-primary border-text-primary' : 'bg-cream border-border hover:border-border-hover'}`}>
        <p className={`text-[10px] sm:text-[11px] uppercase sm:tracking-wider mb-2 ${on ? 'text-cream-70' : 'text-text-muted'}`}>{title}{sub && <><br /><span className={on ? 'text-cream-50' : 'text-text-light'}>{sub}</span></>}</p>
        <p className={`text-xl font-medium ${on ? 'text-cream' : 'text-text-primary'}`}>{targets[id].kcal}</p>
        <p className={`text-[10px] ${on ? 'text-cream-50' : 'text-text-light'}`}>cal/day</p>
        {targets[id].floored && <p className={`text-[10px] uppercase sm:tracking-wider mt-1 ${on ? 'text-cream-70' : 'text-text-muted'}`}>Floor</p>}
      </button>
    )
  }

  // Under a section whose deficit targets hit the floor: what extra movement
  // keeps each pace, in steps — the floor never just silently slows the cut.
  // `brief` drops the explanation for Recomp: its fat-loss pace sits between
  // Slow and Moderate, so whenever it's floored the Lose note is already up.
  const floorNote = (options, brief = false) => {
    const held = options.filter(o => targets[o.id].floored)
    if (!held.length) return null
    const floor = CALORIE_FLOOR[result.sex]
    const steps = (kcal) => (Math.round(kcal / result.kcalPerStep / 500) * 500).toLocaleString()
    return (
      <div className="text-[13px] text-text-muted mt-6 leading-relaxed space-y-3">
        {brief ? null : result.tdee <= floor ? (
          <p>You burn about {result.tdee} cal a day, which is already at or under the {floor} cal/day floor — eating less isn't a safe lever for you. Any deficit has to come from moving more, so the targets marked "floor" hold you at {floor} and the pace comes from extra steps.</p>
        ) : (
          <p>Targets marked "floor" would put you under {floor} cal/day, which makes protein, vitamins and everything else hard to cover. They're held at {floor} instead, and the rest of the deficit comes from moving more.</p>
        )}
        <ul className="space-y-1">
          {held.map(o => (
            <li key={o.id}><strong className="text-text-primary">{o.label}{brief && ' (held at the floor)'}:</strong> burn about {targets[o.id].moveKcal} cal more a day — roughly {steps(targets[o.id].moveKcal)} extra steps.</li>
          ))}
        </ul>
        {!brief && <p>If that's more walking than you can realistically fit in, pick a slower pace. It's the better trade over eating less.</p>}
      </div>
    )
  }

  const fatCalConst = unit === 'imperial' ? '3,500' : '7,700'
  const fatUnitLabel = unit === 'imperial' ? 'pound' : 'kilogram'
  const lightExample = unit === 'imperial' ? '110 lb' : '50 kg'
  const heavyExample = unit === 'imperial' ? '265 lb' : '120 kg'

  return (
    <div className="pt-28 pb-24 px-6">
      <div className="max-w-2xl mx-auto">
        <Link to="/tools" className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary no-underline text-[13px] mb-10 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to tools
        </Link>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-heading text-4xl font-medium text-text-primary mb-3">TDEE calculator</h1>
          <p className="text-text-muted text-[15px] mb-10">Find out how many calories you burn per day, and how to adjust intake and split it into protein, fat and carbs to hit your goal.</p>

          <div className="bg-white border border-border p-5 sm:p-9 space-y-7">
            <div className="flex gap-3 items-center">
              {toggle(unit === 'metric', () => { prefill.touch(); setUnit('metric') }, 'Metric (kg/cm)')}
              {toggle(unit === 'imperial', () => { prefill.touch(); setUnit('imperial') }, 'Imperial (lbs/in)')}
              <UnitHelp />
            </div>
            <div className="flex gap-3">
              {toggle(sex === 'male', () => { prefill.touch(); setSex('male'); setBodyFat(bodyFatBounds.male.default) }, 'Male')}
              {toggle(sex === 'female', () => { prefill.touch(); setSex('female'); setBodyFat(bodyFatBounds.female.default) }, 'Female')}
            </div>
            <PrefillNote from={prefill.from} />

            <div>
              <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-3">Estimate your body fat %</label>
              <img src={asset('images/bodyfat-chart.jpeg')} alt="Body fat percentage reference chart" className="w-full border border-border mb-5" />
              <div className="flex items-baseline justify-between mb-3">
                <span className="text-[13px] text-text-muted">≈ {nearestBodyFatLabel(sex, bodyFat)}</span>
                <span className="text-2xl font-medium text-text-primary">{bodyFat}%</span>
              </div>
              <input
                type="range"
                aria-label="Body fat percentage"
                min={bodyFatBounds[sex].min}
                max={bodyFatBounds[sex].max}
                step={1}
                value={bodyFat}
                onChange={e => setBodyFat(Number(e.target.value))}
                style={{ backgroundImage: `linear-gradient(to right, var(--color-text-primary) ${((bodyFat - bodyFatBounds[sex].min) / (bodyFatBounds[sex].max - bodyFatBounds[sex].min)) * 100}%, var(--color-cream) 0%)` }}
                className="w-full h-2 border border-border appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-text-primary [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-text-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:bg-text-primary [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-text-light mt-2">
                <span>{bodyFatBounds[sex].min}%</span>
                <span>{bodyFatBounds[sex].max}%</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 items-end">
              {[['Age', age, setAge, '25', inputBounds.age.min, inputBounds.age.max], ['Weight', weight, setWeight, unit === 'metric' ? '80' : '176', inputBounds.weight[unit].min, inputBounds.weight[unit].max], ['Height', height, setHeight, unit === 'metric' ? '180' : '71', inputBounds.height[unit].min, inputBounds.height[unit].max]].map(([label, val, set, ph, min, max]) => (
                <div key={label}>
                  <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-2">{label}{label !== 'Age' ? ` (${label === 'Weight' ? (unit === 'metric' ? 'kg' : 'lbs') : (unit === 'metric' ? 'cm' : 'in')})` : ''}</label>
                  <input type="number" min={min} max={max} value={val} onChange={e => set(e.target.value)} placeholder={ph} className="w-full bg-cream border border-border px-4 py-3 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors" />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4 items-end">
              <div>
                <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-2">Workout (hrs/week)</label>
                <input type="number" min={inputBounds.workoutHours.min} max={inputBounds.workoutHours.max} value={workoutHours} onChange={e => setWorkoutHours(e.target.value)} placeholder="4" className="w-full bg-cream border border-border px-4 py-3 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors" />
              </div>
              <div>
                <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-2">Steps (per day)</label>
                <input type="number" min={inputBounds.stepsPerDay.min} max={inputBounds.stepsPerDay.max} step={1000} value={stepsPerDay} onChange={e => setStepsPerDay(e.target.value)} placeholder="10000" className="w-full bg-cream border border-border px-4 py-3 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors" />
              </div>
            </div>

            {error && <p className="text-[13px] text-red-600">{error}</p>}

            <button onClick={calculate} className="w-full bg-text-primary text-cream font-medium py-3.5 border-none cursor-pointer text-[14px] hover:bg-accent-hover transition-colors">
              Calculate TDEE
            </button>
          </div>

          {result && (
            <>
              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-5 sm:p-9">
                <h2 className="font-heading text-xl font-medium text-text-primary mb-6">Your results</h2>
                <div className="grid grid-cols-3 gap-2 sm:gap-4">
                  {[['LBM', result.lbm], ['BMR', result.bmr], ['TDEE', result.tdee]].map(([label, val], i) => (
                    <div key={label} className={`px-2 py-4 sm:p-5 text-center ${i === 2 ? 'bg-text-primary' : 'bg-cream border border-border'}`}>
                      <p className={`text-[11px] uppercase tracking-wider mb-1.5 ${i === 2 ? 'text-cream-70' : 'text-text-muted'}`}>{label}</p>
                      <p className={`text-2xl sm:text-3xl font-medium ${i === 2 ? 'text-cream' : 'text-text-primary'}`}>{val}</p>
                      <p className={`text-[11px] ${i === 2 ? 'text-cream-50' : 'text-text-light'}`}>{label === 'LBM' ? 'kg' : 'cal/day'}</p>
                    </div>
                  ))}
                </div>
                {result.ageAdjustment > 0 && (
                  <p className="text-[13px] text-text-muted mt-6 leading-relaxed">Research shows resting metabolism declines by about 0.7% per year after age 60, independent of muscle loss. That's already factored in above — it's shaving <strong className="text-text-primary">{result.ageAdjustment} cal/day</strong> off your BMR. Prioritizing protein intake and resistance training helps preserve lean mass on top of that.</p>
                )}
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-5 sm:p-9">
                <h2 className="font-heading text-xl font-medium text-text-primary mb-2">Lose weight</h2>
                <p className="text-text-muted text-[13px] mb-3">Deficits scaled to your bodyweight — a fixed kcal number doesn't make sense for everyone at the same rate. Tap any target on this page to see its macros below.</p>
                <p className="text-text-muted text-[13px] mb-6 leading-relaxed">Want it faster? <strong className="text-text-primary">Move more rather than eat less.</strong> Walking more and adding some cardio keeps your food — and your protein, energy and training — intact while the deficit grows.</p>
                <div className="grid grid-cols-3 gap-2 sm:gap-4">
                  {loseSpeeds.map(s => targetCard(s.id, s.label, `${s.percent}% BW/week`))}
                </div>
                {floorNote(loseSpeeds)}
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-5 sm:p-9">
                <h2 className="font-heading text-xl font-medium text-text-primary mb-2">Burn more instead of eating less</h2>
                <p className="text-text-muted text-[13px] mb-6 leading-relaxed">How long it takes you, at your weight, to burn a little extra. These are extra calories on top of your normal day, so they add straight to your deficit.</p>
                <div className="flex gap-2 mb-6">
                  {burnOptions.map(o => (
                    <button key={o.value} type="button" aria-pressed={burn === o.value} onClick={() => setBurnChoice(o.value)} className={`flex-1 py-2.5 text-[13px] font-medium border cursor-pointer transition-colors ${burn === o.value ? 'bg-text-primary text-cream border-text-primary' : 'bg-white text-text-muted border-border hover:border-border-hover'}`}>{o.label}</button>
                  ))}
                </div>
                <div className="space-y-3">
                  {cardioRows.map(r => (
                    <div key={r.id} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-text-primary">{r.label}</p>
                        <p className="text-[11px] text-text-light">{r.detail}</p>
                      </div>
                      <span className="text-[13px] text-text-muted shrink-0"><strong className="text-text-primary font-medium">{r.minutes}</strong> min</span>
                    </div>
                  ))}
                </div>
                <p className="text-[13px] text-text-muted mt-6 leading-relaxed">More activities, your own speed and incline, or what a session burned: <Link to="/tools/cardio" className="text-text-primary underline">cardio calculator</Link>.</p>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-5 sm:p-9">
                <h2 className="font-heading text-xl font-medium text-text-primary mb-2">Gain weight</h2>
                <p className="text-text-muted text-[13px] mb-6">Pick how much fat gain you're willing to trade for faster muscle growth.</p>
                <div className="grid grid-cols-2 gap-2 sm:gap-4">
                  {gainOptions.map(g => targetCard(g.id, g.label, g.sub))}
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-5 sm:p-9">
                <h2 className="font-heading text-xl font-medium text-text-primary mb-2">Recomp</h2>
                <p className="text-text-muted text-[13px] mb-6 leading-relaxed">Eating close to maintenance while training hard and eating enough protein lets you build muscle and lose fat at the same time — no dedicated cut/bulk cycling needed. Pick a lean depending on what you want more of: hold steady, lean into muscle with a very clean bulk, or lean into fat loss at a slow, sustainable pace.</p>
                <div className="grid grid-cols-3 gap-2 sm:gap-4">
                  {recompOptions.map(r => targetCard(r.id, r.label))}
                </div>
                {floorNote(recompOptions, true)}
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-5 sm:p-9">
                <h2 className="font-heading text-xl font-medium text-text-primary mb-2">Your macros</h2>
                <p className="text-text-muted text-[13px] mb-6 leading-relaxed">For <strong className="text-text-primary">{selected.name}</strong> at {selected.kcal} cal/day{selected.floored && ' (held at the floor, with the rest of the deficit coming from extra steps)'}. Tap any calorie target above to switch. Aim for the big number; anywhere in the range underneath works.</p>
                <div className="grid grid-cols-3 gap-2 sm:gap-4">
                  {macros.map(m => (
                    <div key={m.key} className="bg-cream border border-border px-2 py-4 sm:p-5 text-center">
                      <span className={`block w-6 h-1 mx-auto mb-2.5 ${m.color}`} />
                      <p className="text-[10px] sm:text-[11px] uppercase sm:tracking-wider text-text-muted mb-1.5">{m.label}</p>
                      <p className="text-2xl sm:text-3xl font-medium text-text-primary">{m.target}<span className="text-[13px] font-normal text-text-muted">g</span></p>
                      {/* Only fat can collapse to one number: when the essential
                          floor outweighs its whole percentage band. */}
                      <p className="text-[11px] text-text-light">{m.min === m.max ? 'essential minimum' : `${m.min}–${m.max}g`}</p>
                      <p className="text-[11px] text-text-light">{perBodyweight(m.target)}</p>
                    </div>
                  ))}
                </div>
                <div className="flex w-full h-3 gap-[2px] mt-6 mb-4">
                  {macros.map(m => (
                    <div key={m.key} className={m.color} style={{ flex: `${m.kcal} 1 0%` }} />
                  ))}
                </div>
                <div className="space-y-2">
                  {macros.map(m => (
                    <div key={m.key} className="flex items-center gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full ${m.color} shrink-0`} />
                      <span className="text-[13px] text-text-primary flex-1">{m.label}</span>
                      <span className="text-[13px] text-text-muted">{m.kcal} cal ({Math.round((m.kcal / macroKcal) * 100)}%)</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 pt-6 border-t border-border">
                  <div className="flex items-baseline justify-between gap-3 mb-1.5">
                    <p className="text-[13px] font-medium text-text-primary">Adjust the split</p>
                    {adjusted && <button type="button" onClick={() => setAdjust({ target: null, kcal: null })} className="text-[12px] text-text-muted hover:text-text-primary underline bg-transparent border-none p-0 cursor-pointer">Reset</button>}
                  </div>
                  <p className="text-[12px] text-text-light mb-4 leading-relaxed">Each tap moves {Math.round(macroStep)} cal (5% of your day) into or out of a macro. The other two make up the difference, so you stay at {selected.kcal} cal. Lock one to keep it where it is.</p>
                  <div className="space-y-2">
                    {macros.map(m => {
                      const isLocked = locked.includes(m.key)
                      const stepBtn = 'w-8 h-8 sm:w-9 sm:h-9 shrink-0 flex items-center justify-center border border-border bg-white text-text-primary cursor-pointer hover:border-border-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
                      return (
                        <div key={m.key} className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${m.color} shrink-0`} />
                          <span className="flex-1 min-w-0 text-[13px] text-text-primary">{m.label}{m.diff !== 0 && <span className="text-[11px] text-text-muted ml-1.5 whitespace-nowrap">{m.diff > 0 ? '+' : '−'}{Math.abs(m.diff)}g</span>}</span>
                          <button type="button" aria-label={`Less ${m.label.toLowerCase()}`} disabled={!nudged(m.key, -1)} onClick={() => nudge(m.key, -1)} className={stepBtn}><Minus className="w-3.5 h-3.5" /></button>
                          <button type="button" aria-label={`More ${m.label.toLowerCase()}`} disabled={!nudged(m.key, 1)} onClick={() => nudge(m.key, 1)} className={stepBtn}><Plus className="w-3.5 h-3.5" /></button>
                          <button type="button" aria-pressed={isLocked} aria-label={`${isLocked ? 'Unlock' : 'Lock'} ${m.label.toLowerCase()}`} onClick={() => toggleLock(m.key)} className={`w-8 h-8 sm:w-9 sm:h-9 shrink-0 flex items-center justify-center border cursor-pointer transition-colors ${isLocked ? 'bg-text-primary text-cream border-text-primary' : 'bg-white text-text-muted border-border hover:border-border-hover'}`}>{isLocked ? <Lock className="w-3.5 h-3.5" /> : <LockOpen className="w-3.5 h-3.5" />}</button>
                        </div>
                      )
                    })}
                  </div>
                  {limitNotes.length > 0 && (
                    <div className="mt-4 space-y-1">
                      {limitNotes.map(n => <p key={n} className="text-[12px] text-text-muted leading-relaxed">{n}</p>)}
                    </div>
                  )}
                </div>
                {carbsLow && (
                  <p className="text-[13px] text-text-muted mt-6 leading-relaxed">Your carbs land under {CARB_NOTE_BELOW_G}g a day — roughly what your brain alone runs on — because protein and fat take most of the calories at this level. You can move some fat or protein into carbs above, but the better trade is usually more walking or steps to widen the deficit, so you keep enough carbs to train hard.</p>
                )}
                <p className="text-[13px] text-text-muted mt-6 leading-relaxed">
                  {result.protein.ageBumped && 'Protein includes +15% for age 60+ (anabolic resistance). '}
                  Vegan? The <Link to="/tools/protein" className="text-text-primary underline">protein calculator</Link> adds a little extra for plant protein's lower digestibility.
                </p>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-5 sm:p-9">
                <h2 className="font-heading text-xl font-medium text-text-primary mb-2">Foods to build it from</h2>
                <p className="text-text-muted text-[13px] mb-6 leading-relaxed">A few ideas per macro, grouped by what each food is mostly known for. Most foods carry more than one — lentils bring real protein alongside their carbs, and peanut butter is mostly fat, not protein.</p>
                <div className="space-y-8">
                  {macroFoods.map(group => (
                    <div key={group.macro}>
                      <div className="flex items-center gap-3 pb-2">
                        <span className="flex-1 min-w-0 flex items-center gap-2 text-[13px] font-medium text-text-primary"><span className={`w-2.5 h-2.5 rounded-full ${macroMeta[group.macro].color} shrink-0`} />{group.title}</span>
                        <span className="grid grid-cols-3 sm:grid-cols-4 w-[96px] sm:w-[148px] shrink-0 text-right text-[10px] uppercase tracking-wider text-text-light">
                          <span>P</span><span>C</span><span>F</span><span className="hidden sm:block">Cal</span>
                        </span>
                      </div>
                      {group.foods.map(food => (
                        <div key={food.food} className="flex items-center gap-3 py-2.5 border-t border-border">
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] text-text-primary">{food.food}</p>
                            <p className="text-[11px] text-text-light">{food.serving}</p>
                          </div>
                          <span className="grid grid-cols-3 sm:grid-cols-4 w-[96px] sm:w-[148px] shrink-0 text-right text-[12px] tabular-nums">
                            {[['protein', food.p], ['carbs', food.c], ['fat', food.f]].map(([key, g]) => (
                              <span key={key} className={key === group.macro ? 'font-medium text-text-primary' : 'text-text-muted'}>{g}</span>
                            ))}
                            <span className="hidden sm:block text-text-light">{foodKcal(food)}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-text-light mt-6">Grams per serving (P protein, C carbs, F fat), rounded from USDA FoodData Central. Packaged foods vary, so check the label.</p>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-5 sm:p-9">
                <h2 className="font-heading text-xl font-medium text-text-primary mb-2">Where your calories go</h2>
                <p className="text-text-muted text-[13px] mb-6">Your {result.tdee} cal/day TDEE breaks down into:</p>
                {/* Segments grow rather than take a percentage width, so the 2px
                    card-colour gaps between them come out of the track instead of
                    overflowing it. They already sum to tdee, so the proportions
                    are the same either way. */}
                <div className="flex w-full h-3 gap-[2px] mb-5">
                  {breakdown.map(b => (
                    <div key={b.label} className={b.color} style={{ flex: `${b.value} 1 0%` }} />
                  ))}
                </div>
                <div className="space-y-3">
                  {breakdown.map(b => (
                    <div key={b.label} className="flex items-center gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full ${b.color} shrink-0`} />
                      <span className="text-[13px] text-text-primary flex-1">{b.label}</span>
                      <span className="text-[13px] text-text-muted">{b.value} cal ({Math.round((b.value / result.tdee) * 100)}%)</span>
                      <span className="text-[11px] text-text-light">typical {b.typicalRange}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-5 sm:p-9">
                <h2 className="font-heading text-xl font-medium text-text-primary mb-2">Boost your NEAT</h2>
                <p className="text-text-muted text-[13px] mb-6 leading-relaxed">NEAT (non-exercise activity thermogenesis) is the energy you burn on everything that isn't sleeping, eating, or deliberate exercise — walking, standing, fidgeting. It's currently <strong className="text-text-primary">{result.neat} cal/day</strong>, and it's the easiest lever to adjust without extra gym time.</p>
                <div className="space-y-4">
                  {neatLevers.map(lever => {
                    const extra = Math.round(lever.calc(result))
                    const maxExtra = Math.max(...neatLevers.map(l => l.calc(result)))
                    return (
                      <div key={lever.label}>
                        <div className="flex justify-between text-[13px] mb-1.5">
                          <span className="text-text-primary">{lever.label}</span>
                          <span className="text-text-muted">+{extra} cal/day</span>
                        </div>
                        <div className="w-full h-2 bg-cream border border-border overflow-hidden">
                          <div className="h-full bg-series-1" style={{ width: `${(extra / maxExtra) * 100}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            </>
          )}

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-5 sm:p-9">
            <h2 className="font-heading text-xl font-medium text-text-primary mb-6">How this calculator works</h2>
            <div className="space-y-6">
              <div>
                <p className="text-[13px] font-medium text-text-primary mb-1.5">Lean body mass (LBM)</p>
                <p className="text-[13px] text-text-muted leading-relaxed">LBM is your body weight minus fat mass — everything else: muscle, bone, organs, water. It's calculated as weight × (1 − body fat %). We use your body fat estimate rather than just your total weight because muscle burns far more resting energy than fat does, so two people at the same weight with different body fat % can have meaningfully different BMRs.</p>
              </div>
              <div>
                <p className="text-[13px] font-medium text-text-primary mb-1.5">BMR — Katch-McArdle, blended by sex</p>
                <p className="text-[13px] text-text-muted leading-relaxed">BMR = 370 + 21.6 × LBM in kg{unit === 'imperial' && <> (we convert your weight from lbs to kg automatically)</>}, plus a small sex-specific constant borrowed from the Mifflin-St Jeor formula (+5 for men, −161 for women). Katch-McArdle alone is more accurate than weight-only formulas because it's driven by lean mass, not total weight — but research shows a small residual metabolic difference between sexes even at identical lean mass, likely hormonal. Blending in that constant accounts for it.</p>
              </div>
              <div>
                <p className="text-[13px] font-medium text-text-primary mb-1.5">NEAT — from your step count</p>
                <p className="text-[13px] text-text-muted leading-relaxed">Walking on the flat costs about 0.0005 calories per kg of bodyweight for every metre covered, on top of your resting burn (from the ACSM walking equation — the same one the cardio calculator uses), and that cost barely changes with speed. Each step covers about 41% of your height, so a step costs 0.0005 × your weight in kg × your step length in metres. We multiply that by your daily step count to estimate the calories from daily walking and movement. Only the extra, above-resting calories count here, because your resting burn is already in your BMR.</p>
              </div>
              <div>
                <p className="text-[13px] font-medium text-text-primary mb-1.5">Exercise calories</p>
                <p className="text-[13px] text-text-muted leading-relaxed">Estimated from your weekly workout hours using a moderate-to-vigorous intensity estimate (~6 METs), converted to calories per hour based on your body weight, then averaged across the week. One MET is what you'd burn resting anyway, and that's already counted in your BMR, so we take it off and only count the extra your training adds — the same rule we use for steps.</p>
              </div>
              <div>
                <p className="text-[13px] font-medium text-text-primary mb-1.5">TEF — thermic effect of food</p>
                <p className="text-[13px] text-text-muted leading-relaxed">Digesting, absorbing, and storing food itself costs energy — typically about 10% of everything else you burn in a day. We add that on top of BMR, NEAT, and exercise to get your full TDEE.</p>
              </div>
              <div>
                <p className="text-[13px] font-medium text-text-primary mb-1.5">The age-60 adjustment</p>
                <p className="text-[13px] text-text-muted leading-relaxed">A 2021 study in Science (Pontzer et al.) tracked energy expenditure across the human lifespan using doubly-labeled water and found metabolism is essentially flat from age 20 to 60 once you account for body composition — but declines roughly 0.7% per year after 60, independent of any muscle loss. We apply that decline directly to BMR for ages over 60.</p>
              </div>
              <div>
                <p className="text-[13px] font-medium text-text-primary mb-1.5">Calorie targets</p>
                <p className="text-[13px] text-text-muted leading-relaxed">One {fatUnitLabel} of body fat holds roughly {fatCalConst} calories. For cutting, the deficit is scaled to a percentage of your bodyweight per week (0.25 / 0.5 / 1%) instead of a fixed number, since a flat deficit doesn't mean the same thing for a {lightExample} person and a {heavyExample} person. For bulking, instead of a speed choice, you pick how much fat gain you're willing to accept: a lean bulk (+200 cal/day, minimal fat gain) or a normal bulk (+500 cal/day, moderate fat gain) — deliberately bulking "fast" mostly just adds fat, not muscle. Recomp offers three closer-to-maintenance options: hold at maintenance, a very clean +150 cal/day surplus for muscle-gain focus, or a slow 0.35%-bodyweight/week deficit for fat-loss focus. No deficit target goes below {CALORIE_FLOOR.male.toLocaleString()} cal/day for men or {CALORIE_FLOOR.female.toLocaleString()} for women: when a pace would need less than that, the target is held at the floor and the gap is shown as extra daily steps instead, using the same per-step cost as your NEAT{result && <> (about {(Math.round(result.kcalPerStep * 1000) / 1000)} cal per step for you)</>}.</p>
              </div>
              <div>
                <p className="text-[13px] font-medium text-text-primary mb-1.5">Macros</p>
                <p className="text-[13px] text-text-muted leading-relaxed">Protein comes first, from the same formula as our protein calculator: dosed from lean body mass, rising with weekly training (Morton et al. 2018) and with leanness below 20% body fat (Helms et al. 2014) — the leaner you are, the more of your weight is muscle to protect. Your goal then picks where in that range you land: near the top in a deficit, where lean mass is most at risk, and toward the middle in a surplus, where extra calories do more as carbs. For most lifters that works out to roughly 2 g per kg of bodyweight. On a cut, fat aims for 0.8 g per kg of bodyweight, kept within 20–35% of calories so it can't crowd out carbs for heavier people; at maintenance and on a bulk it's 20–30% of calories (25–30% on a bulk). It never goes below an essential minimum of 0.5 g per kg of bodyweight for men and 0.6 g/kg for women — fat carries hormone production and the absorption of vitamins A, D, E and K. Women's higher minimum is a safety margin: menstrual disruption tracks eating too little overall more than low fat specifically, which is what the calorie floor guards against. Carbs get every calorie that's left, because they're what fuels hard training. That's also why the carb range runs the opposite way: it's highest when protein and fat sit at the low end of theirs. You can shift the split by hand in steps of 5% of your calories, and total calories stay the same while you do. It stays inside healthy bounds: protein between the bottom of its range and about 3.3 g per kg of lean mass (past that it's just burned as fuel), fat between its essential minimum and 40% of calories, and carbs no lower than 130 g a day unless your calorie target already put them there.</p>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-5 sm:p-9">
            <h2 className="font-heading text-xl font-medium text-text-primary mb-4">One more thing</h2>
            <div className="space-y-4">
              <p className="text-[13px] text-text-muted leading-relaxed">No matter how many formulas and citations go into this, it's still an estimate. Your real metabolism, digestion, hormones, sleep, and stress all move the actual number around in ways no calculator can fully capture. Treat everything above as a good place to start your journey, not a verdict — give it a few weeks, then adjust based on what the scale and the mirror are actually telling you, rather than assuming the number was wrong from day one.</p>
              <p className="text-[13px] text-text-muted leading-relaxed">One line worth not crossing: don't chase a deficit by dropping below about {CALORIE_FLOOR.female.toLocaleString()}–{CALORIE_FLOOR.male.toLocaleString()} calories a day — it's why the targets above never go under {CALORIE_FLOOR.male.toLocaleString()} for men or {CALORIE_FLOOR.female.toLocaleString()} for women. Below that range, it gets genuinely hard to hit your protein, vitamins, and everything else your body needs to function properly — you're not losing fat faster, you're just shortchanging yourself. If you want to lose weight quicker than a moderate deficit gets you there, it's almost always a better trade to add more walking, steps, or cardio than to cut calories that low.</p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
