import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Flame,
  Target,
  Beef,
  Pill,
  Trophy,
  TrendingDown,
} from 'lucide-react'

const tools = [
  {
    to: '/tools/tdee',
    icon: Flame,
    title: 'TDEE Calculator',
    desc: 'Find your Total Daily Energy Expenditure — how many calories you burn per day.',
  },
  {
    to: '/tools/one-rep-max',
    icon: Target,
    title: 'One Rep Max',
    desc: 'Estimate your max lift for bench, squat, deadlift, and more.',
  },
  {
    to: '/tools/protein',
    icon: Beef,
    title: 'Protein Calculator',
    desc: 'Find your optimal daily protein intake based on your goals.',
  },
  {
    to: '/tools/creatine',
    icon: Pill,
    title: 'Creatine Calculator',
    desc: 'Calculate your ideal creatine dose for loading and maintenance.',
  },
  {
    to: '/tools/strength-standards',
    icon: Trophy,
    title: 'Strength Standards',
    desc: 'See how your lifts stack up against other lifters at your level.',
  },
  {
    to: '/tools/calorie-deficit',
    icon: TrendingDown,
    title: 'Calorie Deficit Guide',
    desc: 'Figure out how long your cut should last and how aggressive to go.',
  },
]

export default function Tools() {
  return (
    <div className="pt-24 pb-16 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="font-heading text-5xl md:text-6xl font-bold text-white mb-4">
            Fitness <span className="text-neon">Tools</span>
          </h1>
          <p className="text-grey-400 text-lg max-w-xl mx-auto">
            Every calculator a lifter needs. Science-backed, no BS.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool, i) => (
            <motion.div
              key={tool.to}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
            >
              <Link
                to={tool.to}
                className="block bg-dark-800 border border-dark-500/50 rounded-2xl p-7 no-underline hover:border-neon/40 transition-all group h-full"
              >
                <div className="w-12 h-12 rounded-xl bg-neon-glow flex items-center justify-center mb-5 group-hover:bg-neon-glow-strong transition-colors">
                  <tool.icon className="w-6 h-6 text-neon" />
                </div>
                <h3 className="font-heading text-lg font-semibold text-white mb-2 group-hover:text-neon transition-colors">
                  {tool.title}
                </h3>
                <p className="text-grey-400 text-sm leading-relaxed">{tool.desc}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
