import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowLeft, LogOut, Check, Users } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { fetchProfile, saveProfile } from '../lib/profile'
import { validateNickname, NICKNAME_MAX } from '../lib/nickname'
import {
  GOALS, EXPERIENCE_LEVELS, EQUIPMENT_PRESETS, HEIGHT_BOUNDS, AGE_BOUNDS, cleanFocus,
  WRIST_BOUNDS, ANKLE_BOUNDS, BODY_FAT_BOUNDS, STEPS_BOUNDS, DIETS, MAX_TRAINING_YEARS,
} from '../lib/profileFields'
import { nearestBodyFatLabel } from '../lib/bodyFat'
import { convertWeight } from '../lib/workoutStats'
import { asset } from '../lib/assets'
import { trainingYearsFromStart } from '../lib/profilePrefill'
import FocusPicker from '../components/FocusPicker'
import UnitHelp from '../components/UnitHelp'
import { getRestTimer, saveRestTimer } from '../lib/workoutStore'
import NumberField from '../components/NumberField'
import { useCoachAccess } from '../lib/useClientsState'

const NOW_YEAR = new Date().getFullYear()
const MIN_BIRTH_YEAR = NOW_YEAR - AGE_BOUNDS.max
const MAX_BIRTH_YEAR = NOW_YEAR - AGE_BOUNDS.min
const MIN_START_YEAR = NOW_YEAR - MAX_TRAINING_YEARS

const round1 = (n) => Math.round(n * 10) / 10

// Whether an optional field's typed value is unusable: blank is fine, anything
// else has to be a number within the bounds.
const outOfBounds = (v, b) => v !== '' && !(Number.isFinite(Number(v)) && Number(v) >= b.min && Number(v) <= b.max)

export default function Account() {
  const { user, signOut, setNickname: setAuthNickname, refreshProfile } = useAuth()
  const { isCoach } = useCoachAccess()
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
    const valid = (v) => v !== '' && Number.isFinite(Number(v))
    // Inches keep two decimals so switching back lands on the same cm (180 →
    // 70.87 → 180, where one decimal would come back as 180.1).
    const length = (v) => (valid(v) ? String(next === 'lbs' ? Math.round((Number(v) / 2.54) * 100) / 100 : round1(Number(v) * 2.54)) : v)
    setBodyweight((v) => (valid(v) ? String(round1(convertWeight(Number(v), unit, next))) : v))
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
    if (!nick.ok) { setError(nick.error); return }
    if (birthYear !== '') {
      const y = Number(birthYear)
      if (!Number.isInteger(y) || y < MIN_BIRTH_YEAR || y > MAX_BIRTH_YEAR) {
        setError(`Birth year should be between ${MIN_BIRTH_YEAR} and ${MAX_BIRTH_YEAR}.`); return
      }
    }
    if (height !== '') {
      const h = Number(height), b = HEIGHT_BOUNDS[unit] || HEIGHT_BOUNDS.kg
      if (!Number.isFinite(h) || h < b.min || h > b.max) {
        setError(`Height should be between ${b.min} and ${b.max} ${b.label}.`); return
      }
    }
    if (outOfBounds(bodyFat, BODY_FAT_BOUNDS)) {
      setError(`Body fat should be between ${BODY_FAT_BOUNDS.min} and ${BODY_FAT_BOUNDS.max}%.`); return
    }
    for (const [label, v, bounds] of [['Wrist', wrist, WRIST_BOUNDS], ['Ankle', ankle, ANKLE_BOUNDS]]) {
      const b = bounds[unit] || bounds.kg
      if (outOfBounds(v, b)) { setError(`${label} should be between ${b.min} and ${b.max} ${b.label}.`); return }
    }
    if (outOfBounds(dailySteps, STEPS_BOUNDS)) {
      setError(`Daily steps should be between ${STEPS_BOUNDS.min} and ${STEPS_BOUNDS.max.toLocaleString()}.`); return
    }
    if (trainingStart !== '') {
      const y = Number(trainingStart)
      if (!Number.isInteger(y) || y < MIN_START_YEAR || y > NOW_YEAR) {
        setError(`The year you started training should be between ${MIN_START_YEAR} and ${NOW_YEAR}.`); return
      }
      if (birthYear !== '' && y < Number(birthYear)) {
        setError('The year you started training is before your birth year.'); return
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
  const cardCls = 'bg-white border border-border p-6 sm:p-9 space-y-7'
  const sectionHeadCls = 'font-heading text-xl font-medium text-text-primary mb-4'

  // Rendered in both branches below — it's device settings, not account data,
  // so it has to survive the logged-out short-circuit.
  const loggingSection = (
    <section>
      <h2 className={sectionHeadCls}>Logging</h2>
      <div className="bg-white border border-border p-6 sm:p-9">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={restTimerOn}
            onChange={(e) => toggleRestTimer(e.target.checked)}
            className="mt-0.5 w-4 h-4 shrink-0 accent-text-primary cursor-pointer"
          />
          <span className="text-[13px] text-text-secondary leading-relaxed">
            <span className="font-medium text-text-primary">Show the rest timer while I log.</span>{' '}
            A clock in the corner of the log counting the time since your last set. Turn it off if you don't
            measure your rest periods — your sets are still timestamped either way, so your session length and
            training history don't change.
          </span>
        </label>
        <p className="text-[12px] text-text-light mt-4">Saved on this device, straight away.</p>
      </div>
    </section>
  )

  return (
    <div className="pt-28 pb-24 px-6">
      <div className="max-w-2xl mx-auto">
        <Link to="/log" className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary no-underline text-[13px] mb-10 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to workout log
        </Link>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-heading text-4xl font-medium text-text-primary mb-3">Your profile</h1>

          {!user ? (
            <>
              <p className="text-text-muted text-[15px] mt-6 mb-10">
                You're not logged in. Use the <span className="text-text-primary font-medium">Log in</span> button in the top bar to access your profile.
              </p>
              {loggingSection}
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
              {/* The coach's own account only (profiles.is_coach). */}
              {isCoach && (
                <Link to="/coach" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-secondary hover:text-text-primary no-underline mb-3 transition-colors">
                  <Users className="w-4 h-4" /> Your clients
                </Link>
              )}

              <p className="text-[13px] text-text-muted mb-10 leading-relaxed">
                Everything here is optional — fill in whatever helps us tailor your training, and skip or clear the rest anytime. Tap a selected option again to clear it.
              </p>

              <div className="space-y-10">
                {/* ---- About you ---------------------------------------------------- */}
                <section>
                  <h2 className={sectionHeadCls}>About you</h2>
                  <div className={cardCls}>
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
                      <p className="text-[11px] text-text-light mt-1.5">Shown on your dashboard instead of your email. Leave blank to use your email name.</p>
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
                </section>

                {/* ---- Your body ---------------------------------------------------- */}
                <section>
                  <h2 className={sectionHeadCls}>Your body</h2>
                  <p className="text-[13px] text-text-muted -mt-2 mb-4 leading-relaxed">
                    The calculators fill these in for you, so you only measure once. Update them as they change.
                  </p>
                  <div className={cardCls}>
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
                        {showBfChart ? 'Hide the reference chart' : 'Not sure? Compare with the reference chart'}
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
                        For the muscle potential calculator. Wrist just past the bony bump on the outside, ankle at its narrowest point, tape snug but not tight.
                      </p>
                    </div>
                  </div>
                </section>

                {/* ---- Activity & diet --------------------------------------------- */}
                <section>
                  <h2 className={sectionHeadCls}>Activity &amp; diet</h2>
                  <div className={cardCls}>
                    <div>
                      <label className={labelCls}>Daily steps</label>
                      <NumberField
                        decimal={false}
                        value={dailySteps}
                        onValueChange={(v) => { setDailySteps(v); edited() }}
                        placeholder="8000"
                        className={`${inputCls} max-w-[140px]`}
                      />
                      <p className="text-[11px] text-text-light mt-1.5">Your usual day. Your phone or watch has a good average. Training hours come from the sessions you log.</p>
                    </div>

                    <div>
                      <label className={labelCls}>Diet</label>
                      <div className="grid grid-cols-2 gap-3">
                        {DIETS.map((d) => choice(diet === d.value, () => setDiet(diet === d.value ? '' : d.value), d.label))}
                      </div>
                    </div>
                  </div>
                </section>

                {/* ---- Your training ----------------------------------------------- */}
                <section>
                  <h2 className={sectionHeadCls}>Your training</h2>
                  <p className="text-[13px] text-text-muted -mt-2 mb-4 leading-relaxed">
                    This is what we'll use to tailor your training when workout programs land.
                  </p>
                  <div className={cardCls}>
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
                      <p className="text-[11px] text-text-light mt-1.5">The year you started training consistently. Gives the muscle potential calculator your years trained, and keeps counting by itself.</p>
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
                        Up to 3. Every split you generate trains them first in the day and on more days of the
                        week, without adding to the week&apos;s total.
                      </p>
                      <FocusPicker value={focusMuscles} onChange={(next) => { setFocusMuscles(next); edited() }} />
                    </div>
                  </div>
                </section>

                {/* ---- Logging ----------------------------------------------------- */}
                {loggingSection}

                {/* ---- Privacy ----------------------------------------------------- */}
                <section>
                  <h2 className={sectionHeadCls}>Privacy</h2>
                  <div className="bg-white border border-border p-6 sm:p-9">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={shareData}
                        onChange={(e) => { setShareData(e.target.checked); edited() }}
                        className="mt-0.5 w-4 h-4 shrink-0 accent-text-primary cursor-pointer"
                      />
                      <span className="text-[13px] text-text-secondary leading-relaxed">
                        <span className="font-medium text-text-primary">Help improve the strength standards.</span>{' '}
                        Share my lifts (exercise, weight, reps, RIR) along with my bodyweight and sex — <span className="font-medium text-text-primary">anonymously</span>, with no name or email attached. You can turn this off anytime.
                      </span>
                    </label>
                  </div>
                </section>
              </div>

              {loadFailed && (
                <div className="mt-8 border border-border bg-white p-4">
                  <p className="text-[13px] text-text-primary font-medium">We couldn't load your profile.</p>
                  <p className="text-[13px] text-text-muted mt-1 leading-relaxed">
                    The fields above are showing blanks, not your saved answers — so saving is turned off until we can read
                    your profile again. Nothing has been lost.
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
                Everything here is used only to make the tools and your training more accurate for you and, if you opt in above,
                to improve the strength standards anonymously. It's never shown to anyone else.
              </p>
            </>
          )}
        </motion.div>
      </div>
    </div>
  )
}
