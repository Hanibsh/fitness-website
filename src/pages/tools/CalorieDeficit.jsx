import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { bodyFatBounds, nearestBodyFatLabel } from '../../lib/bodyFat'
import { asset } from '../../lib/assets'

const inputBounds = {
  weight: { metric: { min: 20, max: 300 }, imperial: { min: 44, max: 660 } },
  tdee: { min: 800, max: 10000 },
}

const essentialFatFloor = { male: 5, female: 12 }

const speeds = [
  { label: 'Slow', percent: 0.25, desc: '0.25% BW/week' },
  { label: 'Moderate', percent: 0.5, desc: '0.5% BW/week' },
  { label: 'Fast', percent: 1, desc: '1% BW/week' },
]

export default function CalorieDeficit() {
  const [unit, setUnit] = useState('metric')
  const [sex, setSex] = useState('male')
  const [bodyFat, setBodyFat] = useState(bodyFatBounds.male.default)
  const [targetBodyFat, setTargetBodyFat] = useState(bodyFatBounds.male.default - 5)
  const [weight, setWeight] = useState('')
  const [tdee, setTdee] = useState('')
  const [speed, setSpeed] = useState(1)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  function calculate() {
    const w = parseFloat(weight), t = parseFloat(tdee)
    if (!w || !t) {
      setError('Enter your weight and TDEE to calculate.')
      setResult(null)
      return
    }
    const weightRange = inputBounds.weight[unit]
    const weightUnitLabel = unit === 'imperial' ? 'lbs' : 'kg'
    if (w < weightRange.min || w > weightRange.max) {
      setError(`Weight should be between ${weightRange.min} and ${weightRange.max} ${weightUnitLabel}.`)
      setResult(null)
      return
    }
    if (t < inputBounds.tdee.min || t > inputBounds.tdee.max) {
      setError(`TDEE should be between ${inputBounds.tdee.min} and ${inputBounds.tdee.max} cal/day.`)
      setResult(null)
      return
    }
    if (targetBodyFat >= bodyFat) {
      setError('Target body fat % must be lower than your current body fat %.')
      setResult(null)
      return
    }
    setError('')

    const weightKg = unit === 'imperial' ? w * 0.453592 : w
    const lbm = weightKg * (1 - bodyFat / 100)
    const targetWeightKg = lbm / (1 - targetBodyFat / 100)
    const weightToLoseKg = weightKg - targetWeightKg

    const s = speeds[speed]
    const weeklyLossKg = weightKg * (s.percent / 100)
    const dailyDeficit = Math.round((weeklyLossKg * 7700) / 7)
    const totalCalories = weightToLoseKg * 7700
    const days = Math.round(totalCalories / dailyDeficit)
    const weeks = Math.round(days / 7)

    setResult({
      weeks,
      days,
      dailyCals: Math.round(t - dailyDeficit),
      dailyDeficit,
      weightToLose: unit === 'imperial' ? Math.round(weightToLoseKg * 2.20462 * 10) / 10 : Math.round(weightToLoseKg * 10) / 10,
      belowEssential: targetBodyFat < essentialFatFloor[sex],
    })
  }

  const toggle = (active, onClick, label) => (
    <button onClick={onClick} className={`flex-1 py-3 text-[13px] font-medium border cursor-pointer transition-colors ${active ? 'bg-text-primary text-cream border-text-primary' : 'bg-white text-text-muted border-border hover:border-border-hover'}`}>{label}</button>
  )

  const bfSlider = (value, onChange, label) => (
    <input
      type="range"
      aria-label={label}
      min={bodyFatBounds[sex].min}
      max={bodyFatBounds[sex].max}
      step={1}
      value={value}
      onChange={onChange}
      style={{ backgroundImage: `linear-gradient(to right, var(--color-text-primary) ${((value - bodyFatBounds[sex].min) / (bodyFatBounds[sex].max - bodyFatBounds[sex].min)) * 100}%, var(--color-cream) 0%)` }}
      className="w-full h-2 border border-border appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-text-primary [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-text-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:bg-text-primary [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
    />
  )

  return (
    <div className="pt-28 pb-24 px-6">
      <div className="max-w-2xl mx-auto">
        <Link to="/tools" className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary no-underline text-[13px] mb-10 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to tools
        </Link>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-heading text-4xl font-medium text-text-primary mb-3">Calorie deficit guide</h1>
          <p className="text-text-muted text-[15px] mb-10">How long will it actually take to reach your goal?</p>

          <div className="bg-white border border-border p-9 space-y-7">
            <div className="flex gap-3">
              {toggle(unit === 'metric', () => setUnit('metric'), 'Metric (kg)')}
              {toggle(unit === 'imperial', () => setUnit('imperial'), 'Imperial (lbs)')}
            </div>
            <div className="flex gap-3">
              {toggle(sex === 'male', () => { setSex('male'); setBodyFat(bodyFatBounds.male.default); setTargetBodyFat(bodyFatBounds.male.default - 5) }, 'Male')}
              {toggle(sex === 'female', () => { setSex('female'); setBodyFat(bodyFatBounds.female.default); setTargetBodyFat(bodyFatBounds.female.default - 5) }, 'Female')}
            </div>

            <div>
              <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-3">Your current body fat %</label>
              <img src={asset('images/bodyfat-chart.jpeg')} alt="Body fat percentage reference chart" className="w-full border border-border mb-5" />
              <div className="flex items-baseline justify-between mb-3">
                <span className="text-[13px] text-text-muted">≈ {nearestBodyFatLabel(sex, bodyFat)}</span>
                <span className="text-2xl font-medium text-text-primary">{bodyFat}%</span>
              </div>
              {bfSlider(bodyFat, e => setBodyFat(Number(e.target.value)), 'Current body fat percentage')}
              <div className="flex justify-between text-[11px] text-text-light mt-2">
                <span>{bodyFatBounds[sex].min}%</span>
                <span>{bodyFatBounds[sex].max}%</span>
              </div>
            </div>

            <div>
              <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-3">Your target body fat %</label>
              <div className="flex items-baseline justify-between mb-3">
                <span className="text-[13px] text-text-muted">≈ {nearestBodyFatLabel(sex, targetBodyFat)}</span>
                <span className="text-2xl font-medium text-text-primary">{targetBodyFat}%</span>
              </div>
              {bfSlider(targetBodyFat, e => setTargetBodyFat(Number(e.target.value)), 'Target body fat percentage')}
              <div className="flex justify-between text-[11px] text-text-light mt-2">
                <span>{bodyFatBounds[sex].min}%</span>
                <span>{bodyFatBounds[sex].max}%</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-2">Weight ({unit === 'metric' ? 'kg' : 'lbs'})</label>
                <input type="number" min={inputBounds.weight[unit].min} max={inputBounds.weight[unit].max} value={weight} onChange={e => setWeight(e.target.value)} placeholder={unit === 'metric' ? '80' : '176'} className="w-full bg-cream border border-border px-4 py-3 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors" />
              </div>
              <div>
                <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-2">TDEE (cal/day)</label>
                <input type="number" min={inputBounds.tdee.min} max={inputBounds.tdee.max} value={tdee} onChange={e => setTdee(e.target.value)} placeholder="2500" className="w-full bg-cream border border-border px-4 py-3 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors" />
              </div>
            </div>
            <p className="text-[12px] text-text-light -mt-4">Don't know your TDEE? Use the <Link to="/tools/tdee" className="text-text-primary no-underline hover:text-accent-hover">TDEE calculator</Link> first.</p>

            <div>
              <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-2">How fast do you want to do this?</label>
              <div className="flex gap-3">
                {speeds.map((s, i) => (
                  <button key={s.label} onClick={() => setSpeed(i)} className={`flex-1 py-3 text-[13px] font-medium border cursor-pointer transition-colors ${speed === i ? 'bg-text-primary text-cream border-text-primary' : 'bg-white text-text-muted border-border hover:border-border-hover'}`}>
                    {s.label}<br /><span className={`text-[11px] ${speed === i ? 'text-cream/60' : 'text-text-light'}`}>{s.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-[13px] text-red-600">{error}</p>}

            <button onClick={calculate} className="w-full bg-text-primary text-cream font-medium py-3.5 border-none cursor-pointer text-[14px] hover:bg-accent-hover transition-colors">
              Calculate timeline
            </button>
          </div>

          {result && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-9">
              <h2 className="font-heading text-xl font-medium text-text-primary mb-6">Your timeline</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-text-primary p-5 text-center">
                  <p className="text-[11px] text-cream/70 uppercase tracking-wider mb-1.5">Duration</p>
                  <p className="text-2xl font-medium text-cream">{result.weeks} weeks</p>
                  <p className="text-[11px] text-cream/50">({result.days} days)</p>
                </div>
                <div className="bg-cream border border-border p-5 text-center">
                  <p className="text-[11px] text-text-muted uppercase tracking-wider mb-1.5">Daily calories</p>
                  <p className="text-2xl font-medium text-text-primary">{result.dailyCals}</p>
                  <p className="text-[11px] text-text-light">cal/day</p>
                </div>
                <div className="bg-cream border border-border p-5 text-center col-span-2">
                  <p className="text-[11px] text-text-muted uppercase tracking-wider mb-1.5">Weight to lose</p>
                  <p className="text-2xl font-medium text-text-primary">{result.weightToLose} {unit === 'metric' ? 'kg' : 'lbs'}</p>
                </div>
              </div>
              {result.belowEssential && (
                <p className="text-[13px] text-red-600 mt-6 leading-relaxed">Your target is below the essential body fat range for your sex (~{essentialFatFloor[sex]}% floor). That's not just "very lean" — it's a level associated with real hormonal disruption. See the essential fat section below before committing to this target.</p>
              )}
            </motion.div>
          )}

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-9">
            <h2 className="font-heading text-xl font-medium text-text-primary mb-6">How long can you actually stay in a deficit?</h2>
            <div className="space-y-4">
              <p className="text-[13px] text-text-muted leading-relaxed">Technically, there's no fixed universal time limit — you can stay in a deficit for as long as a few conditions keep holding up: your genetics allow you to keep losing fat (and ideally retain or even build some muscle) without your body fighting back too hard, your sleep stays normal, and your hormones stay stable. The moment any of those start to break down, that's your body telling you to stop the cut regardless of what the calculator above says, not something to push through.</p>
              <p className="text-[13px] text-text-muted leading-relaxed">In practice, those conditions get harder to meet the longer and deeper you diet — which is really the answer to "how long," it's less a fixed number and more a function of how your body's actually responding.</p>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-9">
            <h2 className="font-heading text-xl font-medium text-text-primary mb-6">Why it gets harder the leaner you get</h2>
            <div className="space-y-4">
              <p className="text-[13px] text-text-muted leading-relaxed">This isn't just in your head. A widely-cited sports nutrition review (Trexler et al., 2014, Journal of the International Society of Sports Nutrition) documents that as you diet, leptin (the hormone that signals fullness and long-term energy status) drops, thyroid hormone (T3) drops, and resting heart rate drops — all of which increase hunger and cravings while your body actively tries to defend its previous weight. Your total energy expenditure also decreases by more than what's predicted just from losing body mass, a phenomenon called adaptive thermogenesis or "metabolic adaptation" — your body gets more efficient at running on less, which slows further fat loss and explains why the same deficit that worked at 20% body fat stops working as well at 12%.</p>
              <p className="text-[13px] text-text-muted leading-relaxed">This effect doesn't necessarily reverse quickly once you stop dieting either — a 6-year follow-up of "The Biggest Loser" contestants (Fothergill et al., 2016) found resting metabolic rate was still suppressed by an average of ~700 calories/day compared to baseline, years after the show ended, even in people who regained much of the weight. The takeaway isn't "dieting permanently breaks your metabolism" — later analysis attributed much of that to large, sustained changes in activity level — but it does show these adaptations are real, can persist, and are a good reason not to treat extreme, prolonged deficits casually.</p>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-9">
            <h2 className="font-heading text-xl font-medium text-text-primary mb-6">There's a real floor: essential fat</h2>
            <div className="space-y-4">
              <p className="text-[13px] text-text-muted leading-relaxed">Everyone has a minimum amount of "essential fat" needed for basic hormonal and organ function — roughly 2-5% for men and 10-13% for women (higher for women due to the fat tissue's role in estrogen production and reproductive function). Below that, the body starts sacrificing function to keep going: in men, testosterone can drop sharply, bringing muscle loss, low libido, and fatigue with it. In women, low body fat commonly causes hypothalamic amenorrhea (loss of the menstrual cycle) along with dropping estrogen, which accelerates bone density loss and disrupts sleep, mood, and immune function.</p>
              <p className="text-[13px] text-text-muted leading-relaxed">Here's the important nuance — this floor isn't identical for everyone. One study comparing women who had lost their periods to women who hadn't found the amenorrheic group averaged around 21.5% body fat versus 25% in those still cycling normally — both well above the bare "essential fat" minimum of 10-13%. In other words, genetics determine exactly where your personal line is, and it can be higher than the textbook floor. Getting very lean isn't inherently dangerous, but it's not something to chase indefinitely without paying attention to how your body (and specifically your sleep, mood, libido, and — for women — menstrual cycle) is actually responding.</p>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-9">
            <p className="text-[13px] text-text-muted leading-relaxed">Quick disclaimer: I'm not a doctor or nutritionist. This is general information based on the research cited and my own coaching experience, not personalized medical advice. If your cycle stops, your sleep is falling apart, or something just feels off, that's worth a conversation with an actual doctor — not something to push through for the sake of a number on this calculator.</p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
