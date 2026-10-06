// Every account signed in on this device, so the navbar can switch between
// them without a log out / log in round trip. Each entry keeps that account's
// latest Supabase tokens — the same pair supabase-js already keeps in this
// browser's storage for the active account.
//
// Supabase rotates the refresh token on every refresh, so lib/auth.jsx calls
// rememberSession on each auth event; a stored token is always the newest one
// and stays usable until that account is switched back to. Logging out drops
// the account from the list.
const KEY = 'leon_accounts'

export function listAccounts() {
  try {
    const rows = JSON.parse(localStorage.getItem(KEY))
    return Array.isArray(rows) ? rows : []
  } catch {
    return []
  }
}

function write(rows) {
  try { localStorage.setItem(KEY, JSON.stringify(rows)) } catch { /* no storage */ }
}

export function rememberSession(session) {
  const u = session?.user
  if (!u || !session.refresh_token) return
  const rows = listAccounts()
  const prev = rows.find((r) => r.id === u.id)
  const entry = {
    id: u.id,
    email: u.email || '',
    name: prev?.name || '',
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  }
  write(prev ? rows.map((r) => (r.id === u.id ? entry : r)) : [...rows, entry])
}

export function setAccountName(id, name) {
  const rows = listAccounts()
  if (!rows.some((r) => r.id === id && r.name !== name)) return
  write(rows.map((r) => (r.id === id ? { ...r, name } : r)))
}

export function forgetAccount(id) {
  write(listAccounts().filter((r) => r.id !== id))
}

export function accountName(a) {
  return a.name?.trim() || a.email.split('@')[0] || 'Account'
}
