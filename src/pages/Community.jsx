import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, X, Loader2 } from 'lucide-react'
import PostCard from '../components/PostCard'
import SharePickers, { ShareMenu, cardMenuItems } from '../components/SharePickers'
import { useAuth } from '../lib/auth'
import { useProgramsState } from '../lib/useProgramsState'
import { useCommunity, useCommunityAccess, setDevRole } from '../lib/useCommunity'
import { markSeen, POST_MAX } from '../lib/community'
import { cardLabel, copyOfSharedSplit } from '../lib/chatCards'
import { saveProfile } from '../lib/profile'
import { getHistory, getUnit } from '../lib/workoutStore'
import { fetchRemoteHistory } from '../lib/workoutRemote'

// The name others see, asked for before a first post or comment — the feed
// never shows an email.
function NameField() {
  const { user, setNickname, mergeProfile } = useAuth()
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save(e) {
    e.preventDefault()
    const name = value.trim().slice(0, 40)
    if (!name || saving) return
    setSaving(true)
    setError('')
    try {
      await saveProfile(user.id, { display_name: name })
      mergeProfile({ display_name: name })
      setNickname(name)
    } catch {
      setError('Couldn’t save — try again.')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save}>
      <label htmlFor="community-name" className="block text-[13px] font-medium text-text-primary mb-1.5">Pick a name others see</label>
      <div className="flex items-end gap-2">
        <input
          id="community-name"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={40}
          placeholder="e.g. Alex"
          className="flex-1 min-w-0 bg-white border border-border px-3 py-2 text-[16px] leading-snug text-text-primary outline-none focus:border-text-primary transition-colors"
        />
        <button
          type="submit"
          disabled={saving || !value.trim()}
          className="shrink-0 h-10 px-4 bg-text-primary text-cream text-[13px] font-medium border-none cursor-pointer hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      {error && <p className="text-[12px] text-red-600 mt-1.5">{error}</p>}
    </form>
  )
}

function Composer({ onPost, splits, sessions, initialCard, nameGate }) {
  const [text, setText] = useState('')
  const [card, setCard] = useState(initialCard)
  const [menuOpen, setMenuOpen] = useState(false)
  const [picker, setPicker] = useState(null)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  // Arrived with something attached: ready for the caption.
  useEffect(() => {
    if (initialCard && !nameGate) inputRef.current?.focus({ preventScroll: true })
  }, [initialCard, nameGate])

  // The box grows with what's typed, up to about six lines.
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 64), 160)}px`
  }, [text])

  async function submit(e) {
    e.preventDefault()
    if (posting || (!text.trim() && !card)) return
    setPosting(true)
    setError('')
    try {
      await onPost(text, card)
      setText('')
      setCard(null)
    } catch {
      setError('Didn’t post — check your connection and try again.')
    }
    setPosting(false)
  }

  return (
    <div className="bg-white border border-border p-4">
      {nameGate || (
        <form onSubmit={submit}>
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={POST_MAX}
            rows={2}
            placeholder="Share a win…"
            aria-label="Write a post"
            className="block w-full resize-none bg-white border border-border px-3 py-2 text-[16px] leading-snug text-text-primary outline-none focus:border-text-primary transition-colors"
          />
          {card && (
            <div className="relative inline-block mt-3 max-w-full">
              <p className="text-[13px] text-text-primary bg-cream border border-border pl-3 pr-8 py-2 break-words">{cardLabel(card)}</p>
              <button
                type="button"
                onClick={() => setCard(null)}
                aria-label="Remove attachment"
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-text-primary text-cream border-none cursor-pointer flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {error && <p className="text-[12px] text-red-600 mt-2">{error}</p>}
          <div className="flex items-center justify-between gap-3 mt-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-expanded={menuOpen}
                className="inline-flex items-center gap-1.5 h-10 px-3 text-[13px] text-text-muted hover:text-text-primary bg-white border border-border hover:border-border-hover cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4" /> Attach
              </button>
              {menuOpen && <ShareMenu up={false} items={cardMenuItems({ splits, sessions, open: setPicker })} onClose={() => setMenuOpen(false)} />}
            </div>
            <button
              type="submit"
              disabled={posting || (!text.trim() && !card)}
              className="inline-flex items-center gap-2 h-10 px-5 bg-text-primary text-cream text-[13px] font-medium border-none cursor-pointer hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {posting && <Loader2 className="w-4 h-4 animate-spin" />} Post
            </button>
          </div>
        </form>
      )}
      <SharePickers
        picker={picker}
        splits={splits}
        sessions={sessions}
        onPick={(c) => {
          setCard(c)
          setPicker(null)
          inputRef.current?.focus()
        }}
        onClose={() => setPicker(null)}
      />
    </div>
  )
}

function Feed({ access, attach }) {
  const { user, nickname } = useAuth()
  const { coachId, meId, isCoach } = access
  const feed = useCommunity(coachId, meId)
  const { programsState, addRoutine } = useProgramsState()
  const [history, setHistory] = useState(null)

  // Your workouts, for the Attach → Workout picker.
  useEffect(() => {
    let cancelled = false
    const load = user ? fetchRemoteHistory(user.id).catch(() => getHistory()) : Promise.resolve(getHistory())
    load.then((list) => { if (!cancelled) setHistory(list || []) })
    return () => { cancelled = true }
  }, [user])

  // Opening the feed clears the top bar's "new posts" dot — and keeps it clear
  // for posts that arrive while it's open.
  const newest = feed.posts[0]?.created_at
  useEffect(() => {
    if (meId) markSeen(meId)
  }, [meId, newest])

  // The coach always has a name (Leon); a client needs a nickname first.
  const needsName = !!user && !isCoach && !nickname?.trim()
  const nameGate = needsName ? <NameField /> : null

  async function saveSplit(program) {
    const copy = copyOfSharedSplit(program)
    addRoutine(copy)
    return `/split/${copy.id}`
  }

  return (
    <>
      <Composer
        onPost={feed.post}
        splits={programsState.programs}
        sessions={history ? { list: history, unit: getUnit() } : null}
        initialCard={attach}
        nameGate={nameGate}
      />
      <div className="space-y-4 mt-6">
        {feed.loading && <p className="text-[13px] text-text-muted">Loading…</p>}
        {feed.error && <p className="text-[13px] text-red-600">{feed.error}</p>}
        {!feed.loading && !feed.error && feed.posts.length === 0 && (
          <p className="text-[13px] text-text-muted text-center py-10">No posts yet. Share the first win.</p>
        )}
        {feed.posts.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            names={feed.names}
            meId={meId}
            canModerate={isCoach}
            comments={feed.comments[p.id]}
            onReact={feed.react}
            onDelete={feed.remove}
            onOpenComments={feed.openComments}
            onComment={feed.comment}
            onDeleteComment={feed.removeComment}
            saveSplit={saveSplit}
            nameGate={nameGate}
          />
        ))}
        {feed.hasMore && (
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={feed.loadMore}
              disabled={feed.loadingMore}
              className="text-[13px] text-text-muted hover:text-text-primary bg-white border border-border hover:border-border-hover px-4 py-2 cursor-pointer transition-colors disabled:opacity-50"
            >
              {feed.loadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}

// /community — Leon and his clients sharing wins: a post box, then the feed.
// Anyone else sees what it is and how to get in.
//
// "Share to community" elsewhere (ShareToCommunityButton) lands here with its
// card in the router state: the post box starts with it attached, and the back
// link returns there.
export default function Community() {
  const location = useLocation()
  const navigate = useNavigate()
  const access = useCommunityAccess()
  const back = location.state?.backTo ? location.state : null
  // Kept once, then cleared from the history entry so a reload doesn't attach
  // it again.
  const [attach] = useState(() => location.state?.attach || null)
  useEffect(() => {
    if (location.state?.attach) {
      const { attach: _sent, ...rest } = location.state
      navigate(location.pathname, { replace: true, state: rest })
    }
  }, [location, navigate])

  return (
    <div className="pt-24 pb-20 px-6">
      <div className="max-w-2xl mx-auto">
        {back && (
          <Link
            to={back.backTo}
            state={back.backState}
            className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary no-underline text-[13px] mb-6 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> {back.backLabel}
          </Link>
        )}
        <h1 className="font-heading text-3xl font-medium text-text-primary mb-1">Community</h1>
        {access.devBoth && (
          <p className="text-[12px] text-text-light mb-1">
            Dev: you are{' '}
            {['coach', 'client'].map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => { setDevRole(role); window.location.reload() }}
                className={`bg-transparent border-none cursor-pointer p-0 mr-2 text-[12px] ${access.isCoach === (role === 'coach') ? 'text-text-primary underline' : 'text-text-light'}`}
              >
                {role === 'coach' ? 'Leon' : 'Alex'}
              </button>
            ))}
          </p>
        )}
        {access.loading ? (
          <p className="text-[13px] text-text-muted mt-4">Loading…</p>
        ) : access.coachId ? (
          <>
            <p className="text-[13px] text-text-muted mb-6">Wins, PRs and splits from Leon’s clients.</p>
            <Feed access={access} attach={attach} />
          </>
        ) : (
          <>
            <p className="text-[14px] text-text-muted mb-6">A private space for Leon’s clients to share wins.</p>
            <Link
              to="/contact"
              className="inline-flex items-center bg-text-primary text-cream text-[14px] font-medium px-5 py-3 no-underline hover:bg-accent-hover transition-colors"
            >
              Book a free intro chat
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
