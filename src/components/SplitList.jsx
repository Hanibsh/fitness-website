import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Trash2, Copy, Users, CalendarRange } from 'lucide-react'
import ConfirmModal from './ConfirmModal'
import { SortableList, SortableItem, DragHandle } from './Sortable'
import { useCoachAccess } from '../lib/useClientsState'
import { isLockedProgram } from '../lib/coachSync'
import { scheduleMode } from '../lib/program'

// Your saved splits: drag to reorder (the ⋮⋮ grip), with Set active / Duplicate / Delete, and a
// tap-through to the full-page editor at /split/:id. Lives on the Programs page
// (it used to be its own tab in the log): Programs is where a split is started,
// brought in or built, so it's also where the ones you have live.
//
// `programs` is the page's useProgramsState() — passed in rather than called
// here, because each call holds its own copy of the list and the page needs to
// see a delete as soon as this card does.
export default function SplitList({ programs }) {
  const navigate = useNavigate()
  const { user, programsState, duplicateRoutine, setActiveRoutine, moveRoutineTo, deleteRoutine } = programs
  const [confirmDelete, setConfirmDelete] = useState(null) // { id, name } | null
  const { isCoach } = useCoachAccess()

  function handleDuplicate(program) {
    const copy = duplicateRoutine(program)
    navigate(`/split/${copy.id}`)
  }

  // "Fixed week · 4 training days" / "5-day rotation · 3 training days" —
  // scheduleMode in lib/program.js decides which.
  function shapeLabel(p) {
    if (!p.days.length) return 'Empty — add days'
    const train = p.days.filter((d) => d.kind !== 'rest').length
    const days = `${train} training day${train !== 1 ? 's' : ''}`
    return scheduleMode(p) === 'weekly' ? `Fixed week · ${days}` : `${p.days.length}-day rotation · ${days}`
  }

  return (
    <>
      <div className="bg-white border border-border p-5 sm:p-6">
        <p className="text-[11px] uppercase tracking-wider text-text-light mb-1">Your splits</p>
        <p className="text-[12px] text-text-muted mb-4 leading-relaxed">
          The active one is what your log follows — it surfaces today’s session and pre-fills what you planned.
        </p>
        <SortableList ids={programsState.programs.map((p) => p.id)} onMove={moveRoutineTo}>
        <div className="space-y-2">
          {programsState.programs.map((p) => {
            const isActive = p.id === programsState.activeId
            return (
              <SortableItem
                key={p.id}
                id={p.id}
                className="flex items-center justify-between gap-2 px-3 py-2.5 bg-white border border-border hover:border-border-hover cursor-pointer transition-colors"
                onClick={() => navigate(`/split/${p.id}`)}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-text-primary break-words">{p.name}</span>
                    {isActive && (
                      <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wider text-cream bg-text-primary px-1.5 py-0.5">Active</span>
                    )}
                    {/* Sent by your coach, who keeps it up to date (lib/coachSync.js). */}
                    {isLockedProgram(p) && (
                      <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wider text-text-muted border border-border px-1.5 py-0.5">From Leon</span>
                    )}
                  </div>
                  <p className="text-[11px] text-text-light mt-0.5 truncate">{shapeLabel(p)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <DragHandle label={`Reorder ${p.name}`} small />
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
                  {/* Your coach's split comes back on the next load if deleted —
                      it goes when they stop sending it or you unlink. */}
                  {!isLockedProgram(p) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete({ id: p.id, name: p.name }) }}
                      aria-label={`Delete ${p.name}`}
                      title="Delete"
                      className="text-text-light hover:text-red-600 bg-transparent border-none cursor-pointer p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </SortableItem>
            )
          })}
        </div>
        </SortableList>
        <div className="flex items-center justify-between gap-x-4 gap-y-2 flex-wrap mt-4">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-text-light">
            <CalendarRange className="w-3.5 h-3.5" /> Saved automatically{user ? ' to your account' : ' on this device'}.
          </span>
          {/* Programs for other people live apart from yours — the coach's own
              account only (profiles.is_coach). */}
          {isCoach && (
            <Link to="/coach" className="inline-flex items-center gap-1.5 text-[12px] font-medium text-text-secondary hover:text-text-primary no-underline transition-colors">
              <Users className="w-3.5 h-3.5" /> Programs for your clients
            </Link>
          )}
        </div>
      </div>

      {confirmDelete && (
        <ConfirmModal
          title={`Delete "${confirmDelete.name}"?`}
          message="This removes all its days and exercises. This can't be undone."
          onConfirm={() => deleteRoutine(confirmDelete.id)}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </>
  )
}
