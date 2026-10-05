import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Paperclip, SendHorizontal, X, Trash2, Loader2 } from 'lucide-react'
import ConfirmModal from './ConfirmModal'
import { useChat } from '../lib/useChat'
import { prepareMedia, MESSAGE_MAX } from '../lib/messages'

const dayLabel = (iso) => {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}
const timeLabel = (iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

// A coach ↔ client chat: the messages, then the composer pinned to the bottom
// of the screen. Used by the client's /messages and the coach's
// /coach/:id/messages.
export default function Chat({ coachId, clientId, meId, otherName }) {
  const { messages, loading, error, send, remove, urlFor } = useChat(coachId, clientId, meId)
  const [text, setText] = useState('')
  const [media, setMedia] = useState(null) // prepared file + preview URL
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [selected, setSelected] = useState(null) // id of your message showing Delete
  const [confirmDelete, setConfirmDelete] = useState(null)
  const fileRef = useRef(null)
  const inputRef = useRef(null)
  const lastCount = useRef(0)
  const composerRef = useRef(null)
  const [composerH, setComposerH] = useState(80)

  // Tracks the composer's height (an attachment preview or a long message
  // makes it taller) so the last message never hides behind it.
  useEffect(() => {
    const el = composerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setComposerH(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Land on the newest message, and follow new ones.
  useLayoutEffect(() => {
    if (messages.length !== lastCount.current) {
      lastCount.current = messages.length
      window.scrollTo(0, document.documentElement.scrollHeight)
    }
  }, [messages.length])

  // The text box grows with what's typed, up to about five lines.
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`
  }, [text])

  useEffect(() => () => { if (media?.preview) URL.revokeObjectURL(media.preview) }, [media])

  async function pick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setSendError('')
    const prepared = await prepareMedia(file)
    if (prepared.error) {
      setSendError(prepared.error)
      return
    }
    setMedia({ ...prepared, preview: URL.createObjectURL(prepared.blob) })
  }

  async function submit(e) {
    e?.preventDefault()
    if (sending || (!text.trim() && !media)) return
    setSending(true)
    setSendError('')
    try {
      await send(text, media)
      setText('')
      setMedia(null)
    } catch {
      setSendError('Didn’t send — check your connection and try again.')
    }
    setSending(false)
  }

  // Enter sends on a keyboard; on a phone it's a new line (the button sends).
  function onKeyDown(e) {
    if (e.key !== 'Enter' || e.shiftKey) return
    if (window.matchMedia?.('(pointer: coarse)').matches) return
    e.preventDefault()
    submit()
  }

  const canSend = !sending && (text.trim() || media)

  return (
    <div className="flex flex-col">
      <div className="space-y-1.5 pb-4">
        {loading && <p className="text-[13px] text-text-muted">Loading…</p>}
        {error && <p className="text-[13px] text-red-600">{error}</p>}
        {!loading && !error && messages.length === 0 && (
          <p className="text-[13px] text-text-muted text-center py-10">No messages yet. Say hi to {otherName}.</p>
        )}
        {messages.map((m, i) => {
          const mine = m.sender_id === meId
          const prev = messages[i - 1]
          const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString()
          const url = m.media_path ? urlFor(m) : null
          return (
            <Fragment key={m.id}>
              {newDay && <p className="text-[11px] text-text-light text-center pt-4 pb-2">{dayLabel(m.created_at)}</p>}
              <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                  {/* Tap your own message for Delete. */}
                  <div
                    onClick={() => mine && setSelected(selected === m.id ? null : m.id)}
                    onKeyDown={(e) => mine && e.key === 'Enter' && setSelected(selected === m.id ? null : m.id)}
                    role={mine ? 'button' : undefined}
                    tabIndex={mine ? 0 : undefined}
                    aria-label={mine ? 'Message options' : undefined}
                    className={`flex flex-col ${mine ? 'items-end cursor-pointer' : 'items-start'}`}
                  >
                    {m.media_type === 'image' && (
                      url ? (
                        <img src={url} alt="Photo" className="block max-w-full w-60 border border-border" loading="lazy" />
                      ) : (
                        <span className="block w-60 h-40 border border-border bg-cream" aria-label="Photo loading" />
                      )
                    )}
                    {m.media_type === 'video' && (
                      url ? (
                        <video src={url} controls playsInline preload="metadata" className="block max-w-full w-64 border border-border bg-black" onClick={(e) => e.stopPropagation()} />
                      ) : (
                        <span className="block w-64 h-36 border border-border bg-cream" aria-label="Video loading" />
                      )
                    )}
                    {m.body && (
                      <span
                        className={`block px-3.5 py-2 text-[14px] leading-snug whitespace-pre-wrap break-words ${
                          m.media_path ? 'mt-1' : ''
                        } ${mine ? 'bg-text-primary text-cream' : 'bg-white border border-border text-text-primary'}`}
                      >
                        {m.body}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-text-light mt-0.5 px-0.5">{timeLabel(m.created_at)}</span>
                  {mine && selected === m.id && (
                    <button
                      onClick={() => setConfirmDelete(m)}
                      className="inline-flex items-center gap-1 text-[12px] text-text-muted hover:text-red-600 bg-transparent border-none cursor-pointer p-0 mt-0.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  )}
                </div>
              </div>
            </Fragment>
          )
        })}
      </div>

      {/* Room for the composer, which is fixed to the bottom of the screen —
          sticky would leave it mid-screen under a short chat. */}
      <div style={{ height: composerH }} aria-hidden="true" />
      <form
        ref={composerRef}
        onSubmit={submit}
        className="fixed bottom-0 left-0 right-0 z-40 bg-cream border-t border-border pt-3 px-6"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="max-w-2xl mx-auto">
        {media && (
          <div className="relative inline-block mb-2">
            {media.type === 'image' ? (
              <img src={media.preview} alt="Photo to send" className="block h-20 border border-border" />
            ) : (
              <video src={media.preview} className="block h-20 border border-border bg-black" muted playsInline />
            )}
            <button
              type="button"
              onClick={() => setMedia(null)}
              aria-label="Remove attachment"
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-text-primary text-cream border-none cursor-pointer flex items-center justify-center"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {sendError && <p className="text-[12px] text-red-600 mb-2">{sendError}</p>}
        <div className="flex items-end gap-2">
          <input ref={fileRef} type="file" accept="image/*,video/*" onChange={pick} className="hidden" />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={sending}
            aria-label="Attach a photo or video"
            className="shrink-0 w-10 h-10 inline-flex items-center justify-center text-text-muted hover:text-text-primary bg-white border border-border cursor-pointer transition-colors disabled:opacity-40"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            maxLength={MESSAGE_MAX}
            rows={1}
            placeholder="Message"
            aria-label={`Message ${otherName}`}
            // 16px: iOS zooms the page into any smaller text box.
            className="flex-1 min-w-0 resize-none bg-white border border-border px-3 py-2 text-[16px] leading-snug text-text-primary outline-none focus:border-text-primary transition-colors"
          />
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Send"
            className="shrink-0 w-10 h-10 inline-flex items-center justify-center bg-text-primary text-cream border-none cursor-pointer hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizontal className="w-4 h-4" />}
          </button>
        </div>
        {sending && media?.type === 'video' && <p className="text-[11px] text-text-light mt-1.5">Uploading video…</p>}
        </div>
      </form>

      {confirmDelete && (
        <ConfirmModal
          title="Delete this message?"
          message={`It's removed for ${otherName} too.`}
          confirmLabel="Delete"
          onConfirm={() => {
            remove(confirmDelete).catch(() => setSendError('Couldn’t delete — try again.'))
            setSelected(null)
          }}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
