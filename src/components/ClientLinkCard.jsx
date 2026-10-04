import { useState } from 'react'
import { Link2, Link2Off, Copy, Check, Share2 } from 'lucide-react'
import ConfirmModal from './ConfirmModal'
import { inviteUrl, linkForCard } from '../lib/coach'

const fmt = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

// A client card's link to the client's real account: invite → they accept →
// linked. Sits at the top of the client's page (ClientDetail).
export default function ClientLinkCard({ client, links, invite, unlink }) {
  const { state, link } = linkForCard(links, client.id)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [confirm, setConfirm] = useState(null) // 'unlink' | null
  const name = client.name || 'this client'

  async function run(fn) {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      // The functions don't exist until schema.sql has been run.
      const notSetUp = e?.code === 'PGRST202' || e?.code === '42883'
      setError(notSetUp ? 'Run the latest schema.sql in Supabase first.' : 'That didn’t work — try again.')
    }
    setBusy(false)
  }

  const url = link?.code ? inviteUrl(link.code) : ''

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('Copy failed — select the link instead.')
    }
  }

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  function share() {
    navigator.share({ title: 'Train with Leon', text: 'Link your account so I can coach you:', url }).catch(() => {})
  }

  const btn = 'inline-flex items-center gap-1.5 text-[13px] font-medium text-text-muted hover:text-text-primary bg-white border border-border hover:border-border-hover px-3 py-2 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <section className="bg-white border border-border p-5 sm:p-7">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="font-heading text-xl font-medium text-text-primary mb-1">Their account</h2>
          {state === 'linked' && (
            <p className="text-[13px] text-text-secondary flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" aria-hidden="true" /> Linked since {fmt(link.accepted_at)}
            </p>
          )}
          {state === 'pending' && <p className="text-[13px] text-text-secondary">Invite sent · expires {fmt(link.expires_at)}</p>}
          {state === 'none' && <p className="text-[13px] text-text-muted">Link it to see their training.</p>}
        </div>
        {state === 'none' && (
          <button
            onClick={() => run(() => invite(client.id))}
            disabled={busy}
            className="shrink-0 inline-flex items-center gap-1.5 bg-text-primary text-cream font-medium px-4 py-2.5 border-none cursor-pointer text-[13px] hover:bg-accent-hover transition-colors disabled:opacity-40"
          >
            <Link2 className="w-4 h-4" /> Link account
          </button>
        )}
        {state === 'linked' && (
          <button onClick={() => setConfirm('unlink')} disabled={busy} className={`shrink-0 ${btn}`}>
            <Link2Off className="w-4 h-4" /> Unlink
          </button>
        )}
      </div>

      {state === 'pending' && (
        <div className="mt-4">
          <div className="flex gap-2">
            <input
              readOnly
              value={url}
              onFocus={(e) => e.target.select()}
              aria-label="Invite link"
              className="flex-1 min-w-0 bg-cream border border-border px-3 py-2 text-text-primary text-[12px] outline-none"
            />
            <button onClick={copy} className={`shrink-0 ${btn}`} aria-label="Copy link">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
            </button>
            {canShare && (
              <button onClick={share} className={`shrink-0 ${btn}`} aria-label="Share link">
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">Share</span>
              </button>
            )}
          </div>
          <p className="text-[11px] text-text-light mt-2">Send it to {name}. Works once.</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3">
            <button onClick={() => run(() => invite(client.id))} disabled={busy} className="text-[12px] text-text-muted hover:text-text-primary bg-transparent border-none cursor-pointer p-0 transition-colors">
              New link
            </button>
            <button onClick={() => run(() => unlink(link.id))} disabled={busy} className="text-[12px] text-text-muted hover:text-red-600 bg-transparent border-none cursor-pointer p-0 transition-colors">
              Cancel invite
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-[12px] text-red-600 mt-3">{error}</p>}

      {confirm === 'unlink' && (
        <ConfirmModal
          title={`Unlink ${name}?`}
          message="You stop seeing their training. Programs you sent stay with them."
          confirmLabel="Unlink"
          onConfirm={() => run(() => unlink(link.id))}
          onClose={() => setConfirm(null)}
        />
      )}
    </section>
  )
}
