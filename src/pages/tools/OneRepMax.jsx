import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function OneRepMax() {
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [unit, setUnit] = useState('kg')
  const [result, setResult] = useState(null)

  function calculate() {
    const w = parseFloat(weight)
    const r = parseInt(reps)
    if (!w || !r || r < 1) return

    const oneRM = w * (1 + r / 30)
    const percentages = [100, 95, 90, 85, 80, 75, 70, 65, 60]
    const table = percentages.map(p => ({
      pct: p,
      weight: Math.round(oneRM * (p / 100)),
      reps: p === 100 ? 1 : p >= 95 ? 2 : p >= 90 ? 3 : p >= 85 ? 5 : p >= 80 ? 6 : p >= 75 ? 8 : p >= 70 ? 10 : p >= 65 ? 12 : 15,
    }))

    setResult({ oneRM: Math.round(oneRM), table })
  }

  return (
    <div className="pt-24 pb-16 px-6">
      <div className="max-w-2xl mx-auto">
        <Link to="/tools" className="inline-flex items-center gap-2 text-grey-400 hover:text-neon no-underline text-sm mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Tools
        </Link>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-heading text-4xl font-bold text-white mb-2">One Rep Max Calculator</h1>
          <p className="text-grey-400 mb-8">Estimate your max based on weight and reps.</p>

          <div className="bg-dark-800 border border-dark-500/50 rounded-2xl p-8 space-y-6">
            <div className="flex gap-3">
              <button onClick={() => setUnit('kg')} className={`flex-1 py-2 rounded-lg text-sm font-medium border-none cursor-pointer transition-colors ${unit === 'kg' ? 'bg-neon text-dark-900' : 'bg-dark-600 text-grey-400'}`}>kg</button>
              <button onClick={() => setUnit('lbs')} className={`flex-1 py-2 rounded-lg text-sm font-medium border-none cursor-pointer transition-colors ${unit === 'lbs' ? 'bg-neon text-dark-900' : 'bg-dark-600 text-grey-400'}`}>lbs</button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-grey-400 uppercase tracking-wider block mb-2">Weight Lifted ({unit})</label>
                <input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="100" className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-neon transition-colors" />
              </div>
              <div>
                <label className="text-xs text-grey-400 uppercase tracking-wider block mb-2">Reps Completed</label>
                <input type="number" value={reps} onChange={e => setReps(e.target.value)} placeholder="5" className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-neon transition-colors" />
              </div>
            </div>

            <button onClick={calculate} className="w-full bg-neon text-dark-900 font-semibold py-3 rounded-lg border-none cursor-pointer text-base hover:bg-neon-dim transition-colors">
              Calculate 1RM
            </button>
          </div>

          {result && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-8 bg-dark-800 border border-neon/30 rounded-2xl p-8">
              <div className="text-center mb-8">
                <p className="text-xs text-neon uppercase tracking-wider mb-1">Estimated One Rep Max</p>
                <p className="text-5xl font-bold text-white">{result.oneRM} <span className="text-xl text-grey-400">{unit}</span></p>
              </div>
              <div className="space-y-2">
                {result.table.map(row => (
                  <div key={row.pct} className={`flex items-center justify-between px-4 py-3 rounded-lg ${row.pct === 100 ? 'bg-neon-glow border border-neon/20' : 'bg-dark-700'}`}>
                    <span className={`text-sm font-medium ${row.pct === 100 ? 'text-neon' : 'text-grey-400'}`}>{row.pct}%</span>
                    <span className="text-white font-semibold">{row.weight} {unit}</span>
                    <span className="text-sm text-grey-400">~{row.reps} reps</span>
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
