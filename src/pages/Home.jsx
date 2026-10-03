import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, MessageCircle, Video, CalendarClock, Calculator, NotebookPen, Dumbbell } from 'lucide-react'
import { VERSION, STAGE } from '../lib/version'

// Two parts for a first visit: the free program maker (plus the other free
// tools), then one brief coaching card. Keep both short — walls of text repel.
const freeTools = [
  { icon: NotebookPen, title: 'Workout log', desc: 'Track every set.', to: '/log' },
  { icon: Dumbbell, title: 'Exercise bank', desc: 'Every exercise, explained.', to: '/exercises' },
  { icon: Calculator, title: 'Calculators', desc: 'Calories, protein, 1RM.', to: '/tools' },
]

const coachingPoints = [
  { icon: MessageCircle, text: 'Text me anytime' },
  { icon: Video, text: 'Video check-ins & form reviews' },
  { icon: CalendarClock, text: 'A plan that fits your week' },
]

export default function Home() {
  return (
    <div>
      {/* ---- 1. Build your program ---------------------------------------- */}
      <section className="pt-36 md:pt-40 pb-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="font-heading text-5xl md:text-6xl font-medium text-text-primary mb-5 tracking-tight leading-[1.1]"
            >
              Get strong,
              <br />
              even with a busy life.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-[15px] text-text-muted mb-8 leading-relaxed"
            >
              Get a free program built around your week.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Link
                to="/programs?start=build"
                className="inline-flex items-center justify-center gap-2 bg-text-primary text-cream font-medium px-7 py-2.5 rounded-lg no-underline hover:bg-accent-hover transition-colors text-[13px]"
              >
                Build my free program
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </motion.div>
          </div>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-[11px] uppercase tracking-[3px] text-text-light mt-16 mb-4 text-center"
          >
            Also free, no sign-up
          </motion.p>
          <div className="grid sm:grid-cols-3 gap-3">
            {freeTools.map((tool, i) => (
              <motion.div
                key={tool.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.35 + i * 0.08 }}
              >
                <Link
                  to={tool.to}
                  className="group flex items-center gap-4 sm:block bg-white border border-border rounded-xl p-5 sm:p-6 no-underline hover:border-border-hover transition-colors h-full"
                >
                  <tool.icon className="w-5 h-5 text-text-primary shrink-0 sm:mb-4" />
                  <div>
                    <h3 className="font-heading text-[15px] font-medium text-text-primary group-hover:text-accent-hover transition-colors">
                      {tool.title}
                    </h3>
                    <p className="text-text-muted text-[13px] mt-0.5 sm:mt-1">{tool.desc}</p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- 2. Coaching --------------------------------------------------- */}
      <section className="pb-24 px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto bg-white border border-border rounded-xl p-7 md:p-10"
        >
          <p className="text-[11px] uppercase tracking-[3px] text-text-light mb-4">1:1 coaching</p>
          <h2 className="font-heading text-2xl md:text-3xl font-medium text-text-primary mb-3 tracking-tight">
            Hey — I&apos;m Leon.
          </h2>
          <p className="text-[15px] text-text-muted leading-relaxed mb-6">
            An engineer who&apos;s lifted for a decade. I coach busy people who want to build muscle.
          </p>
          <ul className="list-none m-0 p-0 space-y-2.5 mb-8">
            {coachingPoints.map((point) => (
              <li key={point.text} className="flex items-center gap-3 text-[14px] text-text-secondary">
                <point.icon className="w-4 h-4 text-text-primary shrink-0" />
                {point.text}
              </li>
            ))}
          </ul>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 bg-text-primary text-cream font-medium px-7 py-2.5 rounded-lg no-underline hover:bg-accent-hover transition-colors text-[13px]"
          >
            Book a free intro chat
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </motion.div>
      </section>

      <footer className="py-6 px-6 border-t border-border text-center text-text-light text-[12px]">
        &copy; {new Date().getFullYear()} Leon. All rights reserved.
        {' · '}
        <Link to="/privacy" className="text-text-light hover:text-text-primary no-underline transition-colors">
          Privacy
        </Link>
        {' · '}
        <span className="text-text-light">{STAGE} v{VERSION}</span>
      </footer>
    </div>
  )
}
