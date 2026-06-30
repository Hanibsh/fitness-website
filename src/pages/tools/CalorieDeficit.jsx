import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function CalorieDeficit() {
  const [currentWeight, setCurrentWeight] = useState('')
  const [targetWeight, setTargetWeight] = useState('')
  const [tdee, setTdee] = useState('')
  const [deficit, setDeficit] = useState(500)
  const [unit, setUnit] = useState('kg')
  const [result, setResult] = useState(null)

  function calculate() {
    const cw = parseFloat(currentWeight)
    const tw = parseFloat(targetWeight)
    const t = parseFloat(tdee)
    if (!cw || !tw || !t || cw <= tw) return

    const weightToLose = unit === 'lbs' ? (cw - tw) * 0.453592 : cw - tw
    const totalCalories = weightToLose * 7700
    const days = Math.round(totalCalories / deficit)
    const weeks = Math.round(days / 7)

    setResult({
      days,
      weeks,
      dailyCals: Math.round(t - deficit),
      weeklyLoss: unit === 'lbs'
        ? Math.round((deficit * 7 / 7700) * 2.20462 * 10) / 10
        : Math.round((deficit * 7 / 7700) * 10) / 10,
    })
  }

  return (
    <div className="pt-24 pb-16 px-6">
      <div className="max-w-2xl mx-auto">
        <Link to="/tools" className="inline-flex items-center gap-2 text-grey-400 hover:text-neon no-underline text-sm mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Tools
        </Link>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-heading text-4xl font-bold text-white mb-2">Calorie Deficit Guide</h1>
          <p className="text-grey-400 mb-8">How long will your cut take?</p>

          <div className="bg-dark-800 border border-dark-500/50 rounded-2xl p-8 space-y-6">
            <div className="flex gap-3">
              <button onClick={() => setUnit('kg')} className={`flex-1 py-2 rounded-lg text-sm font-medium border-none cursor-pointer transition-colors ${unit === 'kg' ? 'bg-neon text-dark-900' : 'bg-dark-600 text-grey-400'}`}>kg</button>
              <button onClick={() => setUnit('lbs')} className={`flex-1 py-2 rounded-lg text-sm font-medium border-none cursor-pointer transition-colors ${unit === 'lbs' ? 'bg-neon text-dark-900' : 'bg-dark-600 text-grey-400'}`}>lbs</button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-grey-400 uppercase tracking-wider block mb-2">Current Weight ({unit})</label>
                <input type="number" value={currentWeight} onChange={e => setCurrentWeight(e.target.value)} placeholder="85" className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-neon transition-colors" />
              </div>
              <div>
                <label className="text-xs text-grey-400 uppercase tracking-wider block mb-2">Target Weight ({unit})</label>
                <input type="number" value={targetWeight} onChange={e => setTargetWeight(e.target.value)} placeholder="75" className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-neon transition-colors" />
              </div>
            </div>

            <div>
              <label className="text-xs text-grey-400 uppercase tracking-wider block mb-2">Your TDEE (cal/day)</label>
              <input type="number" value={tdee} onChange={e => setTdee(e.target.value)} placeholder="2500" className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-neon transition-colors" />
              <p className="text-xs text-grey-400 mt-1">Don't know? Use the <Link to="/tools/tdee" className="text-neon no-underline">TDEE Calculator</Link> first.</p>
            </div>

            <div>
              <label className="text-xs text-grey-400 uppercase tracking-wider block mb-3">Daily Deficit: {deficit} cal</label>
              <input type="range" min="200" max="1000" step="50" value={deficit} onChange={e => setDeficit(parseInt(e.target.value))} className="w-full accent-[#00ff88]" />
              <div className="flex justify-between text-xs text-grey-400 mt-1">
                <span>Conservative (200)</span>
                <span>Aggressive (1000)</span>
              </div>
            </div>

            <button onClick={calculate} className="w-full bg-neon text-dark-900 font-semibold py-3 rounded-lg border-none cursor-pointer text-base hover:bg-neon-dim transition-colors">
              Calculate
            </button>
          </div>

          {result && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-8 bg-dark-800 border border-neon/30 rounded-2xl p-8">
              <h2 className="font-heading text-xl font-semibold text-white mb-6">Your Cut Timeline</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-dark-700 rounded-xl p-5 text-center border border-neon/20">
                  <p className="text-xs text-neon uppercase tracking-wider mb-1">Duration</p>
                  <p className="text-2xl font-bold text-neon">{result.weeks} weeks</p>
                  <p className="text-xs text-grey-400">({result.days} days)</p>
                </div>
                <div className="bg-dark-700 rounded-xl p-5 text-center">
                  <p className="text-xs text-grey-400 uppercase tracking-wider mb-1">Daily Calories</p>
                  <p className="text-2xl font-bold text-white">{result.dailyCals}</p>
                  <p className="text-xs text-grey-400">cal/day</p>
                </div>
                <div className="bg-dark-700 rounded-xl p-5 text-center col-span-2">
                  <p className="text-xs text-grey-400 uppercase tracking-wider mb-1">Expected Weekly Loss</p>
                  <p className="text-2xl font-bold text-white">{result.weeklyLoss} {unit}/week</p>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
