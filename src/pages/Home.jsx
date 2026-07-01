import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, Calculator, Dumbbell, Zap } from 'lucide-react'

const features = [
  {
    icon: Calculator,
    title: 'Smart calculators',
    desc: 'TDEE, One Rep Max, Protein, Creatine — every number you need, dialed in.',
  },
  {
    icon: Dumbbell,
    title: 'Training programs',
    desc: 'Battle-tested programs for beginners to advanced lifters. No fluff.',
  },
  {
    icon: Zap,
    title: 'Built for results',
    desc: 'Tools designed by lifters, for lifters. Simple, fast, and accurate.',
  },
]

export default function Home() {
  return (
    <div>
      <section className="min-h-[85vh] flex items-center justify-center pt-14">
        <div className="text-center px-6 max-w-2xl mx-auto">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-[11px] uppercase tracking-[3px] text-text-light mb-6"
          >
            Fitness toolkit
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="font-heading text-5xl md:text-6xl font-medium text-text-primary mb-5 tracking-tight leading-[1.1]"
          >
            Your body.
            <br />
            Your numbers.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-[15px] text-text-muted mb-10 max-w-md mx-auto leading-relaxed"
          >
            Calculators, training programs, and everything you need to level up.
            Built for gym rats and beginners alike.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Link
              to="/tools"
              className="inline-flex items-center justify-center gap-2 bg-text-primary text-cream font-medium px-7 py-2.5 rounded-lg no-underline hover:bg-accent-hover transition-colors text-[13px]"
            >
              Explore tools
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              to="/programs"
              className="inline-flex items-center justify-center gap-2 border border-border text-text-secondary px-7 py-2.5 rounded-lg no-underline hover:border-border-hover hover:text-text-primary transition-colors text-[13px]"
            >
              Programs
            </Link>
          </motion.div>
        </div>
      </section>

      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-4">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="bg-white border border-border rounded-xl p-7 hover:border-border-hover transition-colors"
            >
              <feature.icon className="w-5 h-5 text-text-primary mb-4" />
              <h3 className="font-heading text-[15px] font-medium text-text-primary mb-2">
                {feature.title}
              </h3>
              <p className="text-text-muted text-[13px] leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-xl mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-heading text-3xl md:text-4xl font-medium text-text-primary mb-4 tracking-tight"
          >
            Stop guessing.
            <br />
            Start calculating.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-text-muted text-[15px] mb-8 leading-relaxed"
          >
            Every tool is science-backed and built for real-world use.
          </motion.p>
          <Link
            to="/tools"
            className="inline-flex items-center gap-2 bg-text-primary text-cream font-medium px-7 py-2.5 rounded-lg no-underline hover:bg-accent-hover transition-colors text-[13px]"
          >
            Check out the tools
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>

      <footer className="py-6 px-6 border-t border-border text-center text-text-light text-[12px]">
        &copy; {new Date().getFullYear()} JEFIT. All rights reserved.
      </footer>
    </div>
  )
}
