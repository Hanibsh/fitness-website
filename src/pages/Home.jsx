import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, Calculator, Dumbbell, Zap } from 'lucide-react'
import Scene3D from '../components/Scene3D'

const features = [
  {
    icon: Calculator,
    title: 'Smart Calculators',
    desc: 'TDEE, One Rep Max, Protein, Creatine — every number you need, dialed in.',
  },
  {
    icon: Dumbbell,
    title: 'Training Programs',
    desc: 'Battle-tested programs for beginners to advanced lifters. No fluff.',
  },
  {
    icon: Zap,
    title: 'Built for Results',
    desc: 'Tools designed by lifters, for lifters. Simple, fast, and accurate.',
  },
]

export default function Home() {
  return (
    <div className="relative">
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <Scene3D />

        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="font-heading text-6xl md:text-8xl font-bold text-white mb-6 tracking-tight">
              YOUR
              <span className="text-neon"> FITNESS</span>
              <br />
              TOOLKIT
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-lg md:text-xl text-grey-400 mb-10 max-w-2xl mx-auto"
          >
            Calculators, training programs, and everything you need to level up.
            Built for gym rats and beginners alike.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              to="/tools"
              className="inline-flex items-center justify-center gap-2 bg-neon text-dark-900 font-semibold px-8 py-3 rounded-lg no-underline hover:bg-neon-dim transition-colors"
            >
              Explore Tools
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/programs"
              className="inline-flex items-center justify-center gap-2 border border-dark-500 text-white px-8 py-3 rounded-lg no-underline hover:border-neon/50 hover:text-neon transition-colors"
            >
              Training Programs
            </Link>
          </motion.div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-dark-900 to-transparent" />
      </section>

      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              className="bg-dark-800 border border-dark-500/50 rounded-2xl p-8 hover:border-neon/30 transition-colors group"
            >
              <div className="w-12 h-12 rounded-xl bg-neon-glow flex items-center justify-center mb-5">
                <feature.icon className="w-6 h-6 text-neon" />
              </div>
              <h3 className="font-heading text-xl font-semibold text-white mb-3">
                {feature.title}
              </h3>
              <p className="text-grey-400 text-sm leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="py-24 px-6 border-t border-dark-500/30">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-heading text-4xl md:text-5xl font-bold text-white mb-6"
          >
            Stop guessing.
            <br />
            <span className="text-neon">Start calculating.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-grey-400 text-lg mb-10 max-w-xl mx-auto"
          >
            Every tool is science-backed and built for real-world use. Whether
            you're cutting, bulking, or just getting started.
          </motion.p>
          <Link
            to="/tools"
            className="inline-flex items-center gap-2 bg-neon text-dark-900 font-semibold px-8 py-3 rounded-lg no-underline hover:bg-neon-dim transition-colors"
          >
            Check out the tools
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <footer className="py-8 px-6 border-t border-dark-500/30 text-center text-grey-400 text-sm">
        &copy; {new Date().getFullYear()} JEFIT. All rights reserved.
      </footer>
    </div>
  )
}
