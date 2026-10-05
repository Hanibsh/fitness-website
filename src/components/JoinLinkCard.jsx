import { useEffect, useState } from 'react'
import { Copy, Check, Share2, QrCode, Download } from 'lucide-react'
import ConfirmModal from './ConfirmModal'
import { fetchJoinCode, inviteUrl } from '../lib/coach'

// The coach's one permanent invite link, for anyone (lib/coach.js "join link").
// Copy it, share it, or show the QR code; whoever accepts lands in the list.
// Sits at the top of /coach.
export default function JoinLinkCard({ user }) {
  const [code, setCode] = useState(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [qr, setQr] = useState(null) // data: URL once drawn
  const [showQr, setShowQr] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [busy, setBusy] = useState(false)

  function fail(e) {
    // The function doesn't exist until schema.sql has been run.
    const notSetUp = e?.code === 'PGRST202' || e?.code === '42883'
    setError(notSetUp ? 'Run the latest schema.sql in Supabase first.' : 'Couldn’t load your link — try again.')
  }

  useEffect(() => {
    let cancelled = false
    fetchJoinCode(user?.id)
      .then((c) => { if (!cancelled) setCode(c) })
      .catch((e) => { if (!cancelled) fail(e) })
    return () => { cancelled = true }
  }, [user])

  const url = code ? inviteUrl(code) : ''

  // Drawn on the device (no outside service), black on white whatever the
  // theme, so every phone camera reads it.
  useEffect(() => {
    if (!showQr || !url) return
    let cancelled = false
    import('qrcode')
      .then((QR) => QR.toDataURL(url, { width: 512, margin: 2, color: { dark: '#000000', light: '#ffffff' } }))
      .then((data) => { if (!cancelled) setQr(data) })
      .catch(() => { if (!cancelled) setError('Couldn’t draw the QR code.') })
    return () => { cancelled = true }
  }, [showQr, url])

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
    navigator.share({ title: 'Train with Leon', text: 'Join me on Leon so I can coach you:', url }).catch(() => {})
  }

  async function reset() {
    setBusy(true)
    setError('')
    try {
      setQr(null)
      setCode(await fetchJoinCode(user?.id, { reset: true }))
    } catch (e) {
      fail(e)
    }
    setBusy(false)
  }

  const btn = 'inline-flex items-center gap-1.5 text-[13px] font-medium text-text-muted hover:text-text-primary bg-white border border-border hover:border-border-hover px-3 py-2 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <section className="bg-white border border-border p-5 sm:p-6 mb-6">
      <h2 className="text-[11px] uppercase tracking-wider text-text-light mb-1">Your invite link</h2>
      <p className="text-[13px] text-text-muted mb-3">Anyone who accepts joins your list.</p>

      {url ? (
        <>
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
            <button onClick={() => setShowQr((v) => !v)} className={`shrink-0 ${btn}`} aria-label="QR code" aria-expanded={showQr}>
              <QrCode className="w-4 h-4" />
              <span className="hidden sm:inline">QR</span>
            </button>
          </div>

          {showQr && (
            <div className="mt-4 flex flex-col items-center gap-3">
              {qr ? (
                <img src={qr} alt="QR code for your invite link" width={224} height={224} className="block border border-border" style={{ background: '#ffffff' }} />
              ) : (
                <div className="w-56 h-56 border border-border" aria-hidden="true" />
              )}
              {qr && (
                <a href={qr} download="leon-invite-qr.png" className={`${btn} no-underline`}>
                  <Download className="w-4 h-4" /> Download
                </a>
              )}
            </div>
          )}

          <button
            onClick={() => setConfirmReset(true)}
            disabled={busy}
            className="mt-3 text-[12px] text-text-muted hover:text-red-600 bg-transparent border-none cursor-pointer p-0 transition-colors"
          >
            Reset link
          </button>
        </>
      ) : (
        !error && <p className="text-[13px] text-text-muted">Loading…</p>
      )}

      {error && <p className="text-[12px] text-red-600 mt-3">{error}</p>}

      {confirmReset && (
        <ConfirmModal
          title="Reset your invite link?"
          message="The old link and QR code stop working. Clients already linked stay linked."
          confirmLabel="Reset"
          onConfirm={reset}
          onClose={() => setConfirmReset(false)}
        />
      )}
    </section>
  )
}
