import { useMemo } from 'react'
import { Sparkles } from 'lucide-react'
import { suggestAlternatives } from '../lib/generator'
import { useInjuries } from '../lib/useInjuries'

// "Give me something else for this slot."
//
// Sits above the search box in the split editor's swap panel. The search box
// answers "I know what I want"; this answers the harder and more common
// version — you're bored of a movement, or it isn't recovering, and you don't
// know what to put there instead.
//
// The ranking is the split generator's own scorer (src/lib/generator.js), run
// against the muscle this row is there for and in the context the row actually
// sits in: what else is in the day, how much fatigue the day already carries,
// and how long until that muscle is trained again. So the answer changes with
// the slot, which is the point — the same two movements are not equally good on
// a fresh day and a fried one. Each option states the one thing that most
// distinguishes it from what's there now.
export default function SwapSuggestions({ planned, program, dayId, sessions, onPick }) {
  // Same injury steer the generator gets. Without this the two would disagree —
  // the generator would route around a bad shoulder and then this panel would
  // suggest the movement it just avoided.
  const { injuries } = useInjuries()
  const options = useMemo(
    () => suggestAlternatives(planned, { program, dayId, sessions, injuries }),
    [planned, program, dayId, sessions, injuries]
  )

  if (!options.length) return null

  return (
    <div className="border border-border bg-white mb-2">
      <p className="flex items-center gap-1.5 px-3 py-2 text-[10px] uppercase tracking-wider text-text-light border-b border-border">
        <Sparkles className="w-3 h-3 shrink-0" />
        Suggested for {options[0].muscle.toLowerCase()}
      </p>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onPick(o)}
          className="w-full text-left px-3 py-2.5 bg-transparent border-none border-b border-border last:border-b-0 cursor-pointer hover:bg-cream transition-colors"
        >
          <span className="block text-[13px] text-text-primary break-words">{o.name}</span>
          <span className="block text-[11px] text-text-light mt-0.5 break-words">{o.reason}</span>
        </button>
      ))}
    </div>
  )
}
