// Edge Function: contribute-lifts
//
// The ONLY way anonymous guests can add rows to `shared_lifts`. The table
// itself rejects public writes; this function (running with the service role)
// is the single controlled door, layered with anti-spam:
//   1. Honeypot — a hidden field bots fill and humans don't.
//   2. Cloudflare Turnstile — verifies a real browser/human.
//   3. Validation — every value must be sane and in range.
//   4. Rate limiting — capped submissions per IP per hour.
//
// Deploy with "Verify JWT" OFF (guests aren't logged in). Set the
// TURNSTILE_SECRET function secret; SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
// are injected automatically.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TURNSTILE_SECRET = Deno.env.get('TURNSTILE_SECRET') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const RATE_LIMIT_PER_HOUR = 20
const MAX_LIFTS_PER_SUBMISSION = 60

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const form = new FormData()
  form.append('secret', TURNSTILE_SECRET)
  form.append('response', token)
  if (ip) form.append('remoteip', ip)
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form })
    const data = await res.json()
    return !!data.success
  } catch {
    return false
  }
}

function validLift(l: Record<string, unknown>): boolean {
  if (typeof l.exercise !== 'string') return false
  const ex = l.exercise.trim()
  if (ex.length < 1 || ex.length > 60) return false
  const reps = Number(l.reps)
  if (!Number.isFinite(reps) || reps < 1 || reps > 100) return false
  if (l.weight != null) { const w = Number(l.weight); if (!Number.isFinite(w) || w < 0 || w > 1000) return false }
  if (l.rir != null) { const r = Number(l.rir); if (!Number.isFinite(r) || r < 0 || r > 10) return false }
  if (l.bodyweight != null) { const b = Number(l.bodyweight); if (!Number.isFinite(b) || b < 20 || b > 400) return false }
  if (l.sex != null && l.sex !== 'male' && l.sex !== 'female') return false
  if (l.logged_at != null && Number.isNaN(new Date(l.logged_at as string).getTime())) return false
  return true
}

function cleanLift(l: Record<string, unknown>) {
  return {
    exercise: String(l.exercise).trim().slice(0, 60),
    weight: l.weight == null ? null : Number(l.weight),
    reps: Number(l.reps),
    rir: l.rir == null ? null : Number(l.rir),
    unit: 'kg',
    bodyweight: l.bodyweight == null ? null : Number(l.bodyweight),
    sex: l.sex === 'male' || l.sex === 'female' ? l.sex : null,
    // validLift guarantees logged_at parses; keep the fallback for safety.
    logged_at:
      l.logged_at && !Number.isNaN(new Date(l.logged_at as string).getTime())
        ? new Date(l.logged_at as string).toISOString()
        : new Date().toISOString(),
  }
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Bad request' })
  }

  // 1. Honeypot — silently accept (don't tip off bots) but store nothing.
  if (body.hp) return json(200, { inserted: 0 })

  // 2. Turnstile
  const ip = req.headers.get('cf-connecting-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim()
  if (typeof body.token !== 'string' || !(await verifyTurnstile(body.token, ip))) {
    return json(403, { error: 'Verification failed' })
  }

  // 3. Validation
  const lifts = Array.isArray(body.lifts) ? (body.lifts as Record<string, unknown>[]) : []
  if (lifts.length < 1 || lifts.length > MAX_LIFTS_PER_SUBMISSION) return json(400, { error: 'Invalid payload' })
  if (!lifts.every(validLift)) return json(400, { error: 'Invalid lift data' })

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

  // 4. Rate limit by hashed IP
  const ipHash = await sha256(`${ip}|leon-fitness`)
  const since = new Date(Date.now() - 3_600_000).toISOString()
  const { count } = await admin
    .from('submission_log')
    .select('*', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', since)
  if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) return json(429, { error: 'Too many submissions — try again later' })

  await admin.from('submission_log').insert({ ip_hash: ipHash })

  const rows = lifts.map(cleanLift)
  const { error } = await admin.from('shared_lifts').insert(rows)
  if (error) return json(500, { error: 'Could not save' })

  return json(200, { inserted: rows.length })
})
