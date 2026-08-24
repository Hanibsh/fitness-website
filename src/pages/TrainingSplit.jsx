import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import { Plus, ChevronUp, ChevronDown, Trash2, CalendarRange, Copy, Wand2, Sparkles } from 'lucide-react'
import { useProgramsState } from '../lib/useProgramsState'
import { getHistory } from '../lib/workoutStore'
import { fetchRemoteHistory } from '../lib/workoutRemote'
import { canBuildFromHistory } from '../lib/splitFromHistory'
import ConfirmModal from '../components/ConfirmModal'
import BuildSplitModal from '../components/BuildSplitModal'
import LogTabs from '../components/LogTabs'

// The training-split list: every saved split, reorderable, with Set active /
// Duplicate / Delete, and a tap-through to the full-page editor. Creating or
// editing a split is a separate page (/split/new or /split/:id) so this page
// stays a clean, scannable list. Lives as the second tab of the log.
export default function TrainingSplit() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, programsState, loading, addRoutine, duplicateRoutine, setActiveRoutine, moveRoutine, deleteRoutine } = useProgramsState()
  const [confirmDelete, setConfirmDelete] = useState(null) // { id, name } | null
  // Finished sessions, for the "build one from what I've logged" offer. Loaded
  // the same way every other surface loads history: remote when signed in,
  // falling back to this device's copy.
  const [history, setHistory] = useState([])
  const [building, setBuilding] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (user) {
        try {
          const remote = await fetchRemoteHistory(user.id)
          if (!cancelled) return setHistory(remote)
        } catch {
          // fall through to local
        }
      }
      if (!cancelled) setHistory(getHistory())
    }
    load()
    return () => { cancelled = true }
  }, [user])

  // The dashboard's nudge links here with this flag rather than creating
  // anything itself — one place owns creating a split, so the preview and the
  // write can't drift apart.
  useEffect(() => {
    if (location.state?.buildFromHistory) {
      setBuilding(true)
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.state, location.pathname, navigate])

  const canBuild = canBuildFromHistory(history)

  // Create the proposed split, make it the one the log follows, and drop the
  // user straight into the editor — it's a starting point to adjust, not a
  // finished plan handed down.
  function createBuilt(program) {
    addRoutine(program)
    navigate(`/split/${program.id}`)
  }

  function openEditor(program) {
    navigate(`/split/${program.id}`)
  }

  // Three ways in, in order of how much they do for you: generate one from the
  // exercise database, read one out of what you've already logged, or start
  // blank. "New split" opens the editor at /split/new, which creates the blank
  // split there (so the just-created split is in the editor's own state —
  // creating here and navigating raced a fresh editor against unsaved storage).
  function createSplit() {
    navigate('/split/new')
  }

  function handleDuplicate(program) {
    const copy = duplicateRoutine(program)
    navigate(`/split/${copy.id}`)
  }

  // "Fixed week · 4 training days" / "5-day rotation · 3 training days" — the
  // same 7-days-means-weekly rule as scheduleMode in lib/program.js.
  function shapeLabel(p) {
    if (!p.days.length) return 'Empty — add days'
    const train = p.days.filter((d) => d.kind !== 'rest').length
    const days = `${train} training day${train !== 1 ? 's' : ''}`
    return p.days.length === 7 ? `Fixed week · ${days}` : `${p.days.length}-day rotation · ${days}`
  }

  return (
    <div className="pt-28 pb-24 px-6">
      <div className="max-w-2xl mx-auto">
        <LogTabs active="/log/split" />

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-heading text-4xl font-medium text-text-primary mb-3">Training split</h1>
          <p className="text-text-muted text-[15px] mb-10">
            The split your log follows — days, exercises and rep targets, as a fixed week or a rotating cycle. The log surfaces today’s session and pre-fills what you planned.
          </p>

          {loading ? (
            <p className="text-[13px] text-text-muted">Loading…</p>
          ) : programsState.programs.length === 0 ? (
            <div className="bg-white border border-border p-7 text-center">
              <h2 className="font-heading text-xl font-medium text-text-primary mb-1">Start a split</h2>
              <p className="text-[13px] text-text-muted mb-6">
                Answer a few questions and we&apos;ll build one around your week — or lay it out yourself.
              </p>
              <button
                onClick={() => navigate('/split/generate')}
                className="inline-flex items-center gap-2 bg-text-primary text-cream font-medium px-6 py-3 border-none cursor-pointer text-[14px] hover:bg-accent-hover transition-colors"
              >
                <Sparkles className="w-4 h-4" /> Generate a split for me
              </button>
              <div className="mt-4 flex items-center justify-center gap-x-4 gap-y-2 flex-wrap">
                <button
                  onClick={createSplit}
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium text-text-muted hover:text-text-primary bg-transparent border-none cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Start one from scratch
                </button>
                {canBuild && (
                  <button
                    onClick={() => setBuilding(true)}
                    className="inline-flex items-center gap-1.5 text-[12px] font-medium text-text-muted hover:text-text-primary bg-transparent border-none cursor-pointer transition-colors"
                  >
                    <Wand2 className="w-3.5 h-3.5" /> Build one from my recent workouts
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="bg-white border border-border p-5 sm:p-6 mb-6">
                <p className="text-[11px] uppercase tracking-wider text-text-light mb-3">Your splits</p>
                <div className="space-y-2">
                  {programsState.programs.map((p, index) => {
                    const isActive = p.id === programsState.activeId
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-2 px-3 py-2.5 border border-border hover:border-border-hover cursor-pointer transition-colors"
                        onClick={() => openEditor(p)}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium text-text-primary break-words">{p.name}</span>
                            {isActive && (
                              <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wider text-cream bg-text-primary px-1.5 py-0.5">Active</span>
                            )}
                          </div>
                          <p className="text-[11px] text-text-light mt-0.5 truncate">{shapeLabel(p)}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <div className="flex flex-col mr-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); moveRoutine(index, -1) }}
                              disabled={index === 0}
                              aria-label={`Move ${p.name} up`}
                              className="text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer p-0 leading-none disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); moveRoutine(index, 1) }}
                              disabled={index === programsState.programs.length - 1}
                              aria-label={`Move ${p.name} down`}
                              className="text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer p-0 leading-none disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {!isActive && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setActiveRoutine(p.id) }}
                              className="text-[11px] font-medium text-text-muted hover:text-text-primary bg-white border border-border hover:border-border-hover px-2 py-1 cursor-pointer transition-colors"
                            >
                              Set active
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDuplicate(p) }}
                            aria-label={`Duplicate ${p.name}`}
                            title="Duplicate"
                            className="text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer p-1"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmDelete({ id: p.id, name: p.name }) }}
                            aria-label={`Delete ${p.name}`}
                            title="Delete"
                            className="text-text-light hover:text-red-600 bg-transparent border-none cursor-pointer p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex items-center gap-x-4 gap-y-2 flex-wrap mt-3">
                  <button
                    onClick={() => navigate('/split/generate')}
                    className="inline-flex items-center gap-1.5 text-[12px] font-medium text-text-muted hover:text-text-primary bg-transparent border-none cursor-pointer transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Generate a split
                  </button>
                  <button
                    onClick={createSplit}
                    className="inline-flex items-center gap-1.5 text-[12px] font-medium text-text-muted hover:text-text-primary bg-transparent border-none cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> New split
                  </button>
                  {canBuild && (
                    <button
                      onClick={() => setBuilding(true)}
                      className="inline-flex items-center gap-1.5 text-[12px] font-medium text-text-muted hover:text-text-primary bg-transparent border-none cursor-pointer transition-colors"
                    >
                      <Wand2 className="w-3.5 h-3.5" /> Build from my workouts
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-10 flex items-center gap-2 text-[12px] text-text-light">
                <CalendarRange className="w-4 h-4" />
                <span>Your splits are saved automatically{user ? ' to your account' : ' on this device'}.</span>
              </div>
            </>
          )}
        </motion.div>
      </div>

      {building && (
        <BuildSplitModal sessions={history} onCreate={createBuilt} onClose={() => setBuilding(false)} />
      )}

      {confirmDelete && (
        <ConfirmModal
          title={`Delete "${confirmDelete.name}"?`}
          message="This removes all its days and exercises. This can't be undone."
          onConfirm={() => deleteRoutine(confirmDelete.id)}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
