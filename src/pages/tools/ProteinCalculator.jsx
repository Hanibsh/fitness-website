import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

const goals = [
  { label: 'Fat Loss', min: 2.0, max: 2.4 },
  { label: 'Maintenance', min: 1.6, max: 2.0 },
  { label: 'Muscle Gain', min: 1.8, max: 2.2 },
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
    setResult({
      min: Math.round(weightKg * g.min),
      max: Math.round(weightKg * g.max),
      perMeal4: Math.round((weightKg * ((g.min + g.max) / 2)) / 4),
    })
  }

  return (
    <div className="pt-24 pb-16 px-6">
      <div className="max-w-2xl mx-auto">
        <Link to="/tools" className="inline-flex items-center gap-2 text-grey-400 hover:text-neon no-underline text-sm mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Tools
        </Link>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-heading text-4xl font-bold text-white mb-2">Protein Calculator</h1>
          <p className="text-grey-400 mb-8">How much protein do you actually need?</p>

          <div className="bg-dark-800 border border-dark-500/50 rounded-2xl p-8 space-y-6">
            <div className="flex gap-3">
              <button onClick={() => setUnit('kg')} className={`flex-1 py-2 rounded-lg text-sm font-medium border-none cursor-pointer transition-colors ${unit === 'kg' ? 'bg-neon text-dark-900' : 'bg-dark-600 text-grey-400'}`}>kg</button>
              <button onClick={() => setUnit('lbs')} className={`flex-1 py-2 rounded-lg text-sm font-medium border-none cursor-pointer transition-colors ${unit === 'lbs' ? 'bg-neon text-dark-900' : 'bg-dark-600 text-grey-400'}`}>lbs</button>
            </div>

            <div>
              <label className="text-xs text-grey-400 uppercase tracking-wider block mb-2">Body Weight ({unit})</label>
              <input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder={unit === 'kg' ? '80' : '176'} className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-neon transition-colors" />
            </div>

            <div>
              <label className="text-xs text-grey-400 uppercase tracking-wider block mb-3">Goal</label>
              <div className="flex gap-3">
                {goals.map((g, i) => (
                  <button key={g.label} onClick={() => setGoal(i)} className={`flex-1 py-3 rounded-lg text-sm font-medium border-none cursor-pointer transition-colors ${goal === i ? 'bg-neon text-dark-900' : 'bg-dark-600 text-grey-400'}`}>
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={calculate} className="w-full bg-neon text-dark-900 font-semibold py-3 rounded-lg border-none cursor-pointer text-base hover:bg-neon-dim transition-colors">
              Calculate
            </button>
          </div>

          {result && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-8 bg-dark-800 border border-neon/30 rounded-2xl p-8">
              <h2 className="font-heading text-xl font-semibold text-white mb-6">Your Daily Protein</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-dark-700 rounded-xl p-5 text-center">
                  <p className="text-xs text-grey-400 uppercase tracking-wider mb-1">Minimum</p>
                  <p className="text-2xl font-bold text-white">{result.min}g</p>
                </div>
                <div className="bg-dark-700 rounded-xl p-5 text-center border border-neon/20">
                  <p className="text-xs text-neon uppercase tracking-wider mb-1">Maximum</p>
                  <p className="text-2xl font-bold text-neon">{result.max}g</p>
                </div>
                <div className="bg-dark-700 rounded-xl p-5 text-center">
                  <p className="text-xs text-grey-400 uppercase tracking-wider mb-1">Per Meal (4)</p>
                  <p className="text-2xl font-bold text-white">{result.perMeal4}g</p>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
