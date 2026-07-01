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

const liftNames = { bench: 'Bench press', squat: 'Squat', deadlift: 'Deadlift', ohp: 'Overhead press' }
const levels = ['beginner', 'novice', 'intermediate', 'advanced', 'elite']

export default function StrengthStandards() {
  const [gender, setGender] = useState('male')
  const [weight, setWeight] = useState('')
  const [unit, setUnit] = useState('kg')

  const w = parseFloat(weight)
  const weightKg = w ? (unit === 'lbs' ? w * 0.453592 : w) : null

  const toggle = (active, onClick, label) => (
    <button onClick={onClick} className={`flex-1 py-2 rounded-lg text-[13px] font-medium border cursor-pointer transition-colors ${active ? 'bg-text-primary text-cream border-text-primary' : 'bg-white text-text-muted border-border hover:border-border-hover'}`}>{label}</button>
  )

  return (
    <div className="pt-24 pb-16 px-6">
      <div className="max-w-2xl mx-auto">
        <Link to="/tools" className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary no-underline text-[13px] mb-8 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to tools
        </Link>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-heading text-3xl font-medium text-text-primary mb-1.5">Strength standards</h1>
          <p className="text-text-muted text-[14px] mb-8">See how your lifts compare.</p>

          <div className="bg-white border border-border rounded-xl p-7 space-y-5">
            <div className="flex gap-2">
              {toggle(gender === 'male', () => setGender('male'), 'Male')}
              {toggle(gender === 'female', () => setGender('female'), 'Female')}
            </div>
            <div className="flex gap-2">
              {toggle(unit === 'kg', () => setUnit('kg'), 'kg')}
              {toggle(unit === 'lbs', () => setUnit('lbs'), 'lbs')}
            </div>
            <div>
              <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-1.5">Body weight ({unit})</label>
              <input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder={unit === 'kg' ? '80' : '176'} className="w-full bg-cream border border-border rounded-lg px-3 py-2.5 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors" />
            </div>
          </div>

          {weightKg && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-6 space-y-3">
              {Object.entries(standards[gender]).map(([lift, vals]) => (
                <div key={lift} className="bg-white border border-border rounded-xl p-5">
                  <h3 className="font-heading text-[14px] font-medium text-text-primary mb-3">{liftNames[lift]}</h3>
                  <div className="grid grid-cols-5 gap-2">
                    {levels.map(level => {
                      const val = Math.round(weightKg * vals[level])
                      const display = unit === 'lbs' ? Math.round(val * 2.20462) : val
                      return (
                        <div key={level} className={`rounded-lg p-2.5 text-center ${level === 'elite' ? 'bg-text-primary' : 'bg-cream'}`}>
                          <p className={`text-[10px] uppercase tracking-wider mb-0.5 capitalize ${level === 'elite' ? 'text-cream/70' : 'text-text-muted'}`}>{level}</p>
                          <p className={`text-[15px] font-medium ${level === 'elite' ? 'text-cream' : 'text-text-primary'}`}>{display}</p>
                          <p className={`text-[10px] ${level === 'elite' ? 'text-cream/50' : 'text-text-light'}`}>{unit}</p>
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
