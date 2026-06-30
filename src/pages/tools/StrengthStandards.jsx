import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

const standards = {
  male: {
    bench: { beginner: 0.5, novice: 0.75, intermediate: 1.0, advanced: 1.5, elite: 2.0 },
    squat: { beginner: 0.75, novice: 1.0, intermediate: 1.5, advanced: 2.0, elite: 2.5 },
    deadlift: { beginner: 1.0, novice: 1.25, intermediate: 1.75, advanced: 2.5, elite: 3.0 },
    ohp: { beginner: 0.35, novice: 0.5, intermediate: 0.75, advanced: 1.0, elite: 1.35 },
  },
  female: {
    bench: { beginner: 0.25, novice: 0.5, intermediate: 0.75, advanced: 1.0, elite: 1.5 },
    squat: { beginner: 0.5, novice: 0.75, intermediate: 1.25, advanced: 1.75, elite: 2.0 },
    deadlift: { beginner: 0.75, novice: 1.0, intermediate: 1.5, advanced: 2.0, elite: 2.5 },
    ohp: { beginner: 0.2, novice: 0.35, intermediate: 0.5, advanced: 0.75, elite: 1.0 },
  },
}

const liftNames = { bench: 'Bench Press', squat: 'Squat', deadlift: 'Deadlift', ohp: 'Overhead Press' }
const levels = ['beginner', 'novice', 'intermediate', 'advanced', 'elite']
const levelColors = { beginner: 'text-grey-400', novice: 'text-blue-400', intermediate: 'text-yellow-400', advanced: 'text-orange-400', elite: 'text-neon' }

export default function StrengthStandards() {
  const [gender, setGender] = useState('male')
  const [weight, setWeight] = useState('')
  const [unit, setUnit] = useState('kg')

  const w = parseFloat(weight)
  const weightKg = w ? (unit === 'lbs' ? w * 0.453592 : w) : null

  return (
    <div className="pt-24 pb-16 px-6">
      <div className="max-w-3xl mx-auto">
        <Link to="/tools" className="inline-flex items-center gap-2 text-grey-400 hover:text-neon no-underline text-sm mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Tools
        </Link>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-heading text-4xl font-bold text-white mb-2">Strength Standards</h1>
          <p className="text-grey-400 mb-8">See how your lifts compare.</p>

          <div className="bg-dark-800 border border-dark-500/50 rounded-2xl p-8 space-y-6">
            <div className="flex gap-3">
              <button onClick={() => setGender('male')} className={`flex-1 py-2 rounded-lg text-sm font-medium border-none cursor-pointer transition-colors ${gender === 'male' ? 'bg-neon text-dark-900' : 'bg-dark-600 text-grey-400'}`}>Male</button>
              <button onClick={() => setGender('female')} className={`flex-1 py-2 rounded-lg text-sm font-medium border-none cursor-pointer transition-colors ${gender === 'female' ? 'bg-neon text-dark-900' : 'bg-dark-600 text-grey-400'}`}>Female</button>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setUnit('kg')} className={`flex-1 py-2 rounded-lg text-sm font-medium border-none cursor-pointer transition-colors ${unit === 'kg' ? 'bg-neon text-dark-900' : 'bg-dark-600 text-grey-400'}`}>kg</button>
              <button onClick={() => setUnit('lbs')} className={`flex-1 py-2 rounded-lg text-sm font-medium border-none cursor-pointer transition-colors ${unit === 'lbs' ? 'bg-neon text-dark-900' : 'bg-dark-600 text-grey-400'}`}>lbs</button>
            </div>

            <div>
              <label className="text-xs text-grey-400 uppercase tracking-wider block mb-2">Body Weight ({unit})</label>
              <input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder={unit === 'kg' ? '80' : '176'} className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-neon transition-colors" />
            </div>
          </div>

          {weightKg && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-8 space-y-4">
              {Object.entries(standards[gender]).map(([lift, vals]) => (
                <div key={lift} className="bg-dark-800 border border-dark-500/50 rounded-2xl p-6">
                  <h3 className="font-heading text-lg font-semibold text-white mb-4">{liftNames[lift]}</h3>
                  <div className="grid grid-cols-5 gap-2">
                    {levels.map(level => {
                      const val = Math.round(weightKg * vals[level])
                      const display = unit === 'lbs' ? Math.round(val * 2.20462) : val
                      return (
                        <div key={level} className="bg-dark-700 rounded-lg p-3 text-center">
                          <p className={`text-xs uppercase tracking-wider mb-1 capitalize ${levelColors[level]}`}>{level}</p>
                          <p className="text-lg font-bold text-white">{display}</p>
                          <p className="text-xs text-grey-400">{unit}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
