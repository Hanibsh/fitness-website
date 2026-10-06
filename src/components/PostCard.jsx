import { useState } from 'react'
import { Trash2, SmilePlus, MessageCircle, SendHorizontal, Loader2 } from 'lucide-react'
import ChatCard from './ChatCard'
import ConfirmModal from './ConfirmModal'
import { REACTIONS, reactionChips } from '../lib/messages'
import { memberName, postTime, COMMENT_MAX } from '../lib/community'

function Name({ names, id }) {
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <span className="text-[14px] font-medium text-text-primary truncate">{memberName(names, id)}</span>
      {names?.[id]?.isCoach && (
        <span className="shrink-0 text-[10px] uppercase tracking-wider text-text-muted border border-border px-1.5 py-px">Coach</span>
      )}
    </span>
  )
}

// One post in the community feed: who, when, the caption and card, reaction
// chips, and its comments (fetched when first opened). The author deletes
// their own; the coach (`canModerate`) deletes anything.
//
// `nameGate`: shown instead of the comment box while you have no name for
// others to see.
export default function PostCard({ post, names, meId, canModerate, comments, onReact, onDelete, onOpenComments, onComment, onDeleteComment, saveSplit, nameGate = null }) {
  const [reacting, setReacting] = useState(false)
  const [open, setOpen] = useState(false)
  const [loadingComments, setLoadingComments] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(null) // { kind: 'post' } | { kind: 'comment', comment }

  const mine = post.author_id === meId
  const chips = reactionChips(post.reactions, meId)
  const myReaction = (post.reactions || []).find((r) => r.user_id === meId)?.emoji || null
  const count = comments ? comments.length : post.comment_count || 0

  function react(emoji) {
    setReacting(false)
    setError('')
    onReact(post, emoji).catch(() => setError('Couldn’t react — try again.'))
  }

  async function toggleComments() {
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    setError('')
    setLoadingComments(true)
    try {
      await onOpenComments(post)
    } catch {
      setError('Couldn’t load comments — try again.')
    }
    setLoadingComments(false)
  }

  async function submit(e) {
    e.preventDefault()
    if (sending || !text.trim()) return
    setSending(true)
    setError('')
    try {
      await onComment(post, text)
      setText('')
    } catch {
      setError('Didn’t send — check your connection and try again.')
    }
    setSending(false)
  }

  return (
    <article className="bg-white border border-border">
      <header className="flex items-start justify-between gap-3 px-4 pt-3.5">
        <div className="min-w-0">
          <Name names={names} id={post.author_id} />
          <p className="text-[12px] text-text-light mt-0.5">{postTime(post.created_at)}</p>
        </div>
        {(mine || canModerate) && (
          <button
            type="button"
            onClick={() => setConfirm({ kind: 'post' })}
            aria-label="Delete post"
            className="shrink-0 p-1 -mr-1 text-text-light hover:text-red-600 bg-transparent border-none cursor-pointer transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </header>

      {post.body && <p className="px-4 pt-2 text-[14px] leading-snug text-text-primary whitespace-pre-wrap break-words">{post.body}</p>}
      {post.card && (
        <div className="px-4 pt-3">
          <ChatCard card={post.card} mine={mine} saveSplit={saveSplit} wide />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3 pb-3">
        {chips.map((c) => (
          <button
            key={c.emoji}
            type="button"
            onClick={() => react(c.emoji)}
            aria-label={c.mine ? `Remove your ${c.emoji}` : `React ${c.emoji}`}
            aria-pressed={c.mine}
            className={`inline-flex items-center gap-1 h-7 px-2 rounded-full text-[14px] leading-none border cursor-pointer transition-colors ${
              c.mine ? 'bg-cream border-text-primary' : 'bg-white border-border hover:border-border-hover'
            }`}
          >
            {c.emoji}
            <span className="text-[12px] text-text-muted tabular-nums">{c.count}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setReacting((r) => !r)}
          aria-label="React"
          aria-expanded={reacting}
          className="inline-flex items-center justify-center h-7 w-8 rounded-full text-text-muted hover:text-text-primary bg-white border border-border hover:border-border-hover cursor-pointer transition-colors"
        >
          <SmilePlus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={toggleComments}
          aria-expanded={open}
          className="ml-auto inline-flex items-center gap-1.5 text-[13px] text-text-muted hover:text-text-primary bg-transparent border-none cursor-pointer p-0 transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          {count ? `${count} comment${count === 1 ? '' : 's'}` : 'Comment'}
        </button>
      </div>

      {reacting && (
        <div className="px-4 pb-3 -mt-1">
          <div className="inline-flex flex-wrap bg-white border border-border">
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => react(emoji)}
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
        </div>
      )}

      {error && <p className="px-4 pb-3 text-[12px] text-red-600">{error}</p>}

      {open && (
        <div className="border-t border-border px-4 py-3 space-y-3 bg-cream">
          {loadingComments && !comments && <p className="text-[13px] text-text-muted">Loading…</p>}
          {(comments || []).map((c) => (
            <div key={c.id} className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="flex items-center gap-2 min-w-0">
                  <Name names={names} id={c.author_id} />
                  <span className="shrink-0 text-[11px] text-text-light">{postTime(c.created_at)}</span>
                </p>
                <p className="text-[14px] leading-snug text-text-primary whitespace-pre-wrap break-words mt-0.5">{c.body}</p>
              </div>
              {(c.author_id === meId || canModerate) && (
                <button
                  type="button"
                  onClick={() => setConfirm({ kind: 'comment', comment: c })}
                  aria-label="Delete comment"
                  className="shrink-0 p-1 -mr-1 text-text-light hover:text-red-600 bg-transparent border-none cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
          {nameGate || (
            <form onSubmit={submit} className="flex items-end gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={COMMENT_MAX}
                placeholder="Add a comment"
                aria-label="Add a comment"
                // 16px: iOS zooms the page into any smaller text box.
                className="flex-1 min-w-0 bg-white border border-border px-3 py-2 text-[16px] leading-snug text-text-primary outline-none focus:border-text-primary transition-colors"
              />
              <button
                type="submit"
                disabled={sending || !text.trim()}
                aria-label="Send comment"
                className="shrink-0 w-10 h-10 inline-flex items-center justify-center bg-text-primary text-cream border-none cursor-pointer hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizontal className="w-4 h-4" />}
              </button>
            </form>
          )}
        </div>
      )}

      {confirm && (
        <ConfirmModal
          title={confirm.kind === 'post' ? 'Delete this post?' : 'Delete this comment?'}
          message="It's removed for everyone."
          confirmLabel="Delete"
          onConfirm={() => {
            const run = confirm.kind === 'post' ? onDelete(post) : onDeleteComment(confirm.comment, post)
            run.catch(() => setError('Couldn’t delete — try again.'))
          }}
          onClose={() => setConfirm(null)}
        />
      )}
    </article>
  )
}
