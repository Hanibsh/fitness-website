import { createClient } from '@supabase/supabase-js'

// These come from environment variables:
//  - locally: .env.local (git-ignored)
//  - production: the Vercel project's Environment Variables
// The anon key is safe to ship in the browser — it's public by design, and
// row-level security in the database is what actually protects the data.
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Null until the project is wired up, so the site keeps running fully
// anonymously (localStorage only) and nothing breaks before Supabase exists.
// Wrapped in try/catch so a misconfigured URL/key just disables accounts
// gracefully instead of crashing the whole app to a blank screen.
let client = null
if (url && anonKey) {
  try {
    client = createClient(url, anonKey)
  } catch (e) {
    console.error('Supabase not initialized (check VITE_SUPABASE_URL / _ANON_KEY):', e?.message || e)
  }
}

export const supabase = client

export const isSupabaseConfigured = () => supabase !== null
