import { motion } from 'framer-motion'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import { getFullExercise, titleCase, fmtRecovery, fmtRest, tierLabel } from '../lib/exerciseBank'
import MuscleMap from '../components/MuscleMap'

// Detail page for one exercise. Commit 1: header + coach stats + muscle list.
// Commit 3 polishes the layout + adds the "Log this" CTA; commit 4 slots in the
// muscle heatmap.
export default function ExerciseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const ex = getFullExercise(id)

  if (!ex) {
    return (
      <div className="pt-24 pb-16 px-6 max-w-2xl mx-auto text-center">
        <p className="text-text-muted text-[15px] mb-4">Exercise not found.</p>
        <Link to="/exercises" className="text-[13px] text-text-primary no-underline hover:text-accent-hover">
          ← Back to the exercise bank
        </Link>
      </div>
    )
  }

  const stats = [
    ['Fatigue', `${ex.fatigueScore}/5`],
    ['Recovery', fmtRecovery(ex.recoveryWindowHours)],
    ['Rest', fmtRest(ex.restSeconds)],
    ['SFR', titleCase(ex.sfr)],
    ['Hypertrophy', titleCase(ex.hypertrophyPotential)],
    ['Stretch', titleCase(ex.stretchMediated)],
    ['Resistance', titleCase(ex.resistanceProfile)],
    ['Skill', titleCase(ex.skill)],
    ['Axial load', ex.axialLoading ? 'Yes' : 'No'],
  ]
  const muscles = Object.entries(ex.muscles || {}).sort((a, b) => b[1] - a[1])

  return (
    <div className="pt-24 pb-16 px-6">
      <div className="max-w-3xl mx-auto">
        <Link
          to="/exercises"
          className="inline-flex items-center gap-1.5 text-[12px] text-text-muted no-underline hover:text-text-primary mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Exercise bank
        </Link>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-[11px] uppercase tracking-[3px] text-text-light mb-2">{ex.category}</p>
          <h1 className="font-heading text-3xl md:text-4xl font-medium text-text-primary tracking-tight mb-2">
            {ex.name}
          </h1>
          <p className="text-text-muted text-[13px]">
            {titleCase(ex.equipment)} · {titleCase(ex.type)} · {titleCase(ex.laterality)}
          </p>

          <button
            onClick={() => navigate('/log', { state: { addExerciseId: ex.id, addExerciseName: ex.name } })}
            className="inline-flex items-center gap-1.5 bg-text-primary text-cream text-[13px] font-medium px-4 py-2 rounded-lg mt-5 border-none cursor-pointer hover:bg-accent-hover transition-colors"
          >
            <Plus className="w-4 h-4" /> Log this exercise
          </button>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-8">
            {stats.map(([label, val]) => (
              <div key={label} className="bg-white border border-border rounded-lg p-3">
                <p className="text-[10px] uppercase tracking-wide text-text-light">{label}</p>
                <p className="text-[15px] font-medium text-text-primary mt-0.5">{val}</p>
              </div>
            ))}
          </div>

          <h2 className="font-heading text-base font-medium text-text-primary mt-10 mb-3">Muscles worked</h2>
          <div className="grid md:grid-cols-2 gap-6 items-start">
            <div className="bg-white border border-border rounded-xl p-4">
              <MuscleMap muscles={ex.muscles} />
            </div>
            <div className="space-y-1.5">
              {muscles.map(([m, w]) => (
                <div
                  key={m}
                  className="flex items-center justify-between bg-white border border-border rounded-lg px-3 py-2"
                >
                  <span className="text-[13px] text-text-primary">{m}</span>
                  <span className="text-[11px] text-text-muted">{tierLabel(w)} · {w}</span>
                </div>
              ))}
            </div>
          </div>

          {ex.notes && <p className="text-text-muted text-[13px] mt-6 leading-relaxed">{ex.notes}</p>}
        </motion.div>
      </div>
    </div>
  )
}
