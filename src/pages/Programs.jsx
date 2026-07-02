import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

export default function Programs() {
  return (
    <div className="pt-24 pb-16 px-6 min-h-screen flex items-center">
      <div className="max-w-lg mx-auto w-full text-center">
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[11px] uppercase tracking-[3px] text-text-light mb-4"
        >
          Programs
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="font-heading text-4xl md:text-5xl font-medium text-text-primary mb-4 tracking-tight"
        >
          Coming soon.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-text-muted text-[15px] mb-10 leading-relaxed"
        >
          I&apos;m putting together training programs for every level — beginner to advanced.
          They&apos;re not ready just yet. In the meantime, the fastest way to get a plan built
          around you is 1:1 coaching, and the calculators are free to use right now.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex flex-col sm:flex-row gap-3 justify-center"
        >
          <Link
            to="/contact"
            className="inline-flex items-center justify-center gap-2 bg-text-primary text-cream font-medium px-7 py-2.5 rounded-lg no-underline hover:bg-accent-hover transition-colors text-[13px]"
          >
            Book a free intro chat
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            to="/tools"
            className="inline-flex items-center justify-center gap-2 border border-border text-text-secondary px-7 py-2.5 rounded-lg no-underline hover:border-border-hover hover:text-text-primary transition-colors text-[13px]"
          >
            Free tools
          </Link>
        </motion.div>
      </div>
    </div>
  )
}
