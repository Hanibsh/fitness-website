import { useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { accountName, listAccounts } from '../lib/accounts'
import Modal from './Modal'

function currentFirst(rows, id) {
  return [...rows.filter((r) => r.id === id), ...rows.filter((r) => r.id !== id)]
}

// Every account signed in on this device (lib/accounts.js). Tapping one swaps
// to it; "Add account" opens the normal login and the new one joins the list.
export default function SwitchAccountModal({ onClose, onAdd }) {
  const { user, switchAccount } = useAuth()
  const [accounts, setAccounts] = useState(() => currentFirst(listAccounts(), user?.id))
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')

  async function pick(id) {
    if (busy || id === user?.id) return
    setError('')
    setBusy(id)
    try {
      await switchAccount(id)
    } catch {
      setAccounts(currentFirst(listAccounts(), user?.id))
      setError('That account was logged out. Add it again.')
      setBusy(null)
    }
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-sm">
      <div className="p-7">
        <h2 className="font-heading text-2xl font-medium text-text-primary mb-5">Switch account</h2>

        <ul className="border border-border divide-y divide-border mb-4">
          {accounts.map((a) => {
            const current = a.id === user?.id
            return (
              <li key={a.id}>
                <button
                  onClick={() => pick(a.id)}
                  disabled={!!busy}
                  aria-current={current ? 'true' : undefined}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left bg-white border-none transition-colors disabled:opacity-60 ${
                    current ? 'cursor-default' : 'cursor-pointer hover:bg-cream'
                  }`}
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14px] text-text-primary font-medium truncate">{accountName(a)}</span>
                    <span className="block text-[12px] text-text-muted truncate">{a.email}</span>
                  </span>
                  {current && <Check className="w-4 h-4 text-text-primary shrink-0" aria-label="Current" />}
                  {busy === a.id && <span className="text-[12px] text-text-muted shrink-0">Switching…</span>}
                </button>
              </li>
            )
          })}
        </ul>

        {error && <p className="text-[13px] text-red-600 mb-4">{error}</p>}

        <button
          onClick={onAdd}
          disabled={!!busy}
          className="w-full inline-flex items-center justify-center gap-2 bg-white border border-border text-text-primary font-medium py-3 cursor-pointer text-[13px] hover:border-border-hover transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Add account
        </button>
      </div>
    </Modal>
  )
}
