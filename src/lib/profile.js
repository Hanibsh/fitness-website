// User profile: bodyweight, sex, unit preference, and the data-sharing consent
// flag. One row per user in the `profiles` table (auto-created on signup).
import { supabase } from './supabase'

export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) {
    if (error.code === 'PGRST116') return null // no row yet
    throw error
  }
  return data
}

// Columns that have existed since the first release. Used as the fallback set if
// the DB hasn't had the newer training-profile columns added yet (see below).
const LEGACY_PROFILE_COLUMNS = ['display_name', 'sex', 'bodyweight', 'unit', 'share_data']

export async function saveProfile(userId, fields) {
  // Upsert so it works whether or not the row already exists.
  const { error } = await supabase.from('profiles').upsert({ id: userId, ...fields })
  if (!error) return

  // Safety net: if supabase/schema.sql hasn't been re-run yet, the newer
  // training-profile columns (goal, experience_level, height, …) don't exist and
  // PostgREST rejects the entire upsert for the unknown column. Rather than let
  // that break saving the long-standing fields too, retry with just the legacy
  // columns. The new fields start persisting the moment the migration is applied.
  const msg = error.message || ''
  const missingColumn =
    error.code === 'PGRST204' || error.code === '42703' || /column .*(does not exist|schema cache)/i.test(msg)
  if (!missingColumn) throw error

  const legacy = Object.fromEntries(Object.entries(fields).filter(([k]) => LEGACY_PROFILE_COLUMNS.includes(k)))
  const { error: retryError } = await supabase.from('profiles').upsert({ id: userId, ...legacy })
  if (retryError) throw retryError
}
