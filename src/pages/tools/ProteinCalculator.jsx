import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

const goals = [
  { label: 'Fat loss', min: 2.0, max: 2.4 },
  { label: 'Maintenance', min: 1.6, max: 2.0 },
  { label: 'Muscle gain', min: 1.8, max: 2.2 },
]

export default function ProteinCalculator() {
  const [weight, setWeight] = useState('')
  const [unit, setUnit] = useState('kg')
  const [goal, setGoal] = useState(0)
  const [result, setResult] = useState(null)

  function calculate() {
    const w = parseFloat(weight)
    if (!w) return
    const weightKg = unit === 'lbs' ? w * 0.453592 : w
    const g = goals[goal]
    setResult({ min: Math.round(weightKg * g.min), max: Math.round(weightKg * g.max), perMeal4: Math.round((weightKg * ((g.min + g.max) / 2)) / 4) })
  }

  const toggle = (active, onClick, label) => (
    <button onClick={onClick} className={`flex-1 py-2 rounded-lg text-[13px] font-medium border cursor-pointer transition-colors ${active ? 'bg-text-primary text-cream border-text-primary' : 'bg-white text-text-muted border-border hover:border-border-hover'}`}>{label}</button>
  )

  return (
    <div className="pt-24 pb-16 px-6">
      <div className="max-w-xl mx-auto">
        <Link to="/tools" className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary no-underline text-[13px] mb-8 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to tools
        </Link>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-heading text-3xl font-medium text-text-primary mb-1.5">Protein calculator</h1>
          <p className="text-text-muted text-[14px] mb-8">How much protein do you actually need?</p>

          <div className="bg-white border border-border rounded-xl p-7 space-y-5">
            <div className="flex gap-2">
              {toggle(unit === 'kg', () => setUnit('kg'), 'kg')}
              {toggle(unit === 'lbs', () => setUnit('lbs'), 'lbs')}
            </div>
            <div>
              <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-1.5">Body weight ({unit})</label>
              <input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder={unit === 'kg' ? '80' : '176'} className="w-full bg-cream border border-border rounded-lg px-3 py-2.5 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors" />
            </div>
            <div>
              <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-2">Goal</label>
              <div className="flex gap-2">
                {goals.map((g, i) => toggle(goal === i, () => setGoal(i), g.label))}
              </div>
            </div>
            <button onClick={calculate} className="w-full bg-text-primary text-cream font-medium py-2.5 rounded-lg border-none cursor-pointer text-[14px] hover:bg-accent-hover transition-colors">
              Calculate
            </button>
          </div>

          {result && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-6 bg-white border border-border rounded-xl p-7">
              <h2 className="font-heading text-lg font-medium text-text-primary mb-5">Your daily protein</h2>
              <div className="grid grid-cols-3 gap-3">
                {[['Minimum', `${result.min}g`, false], ['Maximum', `${result.max}g`, true], ['Per meal (4)', `${result.perMeal4}g`, false]].map(([label, val, highlight]) => (
                  <div key={label} className={`rounded-lg p-4 text-center ${highlight ? 'bg-text-primary' : 'bg-cream border border-border'}`}>
                    <p className={`text-[11px] uppercase tracking-wider mb-1 ${highlight ? 'text-cream/70' : 'text-text-muted'}`}>{label}</p>
                    <p className={`text-2xl font-medium ${highlight ? 'text-cream' : 'text-text-primary'}`}>{val}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
