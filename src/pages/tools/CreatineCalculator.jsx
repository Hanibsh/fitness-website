import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { bodyFatBounds, nearestBodyFatLabel } from '../../lib/bodyFat'
import { asset } from '../../lib/assets'

const inputBounds = {
  weight: { metric: { min: 20, max: 300 }, imperial: { min: 44, max: 660 } },
}

const CREATINE_G_PER_KG_LBM = 0.07

export default function CreatineCalculator() {
  const [unit, setUnit] = useState('metric')
  const [sex, setSex] = useState('male')
  const [bodyFat, setBodyFat] = useState(bodyFatBounds.male.default)
  const [weight, setWeight] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  function calculate() {
    const w = parseFloat(weight)
    if (!w) {
      setError('Enter your weight to calculate.')
      setResult(null)
      return
    }
    const weightRange = inputBounds.weight[unit]
    const weightUnitLabel = unit === 'imperial' ? 'lbs' : 'kg'
    if (w < weightRange.min || w > weightRange.max) {
      setError(`Weight should be between ${weightRange.min} and ${weightRange.max} ${weightUnitLabel}.`)
      setResult(null)
      return
    }
    setError('')

    const weightKg = unit === 'imperial' ? w * 0.453592 : w
    const lbm = weightKg * (1 - bodyFat / 100)
    const dose = Math.round(lbm * CREATINE_G_PER_KG_LBM * 2) / 2

    setResult({ lbm: Math.round(lbm), dose })
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
          <h1 className="font-heading text-4xl font-medium text-text-primary mb-3">Creatine calculator</h1>
          <p className="text-text-muted text-[15px] mb-10">Find your daily creatine dose — no loading phase needed.</p>

          <div className="bg-white border border-border p-9 space-y-7">
            <div className="flex gap-3">
              {toggle(unit === 'metric', () => setUnit('metric'), 'Metric (kg)')}
              {toggle(unit === 'imperial', () => setUnit('imperial'), 'Imperial (lbs)')}
            </div>
            <div className="flex gap-3">
              {toggle(sex === 'male', () => { setSex('male'); setBodyFat(bodyFatBounds.male.default) }, 'Male')}
              {toggle(sex === 'female', () => { setSex('female'); setBodyFat(bodyFatBounds.female.default) }, 'Female')}
            </div>

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

            <div>
              <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-2">Weight ({unit === 'metric' ? 'kg' : 'lbs'})</label>
              <input type="number" min={inputBounds.weight[unit].min} max={inputBounds.weight[unit].max} value={weight} onChange={e => setWeight(e.target.value)} placeholder={unit === 'metric' ? '80' : '176'} className="w-full bg-cream border border-border px-4 py-3 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors" />
            </div>

            {error && <p className="text-[13px] text-red-600">{error}</p>}

            <button onClick={calculate} className="w-full bg-text-primary text-cream font-medium py-3.5 border-none cursor-pointer text-[14px] hover:bg-accent-hover transition-colors">
              Calculate creatine dose
            </button>
          </div>

          {result && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-9">
              <h2 className="font-heading text-xl font-medium text-text-primary mb-6">Your daily dose</h2>
              <div className="bg-text-primary p-6 text-center">
                <p className="text-[11px] uppercase tracking-wider mb-1.5 text-cream/70">Take daily, every day — including rest days</p>
                <p className="text-3xl font-medium text-cream">{result.dose}g</p>
                <p className="text-[11px] text-cream/50">per day, no loading phase</p>
              </div>
              <p className="text-[13px] text-text-muted mt-6 leading-relaxed">Based on 0.07g per kg of lean body mass ({result.lbm}kg) — a research-backed maintenance dose that lands close to the classic "3-5g/day" advice for most people, while scaling sensibly if you're notably larger or smaller than average. Take it with food or a drink, any time of day that's easy to remember.</p>
            </motion.div>
          )}

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-9">
            <h2 className="font-heading text-xl font-medium text-text-primary mb-6">What creatine actually does</h2>
            <div className="space-y-4">
              <p className="text-[13px] text-text-muted leading-relaxed">Your muscles use a molecule called ATP for energy, and during short, intense efforts (heavy lifting, sprinting) they burn through it fast. Creatine helps regenerate ATP more quickly via the phosphocreatine system, which means you can typically squeeze out one or two extra reps, or slightly more power output, per set. That small edge, repeated over months of training, adds up to more total training volume — which is what actually drives long-term strength and muscle gains. Creatine also pulls water into muscle cells, which is part of why people see a bit of scale weight go up shortly after starting it — that's water, not fat.</p>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-9">
            <h2 className="font-heading text-xl font-medium text-text-primary mb-6">Good supplement, not a magic powder</h2>
            <div className="space-y-4">
              <p className="text-[13px] text-text-muted leading-relaxed">Creatine is genuinely the most-researched, most consistently effective supplement in sports nutrition — that part isn't hype. But it's a small, real edge on top of training and diet, not a replacement for either. It doesn't build muscle by itself; it slightly improves your capacity to train, and your training is what actually builds the muscle.</p>
              <p className="text-[13px] text-text-muted leading-relaxed">To put a real number on it: meta-analyses of resistance-trained individuals find creatine plus training adds roughly 1-1.4kg more lean mass than training with a placebo, over the course of a study (typically 8-12 weeks). That's a meaningful but modest bump — not a transformation, and it doesn't happen at all without the resistance training to go with it. Creatine with no training component hasn't been shown to add lean mass on its own.</p>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-9">
            <h2 className="font-heading text-xl font-medium text-text-primary mb-6">Timing, consistency, and cycling</h2>
            <div className="space-y-4">
              <p className="text-[13px] text-text-muted leading-relaxed">Time of day doesn't meaningfully matter — creatine works by fully saturating your muscle stores over time, not by an acute spike around your workout. One small 4-week study (Antonio & Ciccone, 2013) found taking it right after training produced slightly better strength and lean mass results than taking it right before — the opposite of the common assumption — but the difference was small, and other studies have found no timing effect at all. Don't stress over it; take it whenever you'll actually remember to.</p>
              <p className="text-[13px] text-text-muted leading-relaxed">Take it every day, including rest days. Creatine works by keeping your muscle stores topped up — skipping rest-day doses just means your levels drift down between sessions. And you don't need to cycle it (take breaks every few months) — unlike stimulants like caffeine, there's no tolerance or diminishing effectiveness with continuous use, and no evidence cycling provides any benefit.</p>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-9">
            <h2 className="font-heading text-xl font-medium text-text-primary mb-6">Common myths, fact-checked</h2>
            <div className="space-y-6">
              <div>
                <p className="text-[13px] font-medium text-text-primary mb-1.5">Does it cause hair loss or baldness?</p>
                <p className="text-[13px] text-text-muted leading-relaxed">No good evidence for it. The worry traces back to a single 2009 study that found creatine raised DHT levels in rugby players — but that study never actually measured hair loss. A 2024 randomized controlled trial designed specifically to test this found no significant change in DHT levels, DHT-to-testosterone ratio, hair density, follicle count, or hair thickness between creatine and placebo groups. It's a small study and doesn't fully rule out an effect in people already genetically predisposed to hair loss, but there's no evidence supporting the "creatine causes baldness" claim as commonly repeated.</p>
              </div>
              <div>
                <p className="text-[13px] font-medium text-text-primary mb-1.5">Does it harm healthy kidneys?</p>
                <p className="text-[13px] text-text-muted leading-relaxed">No. Studies using doses up to 20g/day for as long as five years have found no evidence of kidney damage in healthy people. Blood creatinine (a common kidney marker) often rises slightly on creatine, but that reflects higher creatine turnover, not reduced kidney filtration — when researchers use more accurate kidney function markers, they stay stable. The handful of case reports linking creatine to kidney problems involved people with pre-existing kidney conditions. If you have kidney disease, talk to a doctor before supplementing — otherwise, this isn't something to worry about.</p>
              </div>
              <div>
                <p className="text-[13px] font-medium text-text-primary mb-1.5">Is any form other than monohydrate worth the extra money?</p>
                <p className="text-[13px] text-text-muted leading-relaxed">Basically no. Creatine HCl, ethyl ester, buffered creatine (Kre-Alkalyn), nitrate, and other fancier forms all market themselves on better absorption or fewer side effects, but head-to-head studies haven't found them to outperform plain monohydrate — one study even found ethyl ester led to lower muscle creatine levels, since it breaks down into inactive creatinine before it's absorbed. Monohydrate has decades of research behind it and is by far the cheapest option. There's no good reason to pay more for an alternative form.</p>
              </div>
              <div>
                <p className="text-[13px] font-medium text-text-primary mb-1.5">Does it actually help your brain, not just your muscles?</p>
                <p className="text-[13px] text-text-muted leading-relaxed">The evidence here is more mixed than for muscle, but real in specific contexts. Creatine supplementation reliably raises brain creatine content, and a few groups see clearer cognitive benefits: vegetarians and vegans (who start with lower baseline creatine levels since it mainly comes from meat and fish), older adults (some studies show improved memory), and people under sleep deprivation, where a single dose has been shown to reduce the drop in cognitive performance and processing speed you'd otherwise get from being sleep-deprived. For a well-rested, well-fed omnivore, the cognitive effect is smaller and less consistent across studies — a nice possible bonus, not a guaranteed nootropic.</p>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-9">
            <p className="text-[13px] text-text-muted leading-relaxed">Quick disclaimer: I'm not a doctor or nutritionist. The research above is cited as accurately as I can, but this is general information, not personal medical advice — if you have a pre-existing condition (especially kidney-related) or take medication, check with a doctor before starting any supplement.</p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
