import { useState } from 'react'
import { Check, Link2Off } from 'lucide-react'
import ProfileSection from './ProfileSection'
import ConfirmModal from './ConfirmModal'
import { COACH_SEES } from '../lib/coach'

const fmt = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

// The profile page's Coach section, for an account linked to a coach: who,
// what they see, and the way out.
export default function CoachSection({ coach, onStop, sectionProps }) {
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState('')
  const name = coach.coach_name

  async function stop() {
    setError('')
    try {
      await onStop()
    } catch {
      setError('That didn’t work — try again.')
    }
  }

  return (
    <ProfileSection id="coach" title="Coach" {...sectionProps}>
      <p className="text-[14px] text-text-primary font-medium mb-4">
        Coached by {name}{coach.since ? ` since ${fmt(coach.since)}` : ''}.
      </p>
      <p className="text-[12px] text-text-muted mb-2">{name} sees:</p>
      <ul className="space-y-2 m-0 p-0 list-none mb-6">
        {COACH_SEES.map((line) => (
          <li key={line} className="flex items-start gap-2 text-[13px] text-text-secondary">
            <Check className="w-4 h-4 shrink-0 mt-px text-text-muted" /> {line}
          </li>
        ))}
      </ul>
      <button
        onClick={() => setConfirm(true)}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-muted hover:text-red-600 bg-white border border-border hover:border-border-hover px-4 py-2.5 cursor-pointer transition-colors"
      >
        <Link2Off className="w-4 h-4" /> Stop sharing
      </button>
      {error && <p className="text-[12px] text-red-600 mt-3">{error}</p>}
      {confirm && (
        <ConfirmModal
          title={`Stop sharing with ${name}?`}
          message={`${name} stops seeing your training. Programs ${name} sent stay yours.`}
          confirmLabel="Stop sharing"
          onConfirm={stop}
          onClose={() => setConfirm(false)}
        />
      )}
    </ProfileSection>
  )
}
