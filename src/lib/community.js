// The community feed (schema.sql section 2k): the coach's clients sharing with
// each other. A post is a caption, a card from the app (lib/chatCards.js — a
// workout, a split or an exercise; never a check-in), or both. Under each:
// one emoji reaction per person and short comments. Live while the page is
// open. A community is named by its coach; members are the coach and every
// active client.
//
// Names come from the community_names RPC — clients can't read each other's
// profiles — and only for people who've posted or commented.
//
// Everything degrades to "no posts" until schema.sql has been run.
import { supabase } from './supabase'
import { isCard } from './chatCards'

export const POST_MAX = 1000
export const COMMENT_MAX = 1000
export const FEED_PAGE = 20
export const SHAREABLE_CARDS = ['workout', 'split', 'exercise']

function missing(error) {
  if (!error) return false
  return ['42P01', 'PGRST205', 'PGRST202', '42883'].includes(error.code)
}

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// ---- Pure helpers ----------------------------------------------------------------

export const canPostCard = (card) => isCard(card) && SHAREABLE_CARDS.includes(card.type)

// What a post will hold — { body, card } — or null when there's nothing to
// post, or the card is one that stays private (a check-in).
export function cleanPost({ body, card = null }) {
  if (card && !canPostCard(card)) return null
  const text = String(body || '').trim().slice(0, POST_MAX) || null
  if (!text && !card) return null
  return { body: text, card: card || null }
}

export function cleanComment(body) {
  return String(body || '').trim().slice(0, COMMENT_MAX) || null
}

// The name to show for a member: their nickname, else "Member".
export function memberName(names, id) {
  return names?.[id]?.name || 'Member'
}

// "Just now", "5m", "3h", then the date.
export function postTime(iso, now = Date.now()) {
  const mins = Math.floor((now - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m`
  if (mins < 24 * 60) return `${Math.floor(mins / 60)}h`
  const d = new Date(iso)
  const sameYear = d.getFullYear() === new Date(now).getFullYear()
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
}

// ---- Dev sample ----------------------------------------------------------------
// In local development, signed out, the coach and client dev samples (see
// lib/coach.js) share one community kept in localStorage, seeded with a post
// from a made-up member so the feed isn't empty. Tabs hear each other over a
// BroadcastChannel.
export const DEV_COMMUNITY_COACH = 'dev-coach'
const DEV_STORE = 'leon_dev_community'
const DEV_NAMES = {
  'dev-coach': { name: 'Leon', isCoach: true },
  'dev-client': { name: 'Alex', isCoach: false },
  'dev-member': { name: 'Sam', isCoach: false },
}
const isDev = (coachId) => import.meta.env.DEV && coachId === DEV_COMMUNITY_COACH
function devSeed() {
  const hour = 3600000
  return {
    posts: [
      {
        id: 'dev-post-1', coach_id: DEV_COMMUNITY_COACH, author_id: 'dev-member',
        body: 'Finally felt hamstrings on these instead of my lower back. Game changer.',
        card: { type: 'exercise', id: 'romanian-deadlift-rdl', name: 'Romanian Deadlift (RDL)', category: 'Legs' },
        created_at: new Date(Date.now() - 5 * hour).toISOString(),
        reactions: [{ user_id: 'dev-coach', emoji: '🔥' }],
      },
    ],
    comments: [
      { id: 'dev-comment-1', post_id: 'dev-post-1', author_id: 'dev-coach', body: 'That’s the hinge clicking. Nice work.', created_at: new Date(Date.now() - 4 * hour).toISOString() },
    ],
  }
}
function devRead() {
  try {
    const stored = JSON.parse(localStorage.getItem(DEV_STORE))
    if (stored?.posts) return stored
  } catch {
    // unreadable — start over
  }
  const seed = devSeed()
  devWrite(seed)
  return seed
}
function devWrite(store) {
  try {
    localStorage.setItem(DEV_STORE, JSON.stringify(store))
  } catch {
    // storage full — the sample just won't remember it
  }
}
let devChannel = null
function devBus() {
  if (!devChannel && typeof BroadcastChannel !== 'undefined') devChannel = new BroadcastChannel('leon_dev_community')
  return devChannel
}
const devPost = (event) => devBus()?.postMessage(event)
const devCount = (store, postId) => store.comments.filter((c) => c.post_id === postId).length

// ---- Reading ---------------------------------------------------------------------

// One page of the feed, newest first: posts older than `before` (an ISO time),
// each with `reactions` ([{ user_id, emoji }]) and `comment_count`.
export async function fetchFeed(coachId, { before = null } = {}) {
  if (isDev(coachId)) {
    const store = devRead()
    return [...store.posts]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .filter((p) => !before || p.created_at < before)
      .slice(0, FEED_PAGE)
      .map((p) => ({ ...p, reactions: p.reactions || [], comment_count: devCount(store, p.id) }))
  }
  if (!supabase || !coachId) return []
  const query = (select) => {
    let q = supabase
      .from('community_posts')
      .select(select)
      .eq('coach_id', coachId)
      .order('created_at', { ascending: false })
      .limit(FEED_PAGE)
    if (before) q = q.lt('created_at', before)
    return q
  }
  let { data, error } = await query('*, reactions:post_reactions(user_id, emoji), comments:post_comments(count)')
  // The embedded count refused: the posts and reactions alone (counts fill in
  // as comments are opened).
  if (error && !missing(error)) ({ data, error } = await query('*, reactions:post_reactions(user_id, emoji)'))
  if (error) {
    if (missing(error)) return []
    throw error
  }
  return (data || []).map(({ comments, ...p }) => ({ ...p, reactions: p.reactions || [], comment_count: comments?.[0]?.count || 0 }))
}

// { userId: { name, isCoach } } for everyone named in the feed.
export async function fetchNames(coachId) {
  if (isDev(coachId)) return DEV_NAMES
  if (!supabase || !coachId) return {}
  const { data, error } = await supabase.rpc('community_names', { p_coach: coachId })
  if (error) return {}
  return Object.fromEntries((data || []).map((r) => [r.id, { name: r.name || null, isCoach: !!r.is_coach }]))
}

// A post's comments, oldest first.
export async function fetchComments(post) {
  if (isDev(post.coach_id)) return devRead().comments.filter((c) => c.post_id === post.id)
  if (!supabase) return []
  const { data, error } = await supabase
    .from('post_comments')
    .select('*')
    .eq('post_id', post.id)
    .order('created_at', { ascending: true })
  if (error) {
    if (missing(error)) return []
    throw error
  }
  return data || []
}

// The newest post by someone else — the top bar's "new posts" dot.
export async function fetchLatestOtherPost(coachId, meId) {
  if (isDev(coachId)) {
    return devRead().posts.filter((p) => p.author_id !== meId).map((p) => p.created_at).sort().pop() || null
  }
  if (!supabase || !coachId || !meId) return null
  const { data, error } = await supabase
    .from('community_posts')
    .select('created_at')
    .eq('coach_id', coachId)
    .neq('author_id', meId)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) return null
  return data?.[0]?.created_at || null
}

// Live changes to one community; RLS decides what reaches this account.
// Handlers: onPost(row), onPostGone(id), onReaction({ post_id, user_id, emoji }),
// onReactionGone({ post_id, user_id }), onComment(row), onCommentGone(id).
// Any can be left out. Returns unsubscribe.
export function subscribeToFeed(coachId, handlers) {
  const h = { onPost() {}, onPostGone() {}, onReaction() {}, onReactionGone() {}, onComment() {}, onCommentGone() {}, ...handlers }
  if (isDev(coachId)) {
    const bus = devBus()
    const listen = ({ data: e }) => {
      if (e.kind === 'post') h.onPost(e.row)
      else if (e.kind === 'post-gone') h.onPostGone(e.id)
      else if (e.kind === 'reaction') h.onReaction(e.row)
      else if (e.kind === 'reaction-gone') h.onReactionGone(e.row)
      else if (e.kind === 'comment') h.onComment(e.row)
      else if (e.kind === 'comment-gone') h.onCommentGone(e.id)
    }
    bus?.addEventListener('message', listen)
    return () => bus?.removeEventListener('message', listen)
  }
  if (!supabase || !coachId) return () => {}
  // Several can be open at once (the top bar and the page), so each gets its
  // own channel name.
  const channel = supabase
    .channel(`community:${coachId}:${newId()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_posts', filter: `coach_id=eq.${coachId}` }, (p) => {
      h.onPost({ ...p.new, reactions: [], comment_count: 0 })
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'community_posts' }, (p) => {
      if (p.old?.id) h.onPostGone(p.old.id)
    })
    // Reactions and comments carry no coach id: the handlers drop the ones
    // for posts they don't hold.
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'post_reactions' }, (p) => h.onReaction(p.new))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'post_reactions' }, (p) => h.onReaction(p.new))
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'post_reactions' }, (p) => {
      if (p.old?.post_id) h.onReactionGone(p.old)
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'post_comments' }, (p) => h.onComment(p.new))
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'post_comments' }, (p) => {
      if (p.old?.id) h.onCommentGone(p.old.id)
    })
    .subscribe()
  return () => supabase.removeChannel(channel)
}

// ---- Writing ---------------------------------------------------------------------

// Posts a caption, a card, or both (cleanPost decides). Returns the row, or
// null when there was nothing to post.
export async function createPost({ coachId, authorId, body, card = null }) {
  const clean = cleanPost({ body, card })
  if (!clean) return null
  if (isDev(coachId)) {
    const row = { id: newId(), coach_id: coachId, author_id: authorId, ...clean, created_at: new Date().toISOString(), reactions: [] }
    const store = devRead()
    devWrite({ ...store, posts: [...store.posts, row] })
    devPost({ kind: 'post', row: { ...row, comment_count: 0 } })
    return { ...row, comment_count: 0 }
  }
  const insert = { coach_id: coachId, author_id: authorId, body: clean.body }
  if (clean.card) insert.card = clean.card
  const { data, error } = await supabase.from('community_posts').insert(insert).select().single()
  if (error) throw error
  return { ...data, reactions: [], comment_count: 0 }
}

export async function deletePost(post) {
  if (isDev(post.coach_id)) {
    const store = devRead()
    devWrite({ posts: store.posts.filter((p) => p.id !== post.id), comments: store.comments.filter((c) => c.post_id !== post.id) })
    devPost({ kind: 'post-gone', id: post.id })
    return
  }
  const { error } = await supabase.from('community_posts').delete().eq('id', post.id)
  if (error) throw error
}

// Your reaction to a post: an emoji sets (or swaps) it, null takes it off.
export async function setPostReaction(post, userId, emoji) {
  if (isDev(post.coach_id)) {
    const store = devRead()
    const posts = store.posts.map((p) => {
      if (p.id !== post.id) return p
      const others = (p.reactions || []).filter((r) => r.user_id !== userId)
      return { ...p, reactions: emoji ? [...others, { user_id: userId, emoji }] : others }
    })
    devWrite({ ...store, posts })
    devPost(emoji ? { kind: 'reaction', row: { post_id: post.id, user_id: userId, emoji } } : { kind: 'reaction-gone', row: { post_id: post.id, user_id: userId } })
    return
  }
  const table = supabase.from('post_reactions')
  const { error } = emoji
    ? await table.upsert({ post_id: post.id, user_id: userId, emoji }, { onConflict: 'post_id,user_id' })
    : await table.delete().eq('post_id', post.id).eq('user_id', userId)
  if (error) throw error
}

export async function addComment({ post, authorId, body }) {
  const text = cleanComment(body)
  if (!text) return null
  if (isDev(post.coach_id)) {
    const row = { id: newId(), post_id: post.id, author_id: authorId, body: text, created_at: new Date().toISOString() }
    const store = devRead()
    devWrite({ ...store, comments: [...store.comments, row] })
    devPost({ kind: 'comment', row })
    return row
  }
  const { data, error } = await supabase.from('post_comments').insert({ post_id: post.id, author_id: authorId, body: text }).select().single()
  if (error) throw error
  return data
}

export async function deleteComment(comment, post) {
  if (isDev(post.coach_id)) {
    const store = devRead()
    devWrite({ ...store, comments: store.comments.filter((c) => c.id !== comment.id) })
    devPost({ kind: 'comment-gone', id: comment.id })
    return
  }
  const { error } = await supabase.from('post_comments').delete().eq('id', comment.id)
  if (error) throw error
}

// ---- "New posts" dot ---------------------------------------------------------------
// When this device last opened the feed, per account.
const SEEN_KEY = 'leon_community_seen'
export function lastSeen(meId) {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}')[meId] || null
  } catch {
    return null
  }
}
export function markSeen(meId, iso = new Date().toISOString()) {
  try {
    const all = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}')
    all[meId] = iso
    localStorage.setItem(SEEN_KEY, JSON.stringify(all))
  } catch {
    // no storage — the dot just shows again
  }
}
