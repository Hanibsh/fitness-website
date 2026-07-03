import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowLeft, LogOut, Check } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { fetchProfile, saveProfile } from '../lib/profile'

export default function Account() {
  const { user, signOut } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [sex, setSex] = useState('')
  const [bodyweight, setBodyweight] = useState('')
  const [unit, setUnit] = useState('kg')
  const [shareData, setShareData] = useState(false)
  const [coachingStatus, setCoachingStatus] = useState('none')

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!user) { setLoading(false); return }
      try {
        const p = await fetchProfile(user.id)
        if (!cancelled && p) {
          setSex(p.sex || '')
          setBodyweight(p.bodyweight != null ? String(p.bodyweight) : '')
          setUnit(p.unit || 'kg')
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

  async function save() {
    setError('')
    setSaved(false)
    setSaving(true)
    try {
      await saveProfile(user.id, {
        sex: sex || null,
        bodyweight: bodyweight === '' ? null : Number(bodyweight),
        unit,
        share_data: shareData,
      })
      setSaved(true)
    } catch {
      setError('Could not save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const toggle = (active, onClick, label) => (
    <button
      onClick={onClick}
      className={`flex-1 py-3 text-[13px] font-medium border cursor-pointer transition-colors ${
        active ? 'bg-text-primary text-cream border-text-primary' : 'bg-white text-text-muted border-border hover:border-border-hover'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="pt-28 pb-24 px-6">
      <div className="max-w-2xl mx-auto">
        <Link to="/log" className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary no-underline text-[13px] mb-10 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to workout log
        </Link>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-heading text-4xl font-medium text-text-primary mb-3">Your account</h1>

          {!user ? (
            <p className="text-text-muted text-[15px] mt-6">
              You're not logged in. Use the <span className="text-text-primary font-medium">Log in</span> button in the top bar to access your account.
            </p>
          ) : loading ? (
            <p className="text-text-muted text-[13px] mt-6">Loading…</p>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap mb-10">
                <p className="text-text-muted text-[15px]">{user.email}</p>
                {coachingStatus === 'client' && (
                  <span className="text-[11px] font-medium text-cream bg-text-primary px-2 py-0.5">Coaching client</span>
                )}
              </div>

              <div className="bg-white border border-border p-9 space-y-7">
                <div>
                  <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-3">Sex</label>
                  <div className="flex gap-3">
                    {toggle(sex === 'male', () => setSex('male'), 'Male')}
                    {toggle(sex === 'female', () => setSex('female'), 'Female')}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-3">Preferred unit</label>
                  <div className="flex gap-3">
                    {toggle(unit === 'kg', () => setUnit('kg'), 'Metric (kg)')}
                    {toggle(unit === 'lbs', () => setUnit('lbs'), 'Imperial (lbs)')}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-2">
                    Bodyweight ({unit})
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={bodyweight}
                    onChange={(e) => setBodyweight(e.target.value)}
                    placeholder={unit === 'kg' ? '80' : '176'}
                    className="w-full bg-cream border border-border px-4 py-3 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors"
                  />
                </div>

                {/* Data-sharing consent */}
                <div className="border border-border bg-cream p-5">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shareData}
                      onChange={(e) => setShareData(e.target.checked)}
                      className="mt-0.5 w-4 h-4 shrink-0 accent-[#1a1a1a] cursor-pointer"
                    />
                    <span className="text-[13px] text-text-secondary leading-relaxed">
                      <span className="font-medium text-text-primary">Help improve the strength standards.</span>{' '}
                      Share my lifts (exercise, weight, reps, RIR) along with my bodyweight and sex — <span className="font-medium text-text-primary">anonymously</span>, with no name or email attached. You can turn this off anytime.
                    </span>
                  </label>
                </div>

                {error && <p className="text-[13px] text-red-600">{error}</p>}

                <div className="flex items-center gap-3">
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
              </div>

              <p className="text-[12px] text-text-light leading-relaxed mt-6">
                Your bodyweight and sex are only used to make the tools more accurate for you and, if you opt in above,
                to improve the strength standards anonymously. They're never shown to anyone.
              </p>
            </>
          )}
        </motion.div>
      </div>
    </div>
  )
}
