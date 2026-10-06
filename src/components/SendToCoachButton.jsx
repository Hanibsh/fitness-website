import { useNavigate, useLocation } from 'react-router-dom'
import { Send } from 'lucide-react'

// "Send to Leon": opens the chat with this thing (a lib/chatCards.js card)
// attached, so a question can go with it before it's sent. Only for a coached
// account — nothing renders without `coachId`.
//
// `makeCard` instead of `card` when building it costs something (a workout's
// PRs), so it only runs on tap. The chat's back link returns here; `backState`
// is this page's own router state, handed back on return.
export default function SendToCoachButton({ card, makeCard, coachId, coachName = 'Leon', backLabel = 'Back', backState, variant = 'link' }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  if (!coachId) return null

  function open() {
    navigate('/messages', { state: { attach: makeCard ? makeCard() : card, backTo: pathname, backLabel, backState } })
  }

  if (variant === 'button') {
    return (
      <button
        onClick={open}
        className="inline-flex items-center gap-1.5 bg-white text-text-muted hover:text-text-primary text-[13px] font-medium px-4 py-[7px] rounded-lg border border-border hover:border-border-hover cursor-pointer transition-colors"
      >
        <Send className="w-4 h-4" /> Send to {coachName}
      </button>
    )
  }
  return (
    <button
      onClick={open}
      className="inline-flex items-center gap-1.5 text-[12px] text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer transition-colors"
    >
      <Send className="w-3.5 h-3.5" /> Send to {coachName}
    </button>
  )
}
