import { useMemo, useState } from 'react'
import { Route, ChevronDown } from 'lucide-react'
import { patternOptions } from '../lib/generator'
import { getPattern, patternPhrase } from '../data/movementPatterns'
import { useInjuries, useInjuryRisk } from '../lib/useInjuries'
import InjuryBadge from './InjuryBadge'
import ExercisePicker from './ExercisePicker'

// "Any vertical pull" — the movements that will do this slot's job.
//
// This is the component the whole movement-path idea is for. A plan row says
// what the day needs (a path, a muscle, a set count); this is where you decide
// which piece of hardware does it. Three surfaces use it and they must offer the
// same list, because they are the same question asked at different moments:
// writing the split, standing in front of a taken machine mid-session, and
// looking for something else to do.
//
// The ranking is the split generator's own scorer, run in the slot's real
// context (see patternOptions) — so the order here is the order the generator
// would have picked in, and the top row is what it proposed. It is a list to
// choose from, not a recommendation to accept: everything on it does the job.
export default function PatternPicker({ planned, program, dayId, sessions = [], onPick, onCancel, autoFocusSearch = false, initialLimit = 0 }) {
  // The same injury steer the generator gets. Without it the two would
  // disagree — the generator would route around a bad shoulder and this panel
  // would then offer the movement it just avoided.
  const { injuries } = useInjuries()
  const injuryRisk = useInjuryRisk()
  const [searchOpen, setSearchOpen] = useState(autoFocusSearch)
  const [showAll, setShowAll] = useState(false)

  const pattern = planned?.slot?.pattern || null
  const options = useMemo(
    () => patternOptions(planned, { program, dayId, sessions, injuries }),
    [planned, program, dayId, sessions, injuries]
  )

  const info = getPattern(pattern)
  // `initialLimit` trims the list where several of these are on screen at once
  // (the logger, mid-session). 0 means show everything, which is what the split
  // editor wants — there you are looking at one slot on purpose.
  const shown = initialLimit && !showAll ? options.slice(0, initialLimit) : options
  const hidden = options.length - shown.length

  // No path to browse (a custom movement, or a row from before slots existed):
  // fall back to plain search rather than showing an empty panel.
  if (!pattern || !options.length) {
    return (
      <div className="mt-2">
        <ExercisePicker
          onSelect={(name, category, id) => onPick?.({ id, name, category })}
          excludeCategory="Cardio"
          placeholder="Replace with…"
        />
      </div>
    )
  }

  return (
    <div className="border border-border bg-white mb-2">
      <div className="px-3 py-2.5 border-b border-border">
        <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-text-primary">
          <Route className="w-3.5 h-3.5 shrink-0" />
          <span className="break-words">{patternPhrase(pattern)}</span>
        </p>
        {/* What the path actually IS, mechanically. Worth the two lines: the
            whole premise of choosing your own movement is that you know what
            the slot is asking for. */}
        {info?.path && <p className="text-[11px] text-text-light mt-1 break-words">{info.path}</p>}
        {planned?.slot?.muscle && (
          <p className="text-[11px] text-text-light mt-1 break-words">
            Ranked for <span className="text-text-primary">{planned.slot.muscle.toLowerCase()}</span> in this slot.
          </p>
        )}
      </div>

      <ul className="list-none m-0 p-0">
        {shown.map((o) => (
          <li key={o.id}>
            <button
              type="button"
              onClick={() => onPick?.(o)}
              className="w-full text-left px-3 py-2.5 bg-transparent border-none border-b border-border cursor-pointer hover:bg-cream transition-colors"
            >
              <span className="flex items-start justify-between gap-2">
                <span className="min-w-0 text-[13px] text-text-primary break-words">{o.name}</span>
                {injuryRisk.get(o.id) ? (
                  <InjuryBadge hit={injuryRisk.get(o.id)} compact asLink={false} />
                ) : (
                  <span className="shrink-0 text-[10px] uppercase tracking-wider text-text-light">{o.equipment}</span>
                )}
              </span>
              <span className="block text-[11px] text-text-light mt-0.5 break-words">
                {/* Only one badge, and current outranks suggested: on a filled
                    row "what you have now" is the more useful fact, and on an
                    open one there is nothing current for it to compete with. */}
                {o.current ? <span className="text-text-primary">Current · </span> : o.suggested ? <span className="text-text-primary">Suggested · </span> : null}
                {o.reason}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="w-full text-left px-3 py-2 bg-transparent border-none border-b border-border cursor-pointer text-[11px] text-text-light hover:text-text-primary transition-colors"
        >
          {hidden} more {hidden === 1 ? 'movement' : 'movements'} on this path
        </button>
      )}

      {/* Sometimes the answer isn't on this path at all — the rack is busy and
          you'll do something else entirely. Folded away because reaching past
          the slot should be the deliberate option, not the obvious one. */}
      <div className="px-3 py-2">
        {searchOpen ? (
          <ExercisePicker
            onSelect={(name, category, id) => onPick?.({ id, name, category })}
            excludeCategory="Cardio"
            placeholder="Search any exercise…"
          />
        ) : (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-1 bg-transparent border-none cursor-pointer p-0 text-[11px] text-text-light hover:text-text-primary transition-colors"
          >
            <ChevronDown className="w-3 h-3" />
            Something else entirely
          </button>
        )}
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="block mt-2 bg-transparent border-none cursor-pointer p-0 text-[11px] text-text-light hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
