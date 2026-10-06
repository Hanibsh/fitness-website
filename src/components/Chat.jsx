import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Plus, SendHorizontal, X, Trash2, Loader2, Reply, Image as ImageIcon, ChevronRight } from 'lucide-react'
import ConfirmModal from './ConfirmModal'
import ChatCard from './ChatCard'
import ChatProfile from './ChatProfile'
import SharePickers, { ShareMenu, cardMenuItems } from './SharePickers'
import { useChat } from '../lib/useChat'
import { prepareMedia, reactionChips, MESSAGE_MAX, REACTIONS } from '../lib/messages'
import { cardLabel } from '../lib/chatCards'

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

// What a message says, in one line — for reply quotes.
function snippet(m) {
  if (!m) return 'Earlier message'
  if (m.body) return m.body
  if (m.card) return cardLabel(m.card)
  return m.media_type === 'video' ? 'Video' : 'Photo'
}

// A coach ↔ client chat: the messages, then the composer pinned to the bottom
// of the screen. Used by the client's /messages and the coach's
// /coach/:id/messages.
//
// Tap a message to react, reply or (your own) delete. The + button shares a
// photo or video, an exercise, one of `splits`, or a workout from `sessions`
// ({ list, unit }) — each only offered when the page passes it. `saveSplit`
// and `sentSplitPath`: see ChatCard.
//
// The page's title is drawn here: `title`, tapped, opens the profile panel
// (ChatProfile) with `about` and this chat's photos and videos.
export default function Chat({ coachId, clientId, meId, otherName, title = otherName, about = null, splits = null, sessions = null, saveSplit = null, sentSplitPath = null, initialCard = null }) {
  const { messages, loading, error, send, remove, react, typing, otherTyping, urlFor } = useChat(coachId, clientId, meId)
  const [text, setText] = useState('')
  // What goes with the text: { media } (a prepared file + preview URL) or { card }.
  // `initialCard`: shared from elsewhere in the app (SendToCoachButton).
  const [attachment, setAttachment] = useState(() => (initialCard ? { card: initialCard } : null))
  const [replyTo, setReplyTo] = useState(null)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [selected, setSelected] = useState(null) // id of the message showing its actions
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [picker, setPicker] = useState(null) // 'exercise' | 'split' | 'workout'
  const [highlight, setHighlight] = useState(null)
  const fileRef = useRef(null)
  const inputRef = useRef(null)
  const lastCount = useRef(0)
  const rootRef = useRef(null)
  const pinned = useRef(true) // at the newest message — the chat keeps you there
  const composerRef = useRef(null)
  const [composerH, setComposerH] = useState(80)

  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages])
  const lastMineId = useMemo(() => [...messages].reverse().find((m) => m.sender_id === meId)?.id || null, [messages, meId])
  const [profileOpen, setProfileOpen] = useState(false)
  const sharedMedia = useMemo(
    () =>
      messages
        .filter((m) => m.media_path && m.media_type)
        .map((m) => ({ id: m.id, type: m.media_type, url: urlFor(m), date: m.created_at }))
        .reverse(),
    [messages, urlFor]
  )
  const media = attachment?.media || null

  // Tracks the composer's height (an attachment preview or a long message
  // makes it taller) so the last message never hides behind it.
  useEffect(() => {
    const el = composerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setComposerH(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Arrived with something attached: ready for the question that goes with it.
  useEffect(() => {
    if (initialCard) inputRef.current?.focus({ preventScroll: true })
  }, [initialCard])

  // Land on the newest message, and follow new ones.
  useLayoutEffect(() => {
    if (messages.length !== lastCount.current) {
      lastCount.current = messages.length
      window.scrollTo(0, document.documentElement.scrollHeight)
      pinned.current = true
    }
  }, [messages.length])

  // Photos and videos load after the chat opens and push the bottom down —
  // while you're at the newest message, stay there. Also keeps "typing…", an
  // opened message's actions and a taller composer in view. Scroll up to read
  // and it lets you be.
  useEffect(() => {
    const el = rootRef.current
    const onScroll = () => {
      pinned.current = document.documentElement.scrollHeight - window.innerHeight - window.scrollY < 80
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    let ro
    if (el && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        if (pinned.current) window.scrollTo(0, document.documentElement.scrollHeight)
      })
      ro.observe(el)
    }
    return () => {
      window.removeEventListener('scroll', onScroll)
      ro?.disconnect()
    }
  }, [])

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
    setAttachment({ media: { ...prepared, preview: URL.createObjectURL(prepared.blob) } })
  }

  function attachCard(card) {
    setAttachment({ card })
    setPicker(null)
    inputRef.current?.focus()
  }

  async function submit(e) {
    e?.preventDefault()
    if (sending || (!text.trim() && !attachment)) return
    setSending(true)
    setSendError('')
    try {
      await send(text, media, { card: attachment?.card || null, replyTo: replyTo?.id || null })
      setText('')
      setAttachment(null)
      setReplyTo(null)
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

  function startReply(m) {
    setReplyTo(m)
    setSelected(null)
    inputRef.current?.focus()
  }

  function jumpTo(id) {
    const el = document.getElementById(`msg-${id}`)
    if (!el) return
    el.scrollIntoView({ block: 'center' })
    setHighlight(id)
    setTimeout(() => setHighlight((h) => (h === id ? null : h)), 1500)
  }

  function doReact(m, emoji) {
    setSelected(null)
    react(m, emoji).catch(() => setSendError('Couldn’t react — try again.'))
  }

  const canSend = !sending && (text.trim() || attachment)
  const nameOf = (m) => (m?.sender_id === meId ? 'You' : otherName)
  const menu = [
    { key: 'media', label: 'Photo or video', icon: ImageIcon, run: () => fileRef.current?.click() },
    ...cardMenuItems({ splits, sessions, open: setPicker }),
  ]

  return (
    <div ref={rootRef} className="flex flex-col">
      {about ? (
        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          className="self-start text-left bg-transparent border-none cursor-pointer p-0 mb-2 group"
        >
          <span className="flex items-center gap-1 font-heading text-3xl font-medium text-text-primary break-words">
            {title} <ChevronRight className="w-6 h-6 shrink-0 text-text-light group-hover:text-text-primary transition-colors" />
          </span>
          <span className="block text-[12px] text-text-muted mt-0.5">Progress, split, media</span>
        </button>
      ) : (
        <h1 className="font-heading text-3xl font-medium text-text-primary mb-2 break-words">{title}</h1>
      )}
      {profileOpen && about && <ChatProfile name={title} about={about} media={sharedMedia} onClose={() => setProfileOpen(false)} />}
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
          const quoted = m.reply_to ? byId.get(m.reply_to) : null
          const chips = reactionChips(m.reactions, meId)
          const myReaction = (m.reactions || []).find((r) => r.user_id === meId)?.emoji || null
          const isOpen = selected === m.id
          const toggle = () => setSelected(isOpen ? null : m.id)
          return (
            <Fragment key={m.id}>
              {newDay && <p className="text-[11px] text-text-light text-center pt-4 pb-2">{dayLabel(m.created_at)}</p>}
              <div id={`msg-${m.id}`} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                  {m.reply_to && (
                    <button
                      type="button"
                      onClick={() => jumpTo(m.reply_to)}
                      className={`max-w-full text-left bg-transparent cursor-pointer px-2.5 py-1 mb-0.5 border-0 border-l-2 border-solid border-border-hover ${mine ? 'mr-0' : 'ml-0'}`}
                    >
                      <span className="block text-[11px] text-text-light">{nameOf(quoted)}</span>
                      <span className="block text-[12px] text-text-muted truncate max-w-[14rem]">{snippet(quoted)}</span>
                    </button>
                  )}
                  {/* Tap a message for its actions. Reactions sit on its
                      bottom-right corner, like a sticker. */}
                  <div className={`relative max-w-full ${chips.length ? 'mb-4' : ''}`}>
                  <div
                    onClick={toggle}
                    onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && toggle()}
                    role="button"
                    tabIndex={0}
                    aria-label="Message options"
                    aria-expanded={isOpen}
                    className={`flex flex-col cursor-pointer ${mine ? 'items-end' : 'items-start'} ${highlight === m.id ? 'ring-2 ring-text-primary' : ''}`}
                  >
                    {m.media_type === 'image' && (
                      url ? (
                        <img src={url} alt="Photo" className="block max-w-[66vw] w-60 border border-border" loading="lazy" />
                      ) : (
                        <span className="block w-60 max-w-full h-40 border border-border bg-cream" aria-label="Photo loading" />
                      )
                    )}
                    {m.media_type === 'video' && (
                      url ? (
                        <video src={url} controls playsInline preload="metadata" className="block max-w-[66vw] w-64 border border-border bg-black" onClick={(e) => e.stopPropagation()} />
                      ) : (
                        <span className="block w-64 max-w-full h-36 border border-border bg-cream" aria-label="Video loading" />
                      )
                    )}
                    {m.card && (
                      <div className={m.media_path ? 'mt-1' : ''}>
                        <ChatCard card={m.card} mine={mine} saveSplit={saveSplit} sentSplitPath={sentSplitPath} />
                      </div>
                    )}
                    {m.body && (
                      <span
                        className={`block px-3.5 py-2 text-[14px] leading-snug whitespace-pre-wrap break-words ${
                          m.media_path || m.card ? 'mt-1' : ''
                        } ${mine ? 'bg-text-primary text-cream' : 'bg-white border border-border text-text-primary'}`}
                      >
                        {m.body}
                      </span>
                    )}
                  </div>
                  {chips.length > 0 && (
                    // 24px tall, 16px of it below the bubble — the rest only
                    // covers the bubble's padding, never its text.
                    <div className="absolute right-1.5 -bottom-4 z-[1] flex items-center gap-px p-px rounded-full bg-white border border-border shadow-sm">
                      {chips.map((c) => (
                        <button
                          key={c.emoji}
                          type="button"
                          onClick={() => doReact(m, c.emoji)}
                          aria-label={c.mine ? `Remove your ${c.emoji}` : `React ${c.emoji}`}
                          className={`inline-flex items-center justify-center gap-0.5 h-5 min-w-5 px-1 rounded-full text-[13px] leading-none border cursor-pointer ${
                            c.mine ? 'bg-cream border-text-primary' : 'bg-transparent border-transparent'
                          }`}
                        >
                          {c.emoji}
                          {c.count > 1 && <span className="text-[11px] text-text-muted tabular-nums">{c.count}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  </div>
                  <span className="text-[10px] text-text-light mt-0.5 px-0.5">
                    {timeLabel(m.created_at)}
                    {mine && m.id === lastMineId && m.read_at && ' · Seen'}
                  </span>
                  {isOpen && (
                    <div className={`flex flex-col gap-1.5 mt-1 ${mine ? 'items-end' : 'items-start'}`}>
                      <div className="flex flex-wrap bg-white border border-border">
                        {REACTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => doReact(m, emoji)}
                            aria-label={`React ${emoji}`}
                            aria-pressed={myReaction === emoji}
                            className={`w-9 h-9 inline-flex items-center justify-center text-[18px] leading-none border-none cursor-pointer ${
                              myReaction === emoji ? 'bg-cream' : 'bg-transparent hover:bg-cream'
                            }`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          onClick={() => startReply(m)}
                          className="inline-flex items-center gap-1 text-[12px] text-text-muted hover:text-text-primary bg-transparent border-none cursor-pointer p-0"
                        >
                          <Reply className="w-3.5 h-3.5" /> Reply
                        </button>
                        {mine && (
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(m)}
                            className="inline-flex items-center gap-1 text-[12px] text-text-muted hover:text-red-600 bg-transparent border-none cursor-pointer p-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Fragment>
          )
        })}
        {otherTyping && <p className="text-[12px] text-text-muted pt-1" aria-live="polite">{otherName} is typing…</p>}
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
        {replyTo && (
          <div className="flex items-start gap-2 mb-2 pl-2.5 border-0 border-l-2 border-solid border-text-primary">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-text-light">Replying to {nameOf(replyTo) === 'You' ? 'yourself' : otherName}</p>
              <p className="text-[12px] text-text-muted truncate">{snippet(replyTo)}</p>
            </div>
            <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply" className="shrink-0 text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer p-0.5">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {attachment && (
          <div className="relative inline-block mb-2 max-w-full">
            {media ? (
              media.type === 'image' ? (
                <img src={media.preview} alt="Photo to send" className="block h-20 border border-border" />
              ) : (
                <video src={media.preview} className="block h-20 border border-border bg-black" muted playsInline />
              )
            ) : (
              <p className="text-[13px] text-text-primary bg-white border border-border pl-3 pr-8 py-2 break-words">{cardLabel(attachment.card)}</p>
            )}
            <button
              type="button"
              onClick={() => setAttachment(null)}
              aria-label="Remove attachment"
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-text-primary text-cream border-none cursor-pointer flex items-center justify-center"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {sendError && <p className="text-[12px] text-red-600 mb-2">{sendError}</p>}
        <div className="relative flex items-end gap-2">
          <input ref={fileRef} type="file" accept="image/*,video/*" onChange={pick} className="hidden" />
          {menuOpen && <ShareMenu items={menu} onClose={() => setMenuOpen(false)} />}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            disabled={sending}
            aria-label="Share something"
            aria-expanded={menuOpen}
            className="shrink-0 w-10 h-10 inline-flex items-center justify-center text-text-muted hover:text-text-primary bg-white border border-border cursor-pointer transition-colors disabled:opacity-40"
          >
            <Plus className="w-4 h-4" />
          </button>
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              if (e.target.value.trim()) typing()
            }}
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

      <SharePickers picker={picker} splits={splits} sessions={sessions} onPick={attachCard} onClose={() => setPicker(null)} />

      {confirmDelete && (
        <ConfirmModal
          title="Delete this message?"
          message={`It's removed for ${otherName} too.`}
          confirmLabel="Delete"
          onConfirm={() => {
            remove(confirmDelete).catch(() => setSendError('Couldn’t delete — try again.'))
            setSelected(null)
            if (replyTo?.id === confirmDelete.id) setReplyTo(null)
          }}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
