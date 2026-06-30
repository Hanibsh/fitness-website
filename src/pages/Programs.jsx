import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Clock, BarChart3, Dumbbell } from 'lucide-react'

const programs = [
  {
    id: 'beginner',
    level: 'Beginner',
    title: 'Foundation Builder',
    duration: '8 weeks',
    frequency: '3 days/week',
    intensity: 'Low–Moderate',
    desc: 'Perfect for people just starting out. Learn the core lifts with proper form and build a base of strength.',
    days: [
      {
        name: 'Day A — Full Body',
        exercises: [
          'Barbell Squat — 3×8',
          'Bench Press — 3×8',
          'Barbell Row — 3×8',
          'Overhead Press — 3×8',
          'Plank — 3×30s',
        ],
      },
      {
        name: 'Day B — Full Body',
        exercises: [
          'Deadlift — 3×5',
          'Incline Dumbbell Press — 3×10',
          'Lat Pulldown — 3×10',
          'Leg Press — 3×10',
          'Face Pulls — 3×15',
        ],
      },
    ],
  },
  {
    id: 'intermediate',
    level: 'Intermediate',
    title: 'Strength & Size',
    duration: '12 weeks',
    frequency: '4 days/week',
    intensity: 'Moderate–High',
    desc: 'Upper/Lower split designed to build serious strength and muscle. Progressive overload built in.',
    days: [
      {
        name: 'Upper A — Strength',
        exercises: [
          'Bench Press — 4×5',
          'Barbell Row — 4×5',
          'Overhead Press — 3×6',
          'Weighted Pull-ups — 3×6',
          'Tricep Dips — 3×10',
          'Barbell Curl — 3×10',
        ],
      },
      {
        name: 'Lower A — Strength',
        exercises: [
          'Barbell Squat — 4×5',
          'Romanian Deadlift — 3×8',
          'Leg Press — 3×10',
          'Leg Curl — 3×10',
          'Calf Raises — 4×12',
          'Hanging Leg Raise — 3×12',
        ],
      },
      {
        name: 'Upper B — Hypertrophy',
        exercises: [
          'Incline DB Press — 4×10',
          'Cable Row — 4×10',
          'Lateral Raises — 4×12',
          'Chest Fly — 3×12',
          'Hammer Curls — 3×12',
          'Overhead Tricep Extension — 3×12',
        ],
      },
      {
        name: 'Lower B — Hypertrophy',
        exercises: [
          'Front Squat — 3×8',
          'Deadlift — 3×5',
          'Bulgarian Split Squat — 3×10 each',
          'Leg Extension — 3×12',
          'Seated Calf Raise — 4×15',
          'Cable Crunch — 3×15',
        ],
      },
    ],
  },
  {
    id: 'advanced',
    level: 'Advanced',
    title: 'Power Protocol',
    duration: '16 weeks',
    frequency: '5–6 days/week',
    intensity: 'High',
    desc: 'Push/Pull/Legs with periodization. For experienced lifters chasing PRs.',
    days: [
      {
        name: 'Push Day',
        exercises: [
          'Bench Press — 5×5 (heavy)',
          'Overhead Press — 4×6',
          'Incline DB Press — 4×8',
          'Cable Crossover — 3×12',
          'Lateral Raises — 4×15',
          'Tricep Pushdown — 4×12',
          'Overhead Extension — 3×12',
        ],
      },
      {
        name: 'Pull Day',
        exercises: [
          'Deadlift — 5×3 (heavy)',
          'Weighted Pull-ups — 4×6',
          'Barbell Row — 4×8',
          'Face Pulls — 4×15',
          'Dumbbell Shrug — 3×12',
          'Barbell Curl — 4×10',
          'Hammer Curl — 3×12',
        ],
      },
      {
        name: 'Legs Day',
        exercises: [
          'Barbell Squat — 5×5 (heavy)',
          'Front Squat — 3×8',
          'Romanian Deadlift — 4×8',
          'Leg Press — 4×10',
          'Walking Lunges — 3×12 each',
          'Leg Curl — 4×12',
          'Standing Calf Raise — 5×15',
        ],
      },
    ],
  },
]

function ProgramCard({ program }) {
  const [open, setOpen] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="bg-dark-800 border border-dark-500/50 rounded-2xl overflow-hidden hover:border-neon/30 transition-colors"
    >
      <div className="p-8">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xs font-semibold uppercase tracking-widest text-neon bg-neon-glow px-3 py-1 rounded-full">
            {program.level}
          </span>
        </div>
        <h3 className="font-heading text-2xl font-bold text-white mb-2">
          {program.title}
        </h3>
        <p className="text-grey-400 text-sm mb-6 leading-relaxed">{program.desc}</p>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="flex items-center gap-2 text-sm text-grey-300">
            <Clock className="w-4 h-4 text-neon" />
            {program.duration}
          </div>
          <div className="flex items-center gap-2 text-sm text-grey-300">
            <Dumbbell className="w-4 h-4 text-neon" />
            {program.frequency}
          </div>
          <div className="flex items-center gap-2 text-sm text-grey-300">
            <BarChart3 className="w-4 h-4 text-neon" />
            {program.intensity}
          </div>
        </div>

        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 text-neon text-sm font-medium bg-transparent border-none cursor-pointer hover:text-neon-dim transition-colors"
        >
          {open ? 'Hide' : 'View'} workout details
          <ChevronDown
            className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-8 pb-8 grid md:grid-cols-2 gap-4">
              {program.days.map((day) => (
                <div
                  key={day.name}
                  className="bg-dark-700 rounded-xl p-5 border border-dark-500/30"
                >
                  <h4 className="font-heading text-sm font-semibold text-white mb-3">
                    {day.name}
                  </h4>
                  <ul className="space-y-2">
                    {day.exercises.map((ex) => (
                      <li
                        key={ex}
                        className="text-sm text-grey-400 flex items-start gap-2"
                      >
                        <span className="text-neon mt-1">•</span>
                        {ex}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function Programs() {
  return (
    <div className="pt-24 pb-16 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="font-heading text-5xl md:text-6xl font-bold text-white mb-4">
            Training <span className="text-neon">Programs</span>
          </h1>
          <p className="text-grey-400 text-lg max-w-xl mx-auto">
            Pick your level. Follow the plan. See results.
          </p>
        </motion.div>

        <div className="space-y-8">
          {programs.map((program) => (
            <ProgramCard key={program.id} program={program} />
          ))}
        </div>
      </div>
    </div>
  )
}
