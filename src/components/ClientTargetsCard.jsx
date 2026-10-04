import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import NumberField from './NumberField'
import CoachComments from './CoachComments'
import { useClientNotes, useClientTargets } from '../lib/useCoachNotes'

// What the coach sets for a linked client — targets and notes — shown on the
// client's dashboard in the "From Leon" card. Sits on the client's page.
export default function ClientTargetsCard({ clientName, clientUserId, unit = 'kg' }) {
  const { targets, targetsLoaded, saveTargets } = useClientTargets(clientUserId)
  const { notes, addNote, removeNote } = useClientNotes(clientUserId)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const name = clientName || 'them'

  // The form starts from what's saved, once that's known.
  useEffect(() => {
    if (!targetsLoaded || form) return
    const t = targets || {}
    const text = (v) => (v == null ? '' : String(v))
    setForm({ goalWeight: text(t.goalWeight), calories: text(t.calories), protein: text(t.protein), carbs: text(t.carbs), fat: text(t.fat) })
  }, [targetsLoaded, targets, form])

  const set = (key) => (v) => {
    setForm((f) => ({ ...f, [key]: v }))
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    setError('')
    const num = (v) => (v === '' || v == null || !(Number(v) > 0) ? null : Number(v))
    try {
      await saveTargets({
        goalWeight: num(form.goalWeight),
        unit,
        calories: num(form.calories),
        protein: num(form.protein),
        carbs: num(form.carbs),
        fat: num(form.fat),
      })
      setSaved(true)
    } catch {
      setError('Didn’t save — try again.')
    }
    setSaving(false)
  }

  const labelCls = 'text-[11px] text-text-muted uppercase tracking-wider block mb-2'
  const inputCls = 'w-full bg-cream border border-border px-3 py-2.5 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors'
  const field = (key, label, decimal = false) => (
    <div>
      <label className={labelCls} htmlFor={`target-${key}`}>{label}</label>
      <NumberField id={`target-${key}`} decimal={decimal} value={form?.[key] ?? ''} onValueChange={set(key)} className={inputCls} />
    </div>
  )

  return (
    <section className="bg-white border border-border p-5 sm:p-7">
      <h2 className="font-heading text-xl font-medium text-text-primary mb-1">For {name}</h2>
      <p className="text-[12px] text-text-light mb-6">Shows on their dashboard.</p>

      <p className="text-[11px] font-medium uppercase tracking-wider text-text-light mb-3">Targets</p>
      {!form ? (
        <p className="text-[13px] text-text-muted mb-6">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 mb-4">
            {field('goalWeight', `Goal weight (${unit})`, true)}
            {field('calories', 'Calories')}
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {field('protein', 'Protein (g)')}
            {field('carbs', 'Carbs (g)')}
            {field('fat', 'Fat (g)')}
          </div>
          <div className="flex items-center gap-3 mb-8">
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 bg-text-primary text-cream font-medium px-4 py-2.5 border-none cursor-pointer text-[13px] hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {saved && <Check className="w-4 h-4" />}
              {saving ? 'Saving…' : saved ? 'Saved' : 'Save targets'}
            </button>
            {error && <p className="text-[12px] text-red-600">{error}</p>}
          </div>
        </>
      )}

      <p className="text-[11px] font-medium uppercase tracking-wider text-text-light mb-3">Note</p>
      <CoachComments
        notes={notes.filter((n) => n.kind === 'general')}
        onAdd={(body) => addNote({ kind: 'general', body })}
        onRemove={removeNote}
        placeholder={`A note for ${name}`}
        label="Sent"
      />
    </section>
  )
}
