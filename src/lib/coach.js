// Coaching — a client card linked to the client's real account (schema.sql
// section 2i). Every remote call for both sides lives here: the coach's
// (invites, the client's data, sent programs, notes, targets, check-ins) and
// the client's (accepting, their coach, what the coach sent them).
//
// The client's own data is read with the SAME fetchers the app uses for your
// own (workoutRemote.js), just with their user id — the database's coach-read
// policies are what let those through, and only while the link is active.
//
// Everything degrades to "no coaching" when schema.sql hasn't been run yet:
// a missing table or function reads as empty, never as an error.
import { supabase } from './supabase'
import {
  fetchRemoteHistory, fetchRemoteBodyweight, fetchRemoteInjuries, fetchRemoteDayAnnotations, fetchRemoteProgramsState,
} from './workoutRemote'
import { fetchProfile } from './profile'
import { getHistory, getBodyweightLog, getInjuries, getDayAnnotations, getProgramsState } from './workoutStore'
import { createClient } from './clients'

// A table or function that isn't in the database yet.
function missing(error) {
  if (!error) return false
  return ['42P01', 'PGRST205', 'PGRST202', '42883'].includes(error.code)
}

// ---- Dev samples -------------------------------------------------------------
// In local development only, two localStorage switches stand in for real
// accounts, so every coaching screen can be worked on signed out:
//   leon_dev_coach  = '1' → the coach area (useCoachAccess), and the FIRST
//                           client card reads as linked, its "training" being
//                           this device's own log, weight and injuries.
//   leon_dev_client = '1' → this device is a linked client of "Leon".
// Production builds drop these branches entirely (import.meta.env.DEV).
function devFlag(key) {
  if (!import.meta.env.DEV) return false
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}
export const devCoachSample = () => devFlag('leon_dev_coach')
export const devClientSample = () => devFlag('leon_dev_client')
const DEV_CLIENT_ID = 'dev-client'
const DEV_COACH_LINK = 'dev-coach-link'
const DEV_INVITE_CODE = 'devcode0000'
const DEV_JOIN_CODE = 'devjoin0000'
const isDevCode = (code) => import.meta.env.DEV && (code === DEV_INVITE_CODE || code === DEV_JOIN_CODE)
const DEV_STORE = 'leon_dev_coaching'

function devRead() {
  try {
    return JSON.parse(localStorage.getItem(DEV_STORE)) || {}
  } catch {
    return {}
  }
}
function devWrite(patch) {
  try {
    localStorage.setItem(DEV_STORE, JSON.stringify({ ...devRead(), ...patch }))
  } catch {
    // storage unavailable — the sample just won't remember
  }
}

// ---- Links (coach side) ----------------------------------------------------

export const INVITE_DAYS = 7

// The dev sample stands in only while signed out — signed in, it's all real.
const devCoach = (coachId) => !coachId && devCoachSample()

// Every link this coach has made, newest first.
export async function fetchCoachLinks(coachId, cards = []) {
  if (devCoach(coachId)) return devLinks(cards)
  if (!supabase || !coachId) return []
  const { data, error } = await supabase
    .from('coach_links')
    .select('*')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false })
  if (error) {
    if (missing(error)) return []
    throw error
  }
  return data || []
}

// The first card reads as linked until the sample is unlinked or re-invited.
function devLinks(cards) {
  const first = cards[0]
  if (!first) return []
  const stored = devRead().link
  if (stored) return [{ ...stored, card_id: first.id }]
  const day = 86400000
  return [{ id: 'dev-link', card_id: first.id, client_id: DEV_CLIENT_ID, status: 'active', code: 'dev', created_at: new Date(Date.now() - 21 * day).toISOString(), accepted_at: new Date(Date.now() - 20 * day).toISOString(), expires_at: new Date(Date.now() - 14 * day).toISOString() }]
}

// The link that matters for one card: an active one, else an open invite.
export function linkForCard(links, cardId, now = Date.now()) {
  const forCard = links.filter((l) => l.card_id === cardId)
  const active = forCard.find((l) => l.status === 'active')
  if (active) return { state: 'linked', link: active }
  const pending = forCard.find((l) => l.status === 'pending' && new Date(l.expires_at).getTime() > now)
  if (pending) return { state: 'pending', link: pending }
  return { state: 'none', link: null }
}

export async function createInvite(coachId, cardId) {
  if (devCoach(coachId)) {
    const link = { id: 'dev-link', card_id: cardId, client_id: null, status: 'pending', code: DEV_INVITE_CODE, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + INVITE_DAYS * 86400000).toISOString() }
    devWrite({ link })
    return link
  }
  const { data, error } = await supabase.rpc('create_coach_invite', { p_card_id: cardId })
  if (error) throw error
  return data
}

// Ends a link from either side, or withdraws an open invite.
export async function endLink(linkId) {
  if (linkId === 'dev-link') {
    devWrite({ link: { ...devRead().link, id: 'dev-link', status: 'ended' } })
    return
  }
  if (linkId === DEV_COACH_LINK) {
    devWrite({ clientEnded: true })
    return
  }
  const { error } = await supabase.rpc('end_coach_link', { p_id: linkId })
  if (error) throw error
}

// The address the client opens. BASE_URL keeps it right on a sub-path host.
export function inviteUrl(code) {
  return `${window.location.origin}${import.meta.env.BASE_URL}join/${code}`
}

// ---- The join link (coach side) ------------------------------------------------
// One permanent link for anyone: whoever accepts gets a new card in the list,
// already linked. Those links' card ids start with JOIN_PREFIX (set by
// accept_coach_invite), and the card itself is made on the coach's side the
// next time the list loads — the client can't write to the coach's list.

const JOIN_PREFIX = 'join-'

// The coach's join code (made on first ask); `reset` swaps in a new one.
export async function fetchJoinCode(coachId, { reset = false } = {}) {
  if (devCoach(coachId)) return DEV_JOIN_CODE
  if (!supabase || !coachId) return null
  const { data, error } = await supabase.rpc('coach_join_code', { p_reset: reset })
  if (error) throw error
  return data
}

// Cards for people who joined through the link and aren't in the list yet.
export function joinedCards(links, clients) {
  const have = new Set(clients.map((c) => c.id))
  return links
    .filter((l) => l.status === 'active' && l.card_id?.startsWith(JOIN_PREFIX) && !have.has(l.card_id))
    .map((l) => {
      const at = l.accepted_at ? new Date(l.accepted_at) : new Date()
      const day = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`
      return { ...createClient(l.client_name || 'New client'), id: l.card_id, startDate: day }
    })
}

// ---- The client's data, as the coach reads it ---------------------------------

// Everything the coach's view of one client needs, in one go. Any piece that
// fails comes back empty rather than sinking the rest.
export async function fetchClientData(clientUserId) {
  if (clientUserId === DEV_CLIENT_ID) {
    const state = getProgramsState()
    return {
      sessions: getHistory(),
      bodyweight: getBodyweightLog(),
      injuries: getInjuries(),
      annotations: getDayAnnotations(),
      program: state.programs.find((p) => p.id === state.activeId) || null,
      profile: { sex: 'male', unit: 'kg', bodyweight: 82, height: 180, birth_year: 1996, goal: 'gain_muscle', experience_level: 'intermediate' },
    }
  }
  const safe = (p, fallback) => p.catch(() => fallback)
  const [sessions, bodyweight, injuries, annotations, programsState, profile] = await Promise.all([
    safe(fetchRemoteHistory(clientUserId), []),
    safe(fetchRemoteBodyweight(clientUserId), []),
    safe(fetchRemoteInjuries(clientUserId), []),
    safe(fetchRemoteDayAnnotations(clientUserId), []),
    safe(fetchRemoteProgramsState(clientUserId, { coach: false }), { programs: [], activeId: null }),
    safe(fetchProfile(clientUserId), null),
  ])
  const program = programsState.programs.find((p) => p.id === programsState.activeId) || null
  return { sessions, bodyweight, injuries, annotations, program, profile }
}

// ---- Sent programs (coach side) ------------------------------------------------
// A program the coach sends lives in coach_programs; the client's app copies it
// into their splits, locked (lib/coachSync.js). Every later edit is pushed to
// the same row.

// { programId: { client_id, make_active, updated_at } } for everything this
// coach has sent.
export async function fetchSentPrograms(coachId) {
  if (devCoach(coachId)) return devRead().sent || {}
  if (!supabase || !coachId) return {}
  const { data, error } = await supabase.from('coach_programs').select('id, client_id, make_active, updated_at').eq('coach_id', coachId)
  if (error) {
    if (missing(error)) return {}
    throw error
  }
  return Object.fromEntries((data || []).map((r) => [r.id, r]))
}

// Sends (or re-sends) a program. `makeActive` only matters the first time the
// client's app sees it.
export async function sendProgram(coachId, clientUserId, program, makeActive = true) {
  const row = { id: program.id, client_id: clientUserId, data: program, make_active: makeActive, updated_at: new Date().toISOString() }
  if (devCoach(coachId)) {
    devWrite({ sent: { ...(devRead().sent || {}), [program.id]: row } })
    return row
  }
  const { error } = await supabase.from('coach_programs').upsert({ ...row, coach_id: coachId })
  if (error) throw error
  return row
}

export async function unsendProgram(coachId, programId) {
  if (devCoach(coachId)) {
    const sent = { ...(devRead().sent || {}) }
    delete sent[programId]
    devWrite({ sent })
    return
  }
  const { error } = await supabase.from('coach_programs').delete().eq('id', programId).eq('coach_id', coachId)
  if (error && !missing(error)) throw error
}

// ---- Notes and targets ------------------------------------------------------------
// What the coach says to a client (coach_notes: a comment on a session, a reply
// to a check-in, or a general note) and the numbers they set (coach_targets).
// The dev samples share one store, so a note written on the coach side shows up
// on the client side.

export const NOTE_MAX = 2000

const devNotes = () => devRead().notes || []

export async function fetchClientNotes(coachId, clientUserId) {
  if (devCoach(coachId)) return devNotes()
  const { data, error } = await supabase
    .from('coach_notes')
    .select('*')
    .eq('coach_id', coachId)
    .eq('client_id', clientUserId)
    .order('created_at', { ascending: false })
  if (error) {
    if (missing(error)) return []
    throw error
  }
  return data || []
}

export async function addCoachNote(coachId, clientUserId, { kind = 'general', targetId = null, body }) {
  const text = String(body || '').trim().slice(0, NOTE_MAX)
  if (!text) return null
  if (devCoach(coachId)) {
    const row = { id: `dev-${Date.now()}`, client_id: clientUserId, kind, target_id: targetId, body: text, created_at: new Date().toISOString(), read_at: null }
    devWrite({ notes: [row, ...devNotes()] })
    return row
  }
  const { data, error } = await supabase
    .from('coach_notes')
    .insert({ coach_id: coachId, client_id: clientUserId, kind, target_id: targetId, body: text })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCoachNote(coachId, id) {
  if (devCoach(coachId)) {
    devWrite({ notes: devNotes().filter((n) => n.id !== id) })
    return
  }
  const { error } = await supabase.from('coach_notes').delete().eq('id', id)
  if (error) throw error
}

// { goalWeight, unit, calories, protein, carbs, fat } — any of them may be blank.
export const TARGET_FIELDS = ['goalWeight', 'calories', 'protein', 'carbs', 'fat']

export async function fetchClientTargets(coachId, clientUserId) {
  if (devCoach(coachId)) return devRead().targets || null
  const { data, error } = await supabase.from('coach_targets').select('data').eq('client_id', clientUserId).maybeSingle()
  if (error) {
    if (missing(error)) return null
    throw error
  }
  return data?.data || null
}

export async function saveClientTargets(coachId, clientUserId, targets) {
  if (devCoach(coachId)) {
    devWrite({ targets })
    return
  }
  const { error } = await supabase
    .from('coach_targets')
    .upsert({ client_id: clientUserId, coach_id: coachId, data: targets, updated_at: new Date().toISOString() })
  if (error) throw error
}

// The client's side: what their coach has said, newest first, and their targets.
export async function fetchMyNotes(userId) {
  if (!userId && devClientSample()) return devNotes()
  if (!supabase || !userId) return []
  const { data, error } = await supabase
    .from('coach_notes')
    .select('*')
    .eq('client_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) {
    if (missing(error)) return []
    throw error
  }
  return data || []
}

export async function markNotesRead(userId, ids) {
  if (!ids.length) return
  if (!userId && devClientSample()) {
    const now = new Date().toISOString()
    devWrite({ notes: devNotes().map((n) => (ids.includes(n.id) ? { ...n, read_at: n.read_at || now } : n)) })
    return
  }
  const { error } = await supabase.rpc('mark_coach_notes_read', { p_ids: ids })
  if (error && !missing(error)) throw error
}

export async function fetchMyTargets(userId) {
  if (!userId && devClientSample()) return devRead().targets || null
  if (!supabase || !userId) return null
  const { data, error } = await supabase.from('coach_targets').select('data').eq('client_id', userId).maybeSingle()
  if (error) {
    if (missing(error)) return null
    throw error
  }
  return data?.data || null
}

// ---- Check-ins ------------------------------------------------------------------
// The client's weekly check-in (lib/checkins.js has the questions). Theirs to
// write; the coach reads them while linked, and replies with a note (kind
// 'checkin', target_id = the check-in's id).

const devCheckins = () => devRead().checkins || []

export async function fetchMyCheckins(userId) {
  if (!userId && devClientSample()) return devCheckins()
  if (!supabase || !userId) return []
  const { data, error } = await supabase
    .from('checkins')
    .select('*')
    .eq('user_id', userId)
    .order('week_start', { ascending: false })
    .limit(12)
  if (error) {
    if (missing(error)) return []
    throw error
  }
  return data || []
}

// One per week: saving again that week updates it.
export async function saveCheckin(userId, week, answers) {
  const now = new Date().toISOString()
  if (!userId && devClientSample()) {
    const prev = devCheckins().find((c) => c.week_start === week)
    const row = { id: prev?.id || `dev-${Date.now()}`, user_id: 'dev-client', week_start: week, answers, created_at: prev?.created_at || now, updated_at: now }
    devWrite({ checkins: [row, ...devCheckins().filter((c) => c.week_start !== week)] })
    return row
  }
  const { data, error } = await supabase
    .from('checkins')
    .upsert({ user_id: userId, week_start: week, answers, updated_at: now }, { onConflict: 'user_id,week_start' })
    .select()
    .single()
  if (error) throw error
  return data
}

// The coach's side: a linked client's check-ins, newest first.
export async function fetchClientCheckins(clientUserId) {
  if (clientUserId === DEV_CLIENT_ID) return devCheckins()
  const { data, error } = await supabase
    .from('checkins')
    .select('*')
    .eq('user_id', clientUserId)
    .order('week_start', { ascending: false })
  if (error) {
    if (missing(error)) return []
    throw error
  }
  return data || []
}

// ---- The client list at a glance -------------------------------------------------
// One line per linked client on /coach: their recent sessions and weigh-ins
// (for the last workout, the no-training flag and the weight trend) and whether
// a check-in is waiting for a reply. Three small batched queries for everyone,
// only the columns those need.

export const SUMMARY_DAYS = 60

// { clientUserId: { sessions: [{date}], bodyweight: [{date, weight, unit}], waitingCheckin: bool } }
export async function fetchClientSummaries(coachId, clientUserIds) {
  const ids = [...new Set(clientUserIds)].filter(Boolean)
  const out = Object.fromEntries(ids.map((id) => [id, { sessions: [], bodyweight: [], waitingCheckin: false }]))
  if (!ids.length) return out
  const since = new Date(Date.now() - SUMMARY_DAYS * 86400000).toISOString()

  if (ids.includes(DEV_CLIENT_ID)) {
    out[DEV_CLIENT_ID] = {
      sessions: getHistory().map((x) => ({ date: x.date })),
      bodyweight: getBodyweightLog(),
      waitingCheckin: devCheckins().some((c) => !devNotes().some((n) => n.kind === 'checkin' && n.target_id === c.id)),
    }
  }
  const real = ids.filter((id) => id !== DEV_CLIENT_ID)
  if (!real.length || !supabase) return out

  const [sessions, weights, checkins, replies] = await Promise.all([
    supabase.from('sessions').select('user_id, date').in('user_id', real).gte('date', since),
    supabase.from('bodyweight_log').select('user_id, date, weight, unit').in('user_id', real).gte('date', since),
    supabase.from('checkins').select('id, user_id, updated_at').in('user_id', real).gte('updated_at', since),
    supabase.from('coach_notes').select('target_id, created_at').eq('coach_id', coachId).eq('kind', 'checkin'),
  ])
  for (const r of sessions.data || []) out[r.user_id]?.sessions.push({ date: new Date(r.date).getTime() })
  for (const r of weights.data || []) out[r.user_id]?.bodyweight.push({ date: new Date(r.date).getTime(), weight: Number(r.weight), unit: r.unit || 'kg' })
  // A check-in is waiting when nothing you've written replies to it since it
  // was last saved.
  const lastReply = new Map()
  for (const n of replies.data || []) {
    const t = Date.parse(n.created_at)
    if (t > (lastReply.get(n.target_id) || 0)) lastReply.set(n.target_id, t)
  }
  for (const c of checkins.data || []) {
    if ((lastReply.get(c.id) || 0) < Date.parse(c.updated_at) && out[c.user_id]) out[c.user_id].waitingCheckin = true
  }
  return out
}

// ---- Invites (client side) ----------------------------------------------------

// What the coach sees once you accept — said on the invite, before you do, and
// again on your profile's Coach section.
export const COACH_SEES = ['Your workout log, past and future', 'Your bodyweight and injuries', 'Your profile and weekly check-ins']

// { state: 'open' | 'linked' | 'used' | 'expired' | 'invalid', coach_name, is_self }
// ('linked': you already accepted this coach's join link.)
export async function inviteInfo(code) {
  if (isDevCode(code)) return { state: 'open', coach_name: 'Leon', is_self: false }
  if (!supabase) return { state: 'invalid' }
  const { data, error } = await supabase.rpc('invite_info', { p_code: code })
  if (error) {
    if (missing(error)) return { state: 'invalid' }
    throw error
  }
  return data || { state: 'invalid' }
}

export async function acceptInvite(code) {
  if (isDevCode(code)) {
    try { localStorage.setItem('leon_dev_client', '1') } catch { /* no storage */ }
    devWrite({ clientEnded: false })
    return
  }
  const { error } = await supabase.rpc('accept_coach_invite', { p_code: code })
  if (error) throw error
}

// Who coaches this account: { link_id, coach_id, coach_name, since } or null.
export async function fetchMyCoach(userId) {
  if (!userId && devClientSample()) {
    return devRead().clientEnded ? null : { link_id: DEV_COACH_LINK, coach_id: 'dev-coach', coach_name: 'Leon', since: new Date(Date.now() - 20 * 86400000).toISOString() }
  }
  if (!supabase || !userId) return null
  const { data, error } = await supabase.rpc('my_coach')
  if (error) {
    if (missing(error)) return null
    throw error
  }
  return data || null
}
