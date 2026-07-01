import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function CreatineCalculator() {
  const [weight, setWeight] = useState('')
  const [unit, setUnit] = useState('kg')
  const [result, setResult] = useState(null)

  function calculate() {
    const w = parseFloat(weight)
    if (!w) return
    const weightKg = unit === 'lbs' ? w * 0.453592 : w
    setResult({ loading: Math.round(weightKg * 0.3 * 10) / 10, maintenance: Math.round(weightKg * 0.05 * 10) / 10, standard: 5 })
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
          <h1 className="font-heading text-3xl font-medium text-text-primary mb-1.5">Creatine calculator</h1>
          <p className="text-text-muted text-[14px] mb-8">Find your optimal creatine dosage.</p>

          <div className="bg-white border border-border rounded-xl p-7 space-y-5">
            <div className="flex gap-2">
              {toggle(unit === 'kg', () => setUnit('kg'), 'kg')}
              {toggle(unit === 'lbs', () => setUnit('lbs'), 'lbs')}
            </div>
            <div>
              <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-1.5">Body weight ({unit})</label>
              <input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder={unit === 'kg' ? '80' : '176'} className="w-full bg-cream border border-border rounded-lg px-3 py-2.5 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors" />
            </div>
            <button onClick={calculate} className="w-full bg-text-primary text-cream font-medium py-2.5 rounded-lg border-none cursor-pointer text-[14px] hover:bg-accent-hover transition-colors">
              Calculate
            </button>
          </div>

          {result && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-6 bg-white border border-border rounded-xl p-7">
              <h2 className="font-heading text-lg font-medium text-text-primary mb-5">Your creatine dosage</h2>
              <div className="space-y-3">
                {[
                  ['Loading phase (5–7 days)', 'Split into 4 doses throughout the day', `${result.loading}g`, '/day', true],
                  ['Maintenance (ongoing)', 'Take once daily with a meal', `${result.maintenance}g`, '/day', false],
                  ['Standard dose (no loading)', 'Simple approach — just take 5g daily', `${result.standard}g`, '/day', false],
                ].map(([title, desc, val, suffix, highlight]) => (
                  <div key={title} className={`rounded-lg p-5 flex justify-between items-center ${highlight ? 'bg-text-primary' : 'bg-cream border border-border'}`}>
                    <div>
                      <p className={`text-[13px] font-medium mb-0.5 ${highlight ? 'text-cream' : 'text-text-primary'}`}>{title}</p>
                      <p className={`text-[12px] ${highlight ? 'text-cream/60' : 'text-text-muted'}`}>{desc}</p>
                    </div>
                    <p className={`text-xl font-medium ${highlight ? 'text-cream' : 'text-text-primary'}`}>{val}<span className={`text-[12px] ${highlight ? 'text-cream/50' : 'text-text-light'}`}>{suffix}</span></p>
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
