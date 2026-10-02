// The coach's clients — people Leon writes programs for, who may never have an
// account here. Pure data, no storage (see useClientsState for that).
//
// A client is:
//
//   { id, name, profile, extra, injuries, notes, programs, createdAt, updatedAt }
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

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export const CLIENT_NAME_MAX = 60

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
