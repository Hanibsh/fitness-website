import { motion } from 'framer-motion'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { categoryExercises, subcategoryExercises, subcategoryTiles } from '../lib/exerciseBank'
import { categoryBySlug, SUBCATEGORIES, MUSCLE_INFO } from '../data/muscleInfo'
import ExerciseCard from '../components/ExerciseCard'

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

// The muscle explainer that leads every hub — so the drill-down and the
// "what is this muscle?" answer never compete for the same click.
function MuscleBlurb({ info }) {
  if (!info) return null
  return (
    <div className="bg-white border border-border rounded-xl p-5 mt-6 mb-8">
      <p className="text-text-secondary text-[14px] leading-relaxed">{info.blurb}</p>
      {info.size && (
        <p className="text-[13px] text-accent-hover mt-3 pt-3 border-t border-border font-medium">
          {info.size}
        </p>
      )}
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
      {MUSCLE_INFO[sub.slug]?.size && (
        <p className="text-text-muted text-[12px] mt-1.5 leading-snug">{MUSCLE_INFO[sub.slug].size}</p>
      )}
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

export default function ExerciseCategory() {
  const { cat, sub } = useParams()
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
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-[11px] uppercase tracking-[3px] text-text-light mb-2">{category.name}</p>
            <h1 className="font-heading text-3xl md:text-4xl font-medium text-text-primary tracking-tight">
              {subDef.name}
            </h1>
            <MuscleBlurb info={MUSCLE_INFO[sub]} />
            <p className="text-text-light text-[12px] mb-4">
              {rows.length} {rows.length === 1 ? 'exercise' : 'exercises'}
            </p>
            <ExerciseGrid rows={rows} />
          </motion.div>
        </div>
      </div>
    )
  }

  // --- Category hub (e.g. /exercises/group/legs) ---
  const tiles = category.subs ? subcategoryTiles(cat) : null
  const rows = tiles ? null : categoryExercises(cat)
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
          <MuscleBlurb info={MUSCLE_INFO[cat]} />

          {tiles ? (
            <>
              <p className="text-text-secondary text-[13px] font-medium mb-3">Pick a muscle</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {tiles.map((t) => (
                  <SubTile key={t.slug} parentSlug={cat} sub={t} />
                ))}
              </div>
            </>
          ) : (
            <>
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
