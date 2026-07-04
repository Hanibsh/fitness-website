import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import Modal from './Modal'
import { newGoalId } from '../lib/workoutStore'

// Editor for the dashboard's goals: a monthly workout target plus any number of
// per-exercise weight goals. Fully controlled locally; commits on Save.
export default function GoalsModal({ goals, exerciseNames, unit, onSave, onClose }) {
  const [monthly, setMonthly] = useState(String(goals.monthlyWorkouts || 12))
  const [lifts, setLifts] = useState(
    goals.lifts.length ? goals.lifts.map((l) => ({ ...l })) : []
  )

  function addLift() {
    setLifts((ls) => [...ls, { id: newGoalId(), exercise: exerciseNames[0] || '', target: '' }])
  }
  function updateLift(id, patch) {
    setLifts((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }
  function removeLift(id) {
    setLifts((ls) => ls.filter((l) => l.id !== id))
  }

  function save() {
    const monthlyWorkouts = Math.max(1, Math.min(60, Math.round(Number(monthly) || 12)))
    const cleaned = lifts
      .filter((l) => l.exercise && Number(l.target) > 0)
      .map((l) => ({ id: l.id, exercise: l.exercise, target: Math.round(Number(l.target) * 10) / 10 }))
    onSave({ monthlyWorkouts, lifts: cleaned })
  }

  const numberInput =
    'w-full min-w-0 bg-cream border border-border px-3 py-2 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors'

  return (
    <Modal onClose={onClose} maxWidth="max-w-md">
      <div className="p-7">
        <h3 className="font-heading text-xl font-medium text-text-primary mb-5">Edit goals</h3>

        <div className="mb-6">
          <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-2">Monthly workout goal</label>
          <input
            type="number"
            min="1"
            max="60"
            value={monthly}
            onChange={(e) => setMonthly(e.target.value)}
            className={`${numberInput} max-w-[120px]`}
            aria-label="Monthly workout goal"
          />
        </div>

        <div className="mb-2 flex items-center justify-between">
          <label className="text-[11px] text-text-muted uppercase tracking-wider">Lift goals ({unit})</label>
          <button
            type="button"
            onClick={addLift}
            disabled={!exerciseNames.length}
            className="inline-flex items-center gap-1 text-[12px] text-text-muted hover:text-text-primary bg-transparent border-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>

        {lifts.length === 0 ? (
          <p className="text-[12px] text-text-light mb-6">
            {exerciseNames.length ? 'No lift goals yet — add one to track it here.' : 'Log some workouts first to set lift goals.'}
          </p>
        ) : (
          <div className="space-y-2 mb-6">
            {lifts.map((l) => (
              <div key={l.id} className="flex items-center gap-2">
                <select
                  value={l.exercise}
                  onChange={(e) => updateLift(l.id, { exercise: e.target.value })}
                  aria-label="Goal exercise"
                  className="flex-1 min-w-0 bg-cream border border-border px-2 py-2 text-text-primary text-[13px] outline-none focus:border-text-primary cursor-pointer"
                >
                  {exerciseNames.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  value={l.target}
                  onChange={(e) => updateLift(l.id, { target: e.target.value })}
                  placeholder={unit}
                  aria-label="Target weight"
                  className={`${numberInput} w-20 shrink-0`}
                />
                <button
                  type="button"
                  onClick={() => removeLift(l.id)}
                  aria-label="Remove goal"
                  className="shrink-0 text-text-light hover:text-red-600 bg-transparent border-none cursor-pointer p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={save}
            className="flex-1 bg-text-primary text-cream font-medium py-3 border-none cursor-pointer text-[14px] hover:bg-accent-hover transition-colors"
          >
            Save goals
          </button>
          <button
            onClick={onClose}
            className="px-5 text-text-muted hover:text-text-primary bg-white border border-border hover:border-border-hover cursor-pointer text-[13px] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  )
}
