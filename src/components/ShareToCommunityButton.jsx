import { useNavigate, useLocation } from 'react-router-dom'
import { UsersRound } from 'lucide-react'
import { useCommunityAccess } from '../lib/useCommunity'

// "Share": opens the community's post box with this thing (a lib/chatCards.js
// card) attached, so a caption can go with it. Only for community members —
// nothing renders for anyone else. Sits beside "Send to Leon" and takes the
// same props (see SendToCoachButton).
export default function ShareToCommunityButton({ card, makeCard, backLabel = 'Back', backState }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { coachId } = useCommunityAccess()
  if (!coachId) return null

  return (
    <button
      onClick={() => navigate('/community', { state: { attach: makeCard ? makeCard() : card, backTo: pathname, backLabel, backState } })}
      className="inline-flex items-center gap-1.5 text-[12px] text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer transition-colors"
    >
      <UsersRound className="w-3.5 h-3.5" /> Share
    </button>
  )
}
