import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import SplitWizard from '../components/SplitWizard'

// The public face of the split generator.
//
// This page used to say "coming soon" and point at 1:1 coaching. The programs
// it was promising now exist and build themselves, so the page leads with the
// generator instead — it's the strongest thing on the site to show a stranger,
// it needs no account, and someone who wants a person rather than an algorithm
// still has the coaching route right underneath it.
//
// Same wizard the log uses at /split/generate; only the framing differs. If this
// ever becomes a paid tier, the gate belongs around SplitWizard here, not inside
// it — the generator itself should stay one implementation.
export default function Programs() {
  return (
    <div className="pt-24 pb-24 px-6">
      <div className="max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-[11px] uppercase tracking-[3px] text-text-light mb-4">Programs</p>

          <h1 className="font-heading text-4xl md:text-5xl font-medium text-text-primary mb-4 tracking-tight">
            A program built around your week.
          </h1>

          <p className="text-text-muted text-[15px] mb-4 leading-relaxed">
            Tell it how often you train, what you want to bring up and what equipment you have, and it writes
            the whole thing: which days, which movements, how many sets and what rep range to chase. Every
            muscle lands on two to three sessions a week, whatever you're bringing up gets trained more often
            and while you're still fresh, and no single day is asked to carry more fatigue than the days around
            it can absorb.
          </p>

          <p className="text-text-muted text-[15px] mb-10 leading-relaxed">
            It's built on the same exercise database as the rest of the site — {' '}
            <Link to="/exercises" className="text-text-secondary underline hover:text-text-primary">
              every movement in it
            </Link>{' '}
            is rated for what it trains, what it costs to recover from and how much growth it buys for that
            cost. Free, no account needed, and yours to edit afterwards.
          </p>

          <SplitWizard />

          {/* The generator is the better answer for most people. Coaching is the
              better answer for some of them, and this is where they find it. */}
          <div className="mt-14 pt-10 border-t border-border text-center">
            <h2 className="font-heading text-2xl font-medium text-text-primary mb-3">Want a person instead?</h2>
            <p className="text-text-muted text-[14px] mb-7 leading-relaxed max-w-md mx-auto">
              A generated split is a good program. It isn&apos;t someone watching your technique, adjusting when
              life gets in the way, or telling you the honest thing about your diet. That&apos;s what the 1:1
              coaching is for.
            </p>
            <Link
              to="/contact"
              className="inline-flex items-center justify-center gap-2 bg-text-primary text-cream font-medium px-7 py-2.5 no-underline hover:bg-accent-hover transition-colors text-[13px]"
            >
              Book a free intro chat
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
