import { Dumbbell, CalendarRange, Activity } from 'lucide-react'
import Modal from './Modal'
import ExercisePicker from './ExercisePicker'
import { exerciseCard, splitCard, workoutCard, splitShape } from '../lib/chatCards'
import { sessionStats } from '../lib/workoutStore'

// Picking something from the app to share — the chat's + button and the
// community's post box. Each pick hands back a lib/chatCards.js card.

const shortDate = (ts) => new Date(ts).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

export function PickerList({ title, empty, items, onClose }) {
  return (
    <Modal onClose={onClose} maxWidth="max-w-md">
      <div className="p-6">
        <h3 className="font-heading text-xl font-medium text-text-primary mb-4 pr-8">{title}</h3>
        {items.length ? (
          <div className="border border-border divide-y divide-border">
            {items.map((it) => (
              <button
                key={it.key}
                type="button"
                onClick={it.onPick}
                className="w-full text-left px-4 py-3 bg-white hover:bg-cream border-none cursor-pointer transition-colors"
              >
                <span className="block text-[14px] text-text-primary break-words">{it.title}</span>
                {it.line && <span className="block text-[12px] text-text-muted mt-0.5">{it.line}</span>}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-text-muted">{empty}</p>
        )}
      </div>
    </Modal>
  )
}

// The + button's menu, opening upward (`up`) or down from the button it sits
// beside. `items`: [{ key, label, icon, run }].
export function ShareMenu({ items, onClose, up = true }) {
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} aria-hidden="true" />
      <div className={`absolute left-0 z-20 w-52 bg-white border border-border shadow-lg ${up ? 'bottom-full mb-2' : 'top-full mt-2'}`} role="menu">
        {items.map((it) => (
          <button
            key={it.key}
            type="button"
            role="menuitem"
            onClick={() => { onClose(); it.run() }}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-left text-[14px] text-text-primary bg-white hover:bg-cream border-none cursor-pointer transition-colors"
          >
            <it.icon className="w-4 h-4 text-text-muted" /> {it.label}
          </button>
        ))}
      </div>
    </>
  )
}

// Menu items for the cards a page can share: an exercise always, a split when
// `splits` is passed, a workout when `sessions` is. `open(kind)` shows that
// kind's picker.
export function cardMenuItems({ splits, sessions, open }) {
  return [
    { key: 'exercise', label: 'Exercise', icon: Dumbbell, run: () => open('exercise') },
    splits && { key: 'split', label: 'Split', icon: CalendarRange, run: () => open('split') },
    sessions && { key: 'workout', label: 'Workout', icon: Activity, run: () => open('workout') },
  ].filter(Boolean)
}

// The picker for `picker` ('exercise' | 'split' | 'workout'; null shows
// nothing). `sessions`: { list, unit }.
export default function SharePickers({ picker, splits, sessions, onPick, onClose }) {
  if (picker === 'exercise') {
    return (
      <Modal onClose={onClose} maxWidth="max-w-md">
        <div className="p-6">
          <h3 className="font-heading text-xl font-medium text-text-primary mb-4 pr-8">Share an exercise</h3>
          <ExercisePicker onSelect={(name, category, id) => onPick(exerciseCard({ id, name, category }))} />
        </div>
      </Modal>
    )
  }
  if (picker === 'split') {
    return (
      <PickerList
        title="Share a split"
        empty="No splits yet."
        onClose={onClose}
        items={(splits || []).map((p) => {
          const { train } = splitShape(p)
          return { key: p.id, title: p.name || 'Split', line: `${train} training day${train === 1 ? '' : 's'}`, onPick: () => onPick(splitCard(p)) }
        })}
      />
    )
  }
  if (picker === 'workout') {
    return (
      <PickerList
        title="Share a workout"
        empty="No workouts logged yet."
        onClose={onClose}
        items={[...(sessions?.list || [])]
          .sort((a, b) => b.date - a.date)
          .slice(0, 20)
          .map((s) => {
            const { sets } = sessionStats(s)
            return {
              key: s.id,
              title: s.name || 'Workout',
              line: `${shortDate(s.date)} · ${sets} set${sets === 1 ? '' : 's'}`,
              onPick: () => onPick(workoutCard(s, sessions.list, sessions.unit)),
            }
          })}
      />
    )
  }
  return null
}
