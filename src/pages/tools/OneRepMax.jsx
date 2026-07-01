import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

const inputBounds = {
  weight: { metric: { min: 1, max: 500 }, imperial: { min: 2, max: 1100 } },
  reps: { min: 1, max: 20 },
}

const tablePercentages = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50]

const testSteps = [
  'Pick the lift you want to test (e.g. squat, bench, deadlift).',
  'Enter the weight and reps from your most recent real set on that lift below to get an estimated 1RM — no need to guess.',
  'Take 90% of that estimated number. That\'s your test weight for next time, not a maximal attempt.',
  'Next time you train that lift, warm up properly (5-10 minutes) and do it first in your session, while you\'re fresh.',
  'Load the bar to that 90% weight and do as many reps as you can — stop one rep short of failure if you\'re alone, or to full failure if you have a spotter.',
  'Plug that new weight × reps back into the calculator for a more accurate, much safer estimate than actually attempting a true 1-rep max.',
]

export default function OneRepMax() {
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [unit, setUnit] = useState('metric')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  function calculate() {
    const w = parseFloat(weight), r = parseInt(reps)
    if (!w || !r) {
      setError('Enter the weight and reps to calculate.')
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
    if (r < inputBounds.reps.min || r > inputBounds.reps.max) {
      setError(`Reps should be between ${inputBounds.reps.min} and ${inputBounds.reps.max}.`)
      setResult(null)
      return
    }
    setError('')

    const oneRM = w * (36 / (37 - r))
    const table = tablePercentages.map(pct => ({
      pct,
      weight: Math.round(oneRM * (pct / 100)),
      reps: Math.max(1, Math.round(37 - 36 * (pct / 100))),
    }))
    setResult({ oneRM: Math.round(oneRM), table, testedReps: r })
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
          <h1 className="font-heading text-4xl font-medium text-text-primary mb-3">One rep max calculator</h1>
          <p className="text-text-muted text-[15px] mb-10">Estimate your true max without actually testing it.</p>

          <div className="bg-white border border-border p-9 space-y-7">
            <div className="flex gap-3">
              {toggle(unit === 'metric', () => setUnit('metric'), 'Metric (kg)')}
              {toggle(unit === 'imperial', () => setUnit('imperial'), 'Imperial (lbs)')}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-2">Weight lifted ({unit === 'metric' ? 'kg' : 'lbs'})</label>
                <input type="number" min={inputBounds.weight[unit].min} max={inputBounds.weight[unit].max} value={weight} onChange={e => setWeight(e.target.value)} placeholder={unit === 'metric' ? '100' : '225'} className="w-full bg-cream border border-border px-4 py-3 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors" />
              </div>
              <div>
                <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-2">Reps completed</label>
                <input type="number" min={inputBounds.reps.min} max={inputBounds.reps.max} value={reps} onChange={e => setReps(e.target.value)} placeholder="5" className="w-full bg-cream border border-border px-4 py-3 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors" />
              </div>
            </div>

            {error && <p className="text-[13px] text-red-600">{error}</p>}

            <button onClick={calculate} className="w-full bg-text-primary text-cream font-medium py-3.5 border-none cursor-pointer text-[14px] hover:bg-accent-hover transition-colors">
              Calculate 1RM
            </button>
          </div>

          {result && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-9">
              <div className="text-center mb-8">
                <p className="text-[11px] text-text-muted uppercase tracking-wider mb-1.5">Estimated one rep max</p>
                <p className="text-4xl font-medium text-text-primary">{result.oneRM} <span className="text-lg text-text-light">{unit === 'metric' ? 'kg' : 'lbs'}</span></p>
              </div>
              <div className="space-y-2">
                {result.table.map(row => (
                  <div key={row.pct} className={`flex items-center justify-between px-4 py-3 text-[13px] ${row.pct === 100 ? 'bg-text-primary text-cream' : 'bg-cream border border-border'}`}>
                    <span className={row.pct === 100 ? 'text-cream/70 font-medium' : 'text-text-muted'}>{row.pct}%</span>
                    <span className={row.pct === 100 ? 'text-cream font-medium' : 'text-text-primary font-medium'}>{row.weight} {unit === 'metric' ? 'kg' : 'lbs'}</span>
                    <span className={row.pct === 100 ? 'text-cream/50' : 'text-text-muted'}>~{row.reps} reps</span>
                  </div>
                ))}
              </div>
              <p className="text-[13px] text-text-muted mt-6 leading-relaxed">This table is generated from the same formula as your 1RM estimate, so it has the same limitation: trust the top rows (95-100%, 1-3 reps) far more than the bottom ones (50-60%, 15+ reps) — see below for why.</p>
            </motion.div>
          )}

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-9">
            <h2 className="font-heading text-xl font-medium text-text-primary mb-6">What a 1-rep max actually is, and why it's worth knowing</h2>
            <p className="text-[13px] text-text-muted leading-relaxed">Your one-rep max (1RM) is the heaviest weight you can lift for a single, full rep of a given exercise. It's the standard reference point lifters, bodybuilders, and powerlifters use to track real strength progress over time — if your estimated 1RM is trending up, your training is working and you're getting stronger, regardless of what the scale says.</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-9">
            <h2 className="font-heading text-xl font-medium text-text-primary mb-6">The right way to test it</h2>
            <p className="text-[13px] text-text-muted leading-relaxed mb-5">Loading up a bar with your best guess and just going for one all-out rep isn't safe, and it's not even that accurate. You'll get a better, safer estimate by testing a 3-6 rep max instead and letting the calculator do the math. Here's the process:</p>
            <ol className="space-y-2.5 list-decimal list-inside">
              {testSteps.map((step, i) => (
                <li key={i} className="text-[13px] text-text-muted leading-relaxed">{step}</li>
              ))}
            </ol>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-9">
            <h2 className="font-heading text-xl font-medium text-text-primary mb-6">The formula, and why we use Brzycki</h2>
            <div className="space-y-4">
              <p className="text-[13px] text-text-muted leading-relaxed">There are several common formulas for estimating 1RM from a submaximal set:</p>
              <ul className="space-y-1.5 text-[13px] text-text-muted">
                <li><strong className="text-text-primary">Brzycki:</strong> weight × (36 / (37 − reps))</li>
                <li><strong className="text-text-primary">Epley:</strong> weight × (1 + 0.0333 × reps)</li>
                <li><strong className="text-text-primary">Lombardi:</strong> weight × reps^0.1</li>
                <li><strong className="text-text-primary">O'Conner:</strong> weight × (1 + 0.025 × reps)</li>
              </ul>
              <p className="text-[13px] text-text-muted leading-relaxed">We use Brzycki. A comparison of seven prediction formulas (LeSuer et al., 1997, Journal of Strength and Conditioning Research) found Brzycki and Epley were the most accurate for reps in the roughly 1-10 range — and that's true of every formula on this list, not just ours: all of them agree fairly closely at low reps and diverge significantly at high ones.</p>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-9">
            <h2 className="font-heading text-xl font-medium text-text-primary mb-6">The further you get from 1 rep, the less you can trust the number</h2>
            <p className="text-[13px] text-text-muted leading-relaxed">Every 1RM formula, Brzycki included, is really just a mathematical curve fit through average results — it doesn't know your individual muscular endurance. That research comparison found these formulas stay within about 2-3% of each other (and of reality) at 1-5 reps, but at 15+ reps they can disagree by 10% or more, and accuracy drops off substantially above roughly 10 reps for all of them. Practically: a set of 3-5 reps will give you a trustworthy estimate. A set of 15-20 reps will give you a rough guess at best — good enough to know the ballpark, not something to program your next training block around.</p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
