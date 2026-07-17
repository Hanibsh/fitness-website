import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import UnitHelp from '../../components/UnitHelp'
import PrefillNote from '../../components/PrefillNote'
import { bodyFatBounds, nearestBodyFatLabel } from '../../lib/bodyFat'
import { usePrefillEffect } from '../../lib/profilePrefill'
import { asset } from '../../lib/assets'

const inputBounds = {
  height: { metric: { min: 100, max: 250 }, imperial: { min: 39, max: 98 } },
  wrist: { metric: { min: 10, max: 25 }, imperial: { min: 4, max: 10 } },
  ankle: { metric: { min: 15, max: 30 }, imperial: { min: 6, max: 12 } },
  years: { min: 0, max: 30 },
}

const targetBfDefault = { male: 10, female: 18 }

const FEMALE_SCALE = 0.7

const trainingRates = [
  { max: 1, label: 'Beginner (first year)', male: '1-1.5% bodyweight/month', female: '0.5-0.75% bodyweight/month' },
  { max: 3, label: 'Intermediate (1-3 years)', male: '0.5-1% bodyweight/month', female: '0.25-0.5% bodyweight/month' },
  { max: Infinity, label: 'Advanced (3+ years)', male: '0.25-0.5% bodyweight/month', female: 'up to 0.25% bodyweight/month' },
]

export default function MuscleGainPotential() {
  const [unit, setUnit] = useState('metric')
  const [sex, setSex] = useState('male')
  const [targetBf, setTargetBf] = useState(targetBfDefault.male)
  const [height, setHeight] = useState('')
  const [wrist, setWrist] = useState('')
  const [ankle, setAnkle] = useState('')
  const [years, setYears] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  // Unit first — a cm height would fail the imperial bounds. Wrist, ankle and
  // years trained aren't on the profile, so they stay manual.
  const prefill = usePrefillEffect((p) => {
    if (p.unitSystem) setUnit(p.unitSystem)
    if (p.sex) { setSex(p.sex); setTargetBf(targetBfDefault[p.sex]) }
    if (p.height != null) setHeight((v) => (v === '' ? String(p.height) : v))
  })

  function calculate() {
    const h = parseFloat(height), w = parseFloat(wrist), a = parseFloat(ankle), y = parseFloat(years)
    if (!h || !w || !a || y === '' || isNaN(y)) {
      setError('Enter your height, wrist, ankle, and years of training to calculate.')
      setResult(null)
      return
    }
    const hRange = inputBounds.height[unit], wRange = inputBounds.wrist[unit], aRange = inputBounds.ankle[unit]
    const unitLabel = unit === 'imperial' ? 'in' : 'cm'
    if (h < hRange.min || h > hRange.max) {
      setError(`Height should be between ${hRange.min} and ${hRange.max} ${unitLabel}.`)
      setResult(null)
      return
    }
    if (w < wRange.min || w > wRange.max) {
      setError(`Wrist should be between ${wRange.min} and ${wRange.max} ${unitLabel}.`)
      setResult(null)
      return
    }
    if (a < aRange.min || a > aRange.max) {
      setError(`Ankle should be between ${aRange.min} and ${aRange.max} ${unitLabel}.`)
      setResult(null)
      return
    }
    if (y < inputBounds.years.min || y > inputBounds.years.max) {
      setError(`Years of training should be between ${inputBounds.years.min} and ${inputBounds.years.max}.`)
      setResult(null)
      return
    }
    setError('')

    let maxBodyweight
    if (unit === 'imperial') {
      maxBodyweight = Math.pow(h, 1.5) * (Math.sqrt(w) / 22.667 + Math.sqrt(a) / 17.0104) * (targetBf / 224 + 1)
    } else {
      maxBodyweight = Math.pow(h, 1.5) * (Math.sqrt(w) / 322.4 + Math.sqrt(a) / 241.9) * (targetBf / 224 + 1)
    }
    if (sex === 'female') maxBodyweight *= FEMALE_SCALE

    const leanMass = maxBodyweight * (1 - targetBf / 100)
    const tier = trainingRates.find(t => y <= t.max)

    setResult({
      maxBodyweight: Math.round(maxBodyweight * 10) / 10,
      leanMass: Math.round(leanMass * 10) / 10,
      tier,
    })
  }

  const toggle = (active, onClick, label) => (
    <button onClick={onClick} className={`flex-1 py-3 text-[13px] font-medium border cursor-pointer transition-colors ${active ? 'bg-text-primary text-cream border-text-primary' : 'bg-white text-text-muted border-border hover:border-border-hover'}`}>{label}</button>
  )

  return (
    <div className="pt-28 pb-24 px-6">
      <div className="max-w-2xl mx-auto">
        <Link to="/tools" className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary no-underline text-[13px] mb-10 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to tools
        </Link>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-heading text-4xl font-medium text-text-primary mb-3">Muscle gain potential calculator</h1>
          <p className="text-text-muted text-[15px] mb-10">Estimate your natural genetic ceiling from your frame size.</p>

          <div className="bg-white border border-border p-9 space-y-7">
            <div className="flex gap-3 items-center">
              {toggle(unit === 'metric', () => { prefill.touch(); setUnit('metric') }, 'Metric (cm)')}
              {toggle(unit === 'imperial', () => { prefill.touch(); setUnit('imperial') }, 'Imperial (in)')}
              <UnitHelp />
            </div>
            <div className="flex gap-3">
              {toggle(sex === 'male', () => { prefill.touch(); setSex('male'); setTargetBf(targetBfDefault.male) }, 'Male')}
              {toggle(sex === 'female', () => { prefill.touch(); setSex('female'); setTargetBf(targetBfDefault.female) }, 'Female')}
            </div>
            <PrefillNote from={prefill.from} />

            <div className="grid grid-cols-3 gap-4 items-end">
              <div>
                <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-2">Height ({unit === 'metric' ? 'cm' : 'in'})</label>
                <input type="number" min={inputBounds.height[unit].min} max={inputBounds.height[unit].max} value={height} onChange={e => setHeight(e.target.value)} placeholder={unit === 'metric' ? '180' : '71'} className="w-full bg-cream border border-border px-4 py-3 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors" />
              </div>
              <div>
                <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-2">Wrist ({unit === 'metric' ? 'cm' : 'in'})</label>
                <input type="number" min={inputBounds.wrist[unit].min} max={inputBounds.wrist[unit].max} value={wrist} onChange={e => setWrist(e.target.value)} placeholder={unit === 'metric' ? '17' : '6.7'} className="w-full bg-cream border border-border px-4 py-3 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors" />
              </div>
              <div>
                <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-2">Ankle ({unit === 'metric' ? 'cm' : 'in'})</label>
                <input type="number" min={inputBounds.ankle[unit].min} max={inputBounds.ankle[unit].max} value={ankle} onChange={e => setAnkle(e.target.value)} placeholder={unit === 'metric' ? '22' : '8.7'} className="w-full bg-cream border border-border px-4 py-3 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors" />
              </div>
            </div>
            <p className="text-[12px] text-text-light -mt-4">Measure your wrist just past the bony bump (styloid process), and your ankle at its narrowest point — see below for details. Small measurement errors meaningfully change the result.</p>

            <div>
              <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-3">Target body fat % for this estimate</label>
              <img src={asset('images/bodyfat-chart.jpeg')} alt="Body fat percentage reference chart" className="w-full border border-border mb-5" />
              <div className="flex items-baseline justify-between mb-3">
                <span className="text-[13px] text-text-muted">≈ {nearestBodyFatLabel(sex, targetBf)}</span>
                <span className="text-2xl font-medium text-text-primary">{targetBf}%</span>
              </div>
              <input
                type="range"
                aria-label="Target body fat percentage"
                min={bodyFatBounds[sex].min}
                max={bodyFatBounds[sex].max}
                step={1}
                value={targetBf}
                onChange={e => setTargetBf(Number(e.target.value))}
                style={{ backgroundImage: `linear-gradient(to right, var(--color-text-primary) ${((targetBf - bodyFatBounds[sex].min) / (bodyFatBounds[sex].max - bodyFatBounds[sex].min)) * 100}%, var(--color-cream) 0%)` }}
                className="w-full h-2 border border-border appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-text-primary [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-text-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:bg-text-primary [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-text-light mt-2">
                <span>{bodyFatBounds[sex].min}%</span>
                <span>{bodyFatBounds[sex].max}%</span>
              </div>
            </div>

            <div>
              <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-2">Years of consistent training</label>
              <input type="number" min={inputBounds.years.min} max={inputBounds.years.max} value={years} onChange={e => setYears(e.target.value)} placeholder="2" className="w-full bg-cream border border-border px-4 py-3 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors" />
            </div>

            {error && <p className="text-[13px] text-red-600">{error}</p>}

            <button onClick={calculate} className="w-full bg-text-primary text-cream font-medium py-3.5 border-none cursor-pointer text-[14px] hover:bg-accent-hover transition-colors">
              Calculate potential
            </button>
          </div>

          {result && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-9">
              <h2 className="font-heading text-xl font-medium text-text-primary mb-6">Your estimated natural ceiling</h2>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-text-primary p-5 text-center">
                  <p className="text-[11px] text-cream/70 uppercase tracking-wider mb-1.5">Max bodyweight at {targetBf}% BF</p>
                  <p className="text-2xl font-medium text-cream">{result.maxBodyweight}</p>
                  <p className="text-[11px] text-cream/50">{unit === 'metric' ? 'kg' : 'lbs'}</p>
                </div>
                <div className="bg-cream border border-border p-5 text-center">
                  <p className="text-[11px] text-text-muted uppercase tracking-wider mb-1.5">Implied lean mass</p>
                  <p className="text-2xl font-medium text-text-primary">{result.leanMass}</p>
                  <p className="text-[11px] text-text-light">{unit === 'metric' ? 'kg' : 'lbs'}</p>
                </div>
              </div>
              <div className="bg-cream border border-border p-5">
                <p className="text-[11px] text-text-muted uppercase tracking-wider mb-1.5">Your training status: {result.tier.label}</p>
                <p className="text-[13px] text-text-primary">Typical pace right now: <strong>{sex === 'male' ? result.tier.male : result.tier.female}</strong></p>
              </div>
              {sex === 'female' && (
                <p className="text-[13px] text-text-muted mt-6 leading-relaxed">This number applies a rough 0.7× scale to the male formula, since Casey Butt's original research was male-only. Independent estimates for the true female scaling factor range anywhere from 0.6× to 0.85× — treat this as a ballpark, not a precise target.</p>
              )}
            </motion.div>
          )}

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-9">
            <h2 className="font-heading text-xl font-medium text-text-primary mb-6">Why wrist and ankle size, and how to measure them</h2>
            <div className="space-y-4">
              <p className="text-[13px] text-text-muted leading-relaxed">Your wrist and ankle are the boniest, leanest points on your body — almost no muscle or fat sits over the bone there, which makes them a clean proxy for your overall skeletal frame size. This matters because, at the same height, someone with a bigger frame has more surface area for muscle to attach to and generally more genetic capacity to build size. This isn't a fringe idea — it's the basis of Casey Butt's formula, built from measurements of 300 natural bodybuilding champions (1947-2010), and remains the most cited approach for this kind of estimate.</p>
              <p className="text-[13px] text-text-muted leading-relaxed">To measure: wrap a tape measure around your wrist right at the bony bump on the outside of the joint (the styloid process), and around your ankle at its narrowest point, just above the ankle bones. Pull snug, not tight. A measurement off by even a centimeter meaningfully shifts the result, so measure carefully and maybe twice.</p>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-9">
            <h2 className="font-heading text-xl font-medium text-text-primary mb-6">A real limitation worth knowing about</h2>
            <div className="space-y-4">
              <p className="text-[13px] text-text-muted leading-relaxed">Casey Butt's dataset spans bodybuilding champions from 1947 to 2010. Steroid use became widespread in competitive bodybuilding from the 1960s onward, and it's genuinely unclear whether every champion in that historical dataset was actually drug-free. If some weren't, the formula's "natural ceiling" is likely calibrated somewhat higher than what a truly natural lifter can reach. It remains the best publicly available formula for this — independent reviewers (including evidence-based coaches who are otherwise critical of weaker alternatives) still consider it the most sensible option out there — but treat the number as a rough ceiling estimate, not a guarantee.</p>
              <p className="text-[13px] text-text-muted leading-relaxed">In practice, most people who train consistently for years land around 80-90% of their calculated number; only the most consistent, genetically favored trainees get close to 95-100%.</p>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-9">
            <h2 className="font-heading text-xl font-medium text-text-primary mb-6">Why "years of training" doesn't feed into the ceiling formula</h2>
            <p className="text-[13px] text-text-muted leading-relaxed">Casey Butt's formula and training-age muscle-gain-rate data come from two completely separate bodies of research — there's no validated formula that converts "years trained" into "% of your genetic ceiling reached," so we're not going to make one up. Instead, your years of training are used to show you the actual, separately-cited expected muscle gain rate for your training status (via the Aragon & Helms model) — useful context for how fast you should realistically expect to be progressing right now, kept clearly separate from the ceiling estimate above rather than mashed into one invented number.</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-9">
            <h2 className="font-heading text-xl font-medium text-text-primary mb-2">The Aragon & Helms muscle gain rate model</h2>
            <p className="text-text-muted text-[13px] mb-6 leading-relaxed">Realistic expected pace of lean mass gain, by training status — assumes training each major muscle group at least twice a week, adequate protein, and 7-9 hours of sleep.</p>
            <div className="space-y-2">
              {trainingRates.map(t => (
                <div key={t.label} className="bg-cream border border-border p-4">
                  <p className="text-[13px] font-medium text-text-primary mb-1.5">{t.label}</p>
                  <div className="flex justify-between text-[12px] text-text-muted">
                    <span>Men: {t.male}</span>
                    <span>Women: {t.female}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
