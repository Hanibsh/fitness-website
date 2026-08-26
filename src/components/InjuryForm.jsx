import { useState } from 'react'
import { Bandage } from 'lucide-react'
import Modal from './Modal'
import { JOINT_AREAS, JOINT_AREA_IDS, MUSCLE_AREA_IDS } from '../lib/injuryConfig'
import { SIDES } from '../lib/injuries'
import { makeInjury } from '../lib/workoutStore'

// Create or edit an injury.
//
// Area is picked from chips rather than a body diagram. The app HAS an
// interactive anatomy map (InteractiveAnatomy.jsx), but its zones are muscle
// label rectangles drawn from the art — there is no shoulder, no knee, no lower
// back on it, and joints are most of what people actually injure. A diagram that
// can only express half the taxonomy is worse than a list that expresses all of
// it.
//
// The joint/muscle split isn't cosmetic either: it selects which risk model runs
// (see injuries.js). A joint infers stress from the muscles that move it; a
// strain is the muscle itself, and cares about stretch instead.
const KINDS = [
  { id: 'joint', label: 'Joint or area', hint: 'Shoulder, knee, lower back — it hurts when you move it.' },
  { id: 'muscle', label: 'Muscle strain', hint: 'You pulled something. The muscle itself is the injury.' },
]

function dateInputValue(ts) {
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function InjuryForm({ injury = null, onSave, onClose }) {
  const editing = !!injury
  const [kind, setKind] = useState(injury?.kind || 'joint')
  const [area, setArea] = useState(injury?.area || '')
  const [side, setSide] = useState(injury?.side ?? null)
  const [label, setLabel] = useState(injury?.label || '')
  const [note, setNote] = useState(injury?.note || '')
  const [started, setStarted] = useState(dateInputValue(injury?.startedAt || Date.now()))
  const [saving, setSaving] = useState(false)

  const areas = kind === 'joint'
    ? JOINT_AREA_IDS.map((id) => ({ id, label: JOINT_AREAS[id].label }))
    : MUSCLE_AREA_IDS.map((m) => ({ id: m, label: m }))

  function pickKind(next) {
    setKind(next)
    setArea('') // the taxonomies don't overlap, so a kept area would be invalid
  }

  async function submit() {
    if (!area || saving) return
    setSaving(true)
    // Parsed as local noon so the start date can't drift a day across a
    // timezone, matching every other date this app stores.
    const [y, m, d] = started.split('-').map(Number)
    const startedAt = new Date(y, m - 1, d, 12, 0, 0, 0).getTime()
    const next = editing
      ? { ...injury, kind, area, side, label: label.trim().slice(0, 80), note: note.trim().slice(0, 600), startedAt }
      : makeInjury({ kind, area, side, label, note, startedAt })
    await onSave(next)
    setSaving(false)
    onClose()
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-lg">
      <div className="p-6 sm:p-7">
        <div className="flex items-center gap-2 mb-4 pr-8">
          <Bandage className="w-4 h-4 text-text-primary shrink-0" />
          <h3 className="font-heading text-lg font-medium text-text-primary">
            {editing ? 'Edit injury' : 'What happened?'}
          </h3>
        </div>

        <p className="text-[10px] uppercase tracking-wider text-text-light mb-2">Kind</p>
        <div className="grid gap-1.5 sm:grid-cols-2 mb-1.5">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => pickKind(k.id)}
              aria-pressed={kind === k.id}
              className={`text-left px-3 py-2 border cursor-pointer transition-colors ${
                kind === k.id ? 'bg-text-primary text-cream border-text-primary' : 'bg-white text-text-muted border-border hover:border-border-hover'
              }`}
            >
              <span className="block text-[13px] font-medium">{k.label}</span>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-text-muted mb-4">{KINDS.find((k) => k.id === kind).hint}</p>

        <p className="text-[10px] uppercase tracking-wider text-text-light mb-2">Where</p>
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {areas.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setArea(a.id)}
              aria-pressed={area === a.id}
              className={`px-2.5 py-1 text-[11px] font-medium border cursor-pointer transition-colors ${
                area === a.id ? 'bg-text-primary text-cream border-text-primary' : 'bg-white text-text-muted border-border hover:border-border-hover'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
        {kind === 'joint' && area && (
          <p className="text-[11px] text-text-muted mb-4">{JOINT_AREAS[area].blurb}</p>
        )}
        {(kind !== 'joint' || !area) && <div className="mb-4" />}

        <p className="text-[10px] uppercase tracking-wider text-text-light mb-2">Side</p>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {SIDES.map((s) => (
            <button
              key={s.id ?? 'na'}
              type="button"
              onClick={() => setSide(s.id)}
              aria-pressed={side === s.id}
              className={`px-2.5 py-1 text-[11px] font-medium border cursor-pointer transition-colors ${
                side === s.id ? 'bg-text-primary text-cream border-text-primary' : 'bg-white text-text-muted border-border hover:border-border-hover'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 mb-4">
          <div>
            <label htmlFor="injury-started" className="block text-[10px] uppercase tracking-wider text-text-light mb-2">Started</label>
            <input
              id="injury-started"
              type="date"
              value={started}
              max={dateInputValue(Date.now())}
              onChange={(e) => setStarted(e.target.value)}
              className="w-full bg-cream border border-border px-2.5 py-2 text-text-primary text-[13px] outline-none focus:border-text-primary"
            />
          </div>
          <div>
            <label htmlFor="injury-label" className="block text-[10px] uppercase tracking-wider text-text-light mb-2">Call it (optional)</label>
            <input
              id="injury-label"
              type="text"
              value={label}
              maxLength={80}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. AC joint tweak"
              className="w-full bg-cream border border-border px-2.5 py-2 text-text-primary text-[13px] outline-none focus:border-text-primary"
            />
          </div>
        </div>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What happened, how it feels, what makes it worse — anything worth remembering (optional)"
          rows={3}
          maxLength={600}
          className="w-full bg-cream border border-border px-3 py-2 text-text-primary text-[13px] outline-none focus:border-text-primary resize-none mb-4"
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={!area || saving}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-text-primary text-cream font-medium py-3 border-none cursor-pointer text-[14px] hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Bandage className="w-4 h-4" /> {editing ? 'Save changes' : 'Track this'}
          </button>
          <button
            type="button"
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
