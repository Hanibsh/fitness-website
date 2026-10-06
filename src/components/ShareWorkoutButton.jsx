import { useState } from 'react'
import { Send, Check } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { sendMessage, DEV_CLIENT_ID } from '../lib/messages'
import { workoutCard } from '../lib/chatCards'

// "Send to Leon" under a workout summary: the workout lands in the chat as a
// card, PRs and all. Only for a coached account — nothing renders without
// `coachId`.
export default function ShareWorkoutButton({ session, history = [], unit = 'kg', coachId, coachName = 'Leon' }) {
  const { user } = useAuth()
  const [state, setState] = useState('idle') // 'sending' | 'sent' | 'error'
  if (!coachId) return null

  async function share() {
    setState('sending')
    const me = user?.id || DEV_CLIENT_ID
    try {
      await sendMessage({ coachId, clientId: me, senderId: me, card: workoutCard(session, history, unit) })
      setState('sent')
    } catch {
      setState('error')
    }
  }

  if (state === 'sent') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-text-primary">
        <Check className="w-3.5 h-3.5" /> Sent to {coachName}
      </span>
    )
  }
  return (
    <button
      onClick={share}
      disabled={state === 'sending'}
      className="inline-flex items-center gap-1.5 text-[12px] text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer transition-colors disabled:opacity-50"
    >
      <Send className="w-3.5 h-3.5" /> {state === 'sending' ? 'Sending…' : state === 'error' ? 'Didn’t send — try again' : `Send to ${coachName}`}
    </button>
  )
}
