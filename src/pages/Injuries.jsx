import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Bandage, Plus, Pencil, Trash2, Check, X, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import exercisesDb from '../data/exercises.json'
import { useInjuries } from '../lib/useInjuries'
import {
  INJURY_STATUSES, injuryTitle, areaLabel, areaBlurb, injuryDuration, isOpen,
  latestPain, daysSinceCheckin, painPoints, painTrend, implicatedExercises, TIER_LABEL,
} from '../lib/injuries'
import { setVerdict, setInjuryStatus } from '../lib/workoutStore'
import StatusChip from '../components/StatusChip'
import ProgressChart from '../components/ProgressChart'
import InjuryForm from '../components/InjuryForm'
import ConfirmModal from '../components/ConfirmModal'

const POOL = exercisesDb.exercises

// How many implicated movements to show before "see all". Enough to cover the
// things you'd actually reach for on a training day, short enough to read.
const MOVEMENT_PREVIEW = 18

function Card({ children, className = '' }) {
  return <div className={`bg-white border border-border p-5 sm:p-6 ${className}`}>{children}</div>
}

const TIER_TONE = { high: 'red', moderate: 'amber', low: 'muted' }

function statusTone(status) {
  return status === 'active' ? 'amber' : status === 'managing' ? 'muted' : 'green'
}

// ---- Pain scale --------------------------------------------------------------

function PainScale({ value, onPick }) {
  return (
    <div className="flex flex-wrap gap-1">
      {Array.from({ length: 11 }, (_, n) => (
        <button
          key={n}
          type="button"
          onClick={() => onPick(n)}
          aria-label={`Pain ${n} out of 10`}
          className={`w-8 h-8 border cursor-pointer text-[12px] tabular-nums transition-colors ${
            value === n
              ? 'border-text-primary bg-text-primary text-cream'
              : 'border-border bg-cream text-text-muted hover:border-text-primary hover:text-text-primary'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

// ---- List --------------------------------------------------------------------

function InjuryCard({ injury }) {
  const pain = latestPain(injury)
  const stale = daysSinceCheckin(injury)
  return (
    <Link
      to={`/injuries/${injury.id}`}
      className="block bg-white border border-border hover:border-border-hover p-4 no-underline transition-colors"
    >
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <Bandage className="w-4 h-4 text-text-muted shrink-0" />
        <span className="text-[14px] font-medium text-text-primary break-words">{injuryTitle(injury)}</span>
        <StatusChip tone={statusTone(injury.status)}>
          {INJURY_STATUSES.find((s) => s.id === injury.status)?.label || injury.status}
        </StatusChip>
      </div>
      <p className="text-[11px] text-text-light tabular-nums">
        {areaLabel(injury)} · day {injuryDuration(injury)}
        {pain != null ? ` · pain ${pain}/10` : ' · no pain logged yet'}
        {isOpen(injury) && stale != null && stale >= 7 && ` · last check-in ${stale} days ago`}
      </p>
    </Link>
  )
}

function InjuryList({ injuries, onNew }) {
  const open = injuries.filter(isOpen)
  const closed = injuries.filter((i) => !isOpen(i))
  const [showClosed, setShowClosed] = useState(false)

  return (
    <>
      <Card>
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Bandage className="w-4 h-4 text-text-primary" />
            <h2 className="font-heading text-lg font-medium text-text-primary">Open</h2>
          </div>
          <button
            onClick={onNew}
            className="inline-flex items-center gap-1.5 bg-text-primary text-cream font-medium px-3 py-1.5 border-none cursor-pointer text-[12px] hover:bg-accent-hover transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Track an injury
          </button>
        </div>

        {open.length ? (
          <div className="space-y-2">
            {open.map((i) => <InjuryCard key={i.id} injury={i} />)}
          </div>
        ) : (
          <p className="text-[13px] text-text-muted">
            Nothing open. When something starts hurting, tracking it here tells the split generator
            and the logger to steer around it — and gives you an honest record of whether it’s
            actually getting better.
          </p>
        )}
      </Card>

      {closed.length > 0 && (
        <Card className="mt-4">
          <button
            onClick={() => setShowClosed((v) => !v)}
            className="w-full flex items-center justify-between gap-3 bg-transparent border-none p-0 cursor-pointer text-left"
          >
            <h2 className="font-heading text-lg font-medium text-text-primary">
              Resolved <span className="text-text-light font-normal">({closed.length})</span>
            </h2>
            <span className="text-[12px] text-text-muted">{showClosed ? 'Hide' : 'Show'}</span>
          </button>
          {showClosed && (
            <div className="space-y-2 mt-4">
              {closed.map((i) => <InjuryCard key={i.id} injury={i} />)}
            </div>
          )}
        </Card>
      )}
    </>
  )
}

// ---- Detail ------------------------------------------------------------------

// The per-exercise verdicts, which are both the most useful thing on this page
// and the thing that makes the whole risk model trustworthy: the estimate is
// derived from muscle data (the exercise DB has no joint column at all), so it
// WILL be wrong about specific movements. Saying so, and letting you correct it
// in one tap, beats pretending otherwise — and a corrected movement is exactly
// the return-to-training checklist you want anyway.
function Movements({ injury, onVerdict }) {
  const [expanded, setExpanded] = useState(false)
  const rows = useMemo(() => implicatedExercises(injury, POOL), [injury])
  const judged = rows.filter((r) => r.verdict)
  const unjudged = rows.filter((r) => !r.verdict)
  const shown = expanded ? unjudged : unjudged.slice(0, MOVEMENT_PREVIEW)

  if (!rows.length) {
    return <p className="text-[13px] text-text-muted">Nothing in the exercise database loads this area hard enough to flag.</p>
  }

  const Row = ({ row }) => (
    <div className="flex items-center gap-2 py-1.5 border-b border-border last:border-b-0">
      <Link
        to={`/exercises/${row.db.id}`}
        className="flex-1 min-w-0 text-[13px] text-text-primary no-underline hover:underline break-words"
      >
        {row.db.name}
      </Link>
      {row.verdict ? (
        <StatusChip tone={row.verdict === 'hurts' ? 'red' : 'green'}>
          {row.verdict === 'hurts' ? 'Hurts' : 'Cleared'}
        </StatusChip>
      ) : (
        <StatusChip tone={TIER_TONE[row.tier]}>{TIER_LABEL[row.tier]}</StatusChip>
      )}
      <span className="flex gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onVerdict(row.db.id, row.verdict === 'hurts' ? null : 'hurts')}
          aria-label={`Mark ${row.db.name} as painful`}
          title="This hurts"
          className={`w-7 h-7 inline-flex items-center justify-center border cursor-pointer transition-colors ${
            row.verdict === 'hurts'
              ? 'border-red-300 bg-red-50 text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400'
              : 'border-border bg-cream text-text-light hover:border-text-primary hover:text-text-primary'
          }`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onVerdict(row.db.id, row.verdict === 'ok' ? null : 'ok')}
          aria-label={`Mark ${row.db.name} as fine`}
          title="This is fine"
          className={`w-7 h-7 inline-flex items-center justify-center border cursor-pointer transition-colors ${
            row.verdict === 'ok'
              ? 'border-green-300 bg-green-50 text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-400'
              : 'border-border bg-cream text-text-light hover:border-text-primary hover:text-text-primary'
          }`}
        >
          <Check className="w-3.5 h-3.5" />
        </button>
      </span>
    </div>
  )

  return (
    <>
      <p className="text-[12px] text-text-muted mb-3">
        Our estimate of what loads this area, worst first. It’s inferred from which muscles each
        movement trains, so it will get some wrong — mark them and the guess stops applying.
      </p>
      {judged.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-wider text-text-light mb-1">You’ve judged these</p>
          {judged.map((row) => <Row key={row.db.id} row={row} />)}
        </div>
      )}
      {shown.map((row) => <Row key={row.db.id} row={row} />)}
      {unjudged.length > MOVEMENT_PREVIEW && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 bg-transparent border-none p-0 text-[12px] text-text-muted hover:text-text-primary cursor-pointer underline"
        >
          {expanded ? 'Show fewer' : `Show all ${unjudged.length}`}
        </button>
      )}
    </>
  )
}

function TrendLine({ injury }) {
  const trend = painTrend(injury)
  if (!trend) return null
  const Icon = trend.direction === 'improving' ? TrendingDown : trend.direction === 'worsening' ? TrendingUp : Minus
  const tone = trend.direction === 'improving'
    ? 'text-green-700 dark:text-green-400'
    : trend.direction === 'worsening'
      ? 'text-red-600 dark:text-red-400'
      : 'text-text-muted'
  const word = trend.direction === 'improving' ? 'Improving' : trend.direction === 'worsening' ? 'Getting worse' : 'Holding steady'
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12px] ${tone}`}>
      <Icon className="w-3.5 h-3.5" /> {word}
    </span>
  )
}

function InjuryDetail({ injury, save, remove, checkin }) {
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const points = painPoints(injury)
  const pain = latestPain(injury)

  return (
    <>
      <Card>
        <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <Bandage className="w-4 h-4 text-text-primary shrink-0" />
            <h1 className="font-heading text-xl font-medium text-text-primary break-words">{injuryTitle(injury)}</h1>
            <StatusChip tone={statusTone(injury.status)}>
              {INJURY_STATUSES.find((s) => s.id === injury.status)?.label || injury.status}
            </StatusChip>
          </div>
          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => setEditing(true)}
              aria-label="Edit injury"
              className="w-8 h-8 inline-flex items-center justify-center bg-transparent border border-border hover:border-border-hover text-text-muted hover:text-text-primary cursor-pointer transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              aria-label="Delete injury"
              className="w-8 h-8 inline-flex items-center justify-center bg-transparent border border-border hover:border-red-300 text-text-light hover:text-red-600 cursor-pointer transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <p className="text-[12px] text-text-light tabular-nums mb-1">
          {areaLabel(injury)} · started {new Date(injury.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          {' · '}day {injuryDuration(injury)}
          {injury.resolvedAt && ` · resolved ${new Date(injury.resolvedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
        </p>
        <p className="text-[12px] text-text-muted">{areaBlurb(injury)}</p>
        {injury.note && <p className="text-[13px] text-text-secondary mt-3 whitespace-pre-wrap break-words">{injury.note}</p>}

        {/* Status. Resolving is what stops the penalties and closes the calendar
            band, so it's a first-class control rather than something buried in
            the edit form. */}
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-[10px] uppercase tracking-wider text-text-light mb-2">Where it’s at</p>
          <div className="flex flex-wrap gap-1.5">
            {INJURY_STATUSES.map((s) => (
              <button
                key={s.id}
                onClick={() => save(setInjuryStatus(injury, s.id))}
                aria-pressed={injury.status === s.id}
                title={s.blurb}
                className={`px-2.5 py-1 text-[11px] font-medium border cursor-pointer transition-colors ${
                  injury.status === s.id
                    ? 'bg-text-primary text-cream border-text-primary'
                    : 'bg-white text-text-muted border-border hover:border-border-hover'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-text-muted mt-2">
            {INJURY_STATUSES.find((s) => s.id === injury.status)?.blurb}
          </p>
        </div>
      </Card>

      <Card className="mt-4">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <h2 className="font-heading text-lg font-medium text-text-primary">Pain</h2>
          <TrendLine injury={injury} />
        </div>

        {points.length > 1 ? (
          <div className="overflow-x-auto -mx-1 px-1">
            <ProgressChart points={points} domain={[0, 10]} />
          </div>
        ) : (
          <p className="text-[12px] text-text-muted mb-4">
            {points.length === 1
              ? 'One rating so far — log a few more and the trend will draw itself.'
              : 'No ratings yet. Logging one every few days is what turns this into an answer about whether it’s healing.'}
          </p>
        )}

        <p className="text-[10px] uppercase tracking-wider text-text-light mt-4 mb-2">
          How is it today? {pain != null && <span className="normal-case tracking-normal text-text-muted">(last: {pain}/10)</span>}
        </p>
        <PainScale value={pain} onPick={(n) => checkin(injury, n)} />
      </Card>

      <Card className="mt-4">
        <h2 className="font-heading text-lg font-medium text-text-primary mb-1">Movements</h2>
        <Movements injury={injury} onVerdict={(exerciseId, verdict) => save(setVerdict(injury, exerciseId, verdict))} />
      </Card>

      {injury.checkins?.length > 0 && (
        <Card className="mt-4">
          <h2 className="font-heading text-lg font-medium text-text-primary mb-3">Check-ins</h2>
          <div className="space-y-1">
            {[...injury.checkins].sort((a, b) => b.date - a.date).map((c) => (
              <div key={c.id} className="flex items-baseline gap-3 py-1.5 border-b border-border last:border-b-0">
                <span className="text-[12px] text-text-light tabular-nums shrink-0 w-20">
                  {new Date(c.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
                <span className="text-[13px] font-medium text-text-primary tabular-nums shrink-0">{c.pain}/10</span>
                {c.note && <span className="text-[12px] text-text-muted break-words">{c.note}</span>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {editing && (
        <InjuryForm injury={injury} onSave={save} onClose={() => setEditing(false)} />
      )}
      {confirmDelete && (
        <ConfirmModal
          title="Delete this injury?"
          message="Its check-ins and the movements you've judged go with it. This can't be undone."
          confirmLabel="Delete"
          onConfirm={async () => { await remove(injury.id); navigate('/injuries') }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </>
  )
}

// ---- Page --------------------------------------------------------------------

export default function Injuries() {
  const { id } = useParams()
  const location = useLocation()
  const { injuries, loading, save, remove, checkin } = useInjuries()
  // The logger sends people here with the form already open when they pick
  // "something new" while ending a session — they've just told us they're hurt,
  // so making them find the button again would be asking twice.
  const [creating, setCreating] = useState(!!location.state?.newInjury)

  const injury = id ? injuries.find((i) => i.id === id) : null

  return (
    <div className="min-h-screen bg-cream pt-24 pb-16">
      <div className="max-w-3xl mx-auto px-6">
        <Link
          to={id ? '/injuries' : '/calendar'}
          className="inline-flex items-center gap-1.5 text-[13px] text-text-muted hover:text-text-primary no-underline mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> {id ? 'All injuries' : 'Calendar'}
        </Link>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          {loading ? (
            <Card><p className="text-[13px] text-text-muted">Loading…</p></Card>
          ) : id && !injury ? (
            <Card>
              <p className="text-[13px] text-text-muted">
                That injury isn’t here any more. <Link to="/injuries" className="text-text-primary">Back to the list</Link>.
              </p>
            </Card>
          ) : injury ? (
            <InjuryDetail injury={injury} save={save} remove={remove} checkin={checkin} />
          ) : (
            <InjuryList injuries={injuries} onNew={() => setCreating(true)} />
          )}
        </motion.div>
      </div>

      {creating && <InjuryForm onSave={save} onClose={() => setCreating(false)} />}
    </div>
  )
}
