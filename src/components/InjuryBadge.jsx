import { Link } from 'react-router-dom'
import { Bandage } from 'lucide-react'
import { TIER_LABEL, injuryTitle } from '../lib/injuries'

// "This one loads the thing that hurts."
//
// One component for every surface that shows exercises — the logger, the
// picker, the exercise page — so the warning can't say three different things
// about the same movement.
//
// It names the injury rather than saying a generic "careful": with two open
// injuries, "loads this area" is useless and "loads your left knee" is
// actionable. Links to the injury so the correction (marking the movement as
// fine, or as one that hurts) is one tap from where you noticed.
const TONE = {
  high: 'text-red-600 bg-red-50 border-red-300 dark:text-red-400 dark:bg-red-500/10 dark:border-red-500/30',
  moderate: 'text-amber-700 bg-amber-50 border-amber-300 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/30',
  low: 'text-text-muted bg-cream border-border',
}

export default function InjuryBadge({ hit, compact = false, asLink = true }) {
  if (!hit) return null
  const { tier, injury } = hit
  const title = injuryTitle(injury)
  // A verdict of 'hurts' comes through as risk 1 — say so plainly instead of
  // repeating our estimate back at someone who already corrected it.
  const flagged = injury.verdicts?.[hit.exerciseId] === 'hurts'
  const text = compact ? title : `${flagged ? 'You marked this' : TIER_LABEL[tier]} · ${title}`

  const className = `inline-flex items-center gap-1 shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 border no-underline ${TONE[tier] || TONE.low}`

  const body = (
    <>
      <Bandage className="w-3 h-3 shrink-0" />
      {text}
    </>
  )

  if (!asLink) return <span className={className}>{body}</span>
  return (
    <Link to={`/injuries/${injury.id}`} className={className} title={`${TIER_LABEL[tier]} — ${title}. Open to mark it fine or painful.`}>
      {body}
    </Link>
  )
}
