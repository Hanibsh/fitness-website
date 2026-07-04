import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { bodyFatBounds, nearestBodyFatLabel } from '../../lib/bodyFat'
import { asset } from '../../lib/assets'

const inputBounds = {
  age: { min: 10, max: 100 },
  weight: { metric: { min: 20, max: 300 }, imperial: { min: 44, max: 660 } },
  trainingHours: { min: 0, max: 40 },
}

const topSources = [
  { food: 'Chicken breast', serving: '100g cooked', grams: 31 },
  { food: 'Lean beef', serving: '100g cooked', grams: 26 },
  { food: 'Tuna', serving: '100g, drained', grams: 26 },
  { food: 'Salmon', serving: '100g cooked', grams: 25 },
  { food: 'Whey protein', serving: '1 scoop (~30g)', grams: 24 },
  { food: 'Greek yogurt', serving: '1 cup (170g)', grams: 17 },
  { food: 'Cottage cheese', serving: '100g', grams: 11 },
  { food: 'Edamame', serving: '100g', grams: 11 },
  { food: 'Lentils', serving: '100g cooked', grams: 9 },
  { food: 'Chickpeas', serving: '100g cooked', grams: 9 },
  { food: 'Milk', serving: '250ml glass', grams: 8.5 },
  { food: 'Tofu', serving: '100g firm', grams: 8 },
  { food: 'Peanut butter', serving: '2 tbsp (32g)', grams: 8 },
  { food: 'Eggs', serving: '1 large', grams: 6 },
  { food: 'Almonds', serving: '30g handful', grams: 6 },
]

const overlookedCarbs = [
  { food: 'Pasta', serving: '1 cup cooked (140g)', grams: 8 },
  { food: 'Bread (whole wheat)', serving: '2 slices (56g)', grams: 7 },
  { food: 'Oats', serving: '1 cup cooked (234g)', grams: 6 },
  { food: 'Corn', serving: '1 cup (154g)', grams: 5 },
  { food: 'White rice', serving: '1 cup cooked (158g)', grams: 4.3 },
  { food: 'Potato', serving: '1 medium (150g)', grams: 3 },
]

const aminoCombos = [
  { combo: 'Rice + beans or lentils', covers: 'Rice is low in lysine but has methionine; beans/lentils are high in lysine but low in methionine — together they cover both.' },
  { combo: 'Hummus + pita or whole wheat bread', covers: 'Chickpeas (high lysine, lower methionine) + wheat (higher methionine, lower lysine).' },
  { combo: 'Peanut butter + whole wheat bread', covers: 'Same grain + legume pairing as above, in sandwich form.' },
  { combo: 'Corn + black beans', covers: 'Classic Latin American pairing — same grain/legume logic.' },
  { combo: 'Dal (lentils) + rice', covers: 'Traditional South Asian staple — grain + legume again.' },
]

const AGE_PROTEIN_BUMP = 1.15
const VEGAN_PROTEIN_BUMP = 1.15

export default function ProteinCalculator() {
  const [unit, setUnit] = useState('metric')
  const [sex, setSex] = useState('male')
  const [bodyFat, setBodyFat] = useState(bodyFatBounds.male.default)
  const [age, setAge] = useState('')
  const [weight, setWeight] = useState('')
  const [vegan, setVegan] = useState(false)
  const [trainingHours, setTrainingHours] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  function calculate() {
    const w = parseFloat(weight), a = parseInt(age)
    const hours = parseFloat(trainingHours) || 0

    if (!w || !a) {
      setError('Enter your age and weight to calculate.')
      setResult(null)
      return
    }

    const weightRange = inputBounds.weight[unit]
    const weightUnitLabel = unit === 'imperial' ? 'lbs' : 'kg'

    if (a < inputBounds.age.min || a > inputBounds.age.max) {
      setError(`Age should be between ${inputBounds.age.min} and ${inputBounds.age.max}.`)
      setResult(null)
      return
    }
    if (w < weightRange.min || w > weightRange.max) {
      setError(`Weight should be between ${weightRange.min} and ${weightRange.max} ${weightUnitLabel}.`)
      setResult(null)
      return
    }
    if (hours < inputBounds.trainingHours.min || hours > inputBounds.trainingHours.max) {
      setError(`Training hours should be between ${inputBounds.trainingHours.min} and ${inputBounds.trainingHours.max}.`)
      setResult(null)
      return
    }
    setError('')

    const weightKg = unit === 'imperial' ? w * 0.453592 : w
    const lbm = weightKg * (1 - bodyFat / 100)

    const t = Math.min(hours, 12) / 12
    const baseMinPerKg = 1.6 + 0.5 * t
    const baseMaxPerKg = 2.1 + 0.8 * t
    const leanBonus = Math.max(0, 20 - bodyFat) * 0.01
    const ageBumped = a >= 60
    const multiplier = (1 + leanBonus) * (ageBumped ? AGE_PROTEIN_BUMP : 1) * (vegan ? VEGAN_PROTEIN_BUMP : 1)

    const minG = lbm * baseMinPerKg * multiplier
    const maxG = lbm * baseMaxPerKg * multiplier
    const optimalFraction = 0.45 + 0.4 * t
    const optimalG = minG + (maxG - minG) * optimalFraction

    setResult({
      lbm: Math.round(lbm),
      min: Math.round(minG),
      max: Math.round(maxG),
      optimal: Math.round(optimalG),
      ageBumped,
      vegan,
      leanBonusPercent: Math.round(leanBonus * 100),
      trainingHours: hours,
    })
  }

  const toggle = (active, onClick, label) => (
    <button onClick={onClick} className={`flex-1 py-3 text-[13px] font-medium border cursor-pointer transition-colors ${active ? 'bg-text-primary text-cream border-text-primary' : 'bg-white text-text-muted border-border hover:border-border-hover'}`}>{label}</button>
  )

  return (
    <div className="pt-28 pb-24 px-6">
      <div className="max-w-2xl mx-auto">
        <Link to="/tools" className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary no-underline text-[13px] mb-10 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to tools
        </Link>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-heading text-4xl font-medium text-text-primary mb-3">Protein calculator</h1>
          <p className="text-text-muted text-[15px] mb-10">How much protein do you actually need — and how much is too much?</p>

          <div className="bg-white border border-border p-9 space-y-7">
            <div className="flex gap-3">
              {toggle(unit === 'metric', () => setUnit('metric'), 'Metric (kg)')}
              {toggle(unit === 'imperial', () => setUnit('imperial'), 'Imperial (lbs)')}
            </div>
            <div className="flex gap-3">
              {toggle(sex === 'male', () => { setSex('male'); setBodyFat(bodyFatBounds.male.default) }, 'Male')}
              {toggle(sex === 'female', () => { setSex('female'); setBodyFat(bodyFatBounds.female.default) }, 'Female')}
            </div>

            <div>
              <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-3">Estimate your body fat %</label>
              <img src={asset('images/bodyfat-chart.jpeg')} alt="Body fat percentage reference chart" className="w-full border border-border mb-5" />
              <div className="flex items-baseline justify-between mb-3">
                <span className="text-[13px] text-text-muted">≈ {nearestBodyFatLabel(sex, bodyFat)}</span>
                <span className="text-2xl font-medium text-text-primary">{bodyFat}%</span>
              </div>
              <input
                type="range"
                aria-label="Body fat percentage"
                min={bodyFatBounds[sex].min}
                max={bodyFatBounds[sex].max}
                step={1}
                value={bodyFat}
                onChange={e => setBodyFat(Number(e.target.value))}
                style={{ backgroundImage: `linear-gradient(to right, var(--color-text-primary) ${((bodyFat - bodyFatBounds[sex].min) / (bodyFatBounds[sex].max - bodyFatBounds[sex].min)) * 100}%, var(--color-cream) 0%)` }}
                className="w-full h-2 border border-border appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-text-primary [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-text-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:bg-text-primary [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-text-light mt-2">
                <span>{bodyFatBounds[sex].min}%</span>
                <span>{bodyFatBounds[sex].max}%</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-2">Age</label>
                <input type="number" min={inputBounds.age.min} max={inputBounds.age.max} value={age} onChange={e => setAge(e.target.value)} placeholder="25" className="w-full bg-cream border border-border px-4 py-3 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors" />
              </div>
              <div>
                <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-2">Weight ({unit === 'metric' ? 'kg' : 'lbs'})</label>
                <input type="number" min={inputBounds.weight[unit].min} max={inputBounds.weight[unit].max} value={weight} onChange={e => setWeight(e.target.value)} placeholder={unit === 'metric' ? '80' : '176'} className="w-full bg-cream border border-border px-4 py-3 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors" />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-2">Training (hrs/week)</label>
              <input type="number" min={inputBounds.trainingHours.min} max={inputBounds.trainingHours.max} value={trainingHours} onChange={e => setTrainingHours(e.target.value)} placeholder="5" className="w-full bg-cream border border-border px-4 py-3 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors" />
            </div>

            <div className="flex gap-3">
              {toggle(!vegan, () => setVegan(false), 'Omnivore')}
              {toggle(vegan, () => setVegan(true), 'Vegan')}
            </div>

            {error && <p className="text-[13px] text-red-600">{error}</p>}

            <button onClick={calculate} className="w-full bg-text-primary text-cream font-medium py-3.5 border-none cursor-pointer text-[14px] hover:bg-accent-hover transition-colors">
              Calculate protein
            </button>
          </div>

          {result && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-9">
              <h2 className="font-heading text-xl font-medium text-text-primary mb-6">Your daily protein</h2>
              <div className="grid grid-cols-3 gap-4">
                {[['Minimum', result.min, false], ['Optimal', result.optimal, true], ['Maximum', result.max, false]].map(([label, val, highlight]) => (
                  <div key={label} className={`p-4 text-center ${highlight ? 'bg-text-primary' : 'bg-cream border border-border'}`}>
                    <p className={`text-[11px] uppercase tracking-wider mb-1.5 ${highlight ? 'text-cream/70' : 'text-text-muted'}`}>{label}</p>
                    <p className={`text-2xl font-medium ${highlight ? 'text-cream' : 'text-text-primary'}`}>{val}</p>
                    <p className={`text-[11px] ${highlight ? 'text-cream/50' : 'text-text-light'}`}>grams/day</p>
                  </div>
                ))}
              </div>
              {(result.ageBumped || result.vegan || result.leanBonusPercent > 0) && (
                <p className="text-[13px] text-text-muted mt-6 leading-relaxed">
                  Adjustments factored in: {[
                    result.leanBonusPercent > 0 && `+${result.leanBonusPercent}% for leanness (less fat reserve, more muscle mass to support)`,
                    result.ageBumped && '+15% for age 60+ (anabolic resistance)',
                    result.vegan && '+15% for vegan (lower digestibility and leucine content of most plant proteins)',
                  ].filter(Boolean).join(', ')}.
                </p>
              )}
            </motion.div>
          )}

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-9">
            <h2 className="font-heading text-xl font-medium text-text-primary mb-6">Why protein, and why these inputs?</h2>
            <div className="space-y-6">
              <div>
                <p className="text-[13px] font-medium text-text-primary mb-1.5">Why you need protein at all</p>
                <p className="text-[13px] text-text-muted leading-relaxed">Protein isn't just for building muscle. It repairs tissue damaged by training and daily life, builds the enzymes and hormones that run your metabolism, forms antibodies for your immune system, and makes up structural tissue like skin, hair, and connective tissue. It's also the most filling macronutrient, which makes sticking to a calorie target a lot easier.</p>
              </div>
              <div>
                <p className="text-[13px] font-medium text-text-primary mb-1.5">Why weight and body fat % (lean body mass)</p>
                <p className="text-[13px] text-text-muted leading-relaxed">Protein needs track with muscle mass, not fat mass — fat tissue doesn't need much protein upkeep. Dosing per kilogram of total bodyweight overestimates the needs of someone carrying more body fat, so we calculate your lean body mass first (weight × (1 − body fat %)) and dose from that instead.</p>
              </div>
              <div>
                <p className="text-[13px] font-medium text-text-primary mb-1.5">Why training hours per week</p>
                <p className="text-[13px] text-text-muted leading-relaxed">A 2018 meta-analysis (Morton et al., British Journal of Sports Medicine, 49 studies, 1,863 participants) found gains in lean mass from added protein plateau around 1.6g/kg bodyweight on average, with the upper 95% confidence interval reaching about 2.2g/kg. Critically, the effect of extra protein was larger in resistance-trained subjects than in untrained ones — so the more and harder you train, the more of that upper range you can actually put to use. That's why your range scales up with your weekly training hours, and why the "optimal" number leans closer to your maximum — not just the middle — the more you train.</p>
              </div>
              <div>
                <p className="text-[13px] font-medium text-text-primary mb-1.5">Why leaner physiques get a bit more</p>
                <p className="text-[13px] text-text-muted leading-relaxed">Research on protein needs during dieting (Helms et al.) found that leaner, more resistance-trained individuals benefit from skewing toward the higher end of the protein range — they're carrying less fat as an energy buffer and proportionally more muscle mass that's actively being broken down and rebuilt. We add up to a 16% bonus on top of your range as your body fat % drops below 20%, scaling with how lean you are.</p>
              </div>
              <div>
                <p className="text-[13px] font-medium text-text-primary mb-1.5">Why age matters</p>
                <p className="text-[13px] text-text-muted leading-relaxed">Muscle becomes more resistant to the anabolic effect of a given protein dose as you age — a phenomenon called anabolic resistance. Expert groups (the PROT-AGE study group, ESPEN guidelines) recommend older adults target meaningfully more protein than the standard 0.8g/kg RDA to compensate. We apply a +15% adjustment to your range starting at age 60.</p>
              </div>
              <div>
                <p className="text-[13px] font-medium text-text-primary mb-1.5">Why vegan matters</p>
                <p className="text-[13px] text-text-muted leading-relaxed">Most plant proteins have lower digestibility and lower leucine content (the amino acid that most directly triggers muscle protein synthesis) than animal proteins. Research on protein quality (DIAAS scoring) suggests vegans typically need roughly 10-20% more total protein to match the anabolic response of an omnivore diet — less of an issue if you deliberately combine varied plant sources (legumes, grains, soy), but a reasonable default adjustment otherwise. We apply +15%.</p>
              </div>
              <div>
                <p className="text-[13px] font-medium text-text-primary mb-1.5">Why we ask for sex</p>
                <p className="text-[13px] text-text-muted leading-relaxed">Not to apply a separate multiplier — there's no strong evidence that protein needs differ by sex at the same lean body mass. It's used purely to show you the right reference chart and range when estimating body fat %.</p>
              </div>
              <div>
                <p className="text-[13px] font-medium text-text-primary mb-1.5">What happens if you eat more than the maximum</p>
                <p className="text-[13px] text-text-muted leading-relaxed">Nothing dramatic. Protein beyond what your body can use for repair and growth gets oxidized for energy or its nitrogen gets excreted — it won't build extra muscle beyond what your training and genetics allow, but it's not dangerous either. Reviews of high-protein intakes in healthy adults have found no evidence of harm to kidney function; the caution around high protein specifically applies to people with pre-existing kidney disease, who should follow medical guidance instead of a general calculator.</p>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-9">
            <h2 className="font-heading text-xl font-medium text-text-primary mb-6">Is chasing more protein actually worth it?</h2>
            <div className="space-y-4">
              <p className="text-[13px] text-text-muted leading-relaxed">Honestly, protein gets more attention than it probably deserves relative to the rest of your diet. The research this calculator is built on (Morton et al. 2018) already found that muscle gains from added protein plateau — going past your maximum here doesn't build extra muscle, it just gets used for energy or excreted. And in endurance research, tripling protein intake (1.5g/kg to 3.0g/kg) while holding carbs constant produced no extra performance benefit at all.</p>
              <p className="text-[13px] text-text-muted leading-relaxed">Protein is also a poor fuel source during training — carbohydrate is what actually powers your workouts, replenishes muscle glycogen, and lets you train hard and recover well session to session. Low glycogen from under-eating carbs (often to make room for more protein) means earlier fatigue, lower training quality, and worse long-term results — which is ironic, since that's the opposite of what people chasing extra protein are usually trying to achieve.</p>
              <p className="text-[13px] text-text-muted leading-relaxed">Practically: once you're within your optimal-to-maximum range above, you're almost always better off putting your remaining calories toward carbohydrates rather than piling on even more protein. Total calories, consistent training, and progressive overload matter far more for your results than perfecting a protein number down to the gram.</p>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-9">
            <h2 className="font-heading text-xl font-medium text-text-primary mb-2">Where to actually get this much protein</h2>
            <p className="text-text-muted text-[13px] mb-6">Grams of protein per typical serving — mix and match to hit your number.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {topSources.map(s => (
                <div key={s.food} className="bg-cream border border-border p-3">
                  <p className="text-[13px] font-medium text-text-primary">{s.food}</p>
                  <p className="text-[11px] text-text-light mb-1">{s.serving}</p>
                  <p className="text-lg font-medium text-text-primary">{s.grams}g</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-9">
            <h2 className="font-heading text-xl font-medium text-text-primary mb-2">Don't sleep on rice, pasta, and other "carb" foods</h2>
            <p className="text-text-muted text-[13px] mb-6 leading-relaxed">These get filed away as pure carbs, but a normal plate built around them adds up to real, uncounted protein.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {overlookedCarbs.map(s => (
                <div key={s.food} className="bg-cream border border-border p-3">
                  <p className="text-[13px] font-medium text-text-primary">{s.food}</p>
                  <p className="text-[11px] text-text-light mb-1">{s.serving}</p>
                  <p className="text-lg font-medium text-text-primary">{s.grams}g</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white border border-border p-9">
            <h2 className="font-heading text-xl font-medium text-text-primary mb-6">Essential amino acids and plant-based combos</h2>
            <div className="space-y-4 mb-6">
              <p className="text-[13px] text-text-muted leading-relaxed">There are 9 essential amino acids your body can't make on its own and has to get from food: histidine, isoleucine, leucine, lysine, methionine, phenylalanine, threonine, tryptophan, and valine. Of these, leucine matters most for building muscle specifically — it's the trigger that switches on muscle protein synthesis. Research (Layman, Phillips) puts the threshold at roughly 2.5-3g of leucine per meal to fully trigger it, with older adults needing closer to 3-3.5g due to the same anabolic resistance mentioned above.</p>
              <p className="text-[13px] text-text-muted leading-relaxed">You may have heard that plant proteins are "incomplete" and need to be combined at the same meal to count. That's outdated — it's been debunked for decades. Nearly every plant food contains all 9 essential amino acids, just in different ratios, and your body keeps a rotating pool of amino acids from meals earlier in the day to fill in gaps. You don't need to eat rice and beans in the same bite. That said, the combos below are still a genuinely useful, simple way to make sure your amino acid ratios are well-rounded across the day — and they're traditional staple pairings in cuisines worldwide for exactly this reason.</p>
            </div>
            <div className="space-y-3">
              {aminoCombos.map(c => (
                <div key={c.combo} className="bg-cream border border-border p-4">
                  <p className="text-[13px] font-medium text-text-primary mb-1">{c.combo}</p>
                  <p className="text-[12px] text-text-muted leading-relaxed">{c.covers}</p>
                </div>
              ))}
            </div>
            <p className="text-[13px] text-text-muted leading-relaxed mt-6">Worth calling out on their own: soy foods (tofu, tempeh, edamame) and quinoa are naturally well-rounded across all 9 essential amino acids without needing to be paired with anything — unusual among plant foods, and genuinely useful if you're vegan.</p>
            <p className="text-[13px] text-text-muted leading-relaxed mt-6 pt-6 border-t border-border">Quick disclaimer: I'm not a nutritionist or registered dietitian. Everything above is backed by the research cited, but the practical food advice — what to eat, what to pair — is just friendly advice based on my own experience, not professional dietary guidance. If you have a medical condition, take medication that interacts with diet, or have specific concerns, please talk to an actual doctor or registered dietitian instead of a calculator on a fitness website.</p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
