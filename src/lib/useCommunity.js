// The community on screen: who's in it, the feed (live), comments, reactions,
// and the top bar's "new posts" dot. lib/community.js has the calls.
import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from './auth'
import { useCoachAccess } from './useClientsState'
import { useMyCoach } from './useMyCoach'
import { devCoachSample, devClientSample } from './coach'
import {
  fetchFeed, fetchNames, fetchComments, fetchLatestOtherPost, subscribeToFeed,
  createPost, deletePost, setPostReaction, addComment, deleteComment,
  lastSeen, FEED_PAGE, DEV_COMMUNITY_COACH,
} from './community'

// ---- Who's in --------------------------------------------------------------------

// In local development, signed out, the dev samples stand in: the coach flag
// is Leon, the client flag is a client. With both on, each tab picks who it is
// (kept per tab, so two tabs can be two people).
const DEV_AS = 'leon_dev_community_as'
function devRole() {
  if (!import.meta.env.DEV) return null
  const coach = devCoachSample()
  const client = devClientSample()
  if (!coach && !client) return null
  let pick = null
  try {
    pick = sessionStorage.getItem(DEV_AS)
  } catch {
    // no storage — the default below
  }
  if (pick === 'client' && client) return 'client'
  if (pick === 'coach' && coach) return 'coach'
  return coach ? 'coach' : 'client'
}
export function setDevRole(role) {
  try {
    sessionStorage.setItem(DEV_AS, role)
  } catch {
    // no storage
  }
}

// { coachId, meId, isCoach, loading, devBoth }. coachId is null for anyone
// outside a community (signed out, or not coached).
export function useCommunityAccess() {
  const { user, loading: authLoading } = useAuth()
  const { isCoach, checking } = useCoachAccess()
  const { coach, coachLoading } = useMyCoach()

  if (!user && !authLoading) {
    const role = devRole()
    if (role) {
      const devBoth = devCoachSample() && devClientSample()
      return role === 'coach'
        ? { coachId: DEV_COMMUNITY_COACH, meId: DEV_COMMUNITY_COACH, isCoach: true, loading: false, devBoth }
        : { coachId: DEV_COMMUNITY_COACH, meId: 'dev-client', isCoach: false, loading: false, devBoth }
    }
  }
  if (user && isCoach) return { coachId: user.id, meId: user.id, isCoach: true, loading: false, devBoth: false }
  return {
    coachId: user ? coach?.coach_id || null : null,
    meId: user?.id || null,
    isCoach: false,
    loading: authLoading || (!!user && (checking || coachLoading)),
    devBoth: false,
  }
}

// ---- The feed --------------------------------------------------------------------

function withReaction(posts, { post_id, user_id, emoji }) {
  return posts.map((p) => {
    if (p.id !== post_id) return p
    const others = (p.reactions || []).filter((r) => r.user_id !== user_id)
    return { ...p, reactions: emoji ? [...others, { user_id, emoji }] : others }
  })
}

const newestFirst = (a, b) => b.created_at.localeCompare(a.created_at)

export function useCommunity(coachId, meId) {
  const [posts, setPosts] = useState([])
  const [names, setNames] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  // Comments of the posts that have them open: { postId: [comment] }.
  const [comments, setComments] = useState({})
  // Every comment id counted into a post's comment_count, so one that arrives
  // twice (sent here, then heard live) counts once.
  const counted = useRef(new Set())
  const namesRef = useRef(names)
  namesRef.current = names
  const commentsRef = useRef(comments)
  commentsRef.current = comments

  const refreshNames = useCallback(() => {
    fetchNames(coachId).then(setNames).catch(() => {})
  }, [coachId])
  // A name we don't have yet (someone's first post or comment).
  const needName = useCallback((id) => {
    if (id && !namesRef.current[id]) refreshNames()
  }, [refreshNames])

  const addCommentRow = useCallback((row) => {
    if (counted.current.has(row.id)) return
    counted.current.add(row.id)
    setPosts((prev) => prev.map((p) => (p.id === row.post_id ? { ...p, comment_count: (p.comment_count || 0) + 1 } : p)))
    setComments((prev) => (prev[row.post_id] ? { ...prev, [row.post_id]: [...prev[row.post_id], row] } : prev))
  }, [])

  // A deleted comment only names itself, so only one under an open post can
  // be placed (and taken off its post's count).
  const dropCommentRow = useCallback((id) => {
    const open = commentsRef.current
    const postId = Object.keys(open).find((k) => open[k].some((c) => c.id === id))
    if (!postId) return
    setComments((prev) => ({ ...prev, [postId]: (prev[postId] || []).filter((c) => c.id !== id) }))
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comment_count: Math.max(0, (p.comment_count || 1) - 1) } : p)))
  }, [])

  useEffect(() => {
    if (!coachId) return
    let cancelled = false
    setLoading(true)
    setError('')
    Promise.all([fetchFeed(coachId), fetchNames(coachId)])
      .then(([rows, n]) => {
        if (cancelled) return
        setPosts(rows)
        setNames(n)
        setHasMore(rows.length === FEED_PAGE)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError('Couldn’t load the community — pull down to try again.')
        setLoading(false)
      })
    const unsubscribe = subscribeToFeed(coachId, {
      onPost: (row) => {
        setPosts((prev) => (prev.some((p) => p.id === row.id) ? prev : [row, ...prev].sort(newestFirst)))
        needName(row.author_id)
      },
      onPostGone: (id) => setPosts((prev) => prev.filter((p) => p.id !== id)),
      onReaction: (row) => setPosts((prev) => withReaction(prev, row)),
      onReactionGone: (row) => setPosts((prev) => withReaction(prev, { ...row, emoji: null })),
      onComment: (row) => {
        addCommentRow(row)
        needName(row.author_id)
      },
      onCommentGone: dropCommentRow,
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [coachId, needName, addCommentRow, dropCommentRow])

  const loadMore = useCallback(async () => {
    const last = posts[posts.length - 1]
    if (!last || loadingMore) return
    setLoadingMore(true)
    try {
      const rows = await fetchFeed(coachId, { before: last.created_at })
      setPosts((prev) => [...prev, ...rows.filter((r) => !prev.some((p) => p.id === r.id))])
      setHasMore(rows.length === FEED_PAGE)
    } catch {
      setError('Couldn’t load more — try again.')
    }
    setLoadingMore(false)
  }, [coachId, posts, loadingMore])

  const post = useCallback(async (body, card) => {
    const row = await createPost({ coachId, authorId: meId, body, card })
    if (!row) return null
    setPosts((prev) => (prev.some((p) => p.id === row.id) ? prev : [row, ...prev].sort(newestFirst)))
    needName(meId)
    return row
  }, [coachId, meId, needName])

  const remove = useCallback(async (p) => {
    await deletePost(p)
    setPosts((prev) => prev.filter((x) => x.id !== p.id))
  }, [])

  // Tapping your current reaction takes it off; anything else sets it. Shown
  // straight away, put back if it didn't save.
  const react = useCallback(async (p, emoji) => {
    const current = (p.reactions || []).find((r) => r.user_id === meId)?.emoji || null
    const next = current === emoji ? null : emoji
    setPosts((prev) => withReaction(prev, { post_id: p.id, user_id: meId, emoji: next }))
    try {
      await setPostReaction(p, meId, next)
    } catch {
      setPosts((prev) => withReaction(prev, { post_id: p.id, user_id: meId, emoji: current }))
      throw new Error('reaction failed')
    }
  }, [meId])

  const openComments = useCallback(async (p) => {
    const rows = await fetchComments(p)
    rows.forEach((c) => counted.current.add(c.id))
    setComments((prev) => ({ ...prev, [p.id]: rows }))
    // The list is the truth now — the count follows it.
    setPosts((prev) => prev.map((x) => (x.id === p.id ? { ...x, comment_count: rows.length } : x)))
    rows.forEach((c) => needName(c.author_id))
  }, [needName])

  const comment = useCallback(async (p, body) => {
    const row = await addComment({ post: p, authorId: meId, body })
    if (!row) return null
    addCommentRow(row)
    needName(meId)
    return row
  }, [meId, addCommentRow, needName])

  const removeComment = useCallback(async (c, p) => {
    await deleteComment(c, p)
    dropCommentRow(c.id)
  }, [dropCommentRow])

  return { posts, names, loading, error, hasMore, loadingMore, loadMore, post, remove, react, comments, openComments, comment, removeComment }
}

// ---- "New posts" dot -------------------------------------------------------------

// True when someone else posted after this device last opened the feed. Live;
// `refreshKey` (the top bar passes the page address) checks again on change.
export function useCommunityNew(coachId, meId, enabled, refreshKey = null) {
  const [latest, setLatest] = useState(null)
  useEffect(() => {
    if (!enabled || !coachId || !meId) return
    let cancelled = false
    fetchLatestOtherPost(coachId, meId).then((t) => { if (!cancelled) setLatest(t) })
    const unsubscribe = subscribeToFeed(coachId, {
      onPost: (row) => {
        if (row.author_id !== meId) setLatest((t) => (!t || row.created_at > t ? row.created_at : t))
      },
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [coachId, meId, enabled, refreshKey])
  if (!enabled || !latest) return false
  const seen = lastSeen(meId)
  return !seen || latest > seen
}
