import { useState, useEffect, useRef } from 'react'
import { Link, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useProgramsState } from '../lib/useProgramsState'
import { emptyProgram, scheduleMode, effectiveRotation } from '../lib/program'
import { getDayAnnotations } from '../lib/workoutStore'

// Shell for ONE training split. Owns the split's data and hands it to whichever
// level is showing: the overview (a card per day) at /split/:id, or one day's
// exercises at /split/:id/day/:dayId.
//
// The data lives HERE rather than in each page because useProgramsState refetches
// from the account on every mount — two independent pages would flash "Loading…"
// on every tap into a day and every tap back. Mounted once, the transitions are
// instant.
//
// (Internals still say "program"/"routine" — only the user-facing wording was
// renamed to "split".)
export default function SplitLayout() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user, programsState, loading, saveProgram, addRoutine, setActiveRoutine, deleteRoutine } = useProgramsState()
  const isNew = id === 'new'
  const creatingRef = useRef(false)

  // Landing on /split/new creates a blank split, then swaps the URL to its id.
  // Creation happens HERE (not on the list page) on purpose: /split/new and
  // /split/:id are the same route element, so the component stays mounted across
  // the swap and the just-created split is already in this hook's in-memory
  // state — no reload, no race. Doing it on the list page navigated to a fresh
  // editor that reloaded storage before the write landed and 404'd.
  useEffect(() => {
    if (isNew && !loading && !creatingRef.current) {
      creatingRef.current = true
      const program = emptyProgram()
      addRoutine(program)
      navigate(`/split/${program.id}`, { replace: true })
    }
  }, [isNew, loading, addRoutine, navigate])

  // No ScrollRestoration in this app, so moving between levels would otherwise
  // keep the offset — tapping day 5 landed you halfway down the day page.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  const program = programsState.programs.find((p) => p.id === id) || null
  const isActive = !!program && program.id === programsState.activeId

  // The one write path for every mutator in lib/program.js.
  function update(mutator) {
    if (!program) return
    saveProgram({ ...mutator(program), updatedAt: Date.now() })
  }

  // Weekly (exactly 7 days): the date decides the day, so the pointer and its
  // affordances (Up next badge, Set as today) disappear — instead the card for
  // today's weekday is highlighted.
  const isWeekly = !!program && scheduleMode(program) === 'weekly'
  const todayWeekdayIndex = (new Date().getDay() + 6) % 7 // Mon=0 … Sun=6
  // Effective (rest-days-auto-passed) position, not the raw stored pointer, so
  // the badge matches what the logger and calendar say is up. A one-time local
  // annotations snapshot is fine for a display-only badge.
  const [dayAnnotations] = useState(() => getDayAnnotations())
  const pointerIndex = program && program.days.length ? effectiveRotation(program, { annotations: dayAnnotations }).index : -1
  const highlightIndex = isWeekly ? todayWeekdayIndex : pointerIndex

  const backLink = (
    <Link to="/log/split" className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary no-underline text-[13px] mb-10 transition-colors">
      <ArrowLeft className="w-3.5 h-3.5" /> Back to your splits
    </Link>
  )

  // Still loading, or on /split/new mid-create (the effect above is swapping the
  // URL to the real split) — show a spinner rather than a false "not found".
  if (loading || isNew) {
    return (
      <div className="pt-28 pb-24 px-6">
        <div className="max-w-2xl mx-auto">
          {backLink}
          <p className="text-[13px] text-text-muted">Loading…</p>
        </div>
      </div>
    )
  }

  if (!program) {
    return (
      <div className="pt-28 pb-24 px-6">
        <div className="max-w-2xl mx-auto">
          {backLink}
          <p className="text-[13px] text-text-muted">That split couldn’t be found — it may have been deleted.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-28 pb-24 px-6">
      <div className="max-w-2xl mx-auto">
        <Outlet
          context={{
            user,
            program,
            update,
            isActive,
            setActiveRoutine,
            deleteRoutine,
            isWeekly,
            todayWeekdayIndex,
            pointerIndex,
            highlightIndex,
          }}
        />
      </div>
    </div>
  )
}
