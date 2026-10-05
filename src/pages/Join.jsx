import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Check } from 'lucide-react'
import { useAuth } from '../lib/auth'
import AuthModal from '../components/AuthModal'
import { inviteInfo, acceptInvite, COACH_SEES } from '../lib/coach'
import { rememberInvite, forgetInvite } from '../lib/pendingInvite'

// /join/:code — the invite a coach sends a client. Open it, sign in, accept.
export default function Join() {
  const { code } = useParams()
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [info, setInfo] = useState(null) // { state, coach_name, is_self }
  const [authOpen, setAuthOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (loading) return
    let cancelled = false
    inviteInfo(code)
      .then((i) => { if (!cancelled) setInfo(i) })
      .catch(() => { if (!cancelled) setInfo({ state: 'error' }) })
    return () => { cancelled = true }
  }, [code, loading, user])

  // A dead link has nothing to come back to after signing in.
  useEffect(() => {
    if (info && info.state !== 'open' && info.state !== 'error') forgetInvite()
  }, [info])

  async function accept() {
    setBusy(true)
    setError('')
    try {
      await acceptInvite(code)
      forgetInvite()
      setDone(true)
    } catch {
      setError('That didn’t work — the link may have expired. Ask for a new one.')
    }
    setBusy(false)
  }

  function signIn() {
    rememberInvite(code)
    setAuthOpen(true)
  }

  function decline() {
    forgetInvite()
    navigate('/', { replace: true })
  }

  const coach = info?.coach_name || 'Leon'
  const primary = 'inline-flex items-center justify-center gap-2 bg-text-primary text-cream font-medium px-7 py-3 border-none cursor-pointer text-[14px] hover:bg-accent-hover transition-colors disabled:opacity-50 no-underline'
  const secondary = 'inline-flex items-center justify-center px-5 py-3 text-text-muted hover:text-text-primary bg-white border border-border hover:border-border-hover cursor-pointer text-[13px] transition-colors'

  let body
  if (!info) {
    body = <p className="text-[13px] text-text-muted">Loading…</p>
  } else if (done) {
    body = (
      <>
        <Check className="w-6 h-6 text-text-primary mb-4" />
        <h1 className="font-heading text-3xl sm:text-4xl font-medium text-text-primary mb-3">You’re linked</h1>
        <p className="text-text-muted text-[15px] mb-8">{coach} can now see your training.</p>
        <Link to="/" className={primary}>Go to your dashboard</Link>
      </>
    )
  } else if (info.state === 'error') {
    body = (
      <>
        <h1 className="font-heading text-3xl font-medium text-text-primary mb-3">Couldn’t load this invite</h1>
        <p className="text-text-muted text-[15px] mb-8">Check your connection and try again.</p>
        <button onClick={() => window.location.reload()} className={secondary}>Try again</button>
      </>
    )
  } else if (info.state === 'linked') {
    body = (
      <>
        <Check className="w-6 h-6 text-text-primary mb-4" />
        <h1 className="font-heading text-3xl sm:text-4xl font-medium text-text-primary mb-3">You’re already linked</h1>
        <p className="text-text-muted text-[15px] mb-8">{coach} can see your training.</p>
        <Link to="/" className={primary}>Go to your dashboard</Link>
      </>
    )
  } else if (info.state !== 'open') {
    body = (
      <>
        <h1 className="font-heading text-3xl font-medium text-text-primary mb-3">This link doesn’t work anymore</h1>
        <p className="text-text-muted text-[15px] mb-8">
          {{ expired: 'It expired. ', used: 'It’s already been used. ' }[info.state] || ''}Ask {coach} for a new one.
        </p>
        <Link to="/" className={secondary}>Home</Link>
      </>
    )
  } else if (info.is_self) {
    body = (
      <>
        <h1 className="font-heading text-3xl font-medium text-text-primary mb-3">This is your own invite</h1>
        <p className="text-text-muted text-[15px] mb-8">Send it to your client.</p>
        <Link to="/coach" className={secondary}>Your clients</Link>
      </>
    )
  } else {
    body = (
      <>
        <p className="text-[11px] uppercase tracking-wider text-text-light mb-3">1:1 coaching</p>
        <h1 className="font-heading text-3xl sm:text-4xl font-medium text-text-primary mb-6">{coach} wants to coach you</h1>
        <div className="bg-white border border-border p-5 sm:p-6 mb-6">
          <p className="text-[13px] font-medium text-text-primary mb-3">{coach} will see:</p>
          <ul className="space-y-2 m-0 p-0 list-none">
            {COACH_SEES.map((line) => (
              <li key={line} className="flex items-start gap-2 text-[13px] text-text-secondary">
                <Check className="w-4 h-4 shrink-0 mt-px text-text-muted" /> {line}
              </li>
            ))}
          </ul>
          <p className="text-[12px] text-text-light mt-4">Stop sharing any time in your profile.</p>
        </div>
        {error && <p className="text-[13px] text-red-600 mb-4">{error}</p>}
        <div className="flex flex-wrap gap-3">
          {user ? (
            <button onClick={accept} disabled={busy} className={primary}>{busy ? 'Linking…' : 'Accept'}</button>
          ) : (
            <button onClick={signIn} className={primary}>Log in to accept</button>
          )}
          <button onClick={decline} className={secondary}>No thanks</button>
        </div>
      </>
    )
  }

  return (
    <div className="pt-28 pb-24 px-6">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="max-w-md mx-auto">
        {body}
      </motion.div>
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </div>
  )
}
