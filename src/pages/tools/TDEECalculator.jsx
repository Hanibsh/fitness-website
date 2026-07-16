import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import UnitHelp from '../../components/UnitHelp'
import PrefillNote from '../../components/PrefillNote'
import { bodyFatBounds, nearestBodyFatLabel } from '../../lib/bodyFat'
import { usePrefillEffect } from '../../lib/profilePrefill'
import { asset } from '../../lib/assets'

const loseSpeeds = [
  { label: 'Slow', percent: 0.25 },
  { label: 'Moderate', percent: 0.5 },
  { label: 'Fast', percent: 1 },
]

const gainOptions = [
  { label: 'Lean bulk', sub: 'minimal fat gain', delta: 200 },
  { label: 'Normal bulk', sub: 'moderate fat gain', delta: 500 },
]

const recompOptions = [
  { label: 'Maintain', delta: 0 },
  { label: 'Muscle-gain focus', delta: 150 },
  { label: 'Fat-loss focus', percent: 0.35 },
]

const inputBounds = {
  age: { min: 10, max: 100 },
  weight: { metric: { min: 20, max: 300 }, imperial: { min: 44, max: 660 } },
  height: { metric: { min: 100, max: 250 }, imperial: { min: 39, max: 98 } },
  workoutHours: { min: 0, max: 40 },
  stepsPerDay: { min: 0, max: 50000 },
}

const neatLevers = [
  { label: 'Walk 30 min more', calc: (w) => 1.84 * w },
  { label: 'Stand 2 hours more instead of sitting', calc: (w) => 18 * (w / 70) },
  { label: 'General more active lifestyle (+2,000 steps/day)', calc: (w) => w * 1 },
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

  // Seed from the profile. Unit goes first: a height in cm would fail the
  // imperial bounds. Text fields only fill while still empty, so a value typed
  // before the profile arrived survives.
  const prefill = usePrefillEffect((p) => {
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

    const weightKg = unit === 'imperial' ? w * 0.453592 : w

    const lbm = weightKg * (1 - bodyFat / 100)
    const sexConstant = sex === 'male' ? 5 : -161
    const bmrRaw = 370 + 21.6 * lbm + sexConstant
    const ageDecline = a > 60 ? 0.007 * (a - 60) : 0
    const bmr = bmrRaw * (1 - ageDecline)

    const neat = steps * weightKg * 0.0005
    const exercise = (hours / 7) * 6.3 * weightKg
    const tef = 0.1 * (bmr + neat + exercise)
    const tdee = bmr + neat + exercise + tef

    setResult({
      lbm: Math.round(lbm),
      ageAdjustment: Math.round(bmrRaw - bmr),
      bmr: Math.round(bmr),
      neat: Math.round(neat),
      exercise: Math.round(exercise),
      tef: Math.round(tef),
      tdee: Math.round(tdee),
      weightKg,
      age: a,
    })
  }

  const toggle = (active, onClick, label) => (
    <button onClick={onClick} className={`flex-1 py-3 text-[13px] font-medium border cursor-pointer transition-colors ${active ? 'bg-text-primary text-cream border-text-primary' : 'bg-white text-text-muted border-border hover:border-border-hover'}`}>{label}</button>
  )

  const breakdown = result ? [
    { label: 'BMR (resting)', value: result.bmr, color: 'bg-text-primary', typicalRange: '50-70%' },
    { label: 'NEAT (steps)', value: result.neat, color: 'bg-accent-hover', typicalRange: '5-20%' },
    { label: 'Exercise', value: result.exercise, color: 'bg-text-muted', typicalRange: '5-15%' },
    { label: 'TEF (digestion)', value: result.tef, color: 'bg-border-hover', typicalRange: '10-15%' },
  ] : []

  const weightUnitLabel = unit === 'imperial' ? 'lbs' : 'kg'
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
          <p className="text-text-muted text-[15px] mb-10">Find out how many calories you burn per day, and how to adjust intake to hit your goal.</p>

          <div className="bg-white border border-border p-9 space-y-7">
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
              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-9">
                <h2 className="font-heading text-xl font-medium text-text-primary mb-6">Your results</h2>
                <div className="grid grid-cols-3 gap-2 sm:gap-4">
                  {[['LBM', result.lbm], ['BMR', result.bmr], ['TDEE', result.tdee]].map(([label, val], i) => (
                    <div key={label} className={`px-2 py-4 sm:p-5 text-center ${i === 2 ? 'bg-text-primary' : 'bg-cream border border-border'}`}>
                      <p className={`text-[11px] uppercase tracking-wider mb-1.5 ${i === 2 ? 'text-cream/70' : 'text-text-muted'}`}>{label}</p>
                      <p className={`text-2xl sm:text-3xl font-medium ${i === 2 ? 'text-cream' : 'text-text-primary'}`}>{val}</p>
                      <p className={`text-[11px] ${i === 2 ? 'text-cream/50' : 'text-text-light'}`}>{label === 'LBM' ? 'kg' : 'cal/day'}</p>
                    </div>
                  ))}
                </div>
                {result.ageAdjustment > 0 && (
                  <p className="text-[13px] text-text-muted mt-6 leading-relaxed">Research shows resting metabolism declines by about 0.7% per year after age 60, independent of muscle loss. That's already factored in above — it's shaving <strong className="text-text-primary">{result.ageAdjustment} cal/day</strong> off your BMR. Prioritizing protein intake and resistance training helps preserve lean mass on top of that.</p>
                )}
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-9">
                <h2 className="font-heading text-xl font-medium text-text-primary mb-2">Lose weight</h2>
                <p className="text-text-muted text-[13px] mb-6">Deficits scaled to your bodyweight — a fixed kcal number doesn't make sense for everyone at the same rate.</p>
                <div className="grid grid-cols-3 gap-4">
                  {loseSpeeds.map(s => {
                    const weeklyLossKg = result.weightKg * (s.percent / 100)
                    const dailyDeficit = Math.round((weeklyLossKg * 7700) / 7)
                    return (
                      <div key={s.label} className="bg-cream border border-border p-4 text-center">
                        <p className="text-[11px] text-text-muted uppercase tracking-wider mb-2">{s.label}<br /><span className="text-text-light">{s.percent}% BW/week</span></p>
                        <p className="text-xl font-medium text-text-primary">{result.tdee - dailyDeficit}</p>
                        <p className="text-[10px] text-text-light">cal/day</p>
                      </div>
                    )
                  })}
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-9">
                <h2 className="font-heading text-xl font-medium text-text-primary mb-2">Gain weight</h2>
                <p className="text-text-muted text-[13px] mb-6">Pick how much fat gain you're willing to trade for faster muscle growth.</p>
                <div className="grid grid-cols-2 gap-4">
                  {gainOptions.map(g => (
                    <div key={g.label} className="bg-cream border border-border p-4 text-center">
                      <p className="text-[11px] text-text-muted uppercase tracking-wider mb-2">{g.label}<br /><span className="text-text-light">{g.sub}</span></p>
                      <p className="text-xl font-medium text-text-primary">{result.tdee + g.delta}</p>
                      <p className="text-[10px] text-text-light">cal/day</p>
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-9">
                <h2 className="font-heading text-xl font-medium text-text-primary mb-2">Recomp</h2>
                <p className="text-text-muted text-[13px] mb-6 leading-relaxed">Eating close to maintenance while training hard and eating enough protein lets you build muscle and lose fat at the same time — no dedicated cut/bulk cycling needed. Pick a lean depending on what you want more of: hold steady, lean into muscle with a very clean bulk, or lean into fat loss at a slow, sustainable pace.</p>
                <div className="grid grid-cols-3 gap-4">
                  {recompOptions.map(r => {
                    const value = r.percent
                      ? result.tdee - Math.round((result.weightKg * (r.percent / 100) * 7700) / 7)
                      : result.tdee + r.delta
                    return (
                      <div key={r.label} className="bg-cream border border-border p-4 text-center">
                        <p className="text-[11px] text-text-muted uppercase tracking-wider mb-2">{r.label}</p>
                        <p className="text-xl font-medium text-text-primary">{value}</p>
                        <p className="text-[10px] text-text-light">cal/day</p>
                      </div>
                    )
                  })}
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-9">
                <h2 className="font-heading text-xl font-medium text-text-primary mb-2">Where your calories go</h2>
                <p className="text-text-muted text-[13px] mb-6">Your {result.tdee} cal/day TDEE breaks down into:</p>
                <div className="flex w-full h-3 overflow-hidden mb-5">
                  {breakdown.map(b => (
                    <div key={b.label} className={b.color} style={{ width: `${(b.value / result.tdee) * 100}%` }} />
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

              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-9">
                <h2 className="font-heading text-xl font-medium text-text-primary mb-2">Boost your NEAT</h2>
                <p className="text-text-muted text-[13px] mb-6 leading-relaxed">NEAT (non-exercise activity thermogenesis) is the energy you burn on everything that isn't sleeping, eating, or deliberate exercise — walking, standing, fidgeting. It's currently <strong className="text-text-primary">{result.neat} cal/day</strong>, and it's the easiest lever to adjust without extra gym time.</p>
                <div className="space-y-4">
                  {neatLevers.map(lever => {
                    const extra = Math.round(lever.calc(result.weightKg))
                    const maxExtra = Math.max(...neatLevers.map(l => l.calc(result.weightKg)))
                    return (
                      <div key={lever.label}>
                        <div className="flex justify-between text-[13px] mb-1.5">
                          <span className="text-text-primary">{lever.label}</span>
                          <span className="text-text-muted">+{extra} cal/day</span>
                        </div>
                        <div className="w-full h-2 bg-cream border border-border overflow-hidden">
                          <div className="h-full bg-accent-hover" style={{ width: `${(extra / maxExtra) * 100}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            </>
          )}

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-9">
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
                <p className="text-[13px] text-text-muted leading-relaxed">Calories burned per step scale with body weight — roughly 0.0005 × weight in kg per step. We multiply your daily step count by that per-step cost (using your weight in {weightUnitLabel}, converted to kg behind the scenes) to estimate the calories from daily walking and movement.</p>
              </div>
              <div>
                <p className="text-[13px] font-medium text-text-primary mb-1.5">Exercise calories</p>
                <p className="text-[13px] text-text-muted leading-relaxed">Estimated from your weekly workout hours using a moderate-to-vigorous intensity estimate (~6 METs), converted to calories per hour based on your body weight, then averaged across the week.</p>
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
                <p className="text-[13px] text-text-muted leading-relaxed">One {fatUnitLabel} of body fat holds roughly {fatCalConst} calories. For cutting, the deficit is scaled to a percentage of your bodyweight per week (0.25 / 0.5 / 1%) instead of a fixed number, since a flat deficit doesn't mean the same thing for a {lightExample} person and a {heavyExample} person. For bulking, instead of a speed choice, you pick how much fat gain you're willing to accept: a lean bulk (+200 cal/day, minimal fat gain) or a normal bulk (+500 cal/day, moderate fat gain) — deliberately bulking "fast" mostly just adds fat, not muscle. Recomp offers three closer-to-maintenance options: hold at maintenance, a very clean +150 cal/day surplus for muscle-gain focus, or a slow 0.35%-bodyweight/week deficit for fat-loss focus.</p>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-9">
            <h2 className="font-heading text-xl font-medium text-text-primary mb-4">One more thing</h2>
            <div className="space-y-4">
              <p className="text-[13px] text-text-muted leading-relaxed">No matter how many formulas and citations go into this, it's still an estimate. Your real metabolism, digestion, hormones, sleep, and stress all move the actual number around in ways no calculator can fully capture. Treat everything above as a good place to start your journey, not a verdict — give it a few weeks, then adjust based on what the scale and the mirror are actually telling you, rather than assuming the number was wrong from day one.</p>
              <p className="text-[13px] text-text-muted leading-relaxed">One line worth not crossing: don't chase a deficit by dropping below about 1,400–1,500 calories a day. Below that range, it gets genuinely hard to hit your protein, vitamins, and everything else your body needs to function properly — you're not losing fat faster, you're just shortchanging yourself. If you want to lose weight quicker than a moderate deficit gets you there, it's almost always a better trade to add more walking, steps, or cardio than to cut calories that low.</p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
