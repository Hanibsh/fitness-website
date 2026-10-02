import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import SplitWizard from '../components/SplitWizard'
import StartSplitChoices from '../components/StartSplitChoices'

// Where a program starts — three ways in, side by side:
//
//   Build me a split  — the generator, opened right here on the page
//   I have a program  — the one Leon sent (a .txt file or its text) → /import
//   I'll make my own  — a blank split to lay out by hand → /split/new
//
// Hani hands clients a program exported from the app, so bringing one in is as
// prominent as having one built. The generator is the same wizard the log uses
// at /split/generate; only the framing differs. If it ever becomes a paid tier,
// the gate belongs around SplitWizard here, not inside it.
//
// `?start=build` opens the generator straight away — what older links to this
// page expected, and a link Hani can send.
export default function Programs() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const building = params.get('start') === 'build'
  const wizardRef = useRef(null)
  const scrollOnOpen = useRef(false)

  function openBuild() {
    scrollOnOpen.current = true
    if (building) wizardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    else setParams({ start: 'build' }, { replace: true })
  }

  // Tapping the card brings the generator into view; arriving on a deep link
  // leaves the page where it is, with the choice still visible above.
  useEffect(() => {
    if (building && scrollOnOpen.current) {
      scrollOnOpen.current = false
      wizardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [building])

  return (
    <div className="pt-24 pb-24 px-6">
      <div className="max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-[11px] uppercase tracking-[3px] text-text-light mb-4">Programs</p>

          <h1 className="font-heading text-4xl md:text-5xl font-medium text-text-primary mb-4 tracking-tight">
            Your program, three ways.
          </h1>

          <p className="text-text-muted text-[15px] mb-8 leading-relaxed">
            Have one built around your week, bring in the program you were sent, or lay one out yourself. Free,
            no account needed, and yours to edit afterwards — every day, movement, set and rep range.
          </p>

          <StartSplitChoices
            selected={building ? 'build' : null}
            onBuild={openBuild}
            onImport={() => navigate('/import')}
            onManual={() => navigate('/split/new')}
          />

          {building && (
            <div ref={wizardRef} className="mt-12" style={{ scrollMarginTop: 'calc(5rem + env(safe-area-inset-top, 0px))' }}>
              <h2 className="font-heading text-2xl font-medium text-text-primary mb-3">Build me a split</h2>
              <p className="text-text-muted text-[14px] mb-4 leading-relaxed">
                Tell it how often you train, what you want to bring up and what equipment you have, and it writes
                the whole thing: which days, which movements, how many sets and what rep range to chase. Every
                muscle lands on two to three sessions a week, whatever you&apos;re bringing up gets trained more
                often and while you&apos;re still fresh, and no single day is asked to carry more fatigue than the
                days around it can absorb.
              </p>
              <p className="text-text-muted text-[14px] mb-8 leading-relaxed">
                It&apos;s built on the same exercise database as the rest of the site —{' '}
                <Link to="/exercises" className="text-text-secondary underline hover:text-text-primary">
                  every movement in it
                </Link>{' '}
                is rated for what it trains, what it costs to recover from and how much growth it buys for that
                cost.
              </p>
              <SplitWizard />
            </div>
          )}

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
