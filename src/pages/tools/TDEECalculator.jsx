import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

const activityLevels = [
  { label: 'Sedentary', desc: 'Desk job, little exercise', multiplier: 1.2 },
  { label: 'Lightly Active', desc: '1–3 days/week', multiplier: 1.375 },
  { label: 'Moderately Active', desc: '3–5 days/week', multiplier: 1.55 },
  { label: 'Very Active', desc: '6–7 days/week', multiplier: 1.725 },
  { label: 'Extremely Active', desc: 'Athlete / physical job', multiplier: 1.9 },
]

export default function TDEECalculator() {
  const [gender, setGender] = useState('male')
  const [age, setAge] = useState('')
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [activity, setActivity] = useState(2)
  const [unit, setUnit] = useState('metric')
  const [result, setResult] = useState(null)

  function calculate() {
    const w = parseFloat(weight)
    const h = parseFloat(height)
    const a = parseInt(age)
    if (!w || !h || !a) return

    const weightKg = unit === 'imperial' ? w * 0.453592 : w
    const heightCm = unit === 'imperial' ? h * 2.54 : h

    let bmr
    if (gender === 'male') {
      bmr = 10 * weightKg + 6.25 * heightCm - 5 * a + 5
    } else {
      bmr = 10 * weightKg + 6.25 * heightCm - 5 * a - 161
    }

    const tdee = bmr * activityLevels[activity].multiplier
    setResult({
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      cut: Math.round(tdee - 500),
      bulk: Math.round(tdee + 300),
    })
  }

  return (
    <div className="pt-24 pb-16 px-6">
      <div className="max-w-2xl mx-auto">
        <Link to="/tools" className="inline-flex items-center gap-2 text-grey-400 hover:text-neon no-underline text-sm mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Tools
        </Link>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-heading text-4xl font-bold text-white mb-2">TDEE Calculator</h1>
          <p className="text-grey-400 mb-8">Find out how many calories you burn per day.</p>

          <div className="bg-dark-800 border border-dark-500/50 rounded-2xl p-8 space-y-6">
            <div className="flex gap-3">
              <button onClick={() => setUnit('metric')} className={`flex-1 py-2 rounded-lg text-sm font-medium border-none cursor-pointer transition-colors ${unit === 'metric' ? 'bg-neon text-dark-900' : 'bg-dark-600 text-grey-400'}`}>Metric (kg/cm)</button>
              <button onClick={() => setUnit('imperial')} className={`flex-1 py-2 rounded-lg text-sm font-medium border-none cursor-pointer transition-colors ${unit === 'imperial' ? 'bg-neon text-dark-900' : 'bg-dark-600 text-grey-400'}`}>Imperial (lbs/in)</button>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setGender('male')} className={`flex-1 py-2 rounded-lg text-sm font-medium border-none cursor-pointer transition-colors ${gender === 'male' ? 'bg-neon text-dark-900' : 'bg-dark-600 text-grey-400'}`}>Male</button>
              <button onClick={() => setGender('female')} className={`flex-1 py-2 rounded-lg text-sm font-medium border-none cursor-pointer transition-colors ${gender === 'female' ? 'bg-neon text-dark-900' : 'bg-dark-600 text-grey-400'}`}>Female</button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-grey-400 uppercase tracking-wider block mb-2">Age</label>
                <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="25" className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-neon transition-colors" />
              </div>
              <div>
                <label className="text-xs text-grey-400 uppercase tracking-wider block mb-2">Weight ({unit === 'metric' ? 'kg' : 'lbs'})</label>
                <input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder={unit === 'metric' ? '80' : '176'} className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-neon transition-colors" />
              </div>
              <div>
                <label className="text-xs text-grey-400 uppercase tracking-wider block mb-2">Height ({unit === 'metric' ? 'cm' : 'in'})</label>
                <input type="number" value={height} onChange={e => setHeight(e.target.value)} placeholder={unit === 'metric' ? '180' : '71'} className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-neon transition-colors" />
              </div>
            </div>

            <div>
              <label className="text-xs text-grey-400 uppercase tracking-wider block mb-3">Activity Level</label>
              <div className="space-y-2">
                {activityLevels.map((level, i) => (
                  <button key={i} onClick={() => setActivity(i)} className={`w-full text-left px-4 py-3 rounded-lg text-sm border-none cursor-pointer transition-colors ${activity === i ? 'bg-neon-glow-strong text-neon border border-neon/30' : 'bg-dark-700 text-grey-400 hover:bg-dark-600'}`}>
                    <span className="font-medium text-white">{level.label}</span> — {level.desc}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={calculate} className="w-full bg-neon text-dark-900 font-semibold py-3 rounded-lg border-none cursor-pointer text-base hover:bg-neon-dim transition-colors">
              Calculate TDEE
            </button>
          </div>

          {result && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-8 bg-dark-800 border border-neon/30 rounded-2xl p-8">
              <h2 className="font-heading text-xl font-semibold text-white mb-6">Your Results</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-dark-700 rounded-xl p-5 text-center">
                  <p className="text-xs text-grey-400 uppercase tracking-wider mb-1">BMR</p>
                  <p className="text-2xl font-bold text-white">{result.bmr}</p>
                  <p className="text-xs text-grey-400">cal/day</p>
                </div>
                <div className="bg-dark-700 rounded-xl p-5 text-center border border-neon/20">
                  <p className="text-xs text-neon uppercase tracking-wider mb-1">TDEE</p>
                  <p className="text-2xl font-bold text-neon">{result.tdee}</p>
                  <p className="text-xs text-grey-400">cal/day</p>
                </div>
                <div className="bg-dark-700 rounded-xl p-5 text-center">
                  <p className="text-xs text-grey-400 uppercase tracking-wider mb-1">Cutting</p>
                  <p className="text-2xl font-bold text-white">{result.cut}</p>
                  <p className="text-xs text-grey-400">cal/day (−500)</p>
                </div>
                <div className="bg-dark-700 rounded-xl p-5 text-center">
                  <p className="text-xs text-grey-400 uppercase tracking-wider mb-1">Bulking</p>
                  <p className="text-2xl font-bold text-white">{result.bulk}</p>
                  <p className="text-xs text-grey-400">cal/day (+300)</p>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
