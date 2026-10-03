import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, LogOut, Check, Users, FileInput } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { fetchProfile, saveProfile } from '../lib/profile'
import { validateNickname, NICKNAME_MAX } from '../lib/nickname'
import {
  GOALS, EXPERIENCE_LEVELS, EQUIPMENT_PRESETS, HEIGHT_BOUNDS, AGE_BOUNDS, cleanFocus,
  WRIST_BOUNDS, ANKLE_BOUNDS, BODY_FAT_BOUNDS, STEPS_BOUNDS, DIETS, MAX_TRAINING_YEARS,
} from '../lib/profileFields'
import { nearestBodyFatLabel } from '../lib/bodyFat'
import { convertMassText, convertLengthText } from '../lib/units'
import { asset } from '../lib/assets'
import { trainingYearsFromStart } from '../lib/profilePrefill'
import FocusPicker from '../components/FocusPicker'
import DashboardSettings from '../components/DashboardSettings'
import ThemePicker from '../components/ThemePicker'
import ProfileSection from '../components/ProfileSection'
import UnitHelp from '../components/UnitHelp'
import { getRestTimer, saveRestTimer } from '../lib/workoutStore'
import NumberField from '../components/NumberField'
import { useCoachAccess } from '../lib/useClientsState'
import { useReturnLink } from '../lib/returnPath'

const NOW_YEAR = new Date().getFullYear()
const MIN_BIRTH_YEAR = NOW_YEAR - AGE_BOUNDS.max
const MAX_BIRTH_YEAR = NOW_YEAR - AGE_BOUNDS.min
const MIN_START_YEAR = NOW_YEAR - MAX_TRAINING_YEARS


// Whether an optional field's typed value is unusable: blank is fine, anything
// else has to be a number within the bounds.
const outOfBounds = (v, b) => v !== '' && !(Number.isFinite(Number(v)) && Number(v) >= b.min && Number(v) <= b.max)

export default function Account() {
  const { user, signOut, setNickname: setAuthNickname, refreshProfile } = useAuth()
  const { isCoach } = useCoachAccess()
  const back = useReturnLink('account', { to: '/log', label: 'Back to workout log' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  // Whether the profile row failed to load. Saving is blocked while it's true:
  // this form posts every field at once, so saving from a form that fell back to
  // blank defaults would overwrite the real row with nulls — silently wiping the
  // nickname, sex, bodyweight and training answers.
  const [loadFailed, setLoadFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  // About you
  const [nickname, setNickname] = useState('')
  const [sex, setSex] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [unit, setUnit] = useState('kg')
  const [bodyweight, setBodyweight] = useState('')
  const [height, setHeight] = useState('')
  const [bodyFat, setBodyFat] = useState('')
  const [wrist, setWrist] = useState('')
  const [ankle, setAnkle] = useState('')
  const [showBfChart, setShowBfChart] = useState(false)

  // Activity & diet
  const [dailySteps, setDailySteps] = useState('')
  const [diet, setDiet] = useState('')

  // Your training
  const [goal, setGoal] = useState('')
  const [experience, setExperience] = useState('')
  const [trainingStart, setTrainingStart] = useState('')
  const [equipment, setEquipment] = useState('')
  const [focusMuscles, setFocusMuscles] = useState([])

  // Preferences
  const [shareData, setShareData] = useState(false)
  const [coachingStatus, setCoachingStatus] = useState('none')

  // Device-local, and saved the instant it changes — unlike everything else on
  // this page, which waits for Save. Whether you time your rests is a property
  // of how you train rather than of your account, so it lives on the device
  // next to the unit picker and the theme, and works logged out.
  const [restTimerOn, setRestTimerOn] = useState(() => getRestTimer().enabled)

  // The dashboard's "Customize" link arrives with #dashboard; the router doesn't
  // scroll to a hash by itself, and the section only exists once loading ends.
  const location = useLocation()

  // Which sections are open (components/ProfileSection.jsx). All start closed;
  // the dashboard's Customize link opens its own.
  const [openSections, setOpenSections] = useState(() => new Set(location.hash === '#dashboard' ? ['dashboard'] : []))
  const openSection = (id) => setOpenSections((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
  const sec = (id) => ({
    open: openSections.has(id),
    onToggle: () => setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    }),
  })

  useEffect(() => {
    if (location.hash !== '#dashboard' || (user && loading)) return
    openSection('dashboard')
    document.getElementById('dashboard')?.scrollIntoView({ block: 'start' })
  }, [location.hash, loading, user])

  function toggleRestTimer(enabled) {
    setRestTimerOn(enabled)
    saveRestTimer({ ...getRestTimer(), enabled })
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!user) { setLoading(false); return }
      try {
        const p = await fetchProfile(user.id)
        if (cancelled) return
        setLoadFailed(false)
        if (p) {
          setNickname(p.display_name || '')
          setSex(p.sex || '')
          setBirthYear(p.birth_year != null ? String(p.birth_year) : '')
          setUnit(p.unit || 'kg')
          setBodyweight(p.bodyweight != null ? String(p.bodyweight) : '')
          setHeight(p.height != null ? String(p.height) : '')
          setBodyFat(p.body_fat != null ? String(p.body_fat) : '')
          setWrist(p.wrist != null ? String(p.wrist) : '')
          setAnkle(p.ankle != null ? String(p.ankle) : '')
          setDailySteps(p.daily_steps != null ? String(p.daily_steps) : '')
          setDiet(p.diet || '')
          setGoal(p.goal || '')
          setExperience(p.experience_level || '')
          setTrainingStart(p.training_start_year != null ? String(p.training_start_year) : '')
          setEquipment(p.equipment || '')
          setFocusMuscles(cleanFocus(p.focus_muscles))
          setShareData(!!p.share_data)
          setCoachingStatus(p.coaching_status || 'none')
        }
      } catch (e) {
        // Keep the defaults on screen, but remember that they're placeholders
        // rather than the account's real answers (see `loadFailed`).
        if (!cancelled) setLoadFailed(true)
        console.warn('Profile load failed:', e?.message || e)
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [user, reloadKey])

  function edited() { if (saved) setSaved(false) }

  // Every number on this page is stored in the system the unit implies (kg + cm,
  // or lbs + inches), so switching unit converts them rather than relabelling
  // them — otherwise a saved 80 kg would quietly turn into 80 lbs.
  function switchUnit(next) {
    if (next === unit) return
    const toImperial = next === 'lbs'
    const length = (v) => convertLengthText(v, toImperial)
    setBodyweight((v) => convertMassText(v, toImperial))
    setHeight(length)
    setWrist(length)
    setAnkle(length)
    setUnit(next)
  }

  async function save() {
    setError('')
    setSaved(false)
    if (loadFailed) {
      setError("Your profile couldn't be loaded, so saving is off — otherwise this would overwrite it with blanks. Try loading it again.")
      return
    }
    const nick = validateNickname(nickname)
    if (!nick.ok) { openSection('about'); setError(nick.error); return }
    if (birthYear !== '') {
      const y = Number(birthYear)
      if (!Number.isInteger(y) || y < MIN_BIRTH_YEAR || y > MAX_BIRTH_YEAR) {
        openSection('about'); setError(`Birth year should be between ${MIN_BIRTH_YEAR} and ${MAX_BIRTH_YEAR}.`); return
      }
    }
    if (height !== '') {
      const h = Number(height), b = HEIGHT_BOUNDS[unit] || HEIGHT_BOUNDS.kg
      if (!Number.isFinite(h) || h < b.min || h > b.max) {
        openSection('body'); setError(`Height should be between ${b.min} and ${b.max} ${b.label}.`); return
      }
    }
    if (outOfBounds(bodyFat, BODY_FAT_BOUNDS)) {
      openSection('body'); setError(`Body fat should be between ${BODY_FAT_BOUNDS.min} and ${BODY_FAT_BOUNDS.max}%.`); return
    }
    for (const [label, v, bounds] of [['Wrist', wrist, WRIST_BOUNDS], ['Ankle', ankle, ANKLE_BOUNDS]]) {
      const b = bounds[unit] || bounds.kg
      if (outOfBounds(v, b)) { openSection('body'); setError(`${label} should be between ${b.min} and ${b.max} ${b.label}.`); return }
    }
    if (outOfBounds(dailySteps, STEPS_BOUNDS)) {
      openSection('activity'); setError(`Daily steps should be between ${STEPS_BOUNDS.min} and ${STEPS_BOUNDS.max.toLocaleString()}.`); return
    }
    if (trainingStart !== '') {
      const y = Number(trainingStart)
      if (!Number.isInteger(y) || y < MIN_START_YEAR || y > NOW_YEAR) {
        openSection('training'); setError(`The year you started training should be between ${MIN_START_YEAR} and ${NOW_YEAR}.`); return
      }
      if (birthYear !== '' && y < Number(birthYear)) {
        openSection('training'); setError('The year you started training is before your birth year.'); return
      }
    }
    setSaving(true)
    try {
      await saveProfile(user.id, {
        display_name: nick.value || null,
        sex: sex || null,
        birth_year: birthYear === '' ? null : Number(birthYear),
        unit,
        bodyweight: bodyweight === '' ? null : Number(bodyweight),
        height: height === '' ? null : Number(height),
        body_fat: bodyFat === '' ? null : Number(bodyFat),
        wrist: wrist === '' ? null : Number(wrist),
        ankle: ankle === '' ? null : Number(ankle),
        daily_steps: dailySteps === '' ? null : Number(dailySteps),
        diet: diet || null,
        goal: goal || null,
        experience_level: experience || null,
        training_start_year: trainingStart === '' ? null : Number(trainingStart),
        equipment: equipment || null,
        focus_muscles: focusMuscles.length ? focusMuscles : null,
        share_data: shareData,
      })
      setNickname(nick.value)
      setAuthNickname(nick.value)
      setSaved(true)
      // Re-read the shared profile so the anatomy map's sex default and the
      // calculators' prefill pick up this save without a reload.
      refreshProfile()
    } catch {
      setError('Could not save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // Segmented option button. `sub` is an optional second line.
  const choice = (active, onClick, label, sub) => (
    <button
      key={label}
      type="button"
      onClick={() => { onClick(); edited() }}
      className={`px-2 py-3 text-[13px] font-medium border cursor-pointer transition-colors text-center leading-tight ${
        active ? 'bg-text-primary text-cream border-text-primary' : 'bg-white text-text-muted border-border hover:border-border-hover'
      }`}
    >
      {label}
      {sub && <span className={`block text-[10px] font-normal mt-0.5 ${active ? 'text-cream-60' : 'text-text-light'}`}>{sub}</span>}
    </button>
  )

  // Shown beside "Started training" — also blank while a year is half-typed.
  const startYears = trainingYearsFromStart(trainingStart)

  const labelCls = 'text-[11px] text-text-muted uppercase tracking-wider block mb-2'
  const inputCls = 'w-full bg-cream border border-border px-4 py-3 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors'

  // Rendered in both branches below — it's device settings, not account data,
  // so it has to survive the logged-out short-circuit.
  const restTimerSection = (
    <ProfileSection id="rest-timer" title="Rest timer" {...sec('rest-timer')}>
      <div>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={restTimerOn}
            onChange={(e) => toggleRestTimer(e.target.checked)}
            className="mt-0.5 w-4 h-4 shrink-0 accent-text-primary cursor-pointer"
          />
          <span className="text-[13px] text-text-secondary leading-relaxed">
            <span className="font-medium text-text-primary">Show the rest timer while I log.</span>{' '}
            Counts the time since your last set.
          </span>
        </label>
        <p className="text-[12px] text-text-light mt-4">Saved on this device.</p>
      </div>
    </ProfileSection>
  )

  // Also in both branches: signed out it lives on this device only. The
  // dashboard's "Customize" link lands here (#dashboard).
  const dashboardSection = (
    <ProfileSection id="dashboard" title="Dashboard" {...sec('dashboard')}>
      <p className="text-[13px] text-text-muted mb-4">Pick your cards and their order.</p>
      <DashboardSettings />
    </ProfileSection>
  )

  // Device setting like the rest timer, so in both branches too.
  const appearanceSection = (
    <ProfileSection id="appearance" title="Appearance" {...sec('appearance')}>
      <p className="text-[13px] text-text-muted mb-4">Saved on this device.</p>
      <ThemePicker />
    </ProfileSection>
  )

  return (
    <div className="pt-28 pb-24 px-6">
      <div className="max-w-2xl mx-auto">
        {/* Your name in the top bar opens this from any page — back goes there. */}
        <Link to={back.to} state={back.state} className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary no-underline text-[13px] mb-10 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> {back.label}
        </Link>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-heading text-4xl font-medium text-text-primary mb-3">Your profile</h1>

          {!user ? (
            <>
              <p className="text-text-muted text-[15px] mt-6 mb-10">
                <span className="text-text-primary font-medium">Log in</span> to see your profile.
              </p>
              <div className="space-y-3">
                {dashboardSection}
                {appearanceSection}
                {restTimerSection}
              </div>
            </>
          ) : loading ? (
            <p className="text-text-muted text-[13px] mt-6">Loading…</p>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <p className="text-text-muted text-[15px]">{user.email}</p>
                {coachingStatus === 'client' && (
                  <span className="text-[11px] font-medium text-cream bg-text-primary px-2 py-0.5">Coaching client</span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2 mb-3">
                {/* A split sent as text can fill this page in too. */}
                <Link to="/import" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-secondary hover:text-text-primary no-underline transition-colors">
                  <FileInput className="w-4 h-4" /> Import from a text file
                </Link>
                {/* The coach's own account only (profiles.is_coach). */}
                {isCoach && (
                  <Link to="/coach" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-secondary hover:text-text-primary no-underline transition-colors">
                    <Users className="w-4 h-4" /> Your clients
                  </Link>
                )}
              </div>

              <p className="text-[13px] text-text-muted mb-10 leading-relaxed">
                Everything here is optional — fill in whatever helps us tailor your training.
              </p>

              <div className="space-y-3">
                {/* ---- About you ---------------------------------------------------- */}
                <ProfileSection id="about" title="About you" {...sec('about')}>
                  <div className="space-y-7">
                    <div>
                      <label className={labelCls}>Nickname</label>
                      <input
                        type="text"
                        value={nickname}
                        maxLength={NICKNAME_MAX}
                        onChange={(e) => { setNickname(e.target.value); edited() }}
                        placeholder="What should we call you?"
                        className={inputCls}
                      />
                      <p className="text-[11px] text-text-light mt-1.5">Shown on your dashboard.</p>
                    </div>

                    <div>
                      <label className={labelCls}>Sex</label>
                      <div className="grid grid-cols-2 gap-3">
                        {choice(sex === 'male', () => setSex(sex === 'male' ? '' : 'male'), 'Male')}
                        {choice(sex === 'female', () => setSex(sex === 'female' ? '' : 'female'), 'Female')}
                      </div>
                    </div>

                    <div>
                      <label className={labelCls}>Birth year</label>
                      <NumberField
                        decimal={false}
                        value={birthYear}
                        onValueChange={(v) => { setBirthYear(v); edited() }}
                        placeholder="1998"
                        className={`${inputCls} max-w-[140px]`}
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">Preferred unit <UnitHelp /></label>
                      <div className="grid grid-cols-2 gap-3">
                        {choice(unit === 'kg', () => switchUnit('kg'), 'Metric (kg/cm)')}
                        {choice(unit === 'lbs', () => switchUnit('lbs'), 'Imperial (lbs/in)')}
                      </div>
                    </div>
                  </div>
                </ProfileSection>

                {/* ---- Your body ---------------------------------------------------- */}
                <ProfileSection id="body" title="Your body" {...sec('body')}>
                  <p className="text-[13px] text-text-muted mb-6 leading-relaxed">
                    The calculators fill these in for you.
                  </p>
                  <div className="space-y-7">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>Bodyweight ({unit})</label>
                        <NumberField
                          value={bodyweight}
                          onValueChange={(v) => { setBodyweight(v); edited() }}
                          placeholder={unit === 'kg' ? '80' : '176'}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Height ({(HEIGHT_BOUNDS[unit] || HEIGHT_BOUNDS.kg).label})</label>
                        <NumberField
                          value={height}
                          onValueChange={(v) => { setHeight(v); edited() }}
                          placeholder={unit === 'kg' ? '180' : '71'}
                          className={inputCls}
                        />
                      </div>
                    </div>

                    <div>
                      <label className={labelCls}>Body fat (%)</label>
                      <div className="flex items-center gap-3">
                        <NumberField
                          decimal={false}
                          value={bodyFat}
                          onValueChange={(v) => { setBodyFat(v); edited() }}
                          placeholder={sex === 'female' ? '24' : '20'}
                          className={`${inputCls} max-w-[140px]`}
                        />
                        {bodyFat !== '' && !outOfBounds(bodyFat, BODY_FAT_BOUNDS) && (
                          <span className="text-[13px] text-text-muted">≈ {nearestBodyFatLabel(sex || 'male', Number(bodyFat))}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowBfChart((v) => !v)}
                        aria-expanded={showBfChart}
                        className="mt-2 text-[12px] text-text-muted underline underline-offset-2 hover:text-text-primary bg-transparent border-none p-0 cursor-pointer"
                      >
                        {showBfChart ? 'Hide the chart' : 'Not sure? See the chart'}
                      </button>
                      {showBfChart && (
                        <img src={asset('images/bodyfat-chart.jpeg')} alt="Body fat percentage reference chart" className="w-full border border-border mt-3" />
                      )}
                    </div>

                    <div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={labelCls}>Wrist ({(WRIST_BOUNDS[unit] || WRIST_BOUNDS.kg).label})</label>
                          <NumberField
                            value={wrist}
                            onValueChange={(v) => { setWrist(v); edited() }}
                            placeholder={unit === 'kg' ? '17' : '6.7'}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Ankle ({(ANKLE_BOUNDS[unit] || ANKLE_BOUNDS.kg).label})</label>
                          <NumberField
                            value={ankle}
                            onValueChange={(v) => { setAnkle(v); edited() }}
                            placeholder={unit === 'kg' ? '22' : '8.7'}
                            className={inputCls}
                          />
                        </div>
                      </div>
                      <p className="text-[11px] text-text-light mt-1.5 leading-relaxed">
                        Wrist just past the bony bump, ankle at its narrowest.
                      </p>
                    </div>
                  </div>
                </ProfileSection>

                {/* ---- Activity & diet --------------------------------------------- */}
                <ProfileSection id="activity" title="Activity & diet" {...sec('activity')}>
                  <div className="space-y-7">
                    <div>
                      <label className={labelCls}>Daily steps</label>
                      <NumberField
                        decimal={false}
                        value={dailySteps}
                        onValueChange={(v) => { setDailySteps(v); edited() }}
                        placeholder="8000"
                        className={`${inputCls} max-w-[140px]`}
                      />
                      <p className="text-[11px] text-text-light mt-1.5">Your usual day — check your phone or watch.</p>
                    </div>

                    <div>
                      <label className={labelCls}>Diet</label>
                      <div className="grid grid-cols-2 gap-3">
                        {DIETS.map((d) => choice(diet === d.value, () => setDiet(diet === d.value ? '' : d.value), d.label))}
                      </div>
                    </div>
                  </div>
                </ProfileSection>

                {/* ---- Your training ----------------------------------------------- */}
                <ProfileSection id="training" title="Your training" {...sec('training')}>
                  <div className="space-y-7">
                    <div>
                      <label className={labelCls}>Primary goal</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {GOALS.map((g) => choice(goal === g.value, () => setGoal(goal === g.value ? '' : g.value), g.label))}
                      </div>
                    </div>

                    <div>
                      <label className={labelCls}>Training age</label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {EXPERIENCE_LEVELS.map((e) => choice(experience === e.value, () => setExperience(experience === e.value ? '' : e.value), e.label, e.sub))}
                      </div>
                    </div>

                    <div>
                      <label className={labelCls}>Started training</label>
                      <div className="flex items-center gap-3">
                        <NumberField
                          decimal={false}
                          value={trainingStart}
                          onValueChange={(v) => { setTrainingStart(v); edited() }}
                          placeholder={String(NOW_YEAR - 3)}
                          className={`${inputCls} max-w-[140px]`}
                        />
                        {startYears != null && (
                          <span className="text-[13px] text-text-muted">{startYears === 0 ? 'This year' : `${startYears} year${startYears === 1 ? '' : 's'}`}</span>
                        )}
                      </div>
                      <p className="text-[11px] text-text-light mt-1.5">The year you started training consistently.</p>
                    </div>

                    <div>
                      <label className={labelCls}>Equipment</label>
                      {/* two presets, so a 4-col grid would leave them stranded at half width */}
                      <div className="grid grid-cols-2 gap-2">
                        {EQUIPMENT_PRESETS.map((eq) => choice(equipment === eq.value, () => setEquipment(equipment === eq.value ? '' : eq.value), eq.label))}
                      </div>
                    </div>

                    <div>
                      <label className={labelCls}>Muscles to bring up</label>
                      <p className="text-[12px] text-text-light -mt-1 mb-3 leading-relaxed">
                        Up to 3. Trained first and more often in your splits.
                      </p>
                      <FocusPicker value={focusMuscles} onChange={(next) => { setFocusMuscles(next); edited() }} />
                    </div>
                  </div>
                </ProfileSection>

                {/* ---- Dashboard --------------------------------------------------- */}
                {dashboardSection}

                {/* ---- Appearance -------------------------------------------------- */}
                {appearanceSection}

                {/* ---- Rest timer -------------------------------------------------- */}
                {restTimerSection}

                {/* ---- Privacy ----------------------------------------------------- */}
                <ProfileSection id="privacy" title="Privacy" {...sec('privacy')}>
                  <div>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={shareData}
                        onChange={(e) => { setShareData(e.target.checked); edited() }}
                        className="mt-0.5 w-4 h-4 shrink-0 accent-text-primary cursor-pointer"
                      />
                      <span className="text-[13px] text-text-secondary leading-relaxed">
                        <span className="font-medium text-text-primary">Help improve the strength standards.</span>{' '}
                        Share my lifts, bodyweight and sex — <span className="font-medium text-text-primary">anonymously</span>, no name or email.
                      </span>
                    </label>
                  </div>
                </ProfileSection>
              </div>

              {loadFailed && (
                <div className="mt-8 border border-border bg-white p-4">
                  <p className="text-[13px] text-text-primary font-medium">We couldn't load your profile.</p>
                  <p className="text-[13px] text-text-muted mt-1 leading-relaxed">
                    Saving is off until it loads. Nothing has been lost.
                  </p>
                  <button
                    onClick={() => { setLoading(true); setReloadKey((k) => k + 1) }}
                    className="mt-3 text-[13px] text-text-primary bg-white border border-border hover:border-border-hover px-4 py-2 cursor-pointer transition-colors"
                  >
                    Try again
                  </button>
                </div>
              )}

              {error && <p className="text-[13px] text-red-600 mt-6">{error}</p>}

              <div className="flex items-center gap-3 mt-8">
                <button
                  onClick={save}
                  disabled={saving || loadFailed}
                  className="inline-flex items-center justify-center gap-2 bg-text-primary text-cream font-medium px-7 py-3 border-none cursor-pointer text-[14px] hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saved ? <Check className="w-4 h-4" /> : null}
                  {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
                </button>
                <button
                  onClick={signOut}
                  className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary bg-white border border-border hover:border-border-hover px-5 py-3 cursor-pointer text-[13px] transition-colors"
                >
                  <LogOut className="w-4 h-4" /> Log out
                </button>
              </div>

              <p className="text-[12px] text-text-light leading-relaxed mt-6">
                Only used to tailor your training. Never shown to anyone else.
              </p>
            </>
          )}
        </motion.div>
      </div>
    </div>
  )
}
