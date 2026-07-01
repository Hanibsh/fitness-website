import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Flame, Target, Beef, Pill, Trophy, TrendingDown, Ruler } from 'lucide-react'

const tools = [
  {
    to: '/tools/tdee',
    icon: Flame,
    title: 'TDEE calculator',
    desc: 'Find your Total Daily Energy Expenditure — how many calories you burn per day.',
  },
  {
    to: '/tools/one-rep-max',
    icon: Target,
    title: 'One rep max',
    desc: 'Estimate your max lift for bench, squat, deadlift, and more.',
  },
  {
    to: '/tools/protein',
    icon: Beef,
    title: 'Protein calculator',
    desc: 'Find your optimal daily protein intake based on your goals.',
  },
  {
    to: '/tools/creatine',
    icon: Pill,
    title: 'Creatine calculator',
    desc: 'Calculate your ideal creatine dose for loading and maintenance.',
  },
  {
    to: '/tools/strength-standards',
    icon: Trophy,
    title: 'Strength standards',
    desc: 'See how your lifts stack up against other lifters at your level.',
  },
  {
    to: '/tools/calorie-deficit',
    icon: TrendingDown,
    title: 'Calorie deficit guide',
    desc: 'Figure out how long your cut should last and how aggressive to go.',
  },
  {
    to: '/tools/ffmi',
    icon: Ruler,
    title: 'FFMI calculator',
    desc: 'See how much muscle you\'re carrying relative to your height.',
  },
]

export default function Tools() {
  return (
    <div className="pt-24 pb-16 px-6">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-14"
        >
          <p className="text-[11px] uppercase tracking-[3px] text-text-light mb-4">Tools</p>
          <h1 className="font-heading text-4xl md:text-5xl font-medium text-text-primary mb-3 tracking-tight">
            Fitness tools
          </h1>
          <p className="text-text-muted text-[15px]">
            Every calculator a lifter needs. Science-backed, no BS.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map((tool, i) => (
            <motion.div
              key={tool.to}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.06 }}
            >
              <Link
                to={tool.to}
                className="block bg-white border border-border rounded-xl p-6 no-underline hover:border-border-hover transition-all group h-full"
              >
                <tool.icon className="w-5 h-5 text-text-primary mb-4" />
                <h3 className="font-heading text-[15px] font-medium text-text-primary mb-1.5 group-hover:text-accent-hover transition-colors">
                  {tool.title}
                </h3>
                <p className="text-text-muted text-[13px] leading-relaxed">{tool.desc}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
