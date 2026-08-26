import { useState } from 'react'
import Modal from './Modal'
import { validateNickname, NICKNAME_MAX } from '../lib/nickname'

// Small editor for the optional display nickname. Validates + runs the
// inappropriate-name filter locally, then hands the cleaned value to onSave
// (which persists it). The parent closes the modal on success.
export default function NicknameModal({ current = '', onSave, onClose }) {
  const [value, setValue] = useState(current)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    const res = validateNickname(value)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setError('')
    setSaving(true)
    try {
      await onSave(res.value)
    } catch {
      setError('Could not save. Please try again.')
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-sm">
      <div className="p-7">
        <h3 className="font-heading text-xl font-medium text-text-primary mb-1">Your nickname</h3>
        <p className="text-[13px] text-text-muted mb-5">
          Optional — this is just what the dashboard greets you by. Leave it blank to use your email name.
        </p>

        <input
          type="text"
          value={value}
          autoFocus
          maxLength={NICKNAME_MAX}
          onChange={(e) => { setValue(e.target.value); setError('') }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !saving) save() }}
          placeholder="e.g. Leo"
          aria-label="Nickname"
          className="w-full bg-cream border border-border px-4 py-3 text-text-primary text-[14px] outline-none focus:border-text-primary"
        />
        <div className="flex justify-between items-center mt-1.5 min-h-[16px]">
          {error ? <span className="text-[12px] text-red-600">{error}</span> : <span />}
          <span className="text-[11px] text-text-light">{value.length}/{NICKNAME_MAX}</span>
        </div>

        <div className="flex gap-3 mt-5">
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 bg-text-primary text-cream font-medium py-3 border-none cursor-pointer text-[14px] hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={onClose}
            className="px-5 text-text-muted hover:text-text-primary bg-white border border-border hover:border-border-hover cursor-pointer text-[13px] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  )
}
