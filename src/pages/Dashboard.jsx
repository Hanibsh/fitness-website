import { useState, useEffect, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import {
  Flame, Dumbbell, TrendingUp, Trophy, Target, Activity, History,
  ChevronRight, Award, CalendarDays, Plus, Pencil, MessageCircle, ArrowRight, Crosshair, Trash2,
  BatteryCharging, Lightbulb, CalendarRange, HelpCircle,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { getHistory, getUnit, getGoals, saveGoals, getProgram, getBlocks, saveBlocks, deleteSession } from '../lib/workoutStore'
import { fetchRemoteHistory, fetchRemoteProgram, fetchRemoteBlocks, upsertRemoteBlocks, deleteRemoteSession } from '../lib/workoutRemote'
import { scheduleMode, plannedDayForDate } from '../lib/program'
import { activeBlock, sortedBlocks, blockWeek } from '../lib/blocks'
import BlockModal from '../components/BlockModal'
import { saveProfile } from '../lib/profile'
import { loggedExerciseNames } from '../lib/workoutStats'
import {
  heroSummary, monthStats, lifetimeStats, personalRecords, recentPRs,
  splitDistribution, recentActivity, thisDayInHistory, formatDuration,
  exerciseBests, blockSummary,
} from '../lib/dashboard'
import { effectiveWeeklyVolume, muscleRecovery, formatReadyIn } from '../lib/engine'
import { muscleHref } from '../data/muscleInfo'
import { adviseTraining } from '../lib/advisor'
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

// Display-only rename — the engine's internal group is still "Abs" (see
// engineConfig.js ENGINE_MUSCLES); this just relabels it in the UI.
function displayMuscle(m) {
  return m === 'Abs' ? 'Core' : m
}

function fmtNum(n) {
  return (n || 0).toLocaleString()
}

// Weekly-volume window choices — landmarks scale to whichever is picked
// (see effectiveWeeklyVolume).
const VOLUME_RANGES = [
  { days: 7, label: 'Week', windowLabel: 'the last 7 days' },
  { days: 30, label: 'Month', windowLabel: 'the last 30 days' },
  { days: 90, label: '3 Months', windowLabel: 'the last 3 months' },
]

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

function SectionHeading({ children, icon: Icon, right }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-text-primary" />}
        <h2 className="font-heading text-lg font-medium text-text-primary">{children}</h2>
      </div>
      {right}
    </div>
  )
}

// Status chip for the recovery card — tones tuned per theme (raw palette
// colors don't flip with the semantic tokens, hence the dark: variants).
const CHIP_TONES = {
  green: 'text-green-700 bg-green-50 border-green-300 dark:text-green-400 dark:bg-green-500/10 dark:border-green-500/30',
  amber: 'text-amber-700 bg-amber-50 border-amber-300 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/30',
  red: 'text-red-600 bg-red-50 border-red-300 dark:text-red-400 dark:bg-red-500/10 dark:border-red-500/30',
}

function StatusChip({ tone, children }) {
  return <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 border ${CHIP_TONES[tone]}`}>{children}</span>
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
  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])
  const [program, setProgram] = useState(null)
  const [blocks, setBlocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [unit, setUnit] = useState(() => getUnit())
  const [selectedDay, setSelectedDay] = useState(null) // { date, sessions }
  const [monthPage, setMonthPage] = useState('calendar') // calendar/summary card: which page is showing
  const calendarSectionRef = useRef(null)
  const [goals, setGoals] = useState(() => getGoals())
  const [editingGoals, setEditingGoals] = useState(false)
  const [blockModal, setBlockModal] = useState(null) // { block } | null; block null = new
  const [expandedMuscle, setExpandedMuscle] = useState(null) // weekly-volume drill-down
  const [expandedRecovery, setExpandedRecovery] = useState(null) // recovery drill-down
  const [volumeRangeDays, setVolumeRangeDays] = useState(7) // weekly-volume window: 7/30/90
  const [editingNick, setEditingNick] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setUnit(getUnit())
      if (user) {
        try {
          const [remote, prog, blks] = await Promise.all([fetchRemoteHistory(user.id), fetchRemoteProgram(user.id), fetchRemoteBlocks(user.id)])
          if (!cancelled) { setSessions(remote); setProgram(prog || getProgram()); setBlocks(blks || getBlocks()) }
        } catch {
          if (!cancelled) { setSessions(getHistory()); setProgram(getProgram()); setBlocks(getBlocks()) }
        }
      } else {
        setSessions(getHistory())
        setProgram(getProgram())
        setBlocks(getBlocks())
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

  // Persist the blocks list: locally always, remotely (best-effort) when logged in.
  function persistBlocks(next) {
    setBlocks(next)
    saveBlocks(next)
    if (user) upsertRemoteBlocks(user.id, next).catch(() => {})
  }
  function saveBlock(block) {
    const exists = blocks.some((b) => b.id === block.id)
    persistBlocks(exists ? blocks.map((b) => (b.id === block.id ? block : b)) : [...blocks, block])
    setBlockModal(null)
  }
  function deleteBlock(id) {
    persistBlocks(blocks.filter((b) => b.id !== id))
    setBlockModal(null)
  }

  // Calendar day panel: jump to the logger with this session pre-loaded into
  // the editor (WorkoutTracker reads editSessionId from navigation state).
  function editDaySession(session) {
    navigate('/log', { state: { editSessionId: session.id } })
  }

  // Hero "Today"/"Tomorrow" click target: select that date in the calendar's
  // existing day panel (same one the calendar grid itself uses) and scroll to
  // it, so the whole app has one place that shows "what's on this day."
  function goToDay(date, daySessions) {
    setMonthPage('calendar')
    setSelectedDay({ date, sessions: daySessions })
    calendarSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Delete a session straight from the calendar day panel — no need to
  // navigate away first.
  async function deleteDaySession(session) {
    if (user) {
      try {
        await deleteRemoteSession(session.id)
      } catch {
        return
      }
      setSessions((prev) => prev.filter((s) => s.id !== session.id))
    } else {
      setSessions(deleteSession(session.id))
    }
    setSelectedDay((prev) => (prev ? { ...prev, sessions: prev.sessions.filter((s) => s.id !== session.id) } : prev))
  }

  const now = new Date()
  const stats = useMemo(() => {
    if (!sessions.length) return null
    return {
      hero: heroSummary(sessions, unit),
      month: monthStats(sessions, now.getFullYear(), now.getMonth(), unit),
      lifetime: lifetimeStats(sessions, unit),
      records: personalRecords(sessions, unit),
      prs: recentPRs(sessions, unit, 6),
      split: splitDistribution(sessions),
      activity: recentActivity(sessions, 8),
      throwback: thisDayInHistory(sessions, unit),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, unit])

  // Kept separate from `stats` so switching the weekly-volume range doesn't
  // recompute everything else on the page.
  const volume = useMemo(() => effectiveWeeklyVolume(sessions, { days: volumeRangeDays }), [sessions, volumeRangeDays])
  // Engine v2: per-muscle fatigue/recovery snapshot (recomputed per visit; a
  // few minutes of staleness while the page sits open doesn't matter).
  const recovery = useMemo(() => muscleRecovery(sessions), [sessions])
  // Engine v3: the advisor's targeted volume-trimming recommendations.
  const advice = useMemo(() => adviseTraining(sessions, { blocks }), [sessions, blocks])

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

  const { hero, month, lifetime, records, prs, split, activity, throwback } = stats
  // With an active program the hero shows the schedule explicitly: what's
  // planned TODAY (with its logged state) and what's coming TOMORROW.
  // plannedDayForDate covers both weekly and rotating schedules — for a
  // rotation that already advanced today it returns null, i.e. done.
  // No program falls back to the name-based "Up next" heuristic.
  const weeklyProgram = !!program && scheduleMode(program) === 'weekly'
  const todaySessions = sessions.filter((s) => new Date(s.date).toDateString() === new Date().toDateString())
  const trainedToday = todaySessions.length > 0
  const todayPlanned = plannedDayForDate(program, Date.now())
  const tomorrowDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const tomorrowSessions = sessions.filter((s) => new Date(s.date).toDateString() === tomorrowDate.toDateString())
  const tomorrowPlanned = plannedDayForDate(program, tomorrowDate.getTime())
  const exerciseCount = (day) => `${day.exercises.length} exercise${day.exercises.length !== 1 ? 's' : ''}`
  const upToday = !program
    ? { label: hero.next, sub: null }
    : !todayPlanned
      ? { label: 'Done for today', sub: null, done: true }
      : todayPlanned.kind === 'rest'
        ? { label: 'Rest day', sub: weeklyProgram ? 'Scheduled day off' : 'Recovery in your rotation', rest: true }
        : weeklyProgram && trainedToday
          ? { label: todayPlanned.name, sub: null, done: true }
          : { label: todayPlanned.name, sub: `${exerciseCount(todayPlanned)} planned` }
  const upTomorrow = tomorrowPlanned
    ? tomorrowPlanned.kind === 'rest'
      ? { label: 'Rest day', sub: null }
      : { label: tomorrowPlanned.name, sub: exerciseCount(tomorrowPlanned) }
    : null
  // Active specialization block + its per-muscle summary.
  const active = activeBlock(blocks)
  const block = blockSummary(sessions, active, unit)
  const pastBlocks = sortedBlocks(blocks).filter((b) => b.id !== active?.id)
  const maxBlockMuscle = block ? Math.max(1, ...block.perMuscle.map((p) => p.sets)) : 1
  const maxSplit = Math.max(1, ...split.map((s) => s.value))
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
                <p className="text-[10px] uppercase tracking-wider text-cream/50 mb-1">Weekly streak</p>
                <p className="font-heading text-2xl font-medium flex items-center gap-1.5">
                  <Flame className="w-5 h-5 text-orange-400" /> {hero.streak}
                </p>
                <p className="text-[11px] text-cream/50">{hero.streak === 1 ? 'week' : 'weeks'} in a row</p>
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
                <p className="text-[10px] uppercase tracking-wider text-cream/50 mb-1">{program ? 'Today' : 'Up next'}</p>
                <button
                  type="button"
                  onClick={() => goToDay(new Date(), todaySessions)}
                  aria-label={`See today's exercises${upToday.label ? `: ${upToday.label}` : ''}`}
                  className="block w-full text-left cursor-pointer group bg-transparent border-none p-0"
                >
                  <p className="font-heading text-[15px] font-medium break-words group-hover:underline">{upToday.label}</p>
                  {upToday.sub && <p className="text-[11px] text-cream/50">{upToday.sub}</p>}
                  {upToday.done ? (
                    <p className="text-[11px] text-cream/70">Done for today ✓</p>
                  ) : upToday.rest ? (
                    <p className="text-[11px] text-cream/70">Enjoy your day off — relax and recover.</p>
                  ) : null}
                </button>
                {!upToday.done && !upToday.rest && (
                  <Link
                    to="/log"
                    onClick={(e) => e.stopPropagation()}
                    className="text-[11px] text-cream/70 underline hover:text-cream no-underline"
                  >
                    {program ? 'Start today’s session →' : 'Start logging →'}
                  </Link>
                )}
                {upTomorrow && (
                  <button
                    type="button"
                    onClick={() => goToDay(tomorrowDate, tomorrowSessions)}
                    aria-label={`See tomorrow's exercises: ${upTomorrow.label}`}
                    className="block w-full text-left cursor-pointer group bg-transparent border-none p-0 mt-3"
                  >
                    <p className="text-[10px] uppercase tracking-wider text-cream/50 mb-0.5">Tomorrow</p>
                    <p className="text-[13px] font-medium break-words group-hover:underline">
                      {upTomorrow.label}
                      {upTomorrow.sub && <span className="text-[11px] font-normal text-cream/50"> · {upTomorrow.sub}</span>}
                    </p>
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* SECTION 2 — CALENDAR / THIS MONTH (paged: calendar first, summary second) */}
        <div ref={calendarSectionRef}>
        <Card>
          <SectionHeading
            icon={CalendarDays}
            right={
              <div className="flex items-center gap-3 shrink-0">
                <Link
                  to={program ? `/routine/${program.id}` : '/routine'}
                  className="inline-flex items-center gap-1 text-[12px] text-text-muted hover:text-text-primary no-underline transition-colors"
                >
                  <CalendarRange className="w-3.5 h-3.5" /> Edit routine
                </Link>
                <div className="flex border border-border">
                  <button
                    onClick={() => setMonthPage('calendar')}
                    className={`px-3 py-1.5 text-[12px] font-medium cursor-pointer transition-colors ${
                      monthPage === 'calendar' ? 'bg-text-primary text-cream' : 'bg-white text-text-muted hover:text-text-primary'
                    }`}
                  >
                    Calendar
                  </button>
                  <button
                    onClick={() => setMonthPage('summary')}
                    className={`px-3 py-1.5 text-[12px] font-medium cursor-pointer transition-colors ${
                      monthPage === 'summary' ? 'bg-text-primary text-cream' : 'bg-white text-text-muted hover:text-text-primary'
                    }`}
                  >
                    Summary
                  </button>
                </div>
              </div>
            }
          >
            {monthPage === 'calendar' ? 'Workout calendar' : 'This month'}
          </SectionHeading>

          {monthPage === 'calendar' ? (
            <>
              <WorkoutCalendar
                sessions={sessions}
                program={program}
                selectedDate={selectedDay?.date}
                onSelectDay={(date, daySessions) => setSelectedDay({ date, sessions: daySessions })}
              />
              {selectedDay && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-[12px] font-medium text-text-primary mb-2">
                    {selectedDay.date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                  </p>
                  {selectedDay.sessions.length === 0 ? (
                    (() => {
                      // Nothing logged: for today/future dates show what the
                      // program has planned there instead of a dead end.
                      const planned = plannedDayForDate(program, selectedDay.date.getTime())
                      if (planned && planned.kind === 'train') {
                        return (
                          <div>
                            <p className="text-[12px] text-text-muted">
                              Planned: <span className="font-medium text-text-primary">{planned.name}</span>
                            </p>
                            {planned.exercises.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {planned.exercises.map((pe) => (
                                  <span key={pe.id} className="text-[11px] text-text-muted bg-white border border-border px-2 py-0.5">
                                    {pe.name} · {pe.sets}×
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      }
                      if (planned && planned.kind === 'rest') {
                        return <p className="text-[12px] text-text-muted">Rest day in your schedule.</p>
                      }
                      return <p className="text-[12px] text-text-muted">No workout logged this day.</p>
                    })()
                  ) : (
                    <div className="space-y-2.5">
                      {selectedDay.sessions.map((s) => (
                        <div key={s.id} className="bg-cream border border-border p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[12px] font-medium text-text-primary break-words">{s.name || 'Workout'}</p>
                              <p className="text-[11px] text-text-muted mt-0.5">
                                {s.exercises.length} exercise{s.exercises.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => editDaySession(s)}
                                aria-label={`Edit ${s.name || 'workout'}`}
                                title="Edit this workout"
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-cream bg-text-primary px-2.5 py-1 border-none cursor-pointer hover:bg-accent-hover transition-colors"
                              >
                                <Pencil className="w-3 h-3" /> Edit
                              </button>
                              <button
                                onClick={() => deleteDaySession(s)}
                                aria-label={`Delete ${s.name || 'workout'}`}
                                title="Delete this workout"
                                className="text-text-light hover:text-red-600 bg-transparent border-none cursor-pointer p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          {s.exercises.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {s.exercises.map((ex) => (
                                <span key={ex.id} className="text-[11px] text-text-muted bg-white border border-border px-2 py-0.5">
                                  {ex.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
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
          )}
        </Card>
        </div>

        {/* SECTION 5 — MUSCLE VOLUME (effective sets, range-selectable) */}
        <Card>
          <SectionHeading
            icon={Activity}
            right={
              <div className="flex border border-border shrink-0">
                {VOLUME_RANGES.map((r) => (
                  <button
                    key={r.days}
                    onClick={() => setVolumeRangeDays(r.days)}
                    className={`px-3 py-1.5 text-[12px] font-medium cursor-pointer transition-colors ${
                      volumeRangeDays === r.days ? 'bg-text-primary text-cream' : 'bg-white text-text-muted hover:text-text-primary'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            }
          >
            Muscle volume
          </SectionHeading>
          <p className="text-[12px] text-text-muted mb-4 -mt-2">
            Effective sets per muscle over {VOLUME_RANGES.find((r) => r.days === volumeRangeDays).windowLabel} — weighted by how directly each set trains the muscle, how close to failure, and diminishing returns within a marathon session. Tap a muscle for the breakdown, or the ? to learn what it is.
          </p>
          {volume.every((v) => v.sets === 0) ? (
            <p className="text-[13px] text-text-muted">No sets logged in this range.</p>
          ) : (
            <div className="space-y-2">
              {volume.map((v) => {
                const barColor = v.status === 'over' ? 'bg-red-500' : v.status === 'in' ? 'bg-green-500' : 'bg-amber-400'
                const pct = Math.min(100, Math.round((v.sets / v.landmarks.high) * 100))
                const expandable = v.atoms.length > 0
                const open = expandedMuscle === v.muscle
                const href = muscleHref(v.muscle)
                return (
                  <div key={v.muscle}>
                    <div className="flex items-center gap-1.5">
                      {href && (
                        <Link
                          to={href}
                          aria-label={`What is ${displayMuscle(v.muscle)}?`}
                          title={`What is ${displayMuscle(v.muscle)}?`}
                          className="shrink-0 text-text-light hover:text-text-primary"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                        </Link>
                      )}
                      <button
                        onClick={() => expandable && setExpandedMuscle(open ? null : v.muscle)}
                        className={`flex-1 min-w-0 text-left bg-transparent border-none p-0 ${expandable ? 'cursor-pointer' : 'cursor-default'}`}
                      >
                        <div className="flex justify-between items-center text-[12px] mb-1">
                          <span className="text-text-secondary flex items-center gap-1">
                            {displayMuscle(v.muscle)}
                            {expandable && <ChevronRight className={`w-3 h-3 text-text-light transition-transform ${open ? 'rotate-90' : ''}`} />}
                          </span>
                          <span className="text-text-muted tabular-nums">
                            {v.sets}<span className="text-text-light"> / {v.landmarks.low}–{v.landmarks.high}</span>
                          </span>
                        </div>
                        <div className="w-full h-2 bg-cream border border-border overflow-hidden">
                          <div className={`h-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                        </div>
                      </button>
                    </div>
                    {open && (
                      <div className="mt-1.5 ml-3 pl-3 border-l border-border space-y-1.5">
                        {v.atoms.map((a) => (
                          <div key={a.atom} className="flex justify-between items-center text-[11px]">
                            <span className="text-text-muted">{a.atom}</span>
                            <span className="text-text-light tabular-nums">{a.sets} sets</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              <p className="text-[11px] text-text-light pt-2">
                <span className="inline-block w-2 h-2 bg-amber-400 align-middle mr-1" /> below range ·
                <span className="inline-block w-2 h-2 bg-green-500 align-middle mx-1" /> productive ·
                <span className="inline-block w-2 h-2 bg-red-500 align-middle mx-1" /> over
              </p>
            </div>
          )}
        </Card>

        {/* SECTION 5c — RECOVERY (engine v2: per-muscle fatigue model) */}
        <Card>
          <SectionHeading icon={BatteryCharging}>Recovery</SectionHeading>
          <p className="text-[12px] text-text-muted mb-4 -mt-2">
            How recovered each muscle is right now — from how hard, how directly and how recently you trained it.
            Tap a muscle for the sub-muscle breakdown, or the ? to learn what it is; a group carries the combined load
            of its parts, so it can read lower than any single one. Estimates to guide the next session, not gospel.
          </p>
          {(() => {
            const trained = recovery.muscles.filter((m) => m.lastTrained).sort((a, b) => a.recoveryPct - b.recoveryPct)
            const untouched = recovery.muscles.filter((m) => !m.lastTrained)
            if (!trained.length) return <p className="text-[13px] text-text-muted">Nothing logged in the last two weeks — everything's fully recovered.</p>
            const strainTone = recovery.systemic.level === 'high' ? 'red' : recovery.systemic.level === 'moderate' ? 'amber' : 'green'
            return (
              <div className="space-y-2">
                <div className="flex justify-between items-center gap-2 flex-wrap text-[12px] border-b border-border pb-3 mb-3">
                  <span className="text-text-secondary">Systemic freshness <span className="text-text-light">· whole-body</span></span>
                  {/* Engine tracks strain (100 = wrecked); shown flipped so higher = better, like the muscle rows. */}
                  <StatusChip tone={strainTone}>{recovery.systemic.level} · {100 - recovery.systemic.pct}%</StatusChip>
                </div>
                {trained.map((m) => {
                  const expandable = m.atoms?.length > 0
                  const open = expandedRecovery === m.muscle
                  const href = muscleHref(m.muscle)
                  return (
                    <div key={m.muscle} title={m.lastTrained ? `Last trained: ${relativeDay(m.lastTrained)}` : undefined}>
                      <div className="flex items-center gap-1.5">
                        {href && (
                          <Link
                            to={href}
                            aria-label={`What is ${displayMuscle(m.muscle)}?`}
                            title={`What is ${displayMuscle(m.muscle)}?`}
                            className="shrink-0 text-text-light hover:text-text-primary"
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                          </Link>
                        )}
                        <button
                          onClick={() => expandable && setExpandedRecovery(open ? null : m.muscle)}
                          className={`flex-1 min-w-0 text-left bg-transparent border-none p-0 ${expandable ? 'cursor-pointer' : 'cursor-default'}`}
                        >
                          <div className="flex justify-between items-center gap-2 flex-wrap text-[12px] mb-1">
                            <span className="text-text-secondary flex items-center gap-2">
                              {displayMuscle(m.muscle)}
                              {expandable && <ChevronRight className={`w-3 h-3 text-text-light transition-transform ${open ? 'rotate-90' : ''}`} />}
                              <StatusChip tone={m.status === 'ready' ? 'green' : 'amber'}>
                                {m.status === 'ready' ? 'Ready' : 'Recovering'}
                              </StatusChip>
                            </span>
                            <span className="text-text-muted tabular-nums">
                              {m.recoveryPct}%
                              {m.status === 'recovering' && m.readyAt && (
                                <span className="text-text-light"> · ready {formatReadyIn(m.readyAt)}</span>
                              )}
                            </span>
                          </div>
                          <div className="w-full h-2 bg-cream border border-border overflow-hidden">
                            <div
                              className={`h-full transition-all ${m.status === 'ready' ? 'bg-green-500' : 'bg-amber-400'}`}
                              style={{ width: `${m.recoveryPct}%` }}
                            />
                          </div>
                        </button>
                      </div>
                      {open && (
                        <div className="mt-1.5 ml-3 pl-3 border-l border-border space-y-1.5">
                          {m.atoms.map((a) => (
                            <div key={a.atom}>
                              <div className="flex justify-between items-center text-[11px] mb-0.5">
                                <span className="text-text-muted">{a.atom}</span>
                                <span className="text-text-light tabular-nums">{a.recoveryPct}%</span>
                              </div>
                              <div className="w-full h-1.5 bg-cream border border-border overflow-hidden">
                                <div
                                  className={`h-full transition-all ${a.status === 'ready' ? 'bg-green-500' : 'bg-amber-400'}`}
                                  style={{ width: `${a.recoveryPct}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
                {untouched.length > 0 && (
                  <p className="text-[11px] text-text-light pt-2">
                    Fully recovered: {untouched.map((m) => displayMuscle(m.muscle)).join(' · ')}
                  </p>
                )}
                {recovery.personal.observations > 0 && (
                  <p className="text-[11px] text-text-light pt-2">
                    Recovery speeds personalized from {recovery.personal.observations} performance observation{recovery.personal.observations !== 1 ? 's' : ''}
                    {recovery.personal.notes.length > 0 && (
                      <> — {recovery.personal.notes.map((n) => `${displayMuscle(n.muscle)} ${n.mult < 1 ? 'faster' : 'slower'}`).join(' · ')} than default for you</>
                    )}.
                  </p>
                )}
              </div>
            )
          })()}
        </Card>

        {/* SECTION 5d — ADVISOR (engine v3: targeted volume trimming) */}
        <Card>
          <SectionHeading icon={Lightbulb}>Advisor</SectionHeading>
          <p className="text-[12px] text-text-muted mb-4 -mt-2">
            What the engine would change this week — targeted set-trimming only, never a deload.
          </p>
          {advice.length === 0 ? (
            <p className="text-[13px] text-text-muted">Keep logging — advice appears once there's enough history.</p>
          ) : (
            <div className="space-y-4">
              {advice.map((a) => (
                <div key={a.id} className="flex items-start gap-3">
                  <div className="shrink-0 mt-0.5">
                    <StatusChip tone={a.severity === 'red' ? 'red' : a.severity === 'amber' ? 'amber' : 'green'}>
                      {a.severity === 'red' ? 'Act' : a.severity === 'amber' ? 'Watch' : 'Good'}
                    </StatusChip>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-text-primary">{a.title}</p>
                    <p className="text-[12px] text-text-muted mt-0.5 leading-relaxed">{a.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* SECTION 5b — SPECIALIZATION BLOCK */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-text-primary" />
              <h2 className="font-heading text-lg font-medium text-text-primary">Specialization block</h2>
            </div>
            {active ? (
              <button onClick={() => setBlockModal({ block: active })} className="inline-flex items-center gap-1 text-[12px] text-text-muted hover:text-text-primary bg-transparent border-none cursor-pointer">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
            ) : (
              <button onClick={() => setBlockModal({ block: null })} className="inline-flex items-center gap-1 text-[12px] text-text-muted hover:text-text-primary bg-transparent border-none cursor-pointer">
                <Plus className="w-3.5 h-3.5" /> New block
              </button>
            )}
          </div>

          {!active ? (
            <p className="text-[13px] text-text-muted">
              No active block. Start one to emphasize a muscle group and track whether you’re giving it the extra volume.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <p className="text-[15px] font-medium text-text-primary break-words">{active.name}</p>
                {active.focusMuscles.map((m) => (
                  <span key={m} className="text-[10px] font-semibold uppercase tracking-wider text-cream bg-text-primary px-1.5 py-0.5">{m}</span>
                ))}
              </div>
              <p className="text-[12px] text-text-muted mb-4">
                Week {blockWeek(active)} · {block.sessions} session{block.sessions !== 1 ? 's' : ''}
                {block.totalSets > 0 && ` · ${block.focusSets} of ${block.totalSets} hard sets on your focus`}
              </p>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
                {block.perMuscle.filter((p) => p.sets > 0 || p.focus).map((p) => (
                  <div key={p.muscle}>
                    <div className="flex justify-between text-[12px] mb-1">
                      <span className={p.focus ? 'text-text-primary font-medium' : 'text-text-secondary'}>
                        {p.muscle}
                        {p.focus && <span className="ml-1.5 text-[10px] uppercase tracking-wider text-text-primary">focus</span>}
                      </span>
                      <span className="text-text-muted">{p.sets} · {p.weeklyAvg}/wk</span>
                    </div>
                    <div className="w-full h-2 bg-cream border border-border overflow-hidden">
                      <div className={`h-full transition-all ${p.focus ? 'bg-text-primary' : 'bg-text-light'}`} style={{ width: `${Math.round((p.sets / maxBlockMuscle) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {pastBlocks.length > 0 && (
            <div className="mt-5 pt-4 border-t border-border">
              <p className="text-[10px] uppercase tracking-wider text-text-light mb-2">Past blocks</p>
              <div className="space-y-1.5">
                {pastBlocks.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setBlockModal({ block: b })}
                    className="w-full flex items-center justify-between gap-2 text-left bg-transparent border-none cursor-pointer text-[12px] hover:text-text-primary text-text-muted p-0"
                  >
                    <span className="truncate">{b.name}</span>
                    <span className="shrink-0 text-text-light">{b.focusMuscles.join(', ')}</span>
                  </button>
                ))}
              </div>
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
              {goals.lifts.map((g) => {
                const metric = g.metric || 'weight'
                const best = bestsByName[g.exercise.trim().toLowerCase()]
                const value = metric === 'reps' ? best?.reps || 0 : Math.round((metric === 'e1rm' ? best?.e1rm : best?.weight) || 0)
                const suffix = metric === 'e1rm' ? ' — est. 1RM' : metric === 'reps' ? ' — reps' : ''
                return (
                  <ProgressGoal
                    key={g.id}
                    label={`${g.exercise}${suffix}`}
                    value={value}
                    target={g.target}
                    unit={metric === 'reps' ? '' : unit}
                  />
                )
              })}
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

        {/* SECTION 10 — SPLIT DISTRIBUTION */}
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

      {blockModal && (
        <BlockModal
          block={blockModal.block}
          onSave={saveBlock}
          onDelete={blockModal.block ? deleteBlock : undefined}
          onClose={() => setBlockModal(null)}
        />
      )}
    </div>
  )
}
