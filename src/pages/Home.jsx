import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, MessageCircle, Video, CalendarClock, Calculator } from 'lucide-react'
import { VERSION, STAGE } from '../lib/version'

const coachingFeatures = [
  {
    icon: MessageCircle,
    title: 'A direct line to me',
    desc: 'Message me when you\'re stuck, sore, or second-guessing something. No ticket system, no chatbot — you text your coach, your coach answers.',
  },
  {
    icon: Video,
    title: 'Video calls & check-ins',
    desc: 'Regular calls to review your progress, fix your form, and adjust the plan when life throws you a curveball.',
  },
  {
    icon: CalendarClock,
    title: 'Training that fits your life',
    desc: 'Built around the hours you actually have. Three solid days a week you\'ll stick to beats six perfect ones you won\'t.',
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
            1:1 online coaching
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="font-heading text-5xl md:text-6xl font-medium text-text-primary mb-5 tracking-tight leading-[1.1]"
          >
            Get strong,
            <br />
            even with a busy life.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-[15px] text-text-muted mb-10 max-w-md mx-auto leading-relaxed"
          >
            I&apos;m Leon. I help busy people get in shape, build muscle, and get
            stronger — with training that fits around your life instead of taking it over.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
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
      </section>

      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-2xl mx-auto">
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-[11px] uppercase tracking-[3px] text-text-light mb-4"
          >
            About me
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-heading text-3xl md:text-4xl font-medium text-text-primary mb-6 tracking-tight"
          >
            Hey — I&apos;m Leon.
          </motion.h2>
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="space-y-4 text-[15px] text-text-muted leading-relaxed"
          >
            <p>
              I&apos;ve been training for the better part of a decade. I&apos;m not a pro
              bodybuilder — I&apos;m an engineer by degree who fell in love with lifting and
              never stopped. Somewhere between the barbell and the day job, friends and
              family started asking me to train them too.
            </p>
            <p>
              Coaching them taught me the thing most programs miss: the best plan is the
              one that survives your actual life. The job, the family, the weeks where
              everything goes sideways. That&apos;s who I coach — people with full
              schedules who still want to get in shape, build muscle, and feel strong.
            </p>
            <p>
              You won&apos;t find stock-photo transformations here. Just straight answers,
              a plan built around you, and a coach who actually replies.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-heading text-3xl md:text-4xl font-medium text-text-primary mb-10 tracking-tight text-center"
          >
            What 1:1 coaching looks like
          </motion.h2>
          <div className="grid md:grid-cols-3 gap-4">
            {coachingFeatures.map((feature, i) => (
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
            It starts with a conversation.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-text-muted text-[15px] mb-8 leading-relaxed"
          >
            Before anything else, we hop on a free call and talk — about your life, your
            goals, and the effort you&apos;re honestly willing to put in. If we&apos;re a
            fit, we build your plan. If not, no hard feelings.
          </motion.p>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 bg-text-primary text-cream font-medium px-7 py-2.5 rounded-lg no-underline hover:bg-accent-hover transition-colors text-[13px]"
          >
            Book your free intro chat
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>

      <section className="py-16 px-6 border-t border-border">
        <div className="max-w-xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Calculator className="w-5 h-5 text-text-primary mx-auto mb-4" />
            <h2 className="font-heading text-xl font-medium text-text-primary mb-3 tracking-tight">
              Not ready for coaching yet?
            </h2>
            <p className="text-text-muted text-[14px] mb-6 leading-relaxed">
              Start with the free calculators — TDEE, one rep max, protein, strength
              standards, and more. No sign-up, no catch.
            </p>
            <Link
              to="/tools"
              className="inline-flex items-center gap-2 border border-border text-text-secondary px-6 py-2.5 rounded-lg no-underline hover:border-border-hover hover:text-text-primary transition-colors text-[13px]"
            >
              Explore the tools
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </motion.div>
        </div>
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
