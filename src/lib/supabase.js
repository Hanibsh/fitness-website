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
export const supabase = url && anonKey ? createClient(url, anonKey) : null

export const isSupabaseConfigured = () => supabase !== null
