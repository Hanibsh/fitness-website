import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Home, Dumbbell } from 'lucide-react'
import { searchExercises } from '../lib/exerciseLibrary'
import { useSearchQuery } from '../lib/useSearchQuery'
import {
  allByCategory,
  bankCategories,
  getFullExercise,
  TYPES,
  titleCase,
  EXERCISE_COUNT,
} from '../lib/exerciseBank'
import { AT_HOME_EQUIPMENT, GYM_EQUIPMENT, ALL_EQUIPMENT } from '../data/equipmentGroups'
import ExerciseCard from '../components/ExerciseCard'
import InteractiveAnatomy from '../components/InteractiveAnatomy'
import SearchField from '../components/SearchField'

// "At home" and "Full gym" are macros over the same equipment Set the gear chips
// write to, so one predicate still filters everything. Full gym selects all five
// values rather than clearing the Set: an empty Set means "no filter", which
// renders the anatomy hero instead of a result list.

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`text-[12px] px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${
        active
          ? 'bg-text-primary text-cream border-text-primary'
          : 'bg-white text-text-muted border-border hover:border-border-hover'
      }`}
    >
      {children}
    </button>
  )
}

// Compact category link — the keyboard/screen-reader path and quick nav that
// sits under the interactive anatomy hero.
function CategoryPill({ cat }) {
  return (
    <Link
      to={`/exercises/group/${cat.slug}`}
      className="inline-flex items-baseline gap-1.5 bg-white border border-border rounded-full px-3.5 py-1.5 no-underline hover:border-border-hover transition-colors group"
    >
      <span className="text-[13px] font-medium text-text-primary group-hover:text-accent-hover transition-colors">
        {cat.name}
      </span>
      <span className="text-text-light text-[11px]">{cat.count}</span>
    </Link>
  )
}

export default function Exercises() {
  // In the URL, so back from an exercise lands on the same results — and so a
  // muscle hub's "search the whole bank" link can hand its query over.
  const [query, setQuery] = useSearchQuery()
  const [equip, setEquip] = useState(() => new Set())
  const [types, setTypes] = useState(() => new Set())

  const q = query.trim()
  const hasQuery = q.length > 0
  const hasFilters = equip.size > 0 || types.size > 0

  const toggle = (setter) => (val) =>
    setter((prev) => {
      const next = new Set(prev)
      next.has(val) ? next.delete(val) : next.add(val)
      return next
    })
  const toggleEquip = toggle(setEquip)
  const toggleType = toggle(setTypes)

  const isExactly = (list) => equip.size === list.length && list.every((x) => equip.has(x))
  const atHomeOn = isExactly(AT_HOME_EQUIPMENT)
  const fullGymOn = isExactly(ALL_EQUIPMENT)
  const setAtHome = () => setEquip(atHomeOn ? new Set() : new Set(AT_HOME_EQUIPMENT))
  const setFullGym = () => setEquip(fullGymOn ? new Set() : new Set(ALL_EQUIPMENT))

  const matches = (e) =>
    (equip.size === 0 || equip.has(e.equipment)) && (types.size === 0 || types.has(e.type))

  // Query → flat ranked results (DB rows only). Filters narrow further.
  const results = useMemo(() => {
    if (!hasQuery) return null
    return searchExercises(q)
      .map((m) => (m.id ? getFullExercise(m.id) : null))
      .filter((e) => e && matches(e))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, hasQuery, equip, types])

  // Filters only (no query) → category sections, rows filtered; empty dropped.
  const sections = useMemo(() => {
    if (hasQuery || !hasFilters) return null
    return allByCategory()
      .map(([cat, rows]) => [cat, rows.filter(matches)])
      .filter(([, rows]) => rows.length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasQuery, hasFilters, equip, types])

  // Pristine view (no query, no filters) → home-category tiles.
  const showTiles = !hasQuery && !hasFilters
  const categories = useMemo(() => (showTiles ? bankCategories() : null), [showTiles])

  const clearAll = () => {
    setQuery('')
    setEquip(new Set())
    setTypes(new Set())
  }

  return (
    <div className="pt-24 pb-16 px-6">
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <p className="text-[11px] uppercase tracking-[3px] text-text-light mb-4">Exercise Bank</p>
          <h1 className="font-heading text-4xl md:text-5xl font-medium text-text-primary mb-3 tracking-tight">
            Every exercise, explained
          </h1>
          <p className="text-text-muted text-[15px]">
            {EXERCISE_COUNT} movements — pick a muscle group, or search across everything.
          </p>
        </motion.div>

        {/* Search — floats under the navbar once you scroll past it */}
        <SearchField
          variant="pill"
          floating
          value={query}
          onChange={setQuery}
          placeholder="Search exercises, muscles…"
          className="max-w-md mx-auto mb-4"
        />

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-2">
          <Chip active={atHomeOn} onClick={setAtHome}>
            <span className="inline-flex items-center gap-1">
              <Home className="w-3 h-3" /> At home
            </span>
          </Chip>
          <Chip active={fullGymOn} onClick={setFullGym}>
            <span className="inline-flex items-center gap-1">
              <Dumbbell className="w-3 h-3" /> Full gym
            </span>
          </Chip>
          {GYM_EQUIPMENT.map((eq) => (
            <Chip key={eq} active={equip.has(eq)} onClick={() => toggleEquip(eq)}>
              {titleCase(eq)}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
          {TYPES.map((t) => (
            <Chip key={t} active={types.has(t)} onClick={() => toggleType(t)}>
              {titleCase(t)}
            </Chip>
          ))}
          {(hasQuery || hasFilters) && (
            <button
              onClick={clearAll}
              className="text-[12px] px-3 py-1.5 text-text-muted hover:text-text-primary bg-transparent border-none cursor-pointer underline underline-offset-2"
            >
              Clear
            </button>
          )}
        </div>

        {/* Interactive anatomy hero + category pills (pristine view) */}
        {categories && (
          <div>
            <InteractiveAnatomy />
            <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
              {categories.map((cat) => (
                <CategoryPill key={cat.slug} cat={cat} />
              ))}
            </div>
          </div>
        )}

        {/* Search results */}
        {results && (
          <div>
            <p className="text-text-light text-[12px] mb-4">
              {results.length} {results.length === 1 ? 'result' : 'results'}
            </p>
            {results.length ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {results.map((e) => (
                  <ExerciseCard key={e.id} e={e} />
                ))}
              </div>
            ) : (
              <p className="text-text-muted text-[14px] text-center py-10">No exercises match.</p>
            )}
          </div>
        )}

        {/* Filtered category sections (filters only, no query) */}
        {sections &&
          (sections.length ? (
            sections.map(([category, rows]) => (
              <section key={category} className="mb-11">
                <h2 className="font-heading text-lg font-medium text-text-primary mb-4">
                  {category} <span className="text-text-light text-sm font-normal">· {rows.length}</span>
                </h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {rows.map((e) => (
                    <ExerciseCard key={e.id} e={e} />
                  ))}
                </div>
              </section>
            ))
          ) : (
            <p className="text-text-muted text-[14px] text-center py-10">No exercises match these filters.</p>
          ))}
      </div>
    </div>
  )
}
