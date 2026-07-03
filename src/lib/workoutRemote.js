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
  }
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
  const { error } = await supabase.from('sessions').insert(toRow(userId, session))
  if (error) throw error
  return session
}

export async function insertRemoteSessions(userId, sessions) {
  if (!sessions.length) return
  const { error } = await supabase.from('sessions').insert(sessions.map((s) => toRow(userId, s)))
  if (error) throw error
}

export async function deleteRemoteSession(id) {
  const { error } = await supabase.from('sessions').delete().eq('id', id)
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
