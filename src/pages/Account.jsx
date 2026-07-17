import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowLeft, LogOut, Check } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { fetchProfile, saveProfile } from '../lib/profile'
import { validateNickname, NICKNAME_MAX } from '../lib/nickname'
import {
  GOALS, EXPERIENCE_LEVELS, EQUIPMENT_PRESETS, HEIGHT_BOUNDS, AGE_BOUNDS,
} from '../lib/profileFields'
import UnitHelp from '../components/UnitHelp'

const NOW_YEAR = new Date().getFullYear()
const MIN_BIRTH_YEAR = NOW_YEAR - AGE_BOUNDS.max
const MAX_BIRTH_YEAR = NOW_YEAR - AGE_BOUNDS.min

export default function Account() {
  const { user, signOut, setNickname: setAuthNickname, refreshProfile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // About you
  const [nickname, setNickname] = useState('')
  const [sex, setSex] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [unit, setUnit] = useState('kg')
  const [bodyweight, setBodyweight] = useState('')
  const [height, setHeight] = useState('')

  // Your training
  const [goal, setGoal] = useState('')
  const [experience, setExperience] = useState('')
  const [equipment, setEquipment] = useState('')

  // Preferences
  const [shareData, setShareData] = useState(false)
  const [coachingStatus, setCoachingStatus] = useState('none')

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!user) { setLoading(false); return }
      try {
        const p = await fetchProfile(user.id)
        if (!cancelled && p) {
          setNickname(p.display_name || '')
          setSex(p.sex || '')
          setBirthYear(p.birth_year != null ? String(p.birth_year) : '')
          setUnit(p.unit || 'kg')
          setBodyweight(p.bodyweight != null ? String(p.bodyweight) : '')
          setHeight(p.height != null ? String(p.height) : '')
          setGoal(p.goal || '')
          setExperience(p.experience_level || '')
          setEquipment(p.equipment || '')
          setShareData(!!p.share_data)
          setCoachingStatus(p.coaching_status || 'none')
        }
      } catch {
        // ignore — keep defaults
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [user])

  function edited() { if (saved) setSaved(false) }

  async function save() {
    setError('')
    setSaved(false)
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
    setSaving(true)
    try {
      await saveProfile(user.id, {
        display_name: nick.value || null,
        sex: sex || null,
        birth_year: birthYear === '' ? null : Number(birthYear),
        unit,
        bodyweight: bodyweight === '' ? null : Number(bodyweight),
        height: height === '' ? null : Number(height),
        goal: goal || null,
        experience_level: experience || null,
        equipment: equipment || null,
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
      {sub && <span className={`block text-[10px] font-normal mt-0.5 ${active ? 'text-cream/60' : 'text-text-light'}`}>{sub}</span>}
    </button>
  )

  const labelCls = 'text-[11px] text-text-muted uppercase tracking-wider block mb-2'
  const inputCls = 'w-full bg-cream border border-border px-4 py-3 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors'
  const cardCls = 'bg-white border border-border p-6 sm:p-9 space-y-7'
  const sectionHeadCls = 'font-heading text-xl font-medium text-text-primary mb-4'

  return (
    <div className="pt-28 pb-24 px-6">
      <div className="max-w-2xl mx-auto">
        <Link to="/log" className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary no-underline text-[13px] mb-10 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to workout log
        </Link>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-heading text-4xl font-medium text-text-primary mb-3">Your profile</h1>

          {!user ? (
            <p className="text-text-muted text-[15px] mt-6">
              You're not logged in. Use the <span className="text-text-primary font-medium">Log in</span> button in the top bar to access your profile.
            </p>
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
                      <input
                        type="number"
                        min={MIN_BIRTH_YEAR}
                        max={MAX_BIRTH_YEAR}
                        value={birthYear}
                        onChange={(e) => { setBirthYear(e.target.value); edited() }}
                        placeholder="1998"
                        className={`${inputCls} max-w-[140px]`}
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">Preferred unit <UnitHelp /></label>
                      <div className="grid grid-cols-2 gap-3">
                        {choice(unit === 'kg', () => setUnit('kg'), 'Metric (kg)')}
                        {choice(unit === 'lbs', () => setUnit('lbs'), 'Imperial (lbs)')}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>Bodyweight ({unit})</label>
                        <input
                          type="number"
                          min="0"
                          value={bodyweight}
                          onChange={(e) => {
                            const v = e.target.value
                            if (v !== '' && (!Number.isFinite(Number(v)) || Number(v) < 0)) return
                            setBodyweight(v); edited()
                          }}
                          placeholder={unit === 'kg' ? '80' : '176'}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Height ({(HEIGHT_BOUNDS[unit] || HEIGHT_BOUNDS.kg).label})</label>
                        <input
                          type="number"
                          min="0"
                          value={height}
                          onChange={(e) => {
                            const v = e.target.value
                            if (v !== '' && (!Number.isFinite(Number(v)) || Number(v) < 0)) return
                            setHeight(v); edited()
                          }}
                          placeholder={unit === 'kg' ? '180' : '71'}
                          className={inputCls}
                        />
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
                      <label className={labelCls}>Experience</label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {EXPERIENCE_LEVELS.map((e) => choice(experience === e.value, () => setExperience(experience === e.value ? '' : e.value), e.label, e.sub))}
                      </div>
                    </div>

                    <div>
                      <label className={labelCls}>Equipment</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {EQUIPMENT_PRESETS.map((eq) => choice(equipment === eq.value, () => setEquipment(equipment === eq.value ? '' : eq.value), eq.label))}
                      </div>
                    </div>
                  </div>
                </section>

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

              {error && <p className="text-[13px] text-red-600 mt-6">{error}</p>}

              <div className="flex items-center gap-3 mt-8">
                <button
                  onClick={save}
                  disabled={saving}
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
