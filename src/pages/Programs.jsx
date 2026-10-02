import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Wand2 } from 'lucide-react'
import SplitWizard from '../components/SplitWizard'
import SplitList from '../components/SplitList'
import StartSplitChoices from '../components/StartSplitChoices'
import BuildSplitModal from '../components/BuildSplitModal'
import { useProgramsState } from '../lib/useProgramsState'
import { getHistory } from '../lib/workoutStore'
import { fetchRemoteHistory } from '../lib/workoutRemote'
import { canBuildFromHistory } from '../lib/splitFromHistory'

// Programs: the splits you have, and the ways to start another — in the top bar
// beside the log rather than inside it (the log is only sessions and injuries).
//
//   Your splits       — once there are any: the list, Set active, Duplicate, Delete
//   Build me a split  — the generator, opened right here on the page
//   I have a program  — the one Leon sent (a .txt file or its text) → /import
//   I'll make my own  — a blank split to lay out by hand → /split/new
//
// Hani hands clients a program exported from the app, so bringing one in is as
// prominent as having one built. The generator is one wizard (SplitWizard); if
// it ever becomes a paid tier, the gate belongs around it here, not inside it.
//
// `?start=build` opens the generator straight away (old /split/generate links
// land there). The dashboard's "Build my split" nudge arrives with
// `state.buildFromHistory` and opens that modal.
export default function Programs() {
  const navigate = useNavigate()
  const location = useLocation()
  const programs = useProgramsState()
  const { user, programsState, loading, addRoutine } = programs
  const hasSplits = programsState.programs.length > 0
  const [params, setParams] = useSearchParams()
  const building = params.get('start') === 'build'
  const wizardRef = useRef(null)
  const scrollOnOpen = useRef(false)

  // Finished sessions, for "build one from my recent workouts". Loaded the way
  // every other surface loads history: the account when signed in, this
  // device's copy otherwise.
  const [history, setHistory] = useState([])
  const [fromHistory, setFromHistory] = useState(false)
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (user) {
        try {
          const remote = await fetchRemoteHistory(user.id)
          if (!cancelled) return setHistory(remote)
        } catch {
          // fall through to this device's copy
        }
      }
      if (!cancelled) setHistory(getHistory())
    }
    load()
    return () => { cancelled = true }
  }, [user])
  const canBuild = canBuildFromHistory(history)

  useEffect(() => {
    if (location.state?.buildFromHistory) {
      setFromHistory(true)
      navigate(location.pathname + location.search, { replace: true, state: null })
    }
  }, [location.state, location.pathname, location.search, navigate])

  function openBuild() {
    scrollOnOpen.current = true
    if (building) wizardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    else setParams({ start: 'build' }, { replace: true })
  }

  // Tapping the card brings the generator into view; arriving on a deep link
  // leaves the page where it is, with the choice still visible above.
  useEffect(() => {
    if (building && scrollOnOpen.current) {
      scrollOnOpen.current = false
      wizardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [building])

  // A split built from the log goes straight into the editor — a starting point
  // to adjust, not a finished plan handed down.
  function createBuilt(program) {
    addRoutine(program)
    navigate(`/split/${program.id}`)
  }

  const choices = (
    <>
      <StartSplitChoices
        selected={building ? 'build' : null}
        onBuild={openBuild}
        onImport={() => navigate('/import')}
        onManual={() => navigate('/split/new')}
      />
      {canBuild && (
        <button
          onClick={() => setFromHistory(true)}
          className="inline-flex items-center gap-1.5 mt-4 text-[12px] font-medium text-text-muted hover:text-text-primary bg-transparent border-none cursor-pointer transition-colors"
        >
          <Wand2 className="w-3.5 h-3.5" /> Or build one from my recent workouts
        </button>
      )}
    </>
  )

  return (
    <div className="pt-24 pb-24 px-6">
      <div className="max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-[11px] uppercase tracking-[3px] text-text-light mb-4">Programs</p>

          {loading ? (
            <p className="text-[13px] text-text-muted">Loading…</p>
          ) : hasSplits ? (
            <>
              <h1 className="font-heading text-4xl md:text-5xl font-medium text-text-primary mb-8 tracking-tight">Your splits</h1>
              <SplitList programs={programs} />
              <h2 className="font-heading text-2xl font-medium text-text-primary mt-12 mb-6">Start a new split</h2>
              {choices}
            </>
          ) : (
            <>
              <h1 className="font-heading text-4xl md:text-5xl font-medium text-text-primary mb-4 tracking-tight">
                Your program, three ways.
              </h1>
              <p className="text-text-muted text-[15px] mb-8 leading-relaxed">
                Free, no account needed, and yours to edit afterwards.
              </p>
              {choices}
            </>
          )}

          {building && (
            <div ref={wizardRef} className="mt-12" style={{ scrollMarginTop: 'calc(5rem + env(safe-area-inset-top, 0px))' }}>
              <h2 className="font-heading text-2xl font-medium text-text-primary mb-3">Build me a split</h2>
              <p className="text-text-muted text-[14px] mb-8 leading-relaxed">
                A few questions, then the whole week: days, movements, sets and reps, picked from the{' '}
                <Link to="/exercises" className="text-text-secondary underline hover:text-text-primary">
                  exercise library
                </Link>
                .
              </p>
              <SplitWizard />
            </div>
          )}

          {/* The generator is the better answer for most people. Coaching is the
              better answer for some of them, and this is where they find it. */}
          <div className="mt-14 pt-10 border-t border-border text-center">
            <h2 className="font-heading text-2xl font-medium text-text-primary mb-3">Want a person instead?</h2>
            <p className="text-text-muted text-[14px] mb-7 leading-relaxed max-w-md mx-auto">
              A program can&apos;t watch your technique or adjust when life gets in the way. A coach can.
            </p>
            <Link
              to="/contact"
              className="inline-flex items-center justify-center gap-2 bg-text-primary text-cream font-medium px-7 py-2.5 no-underline hover:bg-accent-hover transition-colors text-[13px]"
            >
              Book a free intro chat
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </motion.div>
      </div>

      {fromHistory && (
        <BuildSplitModal sessions={history} onCreate={createBuilt} onClose={() => setFromHistory(false)} />
      )}
    </div>
  )
}
