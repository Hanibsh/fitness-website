import { motion } from 'framer-motion'
import { Link, useLocation, useOutletContext, useParams } from 'react-router-dom'
import { ArrowLeft, Play } from 'lucide-react'
import DayEditor from '../components/DayEditor'
import MuscleShareBars from '../components/MuscleShareBars'
import { muscleHref } from '../data/muscleInfo'
import { dayStats } from '../lib/planStats'
import { setDayName, splitSetCap } from '../lib/program'

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Level 3 of the split: ONE day, with room to breathe.
//
// The point of this page is the layout. In the old all-in-one editor every
// exercise lived in a 4-column grid, so on a phone the name column was ~130px
// shared with a chevron stack — long names truncated to "Barbell Bench Pre…" and
// the rows became impossible to tell apart. This page is the day's frame — its
// name, what it works, the way into the logger — and DayEditor is the exercises,
// the same editor the split generator's preview opens before a split is saved.
export default function SplitDay() {
  const { dayId } = useParams()
  const { state } = useLocation()
  const { user, program, update, isActive, isWeekly, todayWeekdayIndex, pointerIndex, mode = 'own', basePath = `/split/${program.id}` } = useOutletContext()
  // A client's split (ClientSplitLayout) keeps its notes on its own rows and
  // never reads your log: the shared per-movement notes and your history are
  // yours, and neither belongs on — or should steer — someone else's plan.
  const sharedNotes = mode !== 'client'

  const dayIndex = program.days.findIndex((d) => d.id === dayId)
  const day = dayIndex === -1 ? null : program.days[dayIndex]
  const setCap = splitSetCap(program)

  // Back goes wherever you actually came FROM. Arriving through the split you
  // came from its overview, and that's the fallback; arriving from the dashboard
  // or the calendar, that page hands over its own address, because otherwise the
  // one tap in cost four taps back out through Splits → Log → Tools. A URL
  // opened cold carries no state — hence the fallback.
  const backTo = state?.backTo || basePath
  const backLabel = state?.backLabel || program.name
  const backLink = (
    <Link to={backTo} className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary no-underline text-[13px] mb-8 transition-colors">
      <ArrowLeft className="w-3.5 h-3.5" /> {backLabel}
    </Link>
  )

  if (!day) {
    return (
      <>
        {backLink}
        <p className="text-[13px] text-text-muted">That day couldn’t be found — it may have been removed from this split.</p>
      </>
    )
  }

  const stats = dayStats(day)
  // What the day spends of the split's set cap: ab sets don't count toward it
  // (CORE_CATEGORY), so they're shown beside it instead.
  const cappedSets = stats.sets - (setCap != null ? stats.coreSets : 0)
  const isToday = isWeekly ? dayIndex === todayWeekdayIndex : dayIndex === pointerIndex
  // The day the badge above calls Today (or Up next) is the one you can start
  // from here, and the logger resolves it against your ACTIVE split — so a day
  // belonging to a split you aren't running gets no button rather than a dead
  // one. Rest days have nothing to log.
  const canStart = isToday && isActive && day.kind !== 'rest'

  return (
    <>
      {backLink}

      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        {/* Day header */}
        <div className="bg-white border border-border p-5 sm:p-6 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <label className="text-[11px] uppercase tracking-wider text-text-light">
              {day.kind === 'rest' ? 'Rest day' : 'Training day'}
            </label>
            {isWeekly && (
              <span className="text-[9px] font-medium uppercase tracking-wider text-text-muted border border-border bg-cream px-1.5 py-0.5">
                {WEEKDAY_NAMES[dayIndex]}
              </span>
            )}
            {isToday && (
              <span className="text-[9px] font-semibold uppercase tracking-wider text-cream bg-text-primary px-1.5 py-0.5">
                {isWeekly ? 'Today' : 'Up next'}
              </span>
            )}
          </div>
          <input
            value={day.name}
            onChange={(e) => update((p) => setDayName(p, day.id, e.target.value))}
            aria-label="Day name"
            className="w-full bg-cream border border-border px-3 py-2.5 text-text-primary text-[15px] font-heading font-medium outline-none focus:border-text-primary transition-colors"
          />

          {day.kind === 'rest' ? (
            <p className="text-[12px] text-text-light mt-3">
              {isWeekly ? 'A rest day — no exercises.' : 'A rest slot in the rotation — no exercises.'}
            </p>
          ) : stats.exercises === 0 ? (
            <p className="text-[12px] text-text-light mt-3">Nothing planned yet — add your first exercise below.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-3 text-[12px] text-text-muted">
                <span className="tabular-nums">
                  {stats.exercises} exercise{stats.exercises !== 1 ? 's' : ''} ·{' '}
                  <span className={setCap != null && cappedSets > setCap ? 'text-amber-600' : undefined}>
                    {cappedSets}
                    {setCap != null ? ` / ${setCap}` : ''} set{cappedSets !== 1 || setCap != null ? 's' : ''}
                  </span>
                  {setCap != null && stats.coreSets > 0 && ` + ${stats.coreSets} abs`}
                </span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted bg-cream border border-border px-1.5 py-0.5">
                  {stats.load.label}
                </span>
              </div>
              {/* The split's day cap, from the volume preference it was
                  generated with. Not enforced — editing is yours — just said. */}
              {setCap != null && cappedSets > setCap && (
                <p className="text-[11px] text-amber-600 mt-1">
                  Over this split’s {setCap}-set day — the sets past it are done tired and buy little.
                </p>
              )}
              {stats.muscles.length > 0 && (
                <div className="mt-4">
                  <p className="text-[11px] uppercase tracking-wider text-text-light mb-2.5">What this day works</p>
                  <MuscleShareBars
                    showSets
                    rows={stats.muscles
                      .filter((m) => m.pct >= 1)
                      .map((m) => ({ label: m.muscle, sets: m.sets, pct: m.pct, href: muscleHref(m.muscle) }))}
                  />
                  <p className="text-[11px] text-text-light mt-2.5">Share of this day’s planned sets, weighted by how much each movement loads the muscle.</p>
                </div>
              )}
            </>
          )}

          {/* Straight into the logger with this day already loaded. The badge
              above says this is the day that's up — without this the only way
              to act on that was to leave and find the Start button elsewhere. */}
          {canStart && (
            <Link
              to="/log"
              state={{ startPlannedDay: day.id }}
              className="inline-flex items-center gap-1.5 bg-text-primary text-cream font-medium px-4 py-2.5 mt-4 text-[13px] no-underline hover:bg-accent-hover transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              {isWeekly ? 'Start today’s session' : 'Start this session'}
            </Link>
          )}
        </div>

        {/* Exercises */}
        {day.kind !== 'rest' && (
          <DayEditor
            program={program}
            day={day}
            update={update}
            user={user}
            notes={sharedNotes ? 'shared' : 'row'}
            sessions={sharedNotes ? undefined : []}
          />
        )}
      </motion.div>
    </>
  )
}
