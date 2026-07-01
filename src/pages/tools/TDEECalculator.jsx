import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

const activityLevels = [
  { label: 'Sedentary', desc: 'Desk job, little exercise', multiplier: 1.2 },
  { label: 'Lightly active', desc: '1–3 days/week', multiplier: 1.375 },
  { label: 'Moderately active', desc: '3–5 days/week', multiplier: 1.55 },
  { label: 'Very active', desc: '6–7 days/week', multiplier: 1.725 },
  { label: 'Extremely active', desc: 'Athlete / physical job', multiplier: 1.9 },
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
    const w = parseFloat(weight), h = parseFloat(height), a = parseInt(age)
    if (!w || !h || !a) return
    const weightKg = unit === 'imperial' ? w * 0.453592 : w
    const heightCm = unit === 'imperial' ? h * 2.54 : h
    let bmr = gender === 'male'
      ? 10 * weightKg + 6.25 * heightCm - 5 * a + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * a - 161
    const tdee = bmr * activityLevels[activity].multiplier
    setResult({ bmr: Math.round(bmr), tdee: Math.round(tdee), cut: Math.round(tdee - 500), bulk: Math.round(tdee + 300) })
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
          <h1 className="font-heading text-3xl font-medium text-text-primary mb-1.5">TDEE calculator</h1>
          <p className="text-text-muted text-[14px] mb-8">Find out how many calories you burn per day.</p>

          <div className="bg-white border border-border rounded-xl p-7 space-y-5">
            <div className="flex gap-2">
              {toggle(unit === 'metric', () => setUnit('metric'), 'Metric (kg/cm)')}
              {toggle(unit === 'imperial', () => setUnit('imperial'), 'Imperial (lbs/in)')}
            </div>
            <div className="flex gap-2">
              {toggle(gender === 'male', () => setGender('male'), 'Male')}
              {toggle(gender === 'female', () => setGender('female'), 'Female')}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[['Age', age, setAge, '25'], ['Weight', weight, setWeight, unit === 'metric' ? '80' : '176'], ['Height', height, setHeight, unit === 'metric' ? '180' : '71']].map(([label, val, set, ph]) => (
                <div key={label}>
                  <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-1.5">{label}{label !== 'Age' ? ` (${label === 'Weight' ? (unit === 'metric' ? 'kg' : 'lbs') : (unit === 'metric' ? 'cm' : 'in')})` : ''}</label>
                  <input type="number" value={val} onChange={e => set(e.target.value)} placeholder={ph} className="w-full bg-cream border border-border rounded-lg px-3 py-2.5 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors" />
                </div>
              ))}
            </div>
            <div>
              <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-2">Activity level</label>
              <div className="space-y-1.5">
                {activityLevels.map((level, i) => (
                  <button key={i} onClick={() => setActivity(i)} className={`w-full text-left px-3 py-2.5 rounded-lg text-[13px] border cursor-pointer transition-colors ${activity === i ? 'bg-text-primary text-cream border-text-primary' : 'bg-cream text-text-muted border-border hover:border-border-hover'}`}>
                    <span className={activity === i ? 'text-cream font-medium' : 'text-text-primary font-medium'}>{level.label}</span> — {level.desc}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={calculate} className="w-full bg-text-primary text-cream font-medium py-2.5 rounded-lg border-none cursor-pointer text-[14px] hover:bg-accent-hover transition-colors">
              Calculate TDEE
            </button>
          </div>

          {result && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-6 bg-white border border-border rounded-xl p-7">
              <h2 className="font-heading text-lg font-medium text-text-primary mb-5">Your results</h2>
              <div className="grid grid-cols-2 gap-3">
                {[['BMR', result.bmr, false], ['TDEE', result.tdee, true], ['Cutting (−500)', result.cut, false], ['Bulking (+300)', result.bulk, false]].map(([label, val, highlight]) => (
                  <div key={label} className={`rounded-lg p-4 text-center ${highlight ? 'bg-text-primary' : 'bg-cream border border-border'}`}>
                    <p className={`text-[11px] uppercase tracking-wider mb-1 ${highlight ? 'text-cream/70' : 'text-text-muted'}`}>{label}</p>
                    <p className={`text-2xl font-medium ${highlight ? 'text-cream' : 'text-text-primary'}`}>{val}</p>
                    <p className={`text-[11px] ${highlight ? 'text-cream/50' : 'text-text-light'}`}>cal/day</p>
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
