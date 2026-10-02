import ExercisePicker from './ExercisePicker'
import SwapSuggestions from './SwapSuggestions'
import PatternPicker from './PatternPicker'

// "Something else for this row" — the one panel both the split editor and the
// wizard's preview open, so a movement is never offered in one and missing from
// the other.
//
// A row with a movement path answers "what else does this job?" first — that
// list is complete, ranked, and almost always where the answer is. A row
// without one (cardio, or anything hand-built) goes straight to the older
// suggestions-then-search panel.
//
// Every pick comes back the same shape, { id, name, category, pattern }, so the
// caller decides how to apply it: the editor through substituteExercise, the
// wizard through swapProposedRow.
export default function SlotSwapPanel({ planned, program, dayId, sessions = [], onPick, onCancel, initialLimit = 0 }) {
  const fromSearch = (name, category, id) => onPick({ id, name, category })

  if (planned.kind !== 'cardio' && planned.slot?.pattern) {
    return (
      <PatternPicker
        planned={planned}
        program={program}
        dayId={dayId}
        sessions={sessions}
        onPick={onPick}
        onCancel={onCancel}
        initialLimit={initialLimit}
      />
    )
  }

  return (
    <>
      {planned.kind !== 'cardio' && (
        <SwapSuggestions planned={planned} program={program} dayId={dayId} sessions={sessions} onPick={onPick} />
      )}
      <ExercisePicker
        onSelect={fromSearch}
        onlyCategory={planned.kind === 'cardio' ? 'Cardio' : undefined}
        excludeCategory={planned.kind === 'cardio' ? undefined : 'Cardio'}
        placeholder="Replace with…"
      />
    </>
  )
}
