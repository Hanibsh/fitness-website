import { useState } from 'react'
import { supabase } from '../lib/supabase'
import Modal from './Modal'

// Email + password sign up / log in. (Google sign-in gets added here later as
// a "Continue with Google" button — the rest of the app won't change.)
export default function AuthModal({ onClose }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setBusy(true)
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (data.session) onClose() // auto-confirmed → straight in
        else setInfo('Almost there — check your email to confirm your account, then log in.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        onClose()
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const inputClass =
    'w-full bg-cream border border-border px-4 py-3 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors'

  return (
    <Modal onClose={onClose} maxWidth="max-w-sm">
      <div className="p-7">
        <h2 className="font-heading text-2xl font-medium text-text-primary mb-1">
          {mode === 'login' ? 'Log in' : 'Create your account'}
        </h2>
        <p className="text-[13px] text-text-muted mb-6">
          {mode === 'login'
            ? 'Save your workouts and sync across devices.'
            : 'Free — save your workouts and track your progress over time.'}
        </p>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            className={inputClass}
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (at least 6 characters)"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className={inputClass}
          />

          {error && <p className="text-[13px] text-red-600">{error}</p>}
          {info && <p className="text-[13px] text-text-secondary">{info}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-text-primary text-cream font-medium py-3.5 border-none cursor-pointer text-[14px] hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'}
          </button>
        </form>

        <p className="text-[13px] text-text-muted mt-5 text-center">
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setInfo('') }}
            className="text-text-primary font-medium bg-transparent border-none cursor-pointer underline"
          >
            {mode === 'login' ? 'Sign up' : 'Log in'}
          </button>
        </p>
      </div>
    </Modal>
  )
}
