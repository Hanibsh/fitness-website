import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { fetchProfile } from './profile'
import { getCachedNickname, getExerciseNotesMap, saveCachedNickname, saveExerciseNotesMap } from './workoutStore'
import { fetchRemoteExerciseNotes, upsertRemoteExerciseNotes } from './workoutRemote'

// Tracks the signed-in user across the app. If Supabase isn't configured
// (no env vars), it stays "signed out" and everything runs anonymously.
// Also carries the user's profile row so any component can read it without its
// own fetch — the navbar/dashboard use `nickname`, the anatomy map defaults its
// sex toggle from `profile.sex`, and the calculators prefill from it (see
// lib/profilePrefill.js). `setNickname` lets editors update the name live
// everywhere (and keeps the device's copy in step); `refreshProfile` re-reads
// the row after the profile page saves.
//
// The nickname is mirrored to the device rather than living only in memory: the
// dashboard greets you by it on the first frame, so a slow or failed profile
// fetch would otherwise silently drop you back to your email name until you
// retyped it. Cached value first, server value once it lands.
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
  const [nickname, setNicknameState] = useState('')

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
      setNicknameState('') // in-memory only — the device's copy waits for the next sign-in
      return
    }
    // Show the last name we knew for this account straight away, then let the
    // server's answer correct it.
    setNicknameState(getCachedNickname(user.id))
    fetchProfile(user.id)
      .then((p) => {
        if (cancelled) return
        setProfile(p || null)
        // A missing row (p === null) means the profile has never been saved, so
        // there's nothing to reconcile against — keep what the device knows.
        if (!p) return
        const name = p.display_name || ''
        setNicknameState(name)
        saveCachedNickname(user.id, name)
      })
      .catch((e) => {
        // Deliberately keep the cached name rather than blanking the greeting:
        // an unreachable profile row is not the same as an empty one.
        console.warn('Profile load failed; keeping the cached nickname:', e?.message || e)
      })
    return () => { cancelled = true }
  }, [user])

  // Reconcile exercise notes once per sign-in: bring in anything saved from
  // another device, keep anything typed on this one since (this device wins on
  // a same-movement conflict — it's the freshest), then push the merged result
  // back so the account is caught up too. Best-effort; a failure just means
  // notes stay local-only until the next successful login.
  useEffect(() => {
    if (!supabase || !user) return
    let cancelled = false
    fetchRemoteExerciseNotes(user.id)
      .then((remote) => {
        if (cancelled) return
        const merged = { ...remote, ...getExerciseNotesMap() }
        saveExerciseNotesMap(merged)
        return upsertRemoteExerciseNotes(user.id, merged)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user])

  // Editors call this after persisting a new nickname; mirroring it here means
  // the cache can never drift from what the UI is showing.
  const setNickname = useCallback((value) => {
    setNicknameState(value)
    if (user) saveCachedNickname(user.id, value)
  }, [user])

  const refreshProfile = useCallback(async () => {
    if (!supabase || !user) return null
    try {
      const p = await fetchProfile(user.id)
      setProfile(p || null)
      if (p) {
        const name = p.display_name || ''
        setNicknameState(name)
        saveCachedNickname(user.id, name)
      }
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
