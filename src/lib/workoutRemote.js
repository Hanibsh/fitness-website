// Remote workout history — the Supabase side of the store.
// Used when a user is logged in; mirrors the localStorage functions in
// workoutStore.js but talks to the `sessions` table. Row-level security means
// each user only ever touches their own rows.
import { supabase } from './supabase'

// DB row <-> app session shape (dates are ms in the app, timestamptz in the DB).
function fromRow(row) {
  return {
    id: row.id,
    date: new Date(row.date).getTime(),
    name: row.name || '',
    unit: row.unit || 'kg',
    exercises: Array.isArray(row.exercises) ? row.exercises : [],
    durationMs: row.duration_ms ?? null,
  }
}

function toRow(userId, session) {
  return {
    id: session.id,
    user_id: userId,
    date: new Date(session.date).toISOString(),
    name: session.name || null,
    unit: session.unit || 'kg',
    exercises: session.exercises || [],
    duration_ms: session.durationMs ?? null,
  }
}

// True when an insert failed only because the `duration_ms` column isn't in
// the schema yet (the migration hasn't been run). Lets us retry without it so
// saving never breaks on older databases.
function missingDurationColumn(error) {
  if (!error) return false
  return error.code === 'PGRST204' || (typeof error.message === 'string' && error.message.includes('duration_ms'))
}

function stripDuration(row) {
  const { duration_ms, ...rest } = row // eslint-disable-line no-unused-vars
  return rest
}

export async function fetchRemoteHistory(userId) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
  if (error) throw error
  return (data || []).map(fromRow)
}

export async function insertRemoteSession(userId, session) {
  const row = toRow(userId, session)
  let { error } = await supabase.from('sessions').insert(row)
  if (missingDurationColumn(error)) {
    ;({ error } = await supabase.from('sessions').insert(stripDuration(row)))
  }
  if (error) throw error
  return session
}

export async function insertRemoteSessions(userId, sessions) {
  if (!sessions.length) return
  const rows = sessions.map((s) => toRow(userId, s))
  let { error } = await supabase.from('sessions').insert(rows)
  if (missingDurationColumn(error)) {
    ;({ error } = await supabase.from('sessions').insert(rows.map(stripDuration)))
  }
  if (error) throw error
}

export async function deleteRemoteSession(id) {
  const { error } = await supabase.from('sessions').delete().eq('id', id)
  if (error) throw error
}

// ---- Bodyweight log --------------------------------------------------------
// Mirrors the localStorage bodyweight functions but talks to the
// `bodyweight_log` table. RLS keeps each user to their own rows.
function bwFromRow(row) {
  return { id: row.id, date: new Date(row.date).getTime(), weight: Number(row.weight), unit: row.unit || 'kg' }
}

function bwToRow(userId, entry) {
  return {
    id: entry.id,
    user_id: userId,
    date: new Date(entry.date).toISOString(),
    weight: entry.weight,
    unit: entry.unit || 'kg',
  }
}

export async function fetchRemoteBodyweight(userId) {
  const { data, error } = await supabase
    .from('bodyweight_log')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
  if (error) throw error
  return (data || []).map(bwFromRow)
}

export async function upsertRemoteBodyweight(userId, entry) {
  const { error } = await supabase.from('bodyweight_log').upsert(bwToRow(userId, entry))
  if (error) throw error
  return entry
}

export async function deleteRemoteBodyweight(id) {
  const { error } = await supabase.from('bodyweight_log').delete().eq('id', id)
  if (error) throw error
}

// Anonymized contribution to the shared strength dataset. No user id is
// attached (the table has no such column) — RLS lets any signed-in user insert
// but no one read it back through the app; you read it in the dashboard.
export async function insertSharedLifts(rows) {
  if (!rows.length) return
  const { error } = await supabase.from('shared_lifts').insert(rows)
  if (error) throw error
}

// Guests can't write to the table directly — they go through the Turnstile-
// protected edge function instead.
const CONTRIBUTE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contribute-lifts`

export async function submitGuestLifts(token, lifts, hp = '') {
  if (!lifts.length) return
  await fetch(CONTRIBUTE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
    body: JSON.stringify({ token, hp, lifts }),
  })
}
