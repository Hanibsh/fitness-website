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
  // Safety net: if supabase/schema.sql hasn't been re-run yet, a newer column
  // (focus_muscles, goal, experience_level, …) doesn't exist and PostgREST
  // rejects the entire upsert for it. Rather than let that break saving every
  // other field, drop the column PostgREST names and retry — so a profile saved
  // before the newest migration still keeps the fields that do exist. If the
  // error doesn't name a column we know, fall back to the legacy columns. The
  // dropped fields start persisting the moment the migration is applied.
  let row = { ...fields }
  for (let attempt = 0; attempt < 4; attempt++) {
    // Upsert so it works whether or not the row already exists.
    const { error } = await supabase.from('profiles').upsert({ id: userId, ...row })
    if (!error) return
    const msg = error.message || ''
    const missingColumn =
      error.code === 'PGRST204' || error.code === '42703' || /column .*(does not exist|schema cache)/i.test(msg)
    if (!missingColumn) throw error
    const named = Object.keys(row).find((k) => msg.includes(`'${k}'`) || msg.includes(`"${k}"`) || msg.includes(`.${k} `))
    if (!named) break
    delete row[named]
  }

  const legacy = Object.fromEntries(Object.entries(fields).filter(([k]) => LEGACY_PROFILE_COLUMNS.includes(k)))
  const { error: retryError } = await supabase.from('profiles').upsert({ id: userId, ...legacy })
  if (retryError) throw retryError
}
