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
  weight: { metric: { min: 20, max: 300 }, imperial: { min: 44, max: 660 } },
  height: { metric: { min: 100, max: 250 }, imperial: { min: 39, max: 98 } },
}

const categoryTables = {
  male: [
    { label: 'Skinny man', ffmiMin: 17, ffmiMax: 18, bfMin: 10, bfMax: 18 },
    { label: 'Average man', ffmiMin: 18, ffmiMax: 20, bfMin: 20, bfMax: 27 },
    { label: 'Fat man', ffmiMin: 19, ffmiMax: 21, bfMin: 25, bfMax: 40 },
    { label: 'Athlete / intermediate gym user', ffmiMin: 20, ffmiMax: 21, bfMin: 10, bfMax: 18 },
    { label: 'Advanced gym user', ffmiMin: 22, ffmiMax: 23, bfMin: 6, bfMax: 12 },
    { label: 'Bodybuilder / powerlifter / weightlifter', ffmiMin: 24, ffmiMax: 25, bfMin: 8, bfMax: 20 },
  ],
  female: [
    { label: 'Skinny woman', ffmiMin: 14, ffmiMax: 15, bfMin: 20, bfMax: 25 },
    { label: 'Average woman', ffmiMin: 14, ffmiMax: 17, bfMin: 22, bfMax: 35 },
    { label: 'Fat woman', ffmiMin: 15, ffmiMax: 18, bfMin: 30, bfMax: 45 },
    { label: 'Athlete / intermediate gym user', ffmiMin: 16, ffmiMax: 17, bfMin: 18, bfMax: 25 },
    { label: 'Advanced gym user', ffmiMin: 18, ffmiMax: 20, bfMin: 15, bfMax: 22 },
    { label: 'Bodybuilder / powerlifter / weightlifter', ffmiMin: 19, ffmiMax: 21, bfMin: 15, bfMax: 30 },
  ],
}

const spectrumZones = {
  male: [
    { label: 'Below average', max: 18, color: 'bg-blue-400' },
    { label: 'Average', max: 20, color: 'bg-teal-400' },
    { label: 'Athletic', max: 22, color: 'bg-green-500' },
    { label: 'Advanced', max: 23, color: 'bg-yellow-500' },
    { label: 'Bodybuilder-tier', max: 25, color: 'bg-orange-500' },
    { label: 'Exceeds natural range', max: 30, color: 'bg-red-600' },
  ],
  female: [
    { label: 'Below average', max: 14, color: 'bg-blue-400' },
    { label: 'Average', max: 17, color: 'bg-teal-400' },
    { label: 'Athletic', max: 18, color: 'bg-green-500' },
    { label: 'Advanced', max: 19, color: 'bg-yellow-500' },
    { label: 'Bodybuilder-tier', max: 21, color: 'bg-orange-500' },
    { label: 'Exceeds natural range', max: 26, color: 'bg-red-600' },
  ],
}

const spectrumDomain = {
  male: { min: 15, max: 27 },
  female: { min: 12, max: 23 },
}

function matchCategory(sex, ffmi, bf) {
  const rows = categoryTables[sex]
  const bothMatch = rows.find(r => ffmi >= r.ffmiMin && ffmi <= r.ffmiMax && bf >= r.bfMin && bf <= r.bfMax)
  if (bothMatch) return bothMatch.label
  const ffmiMatch = rows.find(r => ffmi >= r.ffmiMin && ffmi <= r.ffmiMax)
  if (ffmiMatch) return ffmiMatch.label
  let nearest = rows[0], nearestDist = Infinity
  rows.forEach(r => {
    const mid = (r.ffmiMin + r.ffmiMax) / 2
    const d = Math.abs(ffmi - mid)
    if (d < nearestDist) { nearestDist = d; nearest = r }
  })
  return nearest.label
}

export default function FFMICalculator() {
  const [unit, setUnit] = useState('metric')
  const [sex, setSex] = useState('male')
  const [bodyFat, setBodyFat] = useState(bodyFatBounds.male.default)
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  // Unit first — a cm height would fail the imperial bounds.
  const prefill = usePrefillEffect((p) => {
    if (p.unitSystem) setUnit(p.unitSystem)
    if (p.sex) { setSex(p.sex); setBodyFat(bodyFatBounds[p.sex].default) }
    if (p.weight != null) setWeight((v) => (v === '' ? String(p.weight) : v))
    if (p.height != null) setHeight((v) => (v === '' ? String(p.height) : v))
  })

  function calculate() {
    const w = parseFloat(weight), h = parseFloat(height)
    if (!w || !h) {
      setError('Enter your weight and height to calculate.')
      setResult(null)
      return
    }
    const weightRange = inputBounds.weight[unit]
    const heightRange = inputBounds.height[unit]
    const weightUnitLabel = unit === 'imperial' ? 'lbs' : 'kg'
    const heightUnitLabel = unit === 'imperial' ? 'in' : 'cm'
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
    setError('')

    const weightKg = unit === 'imperial' ? w * 0.453592 : w
    const heightM = unit === 'imperial' ? h * 0.0254 : h / 100
    const leanKg = weightKg * (1 - bodyFat / 100)
    const ffmi = leanKg / (heightM * heightM)
    const adjustedFfmi = ffmi + 6.3 * (1.8 - heightM)
    const category = matchCategory(sex, Math.round(adjustedFfmi), bodyFat)

    setResult({
      ffmi: Math.round(ffmi * 10) / 10,
      adjustedFfmi: Math.round(adjustedFfmi * 10) / 10,
      category,
    })
  }

  const toggle = (active, onClick, label) => (
    <button onClick={onClick} className={`flex-1 py-3 text-[13px] font-medium border cursor-pointer transition-colors ${active ? 'bg-text-primary text-cream border-text-primary' : 'bg-white text-text-muted border-border hover:border-border-hover'}`}>{label}</button>
  )

  const zone = result ? spectrumZones[sex] : null
  const domain = spectrumDomain[sex]

  return (
    <div className="pt-28 pb-24 px-6">
      <div className="max-w-2xl mx-auto">
        <Link to="/tools" className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary no-underline text-[13px] mb-10 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to tools
        </Link>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-heading text-4xl font-medium text-text-primary mb-3">FFMI calculator</h1>
          <p className="text-text-muted text-[15px] mb-10">How much muscle you're carrying, relative to your height.</p>

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

            <div className="grid grid-cols-2 gap-4 items-end">
              <div>
                <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-2">Weight ({unit === 'metric' ? 'kg' : 'lbs'})</label>
                <input type="number" min={inputBounds.weight[unit].min} max={inputBounds.weight[unit].max} value={weight} onChange={e => setWeight(e.target.value)} placeholder={unit === 'metric' ? '80' : '176'} className="w-full bg-cream border border-border px-4 py-3 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors" />
              </div>
              <div>
                <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-2">Height ({unit === 'metric' ? 'cm' : 'in'})</label>
                <input type="number" min={inputBounds.height[unit].min} max={inputBounds.height[unit].max} value={height} onChange={e => setHeight(e.target.value)} placeholder={unit === 'metric' ? '180' : '71'} className="w-full bg-cream border border-border px-4 py-3 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors" />
              </div>
            </div>

            {error && <p className="text-[13px] text-red-600">{error}</p>}

            <button onClick={calculate} className="w-full bg-text-primary text-cream font-medium py-3.5 border-none cursor-pointer text-[14px] hover:bg-accent-hover transition-colors">
              Calculate FFMI
            </button>
          </div>

          {result && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-9">
              <h2 className="font-heading text-xl font-medium text-text-primary mb-6">Your FFMI</h2>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div className="bg-cream border border-border p-5 text-center">
                  <p className="text-[11px] text-text-muted uppercase tracking-wider mb-1.5">FFMI</p>
                  <p className="text-2xl font-medium text-text-primary">{result.ffmi}</p>
                </div>
                <div className="bg-text-primary p-5 text-center">
                  <p className="text-[11px] text-cream/70 uppercase tracking-wider mb-1.5">Adjusted FFMI</p>
                  <p className="text-2xl font-medium text-cream">{result.adjustedFfmi}</p>
                </div>
              </div>
              <p className="text-[12px] text-text-light mb-8">Adjusted FFMI is your FFMI corrected for height, so it's the fairer number to compare against other people — see below for why.</p>

              <p className="text-[13px] text-text-muted mb-3">Closest match: <strong className="text-text-primary">{result.category}</strong></p>

              <div className="mt-8">
                <div className="relative h-4">
                  {[domain.min, ...zone.slice(0, -1).map(z => z.max)].map(val => (
                    <span key={val} className="absolute -translate-x-1/2 text-[10px] text-text-muted" style={{ left: `${((val - domain.min) / (domain.max - domain.min)) * 100}%` }}>{val}</span>
                  ))}
                </div>
                <div className="relative">
                  <div className="flex w-full h-3">
                    {zone.map((z, i) => {
                      const prevMax = i === 0 ? domain.min : zone[i - 1].max
                      const width = ((z.max - prevMax) / (domain.max - domain.min)) * 100
                      return <div key={z.label} className={z.color} style={{ width: `${width}%` }} />
                    })}
                  </div>
                  <div
                    className="absolute top-[-4px] w-0.5 h-5 bg-text-primary"
                    style={{ left: `${Math.min(100, Math.max(0, ((result.adjustedFfmi - domain.min) / (domain.max - domain.min)) * 100))}%` }}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4">
                {zone.map(z => (
                  <div key={z.label} className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 ${z.color} shrink-0`} />
                    <span className="text-[11px] text-text-muted">{z.label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-9">
            <h2 className="font-heading text-xl font-medium text-text-primary mb-6">What FFMI is, and how it's calculated</h2>
            <div className="space-y-6">
              <div>
                <p className="text-[13px] font-medium text-text-primary mb-1.5">What FFMI measures</p>
                <p className="text-[13px] text-text-muted leading-relaxed">FFMI (fat-free mass index) measures how much muscle you're carrying relative to your height — think of it as an alternative to BMI that actually accounts for body composition instead of just weight. Bodybuilders and physique athletes use it to compare muscularity across people of different heights, since raw lean mass alone favors taller people. Formula: FFMI = lean mass (kg) ÷ height (m)².</p>
              </div>
              <div>
                <p className="text-[13px] font-medium text-text-primary mb-1.5">What "adjusted" FFMI actually is</p>
                <p className="text-[13px] text-text-muted leading-relaxed">Here's the problem raw FFMI has: even at identical muscularity, a taller person's FFMI comes out slightly lower than a shorter person's, purely because of how the height-squared term in the formula scales. So a 6'4" and a 5'6" lifter who are equally muscular for their frame won't show the same raw FFMI — the taller one looks artificially "less muscular" by the number alone.</p>
                <p className="text-[13px] text-text-muted leading-relaxed mt-2">Adjusted FFMI fixes that by adding a small height-based correction — +6.3 × (1.8m − your height in meters) — that boosts the score for people taller than 1.8m (5'11") and reduces it slightly for people shorter than that. The result is a number that's actually fair to compare between people of different heights, which is what the interpretation tables and the spectrum bar above are based on. If you're close to 1.8m tall, your adjusted and raw FFMI will be nearly identical, since the correction is close to zero.</p>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-9">
            <h2 className="font-heading text-xl font-medium text-text-primary mb-6">Is there a "natural limit"?</h2>
            <div className="space-y-4">
              <p className="text-[13px] text-text-muted leading-relaxed">You'll often hear that an adjusted FFMI above 25 (for men) means someone is using steroids. That comes from real research — Kouri et al. (1995) measured 157 male athletes and found drug-free bodybuilders topped out around FFMI 25.4, while steroid users averaged notably higher (mid-to-high 20s and up), with FFMI above 25 showing up in fewer than 0.3% of the natural athletes studied.</p>
              <p className="text-[13px] text-text-muted leading-relaxed">Worth treating as a strong rule of thumb, not gospel, though — it came from one study with a specific, fairly small sample, genetics vary a lot between individuals, and a small number of outlier natural lifters do exceed it. Use it as context, not a hard ceiling on what's possible for you specifically.</p>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-9">
            <p className="text-[13px] text-text-muted leading-relaxed">Note: the category match above considers both your FFMI and body fat % together, since the same FFMI can describe very different physiques depending on leanness (a lean, muscular athlete and a bigger, softer lifter can land on similar raw FFMI numbers). If your combination doesn't cleanly fit one row, we show the closest match by FFMI alone.</p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
