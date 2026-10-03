import { motion } from 'framer-motion'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { categoryExercises, subcategoryExercises, subcategoryTiles, EXERCISE_COUNT } from '../lib/exerciseBank'
import { filterExercises } from '../lib/exerciseLibrary'
import { useSearchQuery } from '../lib/useSearchQuery'
import { categoryBySlug, SUBCATEGORIES, MUSCLE_INFO } from '../data/muscleInfo'
import ExerciseCard from '../components/ExerciseCard'
import MuscleGuide from '../components/MuscleGuide'
import SearchField from '../components/SearchField'

function NotFound() {
  return (
    <div className="pt-24 pb-16 px-6 max-w-2xl mx-auto text-center">
      <p className="text-text-muted text-[15px] mb-4">Muscle group not found.</p>
      <Link to="/exercises" className="text-[13px] text-text-primary no-underline hover:text-accent-hover">
        ← Back to the exercise bank
      </Link>
    </div>
  )
}

function SubTile({ parentSlug, sub }) {
  return (
    <Link
      to={`/exercises/group/${parentSlug}/${sub.slug}`}
      className="block bg-white border border-border rounded-xl p-4 no-underline hover:border-border-hover transition-all group"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-heading text-[15px] font-medium text-text-primary group-hover:text-accent-hover transition-colors">
          {sub.name}
        </h3>
        <span className="text-text-light text-[12px] shrink-0">{sub.count}</span>
      </div>
    </Link>
  )
}

function ExerciseGrid({ rows }) {
  if (!rows.length) {
    return <p className="text-text-muted text-[14px] py-10 text-center">No exercises here yet.</p>
  }
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {rows.map((e) => (
        <ExerciseCard key={e.id} e={e} />
      ))}
    </div>
  )
}

// Search box for a hub's exercises. It sits under the title rather than over
// the grid: the muscle guide above the grid is long, and on a phone the box
// would otherwise be a long scroll away from where you land. It floats once
// you scroll past it, so it's still there at the bottom of the grid.
function HubSearch({ name, query, setQuery }) {
  return (
    <SearchField
      variant="pill"
      floating
      value={query}
      onChange={setQuery}
      placeholder={`Search ${name.toLowerCase()}…`}
      className="max-w-md mt-5"
    />
  )
}

// While searching, the hub collapses to just the matches (the guide and the
// muscle tiles step aside), best match first. Nothing here? Hand the query to
// the whole bank rather than leaving a dead end — the movement may simply live
// under another group.
function SearchResults({ name, rows, query }) {
  const q = query.trim()
  const hits = filterExercises(rows, q)
  return (
    <div className="mt-8">
      <p className="text-text-light text-[12px] mb-4">
        {hits.length} of {rows.length} {rows.length === 1 ? 'exercise' : 'exercises'}
      </p>
      {hits.length ? (
        <ExerciseGrid rows={hits} />
      ) : (
        <div className="text-center py-10">
          <p className="text-text-muted text-[14px] mb-2">
            No {name.toLowerCase()} exercises match “{q}”.
          </p>
          <Link
            to={`/exercises?q=${encodeURIComponent(q)}`}
            className="text-[13px] text-text-primary underline underline-offset-2 hover:text-accent-hover"
          >
            Search all {EXERCISE_COUNT} exercises instead
          </Link>
        </div>
      )}
    </div>
  )
}

export default function ExerciseCategory() {
  const { cat, sub } = useParams()
  const [query, setQuery] = useSearchQuery()
  const searching = query.trim().length > 0
  const category = categoryBySlug(cat)
  if (!category) return <NotFound />

  // --- Subcategory hub (e.g. /exercises/group/legs/quads) ---
  if (sub) {
    const subDef = SUBCATEGORIES[sub]
    if (!subDef || subDef.parent !== cat) return <NotFound />
    const rows = subcategoryExercises(sub)
    return (
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-5xl mx-auto">
          <Link
            to={`/exercises/group/${cat}`}
            className="inline-flex items-center gap-1.5 text-[12px] text-text-muted no-underline hover:text-text-primary mb-6"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> {category.name}
          </Link>
          {/* No eyebrow: the back link right above already names the group. */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="font-heading text-3xl md:text-4xl font-medium text-text-primary tracking-tight">
              {subDef.name}
            </h1>
            <HubSearch name={subDef.name} query={query} setQuery={setQuery} />
            {searching ? (
              <SearchResults name={subDef.name} rows={rows} query={query} />
            ) : (
              <>
                <MuscleGuide info={MUSCLE_INFO[sub]} />
                <p className="text-text-light text-[12px] mb-4">
                  {rows.length} {rows.length === 1 ? 'exercise' : 'exercises'}
                </p>
                <ExerciseGrid rows={rows} />
              </>
            )}
          </motion.div>
        </div>
      </div>
    )
  }

  // --- Category hub (e.g. /exercises/group/legs) ---
  const tiles = category.subs ? subcategoryTiles(cat) : null
  const rows = categoryExercises(cat)
  return (
    <div className="pt-24 pb-16 px-6">
      <div className="max-w-5xl mx-auto">
        <Link
          to="/exercises"
          className="inline-flex items-center gap-1.5 text-[12px] text-text-muted no-underline hover:text-text-primary mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Exercise bank
        </Link>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-[11px] uppercase tracking-[3px] text-text-light mb-2">Muscle group</p>
          <h1 className="font-heading text-3xl md:text-4xl font-medium text-text-primary tracking-tight">
            {category.name}
          </h1>
          <HubSearch name={category.name} query={query} setQuery={setQuery} />
          {searching ? (
            <SearchResults name={category.name} rows={rows} query={query} />
          ) : (
            <>
              <MuscleGuide info={MUSCLE_INFO[cat]} />

              {tiles && (
                <>
                  <p className="text-text-secondary text-[13px] font-medium mb-3">Pick a muscle</p>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
                    {tiles.map((t) => (
                      <SubTile key={t.slug} parentSlug={cat} sub={t} />
                    ))}
                  </div>
                </>
              )}
              <p className="text-text-light text-[12px] mb-4">
                {tiles ? `All ${rows.length} exercises` : `${rows.length} ${rows.length === 1 ? 'exercise' : 'exercises'}`}
              </p>
              <ExerciseGrid rows={rows} />
            </>
          )}
        </motion.div>
      </div>
    </div>
  )
}
