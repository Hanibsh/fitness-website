// Programs a coach sends land in the client's own split list — pure merge,
// tested by scripts/test-coach.mjs.
//
// A sent program is a copy in the client's list with the same id and a
// `coach: { updatedAt }` stamp. The coach owns its days and name (the client's
// split pages show it locked); the client owns where they are in it — the
// rotation pointer and its history — which a coach update never resets.
//
//   new row            → added (and made active if the coach asked), from day 1
//   newer row          → name/days/settings replaced, place in the rotation kept
//   own split, same id → locked again (a program resent after a re-link)
//   row gone           → the stamp drops and the split is simply theirs
//
// `rows` are the client's visible coach_programs rows: { id, data, make_active,
// updated_at }. Returns the SAME state object when nothing changed, so the
// caller knows whether to save.

const rowTime = (row) => Date.parse(row.updated_at) || 0

// Their copy of the coach's latest version, keeping the client's place: the
// pointer follows the day it was on (by id), else stays in range.
function applyRow(p, row, now) {
  const data = row.data || {}
  const days = Array.isArray(data.days) ? data.days : []
  const current = p.days?.[p.pointer]?.id
  const kept = days.findIndex((d) => d.id === current)
  const pointer = kept !== -1 ? kept : days.length ? (p.pointer || 0) % days.length : 0
  return {
    ...p,
    name: data.name || p.name,
    days,
    settings: data.settings ?? p.settings,
    pointer,
    coach: { updatedAt: rowTime(row) },
    updatedAt: now,
  }
}

function fromRow(row, now) {
  const data = row.data || {}
  return {
    ...data,
    id: row.id,
    name: data.name || 'Split from your coach',
    days: Array.isArray(data.days) ? data.days : [],
    pointer: 0,
    lastAdvancedAt: null,
    advances: [],
    // Their split starts when it reaches them, not when the coach wrote it.
    createdAt: now,
    updatedAt: now,
    coach: { updatedAt: rowTime(row) },
  }
}

export function isLockedProgram(program) {
  return !!program?.coach
}

export function mergeCoachPrograms(state, rows, now = Date.now()) {
  const byId = new Map((rows || []).map((r) => [r.id, r]))
  let changed = false
  let activeId = state.activeId

  const programs = state.programs.map((p) => {
    const row = byId.get(p.id)
    if (row) {
      if (!p.coach || rowTime(row) > (p.coach.updatedAt || 0)) {
        changed = true
        return applyRow(p, row, now)
      }
      return p
    }
    if (p.coach) {
      changed = true
      const { coach, ...own } = p // eslint-disable-line no-unused-vars
      return { ...own, updatedAt: now }
    }
    return p
  })

  for (const row of rows || []) {
    if (programs.some((p) => p.id === row.id)) continue
    programs.push(fromRow(row, now))
    changed = true
    if (row.make_active || !activeId) activeId = row.id
  }

  return changed ? { ...state, programs, activeId } : state
}
