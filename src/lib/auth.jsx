import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { fetchProfile } from './profile'

// Tracks the signed-in user across the app. If Supabase isn't configured
// (no env vars), it stays "signed out" and everything runs anonymously.
// Also carries the user's profile row so any component can read it without its
// own fetch — the navbar/dashboard use `nickname`, the anatomy map defaults its
// sex toggle from `profile.sex`, and the calculators prefill from it (see
// lib/profilePrefill.js). `setNickname` lets editors update the name live
// everywhere; `refreshProfile` re-reads the row after the profile page saves.
const AuthContext = createContext({
  user: null,
  loading: true,
  profile: null,
  nickname: '',
  setNickname: () => {},
  refreshProfile: async () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [nickname, setNickname] = useState('')

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Load the profile whenever the signed-in user changes.
  useEffect(() => {
    let cancelled = false
    if (!supabase || !user) {
      setProfile(null)
      setNickname('')
      return
    }
    fetchProfile(user.id)
      .then((p) => {
        if (cancelled) return
        setProfile(p || null)
        setNickname(p?.display_name || '')
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user])

  const refreshProfile = useCallback(async () => {
    if (!supabase || !user) return null
    try {
      const p = await fetchProfile(user.id)
      setProfile(p || null)
      setNickname(p?.display_name || '')
      return p
    } catch {
      return null
    }
  }, [user])

  async function signOut() {
    if (supabase) await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, loading, profile, nickname, setNickname, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
