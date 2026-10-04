// The coach's clients — people Leon writes programs for, who may never have an
// account here. Pure data, no storage (see useClientsState for that).
//
// A client is:
//
//   { id, name, profile, extra, injuries, notes, programs, status, startDate,
//     renewalDate, createdAt, updatedAt }
//
// `status` (active | paused | ended) and the two dates ('YYYY-MM-DD' or '')
// are the coach's own bookkeeping — never exported, never seen by the client.
//
// `profile` uses the SAME keys as a profiles row (sex, birth_year, unit, height,
// bodyweight, …) so everything that reads a profile — the split generator, the
// export — reads a client's without a translation layer. `extra` is custom
// "Label: value" lines for anything the profile has no field for. `injuries`
// is free text: it's said in the export, but doesn't steer the generator (a
// client's injuries aren't the structured records yours are). `notes` go under
// "Notes from Leon". `programs` are ordinary split programs (lib/program.js),
// kept apart from your own so none of them can become your active split.

import { emptyProgram } from './program'
import { cleanFocus } from './profileFields'
import { convertMassText, convertLengthText } from './units'

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export const CLIENT_NAME_MAX = 60

export const CLIENT_STATUSES = [
  { id: 'active', label: 'Active' },
  { id: 'paused', label: 'Paused' },
  { id: 'ended', label: 'Ended' },
]

// Cards made before statuses existed read as active.
export function clientStatus(client) {
  return CLIENT_STATUSES.some((s) => s.id === client?.status) ? client.status : 'active'
}

export function createClient(name = '') {
  const now = Date.now()
  return {
    id: newId(),
    name: name.trim().slice(0, CLIENT_NAME_MAX),
    profile: { unit: 'kg' },
    extra: [],
    injuries: '',
    notes: '',
    programs: [],
    createdAt: now,
    updatedAt: now,
  }
}

// A stored client, made safe to render: a record written by an older build, or
// half-written by a failed sync, never breaks a page.
export function normalizeClient(c) {
  return {
    ...createClient(),
    ...c,
    profile: c?.profile && typeof c.profile === 'object' ? c.profile : { unit: 'kg' },
    extra: Array.isArray(c?.extra) ? c.extra : [],
    programs: Array.isArray(c?.programs) ? c.programs : [],
  }
}

// A blank program for this client, named for them so its export title already
// says who it's for.
export function blankClientProgram(client) {
  return emptyProgram(client?.name ? `${client.name}'s split` : 'New split')
}

// Edits to one client's programs list — the client-side twins of what
// useProgramsState does for your own.
export function withProgram(client, program) {
  const idx = client.programs.findIndex((p) => p.id === program.id)
  const programs = idx === -1 ? [...client.programs, program] : client.programs.map((p, i) => (i === idx ? program : p))
  return { ...client, programs }
}

export function withoutProgram(client, programId) {
  return { ...client, programs: client.programs.filter((p) => p.id !== programId) }
}

// ---- A linked client's own profile -------------------------------------------

// The profile fields a linked client's account can fill in on their card.
const ACCOUNT_KEYS = [
  'sex', 'birth_year', 'training_start_year', 'height', 'bodyweight', 'body_fat', 'daily_steps',
  'wrist', 'ankle', 'goal', 'experience_level', 'equipment', 'diet', 'focus_muscles',
]
const MASS_KEYS = ['bodyweight']
const LENGTH_KEYS = ['height', 'wrist', 'ankle']

const filled = (v) => (Array.isArray(v) ? v.length > 0 : v != null && v !== '')

// The card's profile with the client's account laid over it: every field they
// filled in themselves wins, and what they left blank keeps what the coach
// typed. Their unit wins too, so the coach's own measurements are converted
// into it. `fromAccount` is the set of fields that came from their account
// (shown locked on the card). Numbers become text, as the card's fields hold them.
export function withAccountProfile(cardProfile = {}, account) {
  if (!account) return { profile: cardProfile, fromAccount: new Set() }
  const unit = account.unit === 'lbs' ? 'lbs' : 'kg'
  const profile = { ...cardProfile, unit }
  if ((cardProfile.unit === 'lbs' ? 'lbs' : 'kg') !== unit) {
    const toImperial = unit === 'lbs'
    for (const k of MASS_KEYS) profile[k] = convertMassText(profile[k], toImperial)
    for (const k of LENGTH_KEYS) profile[k] = convertLengthText(profile[k], toImperial)
  }
  const fromAccount = new Set()
  for (const k of ACCOUNT_KEYS) {
    const v = account[k]
    if (!filled(v)) continue
    profile[k] = k === 'focus_muscles' ? cleanFocus(v) : typeof v === 'number' ? String(v) : v
    fromAccount.add(k)
  }
  return { profile, fromAccount }
}

// Whether two profiles say the same thing (focus lists compared by value).
export function sameProfile(a = {}, b = {}) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of keys) {
    const x = a[k]
    const y = b[k]
    if (Array.isArray(x) || Array.isArray(y)) {
      if (JSON.stringify(x || []) !== JSON.stringify(y || [])) return false
    } else if ((x ?? '') !== (y ?? '')) return false
  }
  return true
}
