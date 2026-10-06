import { Link } from 'react-router-dom'
import { Check, ChevronRight, Dumbbell, Calculator } from 'lucide-react'

// The dashboard before the first workout: three steps that tick themselves
// off, then the other free tools. The full dashboard takes over once there's
// a session logged. Profile first, then the program, then the coach: a
// coached client messages theirs (`coachName`); anyone else books an intro
// chat — it stands in for the coaching banner on this screen. Starting a workout lives on the calendar
// card and in Tools; a bare "Start Upper A" here read as no context (Hani).
export default function GetStarted({ hasProgram, coachName = null, messaged = false, profileDone }) {
  const steps = [
    { title: 'Set up your profile', to: '/account', done: profileDone },
    { title: 'Build your program', to: '/programs?start=build', done: hasProgram },
    coachName
      ? { title: `Message ${coachName}`, to: '/messages', done: messaged }
      : { title: 'Book a free intro chat', to: '/contact', done: false },
  ]
  // The first step not done yet is the one to do next.
  const next = steps.findIndex((s) => !s.done)

  return (
    <>
      <section>
        <h2 className="text-[11px] uppercase tracking-wider text-text-light mb-3">Get started</h2>
        <ol className="bg-white border border-border divide-y divide-border list-none m-0 p-0">
          {steps.map((s, i) => (
            <li key={s.title}>
              <Link
                to={s.to}
                className="flex items-center gap-3 px-4 py-4 no-underline hover:bg-cream transition-colors"
              >
                <span
                  className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[12px] font-medium ${
                    s.done ? 'bg-text-primary text-cream' : i === next ? 'border border-text-primary text-text-primary' : 'border border-border text-text-light'
                  }`}
                  aria-hidden="true"
                >
                  {s.done ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </span>
                <span className={`flex-1 min-w-0 text-[14px] break-words ${s.done ? 'text-text-muted line-through' : 'text-text-primary font-medium'}`}>
                  {s.title}
                  {s.done && <span className="sr-only"> (done)</span>}
                </span>
                <ChevronRight className="w-4 h-4 text-text-light shrink-0" />
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid grid-cols-2 gap-3">
        {[
          { icon: Dumbbell, title: 'Exercise bank', to: '/exercises' },
          { icon: Calculator, title: 'Calculators', to: '/tools' },
        ].map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="flex items-center gap-2.5 bg-white border border-border px-4 py-3.5 no-underline hover:border-border-hover transition-colors"
          >
            <t.icon className="w-4 h-4 text-text-primary shrink-0" />
            <span className="text-[13px] font-medium text-text-primary">{t.title}</span>
          </Link>
        ))}
      </section>
    </>
  )
}
