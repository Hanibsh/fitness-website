import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck, Gauge, Medal, Zap, Timer, HeartPulse, Bandage, Utensils, Clock, Hourglass } from 'lucide-react'
import Card from './Card'
import SectionHeading from './SectionHeading'
import MiniStat from './MiniStat'
import StatusChip from './StatusChip'
import { planAdherence, liftProgress, strengthLevels, effortSummary, restSummary, cardioThisWeek, trainingTime } from '../lib/dashboardInsights'
import { reasonLabel } from '../lib/dayLog'
import { openInjuries, injuryTitle, injuryDuration, INJURY_STATUSES } from '../lib/injuries'
import { weeklyCardio } from '../lib/cardioPlan'
import { scheduleMode } from '../lib/program'
import { convertWeight, formatRest } from '../lib/workoutStats'
import { formatDuration } from '../lib/dashboard'
import { usePrefill, weeklyTrainingHours, tdeeFromPrefill } from '../lib/profilePrefill'
import { calorieTargets, GOAL_DEFAULT_TARGET, DEFAULT_TARGET } from '../lib/calorieTargets'
import { proteinRange, macroSplit } from '../lib/macros'
import { SPLIT_REFRESH_WEEKS } from '../lib/generatorConfig'

// The dashboard's optional cards — all switched off until someone turns them on
// in their profile (lib/dashboardLayout.js). The numbers come from
// lib/dashboardInsights.js; these only lay them out. Copy stays short on
// purpose: a card says what it shows and, when it can't, what would fill it.

const fmt = (n) => (n == null ? '—' : Math.round(n).toLocaleString('en-US'))
const empty = (text, link) => (
  <p className="text-[13px] text-text-muted">
    {text}
    {link && (
      <>
        {' '}
        <Link to={link.to} className="text-text-secondary underline hover:text-text-primary">
          {link.label}
        </Link>
      </>
    )}
  </p>
)

// ---- Plan adherence -------------------------------------------------------------
export function AdherenceCard({ sessions, annotations, program, now }) {
  const a = useMemo(() => planAdherence(sessions, annotations, program, now), [sessions, annotations, program, now])
  const stat = (label, s) => (
    <MiniStat
      label={label}
      value={s.pct == null ? '—' : `${s.pct}%`}
      sub={s.planned ? `${s.trained} of ${s.planned} sessions` : 'none planned yet'}
    />
  )
  const reasons = a ? Object.entries(a.month.byReason) : []
  return (
    <Card>
      <SectionHeading icon={CalendarCheck}>Plan adherence</SectionHeading>
      {!a ? (
        empty('Set an active split to see this.', { to: '/programs', label: 'Programs' })
      ) : a.month.planned === 0 ? (
        empty('Shows after your split’s first training day.')
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            {stat('This week', a.week)}
            {stat('Last 4 weeks', a.month)}
          </div>
          {(a.month.missed > 0 || a.month.extra > 0 || reasons.length > 0) && (
            <p className="text-[12px] text-text-muted mt-3">
              Last 4 weeks:{' '}
              {[
                a.month.missed > 0 ? `${a.month.missed} missed` : null,
                a.month.extra > 0 ? `${a.month.extra} extra` : null,
                ...reasons.map(([r, n]) => `${n} ${reasonLabel(r).toLowerCase()}`),
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </>
      )}
    </Card>
  )
}

// ---- Stalled lifts ------------------------------------------------------------------
function ProgressRow({ row, unit, tone, chip }) {
  const value = (n) => (row.metric === 'reps' ? `${n} reps` : `${fmt(n)} ${unit}`)
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-text-primary break-words">{row.name}</p>
        <p className="text-[11px] text-text-muted">
          {value(row.from)} → {value(row.to)}
          {row.metric === 'e1rm' ? ' · est. 1RM' : ''}
        </p>
      </div>
      <StatusChip tone={tone}>
        {chip} {row.pct > 0 ? '+' : ''}
        {row.pct}%
      </StatusChip>
    </div>
  )
}

export function StalledLiftsCard({ sessions, unit, now }) {
  const p = useMemo(() => liftProgress(sessions, unit, now), [sessions, unit, now])
  const stuck = [...p.down, ...p.flat]
  const total = stuck.length + p.up.length
  return (
    <Card>
      <SectionHeading icon={Gauge}>Stalled lifts</SectionHeading>
      {total === 0 ? (
        empty('Shows once a lift is logged in the last 2 weeks and the 4 before.')
      ) : (
        <>
          <p className="text-[12px] text-text-muted mb-2 -mt-2">Last 2 weeks vs the 4 before.</p>
          <div className="divide-y divide-border">
            {p.down.map((r) => <ProgressRow key={r.name} row={r} unit={unit} tone="red" chip="Down" />)}
            {p.flat.map((r) => <ProgressRow key={r.name} row={r} unit={unit} tone="amber" chip="Stalled" />)}
            {p.up.map((r) => <ProgressRow key={r.name} row={r} unit={unit} tone="green" chip="Up" />)}
          </div>
        </>
      )}
    </Card>
  )
}

// ---- Strength level ---------------------------------------------------------------
export function StrengthLevelCard({ sessions, sex, bodyweightKg, unit, now, signedIn }) {
  const rows = useMemo(() => strengthLevels(sessions, { sex, bodyweightKg, now }), [sessions, sex, bodyweightKg, now])
  const toUnit = (kg) => fmt(convertWeight(kg, 'kg', unit))
  return (
    <Card>
      <SectionHeading icon={Medal}>Strength level</SectionHeading>
      {!rows ? (
        signedIn
          ? empty('Add your sex and bodyweight to your profile to see this.', { to: '/account', label: 'Profile' })
          : empty('Log in and add your sex and bodyweight to see this.')
      ) : rows.length === 0 ? (
        empty('Log a standard lift in the last 12 weeks — bench press, squat, deadlift and more.', {
          to: '/tools/strength-standards',
          label: 'See the list',
        })
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.key}>
              <div className="flex items-center justify-between gap-3 mb-1">
                <p className="text-[13px] font-medium text-text-primary break-words min-w-0">{r.name}</p>
                <StatusChip tone="dark">{r.tier}</StatusChip>
              </div>
              <div className="flex gap-0.5">
                {Array.from({ length: r.count }, (_, i) => (
                  <span key={i} className={`h-1.5 flex-1 ${i <= r.index ? 'bg-text-primary' : 'bg-border'}`} />
                ))}
              </div>
              <p className="text-[11px] text-text-muted mt-1">
                {toUnit(r.e1rmKg)} {unit} est. 1RM · {r.ratio}× bodyweight
                {r.next ? ` · ${r.next.label} at ${toUnit(r.next.kg)} ${unit}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// ---- Effort ----------------------------------------------------------------------------
export function EffortCard({ sessions, now }) {
  const e = useMemo(() => effortSummary(sessions, now), [sessions, now])
  return (
    <Card>
      <SectionHeading icon={Zap}>Effort</SectionHeading>
      {e.sets === 0 ? (
        empty('Log RIR on your sets to see this.')
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <MiniStat label="Avg RIR" value={e.avg} sub={e.prevAvg != null ? `was ${e.prevAvg}` : null} />
            <MiniStat label="To failure" value={`${e.failure}%`} sub="0 RIR" />
            <MiniStat label="Hard sets" value={`${e.hard}%`} sub="1–3 RIR" />
            <MiniStat label="Easy sets" value={`${e.easy}%`} sub="4+ RIR" />
          </div>
          <p className="text-[12px] text-text-muted mt-3">Last 4 weeks, {e.sets} sets. Most should sit at 1–3 RIR.</p>
        </>
      )}
    </Card>
  )
}

// ---- Rest times ----------------------------------------------------------------------
const REST_CHIP = { short: ['amber', 'Short'], ok: ['green', 'In range'], long: ['muted', 'Long'] }
const restRange = (lo, hi) => {
  const m = (s) => String(Math.round((s / 60) * 10) / 10)
  return lo === hi ? `${m(lo)} min` : `${m(lo)}–${m(hi)} min`
}

export function RestTimesCard({ sessions, now }) {
  const r = useMemo(() => restSummary(sessions, now), [sessions, now])
  return (
    <Card>
      <SectionHeading icon={Timer} right={r.avgSec != null && <span className="text-[12px] text-text-muted">Avg {formatRest(r.avgSec)}</span>}>
        Rest times
      </SectionHeading>
      {r.rests === 0 ? (
        empty('Tick off sets as you go to measure your rest.')
      ) : (
        <div className="divide-y divide-border">
          {r.rows.map((row) => (
            <div key={row.name} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-text-primary break-words">{row.name}</p>
                <p className="text-[11px] text-text-muted">
                  You: {formatRest(row.sec)}
                  {row.lo != null ? ` · recommended ${restRange(row.lo, row.hi)}` : ''}
                </p>
              </div>
              {row.status && <StatusChip tone={REST_CHIP[row.status][0]}>{REST_CHIP[row.status][1]}</StatusChip>}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// ---- Cardio ------------------------------------------------------------------------------
export function CardioCard({ sessions, program, unit, weightKg, now }) {
  const done = useMemo(() => cardioThisWeek(sessions, unit, now), [sessions, unit, now])
  // A plan only reads as "this week" on a fixed week; a rotation's cycle isn't 7 days.
  const plan = useMemo(
    () => (program && scheduleMode(program) === 'weekly' ? weeklyCardio(program, weightKg).total : null),
    [program, weightKg]
  )
  const planned = plan && plan.sessions > 0 ? plan : null
  return (
    <Card>
      <SectionHeading icon={HeartPulse}>Cardio this week</SectionHeading>
      <div className="grid grid-cols-3 gap-2.5">
        <MiniStat label="Sessions" value={done.days} sub={planned ? `of ${planned.sessions} planned` : null} />
        <MiniStat label="Minutes" value={fmt(done.minutes)} sub={planned?.minutes ? `of ${fmt(planned.minutes)} planned` : null} />
        <MiniStat label="Distance" value={done.distance ? `${done.distance} ${done.distanceUnit}` : '—'} />
      </div>
    </Card>
  )
}

// ---- Injuries ----------------------------------------------------------------------------
export function InjuriesCard({ injuries, now }) {
  const open = useMemo(() => openInjuries(injuries), [injuries])
  return (
    <Card>
      <SectionHeading icon={Bandage}>Injuries</SectionHeading>
      {open.length === 0 ? (
        empty('No open injuries.', { to: '/injuries', label: 'Injuries' })
      ) : (
        <div className="divide-y divide-border">
          {open.map((i) => {
            const checks = [...(i.checkins || [])].sort((a, b) => a.date - b.date).slice(-8)
            const first = checks[0]?.pain
            const last = checks[checks.length - 1]?.pain
            const status = INJURY_STATUSES.find((s) => s.id === i.status)?.label
            return (
              <Link key={i.id} to={`/injuries/${i.id}`} className="flex items-center justify-between gap-3 py-2.5 no-underline group">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-text-primary break-words group-hover:underline">{injuryTitle(i)}</p>
                  <p className="text-[11px] text-text-muted">
                    {[status, `day ${injuryDuration(i, now)}`, last != null ? `pain ${checks.length > 1 ? `${first} → ` : ''}${last}/10` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                {checks.length > 1 && (
                  <div className="flex items-end gap-0.5 h-6 shrink-0" aria-hidden="true">
                    {checks.map((c) => (
                      <span key={c.id || c.date} className="w-1.5 bg-text-primary" style={{ height: `${Math.max(8, c.pain * 10)}%` }} />
                    ))}
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// ---- Daily targets --------------------------------------------------------------------
// The TDEE calculator's own numbers, worked out from the profile — only when
// every input it needs is really known, same rule as the calculators' prefill.
export function DailyTargetsCard({ sessions, now }) {
  const p = usePrefill()
  const hours = useMemo(() => weeklyTrainingHours(sessions, now), [sessions, now])
  const result = useMemo(() => {
    if (!p.ready) return null
    const tdee = tdeeFromPrefill(p, hours)
    if (tdee == null) return null
    const metric = p.unitSystem !== 'imperial'
    const weightKg = metric ? p.weight : convertWeight(p.weight, 'lbs', 'kg')
    const target = calorieTargets({ tdee, weightKg, sex: p.sex })[GOAL_DEFAULT_TARGET[p.goal] ?? DEFAULT_TARGET]
    const protein = proteinRange({ lbmKg: weightKg * (1 - p.bodyFat / 100), bodyFat: p.bodyFat, trainingHours: hours, age: p.age, vegan: !!p.vegan })
    const split = macroSplit({ kcal: target.kcal, posture: target.posture, weightKg, sex: p.sex, protein })
    return { tdee, target, protein: Math.round(split.protein.target) }
  }, [p, hours])

  const missing = p.ready
    ? [
        !p.sex && 'sex',
        p.age == null && 'birth year',
        p.weight == null && 'bodyweight',
        p.height == null && 'height',
        p.bodyFat == null && 'body fat',
        p.steps == null && 'daily steps',
      ].filter(Boolean)
    : []

  return (
    <Card>
      <SectionHeading icon={Utensils}>Daily targets</SectionHeading>
      {!p.ready ? (
        empty('Log in and fill in your profile to see this.')
      ) : missing.length > 0 ? (
        empty(`Add your ${missing.join(', ')} to your profile to see this.`, { to: '/account', label: 'Profile' })
      ) : hours == null ? (
        empty('Shows after 2 weeks of logged workouts.')
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2.5">
            <MiniStat label="Calories" value={fmt(result.target.kcal)} sub={result.target.name} />
            <MiniStat label="Protein" value={`${result.protein} g`} sub="a day" />
            <MiniStat label="Burn" value={fmt(result.tdee)} sub="cal a day" />
          </div>
          <p className="text-[12px] text-text-muted mt-3">
            {result.target.floored ? 'Held at the calorie floor — walk more for the rest. ' : ''}
            <Link to="/tools/tdee" className="text-text-secondary underline hover:text-text-primary">
              Full breakdown
            </Link>
          </p>
        </>
      )}
    </Card>
  )
}

// ---- Training time ---------------------------------------------------------------------
export function TrainingTimeCard({ sessions, now }) {
  const t = useMemo(() => trainingTime(sessions, now), [sessions, now])
  const max = Math.max(1, ...t.weeks.map((w) => w.hours))
  return (
    <Card>
      <SectionHeading icon={Clock}>Training time</SectionHeading>
      {t.avgSessionMs == null && t.hoursPerWeek == null ? (
        empty('Shows once your logged sessions have times.')
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            <MiniStat label="Hours a week" value={t.hoursPerWeek ?? '—'} sub="last 4 weeks" />
            <MiniStat
              label="Avg session"
              value={formatDuration(t.avgSessionMs) || '—'}
              sub={t.prevAvgSessionMs ? `was ${formatDuration(t.prevAvgSessionMs)}` : null}
            />
          </div>
          <p className="text-[10px] uppercase tracking-wider text-text-light mb-2">Last 8 weeks</p>
          <div className="flex items-end gap-1.5 h-16">
            {t.weeks.map((w) => (
              <div key={w.start} className="flex-1 h-full flex flex-col justify-end" title={`${w.hours} h`}>
                <span className="block bg-text-primary" style={{ height: `${(100 * w.hours) / max}%`, minHeight: w.hours > 0 ? 2 : 0 }} />
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  )
}

// ---- Split progress --------------------------------------------------------------------
// A generated split is built to run SPLIT_REFRESH_WEEKS; one made by hand has
// no shelf life, so it only counts the weeks.
export function SplitProgressCard({ program, now }) {
  const created = program?.createdAt
  const known = Number.isFinite(created)
  const week = known ? Math.floor((now - created) / (7 * 86400000)) + 1 : null
  const shelf = program?.settings ? SPLIT_REFRESH_WEEKS : null
  return (
    <Card>
      <SectionHeading icon={Hourglass}>Split progress</SectionHeading>
      {!program ? (
        empty('No active split.', { to: '/programs', label: 'Programs' })
      ) : !known ? (
        empty(`${program.name || 'Your split'} — start date unknown.`)
      ) : (
        <>
          <p className="text-[13px] text-text-primary font-medium break-words">{program.name || 'Your split'}</p>
          <p className="text-[12px] text-text-muted mb-3">
            Week {week}
            {shelf ? (week > shelf ? ` · built for ${shelf} weeks` : ` of ${shelf}`) : ''}
          </p>
          {shelf && (
            <div className="w-full h-2 bg-cream border border-border overflow-hidden mb-3">
              <div className="h-full bg-text-primary" style={{ width: `${Math.min(100, (100 * week) / shelf)}%` }} />
            </div>
          )}
          {shelf && week > shelf && (
            <p className="text-[12px] text-text-muted">
              Time for a new emphasis.{' '}
              <Link to="/programs?start=build" className="text-text-secondary underline hover:text-text-primary">
                Build a new split
              </Link>
            </p>
          )}
        </>
      )}
    </Card>
  )
}
