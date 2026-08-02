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
    // When training actually ran. Null on anything logged before these columns
    // existed, or on a session whose window wasn't plausible.
    startedAt: row.started_at ? new Date(row.started_at).getTime() : null,
    endedAt: row.ended_at ? new Date(row.ended_at).getTime() : null,
    durationMs: row.duration_ms ?? null,
  }
}

function toRow(userId, session) {
  return {
    id: session.id,
    user_id: userId,
    // Noon-pinned calendar day — the app buckets by this and only this. The
    // clock times below never feed day bucketing.
    date: new Date(session.date).toISOString(),
    name: session.name || null,
    unit: session.unit || 'kg',
    exercises: session.exercises || [],
    started_at: session.startedAt ? new Date(session.startedAt).toISOString() : null,
    ended_at: session.endedAt ? new Date(session.endedAt).toISOString() : null,
    duration_ms: session.durationMs ?? null,
  }
}

// True when a write failed only because one of the timing columns isn't in the
// schema yet (schema.sql hasn't been re-run against this database). Lets us
// retry without them so saving a workout never breaks on an older database —
// you lose the timing, not the session.
const TIMING_COLUMNS = ['duration_ms', 'started_at', 'ended_at']

function missingTimingColumn(error) {
  if (!error) return false
  return (
    error.code === 'PGRST204' ||
    (typeof error.message === 'string' && TIMING_COLUMNS.some((c) => error.message.includes(c)))
  )
}

function stripTiming(row) {
  const { duration_ms, started_at, ended_at, ...rest } = row // eslint-disable-line no-unused-vars
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
  if (missingTimingColumn(error)) {
    ;({ error } = await supabase.from('sessions').insert(stripTiming(row)))
  }
  if (error) throw error
  return session
}

export async function insertRemoteSessions(userId, sessions) {
  if (!sessions.length) return
  const rows = sessions.map((s) => toRow(userId, s))
  let { error } = await supabase.from('sessions').insert(rows)
  if (missingTimingColumn(error)) {
    ;({ error } = await supabase.from('sessions').insert(rows.map(stripTiming)))
  }
  if (error) throw error
}

export async function deleteRemoteSession(id) {
  const { error } = await supabase.from('sessions').delete().eq('id', id)
  if (error) throw error
}

// Move a saved session to another day. Only the date changes; RLS keeps this
// scoped to the user's own rows.
export async function updateRemoteSessionDate(id, date) {
  const { error } = await supabase
    .from('sessions')
    .update({ date: new Date(date).toISOString() })
    .eq('id', id)
  if (error) throw error
}

// Correct when a saved session started and ended. Only the timing columns
// change — `date` stays exactly where it is, so a time edit can never move a
// workout to another day. Degrades to a no-op on a database that hasn't run
// the migration, matching the insert/update paths above.
export async function updateRemoteSessionTimes(id, startedAt, endedAt, durationMs) {
  const patch = {
    started_at: startedAt ? new Date(startedAt).toISOString() : null,
    ended_at: endedAt ? new Date(endedAt).toISOString() : null,
    duration_ms: durationMs ?? null,
  }
  const { error } = await supabase.from('sessions').update(patch).eq('id', id)
  if (error && !missingTimingColumn(error)) throw error
}

// Overwrite a saved session in place (editing a past workout). Updates the
// existing row rather than inserting; RLS scopes it to the user's own rows.
export async function updateRemoteSession(userId, session) {
  const row = toRow(userId, session)
  let { error } = await supabase.from('sessions').update(row).eq('id', session.id)
  if (missingTimingColumn(error)) {
    ;({ error } = await supabase.from('sessions').update(stripTiming(row)).eq('id', session.id))
  }
  if (error) throw error
  return session
}

// ---- Training programs (routines) ------------------------------------------
// A list of routines + which one is active, stored as one jsonb blob in the
// `programs` table (one row per user, keyed by user_id — same table/column as
// before multi-routine support, just a richer shape inside it, so no schema
// migration was needed). If the table doesn't exist yet, reads return an
// empty state and saves no-op so the app degrades gracefully.
function missingProgramsTable(error) {
  if (!error) return false
  return error.code === '42P01' || (typeof error.message === 'string' && /relation .*programs.* does not exist/i.test(error.message))
}

// A row saved before multi-routine support holds a single program directly
// (has `.days`) rather than `{programs, activeId}`. Wrap it so it survives as
// that user's first (active) routine.
function migrateLegacyProgramShape(data) {
  if (!data) return { programs: [], activeId: null }
  if (Array.isArray(data.programs)) return data
  if (data.days) return { programs: [data], activeId: data.id }
  return { programs: [], activeId: null }
}

export async function fetchRemoteProgramsState(userId) {
  const { data, error } = await supabase.from('programs').select('data').eq('user_id', userId).maybeSingle()
  if (error) {
    if (error.code === 'PGRST116' || missingProgramsTable(error)) return { programs: [], activeId: null } // no row / no table yet
    throw error
  }
  return migrateLegacyProgramShape(data?.data)
}

export async function upsertRemoteProgramsState(userId, state) {
  const { error } = await supabase.from('programs').upsert({ user_id: userId, data: state, updated_at: new Date().toISOString() })
  if (error && !missingProgramsTable(error)) throw error
  return state
}

// The active routine, or null if none exists yet (same shape callers expect
// from before multi-routine support).
export async function fetchRemoteProgram(userId) {
  const state = await fetchRemoteProgramsState(userId)
  return state.programs.find((p) => p.id === state.activeId) || null
}

// Upsert one routine into the remote list (read-modify-write over the single
// row). Preserves the current active id unless there isn't one yet.
export async function upsertRemoteProgram(userId, program) {
  const state = await fetchRemoteProgramsState(userId)
  const idx = state.programs.findIndex((p) => p.id === program.id)
  const programs = idx === -1 ? [...state.programs, program] : state.programs.map((p, i) => (i === idx ? program : p))
  const activeId = state.activeId || program.id
  return upsertRemoteProgramsState(userId, { programs, activeId })
}

export async function setActiveRemoteProgram(userId, id) {
  const state = await fetchRemoteProgramsState(userId)
  return upsertRemoteProgramsState(userId, { ...state, activeId: id })
}

export async function deleteRemoteProgramById(userId, id) {
  const state = await fetchRemoteProgramsState(userId)
  const programs = state.programs.filter((p) => p.id !== id)
  const activeId = state.activeId === id ? (programs[0]?.id || null) : state.activeId
  return upsertRemoteProgramsState(userId, { programs, activeId })
}

// ---- Specialization blocks -------------------------------------------------
// One row per user, the whole list as a jsonb array. Degrades gracefully if the
// `blocks` table migration hasn't been run (reads null, saves no-op).
function missingBlocksTable(error) {
  if (!error) return false
  return error.code === '42P01' || (typeof error.message === 'string' && /relation .*blocks.* does not exist/i.test(error.message))
}

export async function fetchRemoteBlocks(userId) {
  const { data, error } = await supabase.from('blocks').select('data').eq('user_id', userId).maybeSingle()
  if (error) {
    if (error.code === 'PGRST116' || missingBlocksTable(error)) return null
    throw error
  }
  return Array.isArray(data?.data) ? data.data : null
}

export async function upsertRemoteBlocks(userId, blocks) {
  const { error } = await supabase.from('blocks').upsert({ user_id: userId, data: blocks, updated_at: new Date().toISOString() })
  if (error && !missingBlocksTable(error)) throw error
  return blocks
}

// ---- Exercise notes ---------------------------------------------------------
// One row per user, the whole {movementKey: note} map as a jsonb object — same
// shape as the local `leon_exercise_notes` map, so syncing it is a straight
// read/replace rather than a per-note diff. Degrades gracefully if the
// `exercise_notes` table migration hasn't been run yet.
function missingExerciseNotesTable(error) {
  if (!error) return false
  return error.code === '42P01' || (typeof error.message === 'string' && /relation .*exercise_notes.* does not exist/i.test(error.message))
}

export async function fetchRemoteExerciseNotes(userId) {
  const { data, error } = await supabase.from('exercise_notes').select('data').eq('user_id', userId).maybeSingle()
  if (error) {
    if (error.code === 'PGRST116' || missingExerciseNotesTable(error)) return {}
    throw error
  }
  return data?.data && typeof data.data === 'object' ? data.data : {}
}

export async function upsertRemoteExerciseNotes(userId, notes) {
  const { error } = await supabase.from('exercise_notes').upsert({ user_id: userId, data: notes, updated_at: new Date().toISOString() })
  if (error && !missingExerciseNotesTable(error)) throw error
  return notes
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

// ---- Day annotations --------------------------------------------------------
// Mirrors the localStorage day-annotation functions but talks to the
// `day_annotations` table. Degrades gracefully if the migration hasn't been
// run yet (reads empty, writes throw so the caller falls back to local —
// same pattern as blocks).
function missingDayAnnotationsTable(error) {
  if (!error) return false
  return error.code === '42P01' || (typeof error.message === 'string' && /relation .*day_annotations.* does not exist/i.test(error.message))
}

function dayLogFromRow(row) {
  return { id: row.id, date: new Date(row.date).getTime(), reason: row.reason, note: row.note || '' }
}

function dayLogToRow(userId, entry) {
  return {
    id: entry.id,
    user_id: userId,
    date: new Date(entry.date).toISOString(),
    reason: entry.reason,
    note: entry.note || null,
  }
}

export async function fetchRemoteDayAnnotations(userId) {
  const { data, error } = await supabase
    .from('day_annotations')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
  if (error) {
    if (missingDayAnnotationsTable(error)) return []
    throw error
  }
  return (data || []).map(dayLogFromRow)
}

export async function upsertRemoteDayAnnotation(userId, entry) {
  const { error } = await supabase.from('day_annotations').upsert(dayLogToRow(userId, entry))
  if (error) throw error
  return entry
}

export async function deleteRemoteDayAnnotation(id) {
  const { error } = await supabase.from('day_annotations').delete().eq('id', id)
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
