import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

const sections = [
  {
    title: 'The short version',
    body: [
      "You can use every tool on this site — the calculators and the workout log — without an account and without giving me any personal information. If you don't log in, your data lives only in your own browser and never reaches my servers.",
      'An account is optional. It exists so your workouts sync across your devices. Sharing your data for research is separate, opt-in, and anonymous. I don\'t sell your data, run ads, or use third-party tracking.',
    ],
  },
  {
    title: 'What I collect',
    body: [
      'As a guest (no account): nothing leaves your device. Your workout log and any calculator inputs are saved in your browser\'s local storage only.',
      'If you create an account: your email address (or, if you sign in with Google, your Google account email). If you fill in your profile, your sex, bodyweight, and preferred units. And the workouts you log while signed in.',
      'If you opt in to sharing (a checkbox that is off by default): your lifts — exercise, weight, reps, and RIR — along with your bodyweight and sex, are saved without your name, email, or any identifier. This anonymized data is used only to improve the strength-standards tool.',
    ],
  },
  {
    title: 'How I use it',
    body: [
      'To provide the service: saving your workouts to your account and syncing them across your devices.',
      'To personalize the tools: your profile details make calculators and standards more accurate for you.',
      'To improve the strength standards: only if you opt in, and only using the anonymized data described above.',
      "I don't use your data for advertising, and I don't sell or rent it to anyone.",
    ],
  },
  {
    title: 'Who processes your data',
    body: [
      'Supabase — provides the login and database where account data is stored.',
      'Vercel — hosts the website (a legacy mirror also exists on GitHub Pages).',
      'Google — only if you choose "Sign in with Google," which shares your Google email with this site to create your account.',
      'These providers process data on my behalf so the site can function. No other third parties receive your data.',
    ],
  },
  {
    title: 'Cookies & local storage',
    body: [
      'The site uses your browser\'s local storage to keep your workout log (and, when logged in, a secure session so you stay signed in). There are no advertising or tracking cookies.',
    ],
  },
  {
    title: 'Your choices and rights',
    body: [
      'You can use everything as a guest and share nothing.',
      'You can turn data-sharing on or off anytime on your account page.',
      'You can ask me to show you what account data I hold, or to delete your account and its data entirely — just message me (contact below).',
    ],
  },
  {
    title: 'Data security & retention',
    body: [
      'Account data is protected so that each user can only access their own — your workouts are visible to you alone. I keep your account data for as long as your account exists; delete your account and it\'s removed.',
    ],
  },
  {
    title: 'Children',
    body: [
      "This site isn't intended for anyone under 16. If you're under 16, please don't create an account.",
    ],
  },
  {
    title: 'Changes',
    body: [
      'If this policy changes, the updated version will be posted here with a new date.',
    ],
  },
  {
    title: 'Contact',
    body: [
      'Questions, or want your data shown or deleted? Reach me on WhatsApp at @luckybull.',
    ],
  },
]

export default function Privacy() {
  return (
    <div className="pt-28 pb-24 px-6">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary no-underline text-[13px] mb-10 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back home
        </Link>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-heading text-4xl font-medium text-text-primary mb-2">Privacy</h1>
          <p className="text-[12px] text-text-light mb-10">Last updated: July 2026</p>

          <div className="space-y-8">
            {sections.map((s) => (
              <section key={s.title}>
                <h2 className="font-heading text-lg font-medium text-text-primary mb-3">{s.title}</h2>
                <div className="space-y-3">
                  {s.body.map((p, i) => (
                    <p key={i} className="text-[14px] text-text-muted leading-relaxed">{p}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
