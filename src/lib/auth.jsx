import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { fetchProfile, saveProfile } from './profile'
import { setTheme, storedTheme, themeById } from './theme'
import { getCachedNickname, getExerciseNotesMap, saveCachedNickname, saveExerciseNotesMap } from './workoutStore'
import { fetchRemoteExerciseNotes, upsertRemoteExerciseNotes } from './workoutRemote'
import { forgetAccount, listAccounts, rememberSession, setAccountName } from './accounts'

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
// The theme follows the account, like the dashboard layout: a saved one wins
// over the device's and becomes the device's too, so the next load paints it
// before the profile arrives. With none saved yet, this device's pick seeds
// the account. `undefined` means the column isn't in the DB yet — leave it.
function reconcileTheme(userId, p) {
  if (p.theme === undefined) return
  if (themeById(p.theme)) {
    if (p.theme !== storedTheme()) setTheme(p.theme)
    return
  }
  const local = storedTheme()
  if (local) saveProfile(userId, { theme: local }).catch(() => {})
}

const AuthContext = createContext({
  user: null,
  loading: true,
  profile: null,
  profileLoading: false,
  nickname: '',
  setNickname: () => {},
  refreshProfile: async () => {},
  mergeProfile: () => {},
  signOut: async () => {},
  switchAccount: async () => {},
})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  // Which account the profile (or its failure) has come back for. A page that
  // depends on a profile flag — the coach area — waits while this lags the
  // signed-in user, rather than reading "no profile yet" as "not allowed".
  // Derived, not set at fetch time, so there's no render in between where the
  // user is known and the fetch hasn't started.
  const [profileSettledFor, setProfileSettledFor] = useState(null)
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
    // Every session is remembered for the account switcher (lib/accounts.js),
    // refreshes included, so its stored token is never a spent one. Logging
    // into a second account straight over the first ("Add account") reloads,
    // like a switch, so no page carries the old account's state across.
    let lastId = null
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const id = session?.user?.id ?? null
      if (session) rememberSession(session)
      if (event === 'SIGNED_IN' && lastId && id && id !== lastId) {
        window.location.reload()
        return
      }
      lastId = id
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
        setProfileSettledFor(user.id)
        // A missing row (p === null) means the profile has never been saved, so
        // there's nothing to reconcile against — keep what the device knows.
        if (!p) return
        const name = p.display_name || ''
        setNicknameState(name)
        saveCachedNickname(user.id, name)
        reconcileTheme(user.id, p)
      })
      .catch((e) => {
        // Deliberately keep the cached name rather than blanking the greeting:
        // an unreachable profile row is not the same as an empty one.
        console.warn('Profile load failed; keeping the cached nickname:', e?.message || e)
        if (!cancelled) setProfileSettledFor(user.id)
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
  // The switcher lists accounts by nickname, so keep its copy current too.
  useEffect(() => {
    if (user && nickname) setAccountName(user.id, nickname)
  }, [user, nickname])

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

  // For settings saved on their own (the dashboard layout), outside the profile
  // form: puts the saved fields into the shared row without re-reading it.
  const mergeProfile = useCallback((fields) => {
    setProfile((p) => ({ ...(p || {}), ...fields }))
  }, [])

  const profileLoading = !!user && profileSettledFor !== user.id

  async function signOut() {
    if (!supabase) return
    if (user) forgetAccount(user.id)
    await supabase.auth.signOut()
  }

  // Swaps the session for another remembered account, then reloads so every
  // page starts clean on the new account. A token that no longer works (that
  // account logged out everywhere) drops it from the list and throws.
  async function switchAccount(id) {
    const a = listAccounts().find((r) => r.id === id)
    if (!supabase || !a) return
    const { error } = await supabase.auth.setSession({
      access_token: a.access_token,
      refresh_token: a.refresh_token,
    })
    if (error) {
      forgetAccount(id)
      throw error
    }
    window.location.reload()
  }

  return (
    <AuthContext.Provider value={{ user, loading, profile, profileLoading, nickname, setNickname, refreshProfile, mergeProfile, signOut, switchAccount }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
