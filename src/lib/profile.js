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

export async function saveProfile(userId, fields) {
  // Upsert so it works whether or not the row already exists.
  const { error } = await supabase.from('profiles').upsert({ id: userId, ...fields })
  if (error) throw error
}
