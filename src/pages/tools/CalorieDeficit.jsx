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
    const cw = parseFloat(currentWeight), tw = parseFloat(targetWeight), t = parseFloat(tdee)
    if (!cw || !tw || !t || cw <= tw) return
    const weightToLose = unit === 'lbs' ? (cw - tw) * 0.453592 : cw - tw
    const totalCalories = weightToLose * 7700
    const days = Math.round(totalCalories / deficit)
    const weeks = Math.round(days / 7)
    setResult({
      days, weeks, dailyCals: Math.round(t - deficit),
      weeklyLoss: unit === 'lbs' ? Math.round((deficit * 7 / 7700) * 2.20462 * 10) / 10 : Math.round((deficit * 7 / 7700) * 10) / 10,
    })
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
          <h1 className="font-heading text-3xl font-medium text-text-primary mb-1.5">Calorie deficit guide</h1>
          <p className="text-text-muted text-[14px] mb-8">How long will your cut take?</p>

          <div className="bg-white border border-border rounded-xl p-7 space-y-5">
            <div className="flex gap-2">
              {toggle(unit === 'kg', () => setUnit('kg'), 'kg')}
              {toggle(unit === 'lbs', () => setUnit('lbs'), 'lbs')}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-1.5">Current weight ({unit})</label>
                <input type="number" value={currentWeight} onChange={e => setCurrentWeight(e.target.value)} placeholder="85" className="w-full bg-cream border border-border rounded-lg px-3 py-2.5 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors" />
              </div>
              <div>
                <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-1.5">Target weight ({unit})</label>
                <input type="number" value={targetWeight} onChange={e => setTargetWeight(e.target.value)} placeholder="75" className="w-full bg-cream border border-border rounded-lg px-3 py-2.5 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors" />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-1.5">Your TDEE (cal/day)</label>
              <input type="number" value={tdee} onChange={e => setTdee(e.target.value)} placeholder="2500" className="w-full bg-cream border border-border rounded-lg px-3 py-2.5 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors" />
              <p className="text-[12px] text-text-light mt-1">Don't know? Use the <Link to="/tools/tdee" className="text-text-primary no-underline hover:text-accent-hover">TDEE calculator</Link> first.</p>
            </div>
            <div>
              <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-2">Daily deficit: {deficit} cal</label>
              <input type="range" min="200" max="1000" step="50" value={deficit} onChange={e => setDeficit(parseInt(e.target.value))} className="w-full accent-[#1a1a1a]" />
              <div className="flex justify-between text-[11px] text-text-light mt-1">
                <span>Conservative (200)</span>
                <span>Aggressive (1000)</span>
              </div>
            </div>
            <button onClick={calculate} className="w-full bg-text-primary text-cream font-medium py-2.5 rounded-lg border-none cursor-pointer text-[14px] hover:bg-accent-hover transition-colors">
              Calculate
            </button>
          </div>

          {result && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-6 bg-white border border-border rounded-xl p-7">
              <h2 className="font-heading text-lg font-medium text-text-primary mb-5">Your cut timeline</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-text-primary rounded-lg p-4 text-center">
                  <p className="text-[11px] text-cream/70 uppercase tracking-wider mb-1">Duration</p>
                  <p className="text-2xl font-medium text-cream">{result.weeks} weeks</p>
                  <p className="text-[11px] text-cream/50">({result.days} days)</p>
                </div>
                <div className="bg-cream border border-border rounded-lg p-4 text-center">
                  <p className="text-[11px] text-text-muted uppercase tracking-wider mb-1">Daily calories</p>
                  <p className="text-2xl font-medium text-text-primary">{result.dailyCals}</p>
                  <p className="text-[11px] text-text-light">cal/day</p>
                </div>
                <div className="bg-cream border border-border rounded-lg p-4 text-center col-span-2">
                  <p className="text-[11px] text-text-muted uppercase tracking-wider mb-1">Expected weekly loss</p>
                  <p className="text-2xl font-medium text-text-primary">{result.weeklyLoss} {unit}/week</p>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
