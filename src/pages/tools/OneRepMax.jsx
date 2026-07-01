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
    const w = parseFloat(weight), r = parseInt(reps)
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
          <h1 className="font-heading text-3xl font-medium text-text-primary mb-1.5">One rep max calculator</h1>
          <p className="text-text-muted text-[14px] mb-8">Estimate your max based on weight and reps.</p>

          <div className="bg-white border border-border rounded-xl p-7 space-y-5">
            <div className="flex gap-2">
              {toggle(unit === 'kg', () => setUnit('kg'), 'kg')}
              {toggle(unit === 'lbs', () => setUnit('lbs'), 'lbs')}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-1.5">Weight lifted ({unit})</label>
                <input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="100" className="w-full bg-cream border border-border rounded-lg px-3 py-2.5 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors" />
              </div>
              <div>
                <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-1.5">Reps completed</label>
                <input type="number" value={reps} onChange={e => setReps(e.target.value)} placeholder="5" className="w-full bg-cream border border-border rounded-lg px-3 py-2.5 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors" />
              </div>
            </div>
            <button onClick={calculate} className="w-full bg-text-primary text-cream font-medium py-2.5 rounded-lg border-none cursor-pointer text-[14px] hover:bg-accent-hover transition-colors">
              Calculate 1RM
            </button>
          </div>

          {result && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-6 bg-white border border-border rounded-xl p-7">
              <div className="text-center mb-6">
                <p className="text-[11px] text-text-muted uppercase tracking-wider mb-1">Estimated one rep max</p>
                <p className="text-4xl font-medium text-text-primary">{result.oneRM} <span className="text-lg text-text-light">{unit}</span></p>
              </div>
              <div className="space-y-1.5">
                {result.table.map(row => (
                  <div key={row.pct} className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-[13px] ${row.pct === 100 ? 'bg-text-primary text-cream' : 'bg-cream'}`}>
                    <span className={row.pct === 100 ? 'text-cream/70 font-medium' : 'text-text-muted'}>{row.pct}%</span>
                    <span className={row.pct === 100 ? 'text-cream font-medium' : 'text-text-primary font-medium'}>{row.weight} {unit}</span>
                    <span className={row.pct === 100 ? 'text-cream/50' : 'text-text-muted'}>~{row.reps} reps</span>
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
