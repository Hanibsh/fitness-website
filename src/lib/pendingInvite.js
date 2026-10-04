// A coach's invite opened while signed out survives the sign-in round trip
// (Google sends you back to the home page; an emailed confirmation link opens a
// new tab), and App sends you back to the invite once you're in. Its own tiny
// module so the app shell doesn't pull in the rest of lib/coach.js.
const PENDING_INVITE = 'leon_pending_invite'

export function rememberInvite(code) {
  try { localStorage.setItem(PENDING_INVITE, code) } catch { /* no storage */ }
}
export function pendingInvite() {
  try { return localStorage.getItem(PENDING_INVITE) } catch { return null }
}
export function forgetInvite() {
  try { localStorage.removeItem(PENDING_INVITE) } catch { /* no storage */ }
}
