import { Link } from 'react-router-dom'
import { primaryMuscles, titleCase } from '../lib/exerciseBank'

// Deliberately rare mini-badge: only exercises the DB rates excellent on BOTH
// stimulus-to-fatigue and hypertrophy potential (~1 in 6) qualify, so a badge
// on a card still means something while scanning a grid.
function badges(e) {
  return e.sfr === 'excellent' && e.hypertrophyPotential === 'excellent' ? ['Top pick'] : []
}

// Compact card for one exercise in the bank (browse landing, hubs, search).
export default function ExerciseCard({ e }) {
  const tags = badges(e)
  return (
    <Link
      to={`/exercises/${e.id}`}
      className="block bg-white border border-border rounded-xl p-4 no-underline hover:border-border-hover transition-all group"
    >
      <h3 className="font-heading text-[14px] font-medium text-text-primary group-hover:text-accent-hover transition-colors leading-snug">
        {e.name}
      </h3>
      <p className="text-text-muted text-[12px] mt-1.5">
        {titleCase(e.equipment)} · {titleCase(e.type)}
      </p>
      <p className="text-text-light text-[11px] mt-1 truncate">{primaryMuscles(e).join(', ')}</p>
      {tags.length > 0 && (
        <p className="mt-2 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span
              key={t}
              className="text-[10px] font-medium text-text-secondary border border-border rounded-full px-2 py-0.5"
            >
              {t}
            </span>
          ))}
        </p>
      )}
    </Link>
  )
}
