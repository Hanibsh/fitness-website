// The split wizard's picks and preview edits, kept on this device so a reload —
// pull to refresh, the Refresh button, or the phone closing the installed app
// in the background — doesn't lose a half-built split. One draft per client
// (or per account for your own split), a day at most, gone once the split is
// saved. Best effort: storage that's full or blocked just means no draft.

const PREFIX = 'leon_wizard_draft:'
const MAX_AGE_MS = 24 * 60 * 60 * 1000
// Bumped when the draft's shape changes, so an old one is dropped, not misread.
const SHAPE = 1

export function readWizardDraft(who) {
  try {
    const d = JSON.parse(localStorage.getItem(PREFIX + who) || 'null')
    if (!d || d.v !== SHAPE || !(Date.now() - d.at < MAX_AGE_MS)) return null
    return d
  } catch {
    return null
  }
}

export function saveWizardDraft(who, draft) {
  try {
    localStorage.setItem(PREFIX + who, JSON.stringify({ ...draft, v: SHAPE, at: Date.now() }))
  } catch {
    // full or blocked — the wizard still works, it just won't survive a reload
  }
}

export function clearWizardDraft(who) {
  try {
    localStorage.removeItem(PREFIX + who)
  } catch {
    // nothing to clear
  }
}
