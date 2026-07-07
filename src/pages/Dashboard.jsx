import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Flame, Dumbbell, TrendingUp, Clock, Trophy, Target, Activity, History,
  ChevronRight, Award, CalendarDays, Plus, Pencil, MessageCircle, ArrowRight,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { getHistory, getUnit, getGoals, saveGoals } from '../lib/workoutStore'
import { fetchRemoteHistory } from '../lib/workoutRemote'
import { saveProfile } from '../lib/profile'
import { loggedExerciseNames } from '../lib/workoutStats'
import {
  heroSummary, monthStats, lifetimeStats, weeklyMuscleSets, personalRecords, recentPRs,
  splitDistribution, muscleDistribution, recentActivity, thisDayInHistory, formatDuration,
  exerciseBests,
} from '../lib/dashboard'
import WorkoutCalendar from '../components/WorkoutCalendar'
import ExerciseProgress from '../components/ExerciseProgress'
import BodyweightTracker from '../components/BodyweightTracker'
import GoalsModal from '../components/GoalsModal'
import NicknameModal from '../components/NicknameModal'

function greeting(d = new Date()) {
  const h = d.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function fmtNum(n) {
  return (n || 0).toLocaleString()
}

function relativeDay(ts) {
  const day = new Date(ts); day.setHours(0, 0, 0, 0)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.round((today - day) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return `${diff} days ago`
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function fullDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

// ---- Small presentational pieces ------------------------------------------
function Card({ children, className = '' }) {
  return <div className={`bg-white border border-border p-5 sm:p-6 ${className}`}>{children}</div>
}

function SectionHeading({ children, icon: Icon }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {Icon && <Icon className="w-4 h-4 text-text-primary" />}
      <h2 className="font-heading text-lg font-medium text-text-primary">{children}</h2>
    </div>
  )
}

function StatTile({ icon: Icon, label, value, sub }) {
  return (
    <div className="bg-white border border-border p-4 sm:p-5">
      <div className="flex items-center gap-1.5 mb-2 text-text-light">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <p className="font-heading text-2xl font-medium text-text-primary leading-none break-words">{value}</p>
      {sub && <p className="text-[11px] text-text-muted mt-1.5">{sub}</p>}
    </div>
  )
}

function MiniStat({ label, value }) {
  return (
    <div className="bg-cream border border-border px-3 py-3 text-center">
      <p className="text-[10px] uppercase tracking-wider text-text-light mb-1">{label}</p>
      <p className="text-[15px] font-medium text-text-primary break-words">{value}</p>
    </div>
  )
}

// Horizontal bar row used for muscle volume and distribution.
function Bar({ label, value, max, suffix }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div>
      <div className="flex justify-between text-[12px] mb-1">
        <span className="text-text-secondary">{label}</span>
        <span className="text-text-muted">{value}{suffix}</span>
      </div>
      <div className="w-full h-2 bg-cream border border-border overflow-hidden">
        <div className="h-full bg-text-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function ProgressGoal({ label, value, target, unit = '' }) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-[13px] text-text-secondary">{label}</span>
        <span className="text-[13px] font-medium text-text-primary">{value} / {target}{unit ? ` ${unit}` : ''}</span>
      </div>
      <div className="w-full h-2.5 bg-cream border border-border overflow-hidden">
        <div className="h-full bg-text-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// Compact 1:1 coaching banner shown at the top of the dashboard — the first
// thing a logged-in user sees, since coaching is the point of the brand.
function CoachingBanner() {
  return (
    <Link to="/contact" className="block group no-underline">
      <div className="bg-white border border-border p-4 sm:p-5 flex items-center gap-4 hover:border-border-hover transition-colors">
        <div className="w-10 h-10 shrink-0 rounded-full bg-text-primary flex items-center justify-center">
          <MessageCircle className="w-4 h-4 text-cream" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-text-light mb-0.5">1:1 online coaching</p>
          <p className="text-[14px] font-medium text-text-primary">Train with Leon — a plan built around your life.</p>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 bg-text-primary text-cream text-[13px] font-medium px-4 py-2 shrink-0 group-hover:bg-accent-hover transition-colors">
          Book a free intro chat <ArrowRight className="w-3.5 h-3.5" />
        </span>
        <ArrowRight className="w-4 h-4 text-text-light shrink-0 sm:hidden group-hover:text-text-primary transition-colors" />
      </div>
    </Link>
  )
}

// Fuller coaching call-to-action shown below the dashboard stats.
function CoachingCTA() {
  return (
    <div className="bg-text-primary text-cream p-6 sm:p-8 text-center">
      <MessageCircle className="w-5 h-5 text-cream/80 mx-auto mb-4" />
      <h2 className="font-heading text-2xl sm:text-3xl font-medium mb-3">Ready to take it further?</h2>
      <p className="text-[14px] text-cream/70 max-w-md mx-auto mb-6 leading-relaxed">
        A dashboard tracks your progress — a coach in your corner accelerates it. I build the plan,
        fix your form, and adjust it around your life so you actually stick to it.
      </p>
      <Link
        to="/contact"
        className="inline-flex items-center gap-2 bg-cream text-text-primary font-medium px-6 py-3 no-underline cursor-pointer text-[14px] hover:bg-white transition-colors"
      >
        Book a free intro chat <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  )
}

export default function Dashboard() {
  // Nickname lives in the auth context so the navbar reflects edits instantly.
  const { user, nickname, setNickname } = useAuth()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [unit, setUnit] = useState(() => getUnit())
  const [selectedDay, setSelectedDay] = useState(null) // { date, sessions }
  const [goals, setGoals] = useState(() => getGoals())
  const [editingGoals, setEditingGoals] = useState(false)
  const [editingNick, setEditingNick] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setUnit(getUnit())
      if (user) {
        try {
          const remote = await fetchRemoteHistory(user.id)
          if (!cancelled) setSessions(remote)
        } catch {
          if (!cancelled) setSessions(getHistory())
        }
      } else {
        setSessions(getHistory())
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [user])

  async function saveNickname(value) {
    await saveProfile(user.id, { display_name: value || null })
    setNickname(value)
    setEditingNick(false)
  }

  const now = new Date()
  const stats = useMemo(() => {
    if (!sessions.length) return null
    return {
      hero: heroSummary(sessions, unit),
      month: monthStats(sessions, now.getFullYear(), now.getMonth(), unit),
      lifetime: lifetimeStats(sessions, unit),
      muscle: weeklyMuscleSets(sessions),
      records: personalRecords(sessions, unit),
      prs: recentPRs(sessions, unit, 6),
      split: splitDistribution(sessions),
      muscleDist: muscleDistribution(sessions),
      activity: recentActivity(sessions, 8),
      throwback: thisDayInHistory(sessions, unit),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, unit])

  const exerciseNames = useMemo(() => loggedExerciseNames(sessions), [sessions])
  // Best working-set weight per exercise (display unit) — the "current" value
  // behind each lift goal.
  const bestsByName = useMemo(() => {
    const map = {}
    for (const b of exerciseBests(sessions, unit)) map[b.name.trim().toLowerCase()] = b
    return map
  }, [sessions, unit])
  const kindFor = (name) => {
    for (const s of [...sessions].sort((a, b) => b.date - a.date)) {
      const ex = s.exercises.find((e) => e.name.trim().toLowerCase() === name.trim().toLowerCase())
      if (ex) return ex.kind === 'cardio' ? 'cardio' : 'strength'
    }
    return 'strength'
  }
  const [selectedExercise, setSelectedExercise] = useState('')
  useEffect(() => {
    if (exerciseNames.length && !exerciseNames.includes(selectedExercise)) setSelectedExercise(exerciseNames[0])
  }, [exerciseNames, selectedExercise])

  const emailName = (user?.email ? user.email.split('@')[0] : 'there').replace(/[.\-_]/g, ' ')
  const displayName = nickname.trim() || emailName
  // Auto-capitalise the email fallback, but leave a chosen nickname's casing.
  const nameClass = nickname.trim() ? '' : 'capitalize'

  if (loading) {
    return (
      <div className="pt-28 pb-24 px-6 max-w-5xl mx-auto">
        <p className="text-[13px] text-text-muted">Loading your dashboard…</p>
      </div>
    )
  }

  // Empty state — no workouts yet.
  if (!stats) {
    return (
      <div className="pt-24 pb-24 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <CoachingBanner />
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-[13px] text-text-light uppercase tracking-wider mb-2">{greeting()}</p>
            <div className="flex items-center gap-2 mb-3">
              <h1 className={`font-heading text-4xl font-medium text-text-primary ${nameClass}`}>{displayName}</h1>
              {user && (
                <button
                  onClick={() => setEditingNick(true)}
                  aria-label="Edit nickname"
                  className="text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer p-1"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-text-muted text-[15px] mb-8">
              Your dashboard comes to life once you start logging. Track your first session and you'll see your streak,
              volume, records, and trends here.
            </p>
            <Link
              to="/log"
              className="inline-flex items-center gap-2 bg-text-primary text-cream font-medium px-6 py-3 no-underline cursor-pointer text-[14px] hover:bg-accent-hover transition-colors"
            >
              <Plus className="w-4 h-4" /> Log your first workout
            </Link>
          </motion.div>
          <BodyweightTracker user={user} unit={unit} />
          <CoachingCTA />
        </div>
        {editingNick && user && (
          <NicknameModal current={nickname} onSave={saveNickname} onClose={() => setEditingNick(false)} />
        )}
      </div>
    )
  }

  const { hero, month, lifetime, muscle, records, prs, split, muscleDist, activity, throwback } = stats
  const maxMuscle = Math.max(1, ...muscle.map((m) => m.sets))
  const maxSplit = Math.max(1, ...split.map((s) => s.value))
  const maxMuscleDist = Math.max(1, ...muscleDist.map((m) => m.value))
  const trainingTime = formatDuration(month.durationMs)
  const nextMilestone = records.bestE1rm.value ? Math.ceil((records.bestE1rm.value + 1) / 5) * 5 : 0

  return (
    <div className="pt-24 pb-24 px-4 sm:px-6" style={{ paddingBottom: 'max(6rem, env(safe-area-inset-bottom))' }}>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* SECTION 0 — COACHING BANNER (coaching-first: the point of the brand) */}
        <CoachingBanner />

        {/* SECTION 1 — HERO */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <div className="bg-text-primary text-cream p-6 sm:p-8">
            <p className="text-[12px] text-cream/60 uppercase tracking-wider">{greeting()}</p>
            <div className="flex items-center gap-2 mb-1">
              <h1 className={`font-heading text-2xl sm:text-3xl font-medium ${nameClass}`}>{displayName}</h1>
              {user && (
                <button
                  onClick={() => setEditingNick(true)}
                  aria-label="Edit nickname"
                  className="text-cream/50 hover:text-cream bg-transparent border-none cursor-pointer p-1"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-[12px] text-cream/50 mb-6">{fullDate(now)}</p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
              <div className="col-span-2 sm:col-span-1">
                <p className="text-[10px] uppercase tracking-wider text-cream/50 mb-1">Current streak</p>
                <p className="font-heading text-2xl font-medium flex items-center gap-1.5">
                  <Flame className="w-5 h-5 text-orange-400" /> {hero.streak}
                </p>
                <p className="text-[11px] text-cream/50">{hero.streak === 1 ? 'day' : 'days'} in a row</p>
              </div>
              {hero.last && (
                <>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-cream/50 mb-1">Last workout</p>
                    <p className="font-heading text-[15px] font-medium break-words">{hero.last.name}</p>
                    <p className="text-[11px] text-cream/50">{relativeDay(hero.last.date)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-cream/50 mb-1">Volume</p>
                    <p className="font-heading text-[15px] font-medium">{fmtNum(hero.last.volume)} {unit}</p>
                    <p className="text-[11px] text-cream/50">
                      {hero.last.sets} sets{hero.last.durationMs ? ` · ${formatDuration(hero.last.durationMs)}` : ''}
                    </p>
                  </div>
                </>
              )}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-cream/50 mb-1">Up next</p>
                <p className="font-heading text-[15px] font-medium">{hero.next}</p>
                <Link to="/log" className="text-[11px] text-cream/70 underline hover:text-cream no-underline">Start logging →</Link>
              </div>
            </div>
          </div>
        </motion.div>

        {/* SECTION 2 — QUICK STATS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatTile icon={Flame} label="Workout streak" value={hero.streak} sub={`${hero.streak === 1 ? 'day' : 'days'} in a row`} />
          <StatTile icon={Dumbbell} label="Workouts this month" value={month.workouts} sub={`${month.daysTrained} day${month.daysTrained !== 1 ? 's' : ''} trained`} />
          <StatTile icon={TrendingUp} label="Volume this month" value={fmtNum(month.volume)} sub={unit} />
          <StatTile icon={Clock} label="Training time" value={trainingTime || '—'} sub={trainingTime ? 'this month' : 'not tracked yet'} />
        </div>

        {/* SECTION 3 + 4 — CALENDAR & MONTHLY SUMMARY */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <SectionHeading icon={CalendarDays}>Workout calendar</SectionHeading>
            <WorkoutCalendar
              sessions={sessions}
              selectedDate={selectedDay?.date}
              onSelectDay={(date, daySessions) => setSelectedDay({ date, sessions: daySessions })}
            />
            {selectedDay && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-[12px] font-medium text-text-primary mb-2">
                  {selectedDay.date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                </p>
                {selectedDay.sessions.length === 0 ? (
                  <p className="text-[12px] text-text-muted">No workout logged this day.</p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedDay.sessions.map((s) => (
                      <div key={s.id} className="flex items-center justify-between text-[12px]">
                        <span className="text-text-secondary">{s.name || 'Workout'}</span>
                        <span className="text-text-muted">{s.exercises.length} exercise{s.exercises.length !== 1 ? 's' : ''}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card>
            <SectionHeading icon={CalendarDays}>This month</SectionHeading>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <MiniStat label="Workouts" value={month.workouts} />
              <MiniStat label="Days trained" value={month.daysTrained} />
              <MiniStat label="Volume" value={`${fmtNum(month.volume)}`} />
              <MiniStat label="Sets" value={fmtNum(month.sets)} />
              <MiniStat label="Reps" value={fmtNum(month.reps)} />
              <MiniStat label="Avg RIR" value={month.avgRir ?? '—'} />
              <MiniStat label="Avg duration" value={formatDuration(month.avgDurationMs) || '—'} />
              <MiniStat label="PRs" value={month.prs} />
              <MiniStat label="Exercises" value={month.exercises} />
            </div>
          </Card>
        </div>

        {/* SECTION 5 — WEEKLY MUSCLE VOLUME */}
        <Card>
          <SectionHeading icon={Activity}>Weekly muscle volume</SectionHeading>
          <p className="text-[12px] text-text-muted mb-4 -mt-2">Hard sets per muscle group over the last 7 days.</p>
          {muscle.every((m) => m.sets === 0) ? (
            <p className="text-[13px] text-text-muted">No sets logged in the last 7 days.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
              {muscle.map((m) => (
                <Bar key={m.muscle} label={m.muscle} value={m.sets} max={maxMuscle} suffix=" sets" />
              ))}
            </div>
          )}
        </Card>

        {/* SECTION 6 — EXERCISE PROGRESS */}
        <Card>
          <SectionHeading icon={TrendingUp}>Exercise progress</SectionHeading>
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <select
              value={selectedExercise}
              onChange={(e) => setSelectedExercise(e.target.value)}
              aria-label="Select exercise"
              className="bg-cream border border-border px-3 py-2 text-[13px] text-text-primary outline-none focus:border-text-primary cursor-pointer max-w-full"
            >
              {exerciseNames.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          {selectedExercise && (
            <div className="-mx-1">
              <ExerciseProgress exerciseName={selectedExercise} kind={kindFor(selectedExercise)} sessions={sessions} unit={unit} />
            </div>
          )}
        </Card>

        {/* SECTION 7 + 8 — GOALS & PERSONAL RECORDS */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-text-primary" />
                <h2 className="font-heading text-lg font-medium text-text-primary">Goals</h2>
              </div>
              <button
                onClick={() => setEditingGoals(true)}
                className="inline-flex items-center gap-1 text-[12px] text-text-muted hover:text-text-primary bg-transparent border-none cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
            </div>
            <div className="space-y-5">
              <ProgressGoal label="Monthly workouts" value={month.workouts} target={goals.monthlyWorkouts} />
              {goals.lifts.map((g) => (
                <ProgressGoal
                  key={g.id}
                  label={g.exercise}
                  value={Math.round(bestsByName[g.exercise.trim().toLowerCase()]?.weight || 0)}
                  target={g.target}
                  unit={unit}
                />
              ))}
              {goals.lifts.length === 0 && records.bestE1rm.name && (
                <ProgressGoal
                  label={`${records.bestE1rm.name} — next milestone`}
                  value={records.bestE1rm.value}
                  target={nextMilestone}
                  unit={unit}
                />
              )}
            </div>
          </Card>

          <Card>
            <SectionHeading icon={Trophy}>Personal records</SectionHeading>
            <div className="grid grid-cols-2 gap-2.5">
              <MiniStat label="Best weight" value={records.bestWeight.value ? `${fmtNum(records.bestWeight.value)} ${unit}` : '—'} />
              <MiniStat label="Best est. 1RM" value={records.bestE1rm.value ? `${fmtNum(records.bestE1rm.value)} ${unit}` : '—'} />
              <MiniStat label="Best reps" value={records.bestReps.value || '—'} />
              <MiniStat label="Sessions" value={fmtNum(records.sessions)} />
              <div className="col-span-2">
                <MiniStat label="Lifetime volume" value={`${fmtNum(records.lifetimeVolume)} ${unit}`} />
              </div>
            </div>
          </Card>
        </div>

        {/* SECTION 9 — RECENT PRs */}
        {prs.length > 0 && (
          <Card>
            <SectionHeading icon={Award}>Recent personal records</SectionHeading>
            <div className="space-y-2.5">
              {prs.map((pr, i) => (
                <div key={i} className="flex items-center justify-between border border-border bg-cream px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-text-primary break-words">{pr.name}</p>
                    <p className="text-[11px] text-text-muted">{relativeDay(pr.date)} · est. 1RM</p>
                  </div>
                  <p className="text-[13px] font-medium text-text-primary shrink-0 ml-3">
                    {fmtNum(pr.from)} <span className="text-text-light">→</span> {fmtNum(pr.to)} {unit}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* SECTION 10 — TRAINING DISTRIBUTION */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <SectionHeading icon={Activity}>Split distribution</SectionHeading>
            {split.length === 0 ? (
              <p className="text-[13px] text-text-muted">Name your sessions (Push, Pull, Legs…) to see this.</p>
            ) : (
              <div className="space-y-3">
                {split.map((s) => (
                  <Bar key={s.label} label={s.label} value={s.value} max={maxSplit} suffix="" />
                ))}
              </div>
            )}
          </Card>
          <Card>
            <SectionHeading icon={Activity}>Muscle group focus</SectionHeading>
            {muscleDist.length === 0 ? (
              <p className="text-[13px] text-text-muted">No mapped exercises logged yet.</p>
            ) : (
              <div className="space-y-3">
                {muscleDist.map((m) => (
                  <Bar key={m.label} label={m.label} value={m.value} max={maxMuscleDist} suffix=" sets" />
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* SECTION 11 — LIFETIME STATISTICS */}
        <Card>
          <SectionHeading icon={Trophy}>Lifetime statistics</SectionHeading>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <MiniStat label="Workouts" value={fmtNum(lifetime.workouts)} />
            <MiniStat label="Exercises" value={fmtNum(lifetime.exercises)} />
            <MiniStat label="Sets" value={fmtNum(lifetime.sets)} />
            <MiniStat label="Reps" value={fmtNum(lifetime.reps)} />
            <MiniStat label="Volume" value={`${fmtNum(lifetime.volume)} ${unit}`} />
            <MiniStat label="Time" value={formatDuration(lifetime.durationMs) || '—'} />
          </div>
        </Card>

        {/* SECTION 12 — RECENT ACTIVITY */}
        <Card>
          <SectionHeading icon={Activity}>Recent activity</SectionHeading>
          <div className="space-y-0">
            {activity.map((a, i) => (
              <Link
                key={a.id}
                to="/log"
                className={`flex items-center gap-3 py-3 no-underline group ${i > 0 ? 'border-t border-border' : ''}`}
              >
                <div className="w-8 h-8 shrink-0 rounded-full bg-cream border border-border flex items-center justify-center">
                  <Dumbbell className="w-3.5 h-3.5 text-text-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-text-primary break-words">
                    {a.name}
                    {a.hadPR && <span className="ml-2 text-[10px] font-medium text-cream bg-text-primary px-1.5 py-0.5 align-middle">PR</span>}
                  </p>
                  <p className="text-[11px] text-text-muted">{relativeDay(a.date)} · {a.exercises} exercise{a.exercises !== 1 ? 's' : ''} · {a.sets} sets</p>
                </div>
                <ChevronRight className="w-4 h-4 text-text-light shrink-0 group-hover:text-text-primary transition-colors" />
              </Link>
            ))}
          </div>
        </Card>

        {/* SECTION 13 — THIS DAY IN HISTORY */}
        {throwback && (
          <Card>
            <SectionHeading icon={History}>This day in history</SectionHeading>
            <p className="text-[12px] text-text-muted mb-3 -mt-2">
              {throwback.yearsAgo} year{throwback.yearsAgo !== 1 ? 's' : ''} ago today you trained
              {throwback.session.name ? ` ${throwback.session.name}` : ''}.
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="text-[12px] text-text-secondary bg-cream border border-border px-2.5 py-1">{fmtNum(throwback.volume)} {unit} volume</span>
              <span className="text-[12px] text-text-secondary bg-cream border border-border px-2.5 py-1">{throwback.sets} set{throwback.sets !== 1 ? 's' : ''}</span>
              <span className="text-[12px] text-text-secondary bg-cream border border-border px-2.5 py-1">{throwback.session.exercises.length} exercise{throwback.session.exercises.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {throwback.session.exercises.slice(0, 8).map((ex) => (
                <span key={ex.id} className="text-[11px] text-text-muted">{ex.name}</span>
              )).reduce((acc, el, i) => (i === 0 ? [el] : [...acc, <span key={`sep${i}`} className="text-text-light text-[11px]">·</span>, el]), [])}
            </div>
          </Card>
        )}

        {/* SECTION 14 — BODYWEIGHT (compact; tap to open the full panel) */}
        <BodyweightTracker user={user} unit={unit} />

        {/* SECTION 15 — COACHING CTA */}
        <CoachingCTA />
      </div>

      {editingGoals && (
        <GoalsModal
          goals={goals}
          exerciseNames={exerciseNames}
          unit={unit}
          onSave={(g) => { saveGoals(g); setGoals(g); setEditingGoals(false) }}
          onClose={() => setEditingGoals(false)}
        />
      )}

      {editingNick && user && (
        <NicknameModal current={nickname} onSave={saveNickname} onClose={() => setEditingNick(false)} />
      )}
    </div>
  )
}
