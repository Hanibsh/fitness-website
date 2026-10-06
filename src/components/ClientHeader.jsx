import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Link2, Link2Off, Copy, Check, Share2, MessageCircle, Activity } from 'lucide-react'
import ConfirmModal from './ConfirmModal'
import { inviteUrl, linkForCard } from '../lib/coach'
import { CLIENT_NAME_MAX, CLIENT_STATUSES, clientStatus } from '../lib/clients'

const fmt = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

// The top of a client's page (ClientDetail): their name, the link to their
// real account (invite → they accept → linked) with the ways into it as small
// icon buttons, and your own bookkeeping — status and dates, never exported.
export default function ClientHeader({ client, edit, links, invite, unlink, unread = 0 }) {
  const { state, link } = linkForCard(links, client.id)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [confirm, setConfirm] = useState(false)
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
  const square = 'relative w-9 h-9 shrink-0 inline-flex items-center justify-center bg-white border border-border hover:border-border-hover text-text-muted hover:text-text-primary cursor-pointer no-underline transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
  const labelCls = 'text-[11px] text-text-muted uppercase tracking-wider block mb-2'
  const inputCls = 'w-full bg-cream border border-border px-3 py-2.5 text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors'

  return (
    <section className="bg-white border border-border p-5 sm:p-7">
      <input
        value={client.name}
        maxLength={CLIENT_NAME_MAX}
        onChange={(e) => edit((c) => ({ ...c, name: e.target.value }))}
        placeholder="Their name"
        aria-label="Client name"
        className="w-full bg-transparent border-b border-transparent hover:border-border focus:border-text-primary px-0 py-1 font-heading text-2xl font-medium text-text-primary outline-none transition-colors"
      />

      <div className="flex items-center justify-between gap-x-3 gap-y-2 flex-wrap mt-2">
        {state === 'linked' && (
          <p className="text-[13px] text-text-secondary flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" aria-hidden="true" /> Linked since {fmt(link.accepted_at)}
          </p>
        )}
        {state === 'pending' && <p className="text-[13px] text-text-secondary">Invite sent · expires {fmt(link.expires_at)}</p>}
        {state === 'none' && <p className="text-[13px] text-text-muted">Not linked</p>}

        {state === 'linked' && (
          <div className="flex gap-1.5">
            <Link
              to={`/coach/${client.id}/messages`}
              aria-label={unread ? `Messages, ${unread} unread` : 'Messages'}
              title="Messages"
              className={square}
            >
              <MessageCircle className="w-4 h-4" />
              {unread > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-text-primary text-cream text-[9px] font-semibold flex items-center justify-center">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
            <Link to={`/coach/${client.id}/training`} aria-label="Their training" title="Their training" className={square}>
              <Activity className="w-4 h-4" />
            </Link>
            <button onClick={() => setConfirm(true)} disabled={busy} aria-label="Unlink account" title="Unlink" className={`${square} hover:text-red-600`}>
              <Link2Off className="w-4 h-4" />
            </button>
          </div>
        )}
        {state === 'none' && (
          <button
            onClick={() => run(() => invite(client.id))}
            disabled={busy}
            className="shrink-0 inline-flex items-center gap-1.5 bg-text-primary text-cream font-medium px-4 py-2.5 border-none cursor-pointer text-[13px] hover:bg-accent-hover transition-colors disabled:opacity-40"
          >
            <Link2 className="w-4 h-4" /> Link account
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

      {/* Your own bookkeeping. Stacked on a phone: a date field half of 320px
          clips its own text. */}
      <div className="border-t border-border mt-5 pt-5 grid grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-[auto_1fr_1fr] gap-4">
        <div className="min-[400px]:col-span-2 sm:col-span-1">
          <span className={labelCls}>Status</span>
          <div className="flex">
            {CLIENT_STATUSES.map((st, i) => {
              const on = clientStatus(client) === st.id
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => edit((c) => ({ ...c, status: st.id }))}
                  aria-pressed={on}
                  className={`flex-1 sm:flex-none px-3 py-2.5 text-[13px] font-medium border cursor-pointer transition-colors ${i > 0 ? '-ml-px' : ''} ${
                    on ? 'relative bg-text-primary text-cream border-text-primary' : 'bg-white text-text-muted border-border hover:text-text-primary'
                  }`}
                >
                  {st.label}
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <label className={labelCls} htmlFor="client-start">Started</label>
          <input
            id="client-start"
            type="date"
            value={client.startDate || ''}
            onChange={(e) => edit((c) => ({ ...c, startDate: e.target.value }))}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="client-renewal">Renews</label>
          <input
            id="client-renewal"
            type="date"
            value={client.renewalDate || ''}
            onChange={(e) => edit((c) => ({ ...c, renewalDate: e.target.value }))}
            className={inputCls}
          />
        </div>
      </div>

      {confirm && (
        <ConfirmModal
          title={`Unlink ${name}?`}
          message="You stop seeing their training. Programs you sent stay with them."
          confirmLabel="Unlink"
          onConfirm={() => run(() => unlink(link.id))}
          onClose={() => setConfirm(false)}
        />
      )}
    </section>
  )
}
