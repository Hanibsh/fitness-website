import { useState } from 'react'
import Modal from './Modal'
import FoodFields from './FoodFields'
import { CHECKIN_QUESTIONS, CHECKIN_NOTE_MAX, checkinComplete } from '../lib/checkins'
import { foodForm, parseIntake } from '../lib/weeklyLog'

// The weekly check-in: one 1–5 row per question, the week's food (optional),
// and an optional note. Opens on this week's answers and food when there are
// some, so it doubles as the edit. `food`: this week's weekly-log entry.
// `onSave(answers, food)` — food as lib/weeklyLog.js parseIntake gives it.
export default function CheckinModal({ coachName = 'Leon', initial = null, food = null, onSave, onClose }) {
  const [answers, setAnswers] = useState(() => ({ ...(initial || {}) }))
  const [foodText, setFoodText] = useState(() => foodForm(food))
  const [foodError, setFoodError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    const parsed = parseIntake(foodText)
    setFoodError(parsed.error)
    if (parsed.error) return
    setBusy(true)
    setError('')
    try {
      await onSave({ ...answers, note: (answers.note || '').trim() }, parsed.entry)
      onClose()
    } catch {
      setError('Didn’t save — try again.')
      setBusy(false)
    }
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-md">
      <div className="p-6 sm:p-7">
        <h3 className="font-heading text-xl font-medium text-text-primary mb-1 pr-8">Weekly check-in</h3>
        <p className="text-[13px] text-text-muted mb-6">How was your week? {coachName} reads this.</p>
        <div className="space-y-5">
          {CHECKIN_QUESTIONS.map((q) => (
            <div key={q.key}>
              <p className="text-[13px] font-medium text-text-primary mb-2">{q.label}</p>
              <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label={q.label}>
                {[1, 2, 3, 4, 5].map((n) => {
                  const on = answers[q.key] === n
                  return (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setAnswers((a) => ({ ...a, [q.key]: n }))}
                      className={`py-2.5 text-[14px] font-medium border cursor-pointer transition-colors ${
                        on ? 'bg-text-primary text-cream border-text-primary' : 'bg-white text-text-muted border-border hover:border-border-hover'
                      }`}
                    >
                      {n}
                    </button>
                  )
                })}
              </div>
              <div className="flex justify-between text-[10px] text-text-light mt-1">
                <span>{q.low}</span>
                <span>{q.high}</span>
              </div>
            </div>
          ))}
          <div>
            <p className="text-[13px] font-medium text-text-primary mb-2">Food this week</p>
            <FoodFields value={foodText} onChange={(v) => { setFoodText(v); setFoodError(null) }} error={foodError} idPrefix="checkin-food" />
          </div>
          <div>
            <label htmlFor="checkin-note" className="text-[13px] font-medium text-text-primary block mb-2">Anything else?</label>
            <textarea
              id="checkin-note"
              value={answers.note || ''}
              onChange={(e) => setAnswers((a) => ({ ...a, note: e.target.value.slice(0, CHECKIN_NOTE_MAX) }))}
              rows={3}
              placeholder="Optional"
              className="w-full bg-cream border border-border px-3 py-2.5 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors resize-y"
            />
          </div>
        </div>
        {error && <p className="text-[12px] text-red-600 mt-4">{error}</p>}
        <button
          onClick={save}
          disabled={busy || !checkinComplete(answers)}
          className="w-full mt-6 bg-text-primary text-cream font-medium py-3 border-none cursor-pointer text-[14px] hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? 'Sending…' : `Send to ${coachName}`}
        </button>
      </div>
    </Modal>
  )
}
