// The coach ↔ client chat (schema.sql section 2j): text, photos and short
// videos between the coach and one linked client, live while either has it
// open. A chat is named by its two people — (coachId, clientId) — and only
// exists while their link is active.
//
// A message can also answer another (reply_to), carry something shared from
// the app (card — lib/chatCards.js), and collect one emoji reaction per person
// (message_reactions). "Typing…" goes over the chat's live channel and is
// never stored.
//
// Photos are shrunk on the device before they go (a phone photo is several MB;
// 1600px JPEG is a few hundred KB and still sharp on any screen). Videos go as
// they are, up to 50 MB — the storage bucket's own cap.
//
// Everything degrades to "no messages" until schema.sql has been run.
import { supabase } from './supabase'

export const MESSAGE_MAX = 4000
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024
export const REACTIONS = ['👍', '🔥', '💪', '❤️', '😂', '👀']
const PHOTO_MAX_SIDE = 1600
const BUCKET = 'chat-media'
const PAGE = 200

function missing(error) {
  if (!error) return false
  return ['42P01', 'PGRST205', 'PGRST202', '42883'].includes(error.code)
}

// ---- Dev sample ----------------------------------------------------------------
// In local development, signed out, the coach and client dev samples (see
// lib/coach.js) share one chat kept in localStorage; media stays as data: URLs
// and reactions ride on the row. Tabs hear each other over a BroadcastChannel,
// so a coach tab and a client tab chat live.
const DEV_STORE = 'leon_dev_messages'
const isDevChat = (coachId, clientId) => import.meta.env.DEV && (coachId === 'dev-coach' || clientId === 'dev-client')
function devRead() {
  try {
    return JSON.parse(localStorage.getItem(DEV_STORE)) || []
  } catch {
    return []
  }
}
function devWrite(rows) {
  try {
    localStorage.setItem(DEV_STORE, JSON.stringify(rows))
  } catch {
    // storage full (a big data: URL) — the sample just won't remember it
  }
}
let devChannel = null
function devBus() {
  if (!devChannel && typeof BroadcastChannel !== 'undefined') devChannel = new BroadcastChannel('leon_dev_chat')
  return devChannel
}
const devPost = (event) => devBus()?.postMessage(event)
export const DEV_COACH_ID = 'dev-coach'
export const DEV_CLIENT_ID = 'dev-client'

// ---- Reading ---------------------------------------------------------------------

// The latest messages in one chat, oldest first, each with its `reactions`
// ([{ user_id, emoji }]).
export async function fetchMessages(coachId, clientId) {
  if (isDevChat(coachId, clientId)) return devRead().map((m) => ({ ...m, reactions: m.reactions || [] }))
  if (!supabase) return []
  const query = (select) =>
    supabase
      .from('messages')
      .select(select)
      .eq('coach_id', coachId)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(PAGE)
  let { data, error } = await query('*, reactions:message_reactions(user_id, emoji)')
  // No reactions table yet (schema.sql not re-run): the messages alone.
  if (error && !missing(error)) ({ data, error } = await query('*'))
  if (error) {
    if (missing(error)) return []
    throw error
  }
  return (data || []).map((m) => ({ ...m, reactions: m.reactions || [] })).reverse()
}

// Signed links for the files in these messages: { media_path: url }. They last
// an hour — longer than anyone keeps a chat open.
export async function mediaUrls(messages) {
  const paths = [...new Set(messages.map((m) => m.media_path).filter((p) => p && !p.startsWith('data:')))]
  if (!paths.length || !supabase) return {}
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600)
  if (error) return {}
  return Object.fromEntries((data || []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]))
}

// Live changes to one chat. RLS decides what reaches this account. Handlers:
// onInsert(row), onUpdate(row) — read, or its original deleted —, onDelete(id),
// onReaction({ message_id, user_id, emoji }), onReactionGone({ message_id,
// user_id }), onTyping(fromUserId). Returns { unsubscribe, typing } — call
// typing() while you type.
export function subscribeToChat(coachId, clientId, meId, handlers) {
  const { onInsert, onUpdate, onDelete, onReaction, onReactionGone, onTyping } = handlers
  if (isDevChat(coachId, clientId)) {
    const bus = devBus()
    const listen = ({ data: e }) => {
      if (e.kind === 'insert') onInsert(e.row)
      else if (e.kind === 'update') onUpdate(e.row)
      else if (e.kind === 'delete') onDelete(e.id)
      else if (e.kind === 'reaction') onReaction(e.row)
      else if (e.kind === 'reaction-gone') onReactionGone(e.row)
      else if (e.kind === 'typing' && e.from !== meId) onTyping(e.from)
    }
    bus?.addEventListener('message', listen)
    return { unsubscribe: () => bus?.removeEventListener('message', listen), typing: () => devPost({ kind: 'typing', from: meId }) }
  }
  if (!supabase) return { unsubscribe: () => {}, typing: () => {} }
  const mine = (row) => row?.coach_id === coachId
  const channel = supabase
    .channel(`chat:${coachId}:${clientId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `client_id=eq.${clientId}` }, (p) => {
      if (mine(p.new)) onInsert({ ...p.new, reactions: [] })
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `client_id=eq.${clientId}` }, (p) => {
      if (mine(p.new)) onUpdate(p.new)
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (p) => {
      if (p.old?.id) onDelete(p.old.id)
    })
    // Not filterable by chat: the handler drops reactions to messages it
    // doesn't hold.
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reactions' }, (p) => onReaction(p.new))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'message_reactions' }, (p) => onReaction(p.new))
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message_reactions' }, (p) => {
      if (p.old?.message_id) onReactionGone(p.old)
    })
    .on('broadcast', { event: 'typing' }, (p) => {
      if (p.payload?.from && p.payload.from !== meId) onTyping(p.payload.from)
    })
    .subscribe()
  return {
    unsubscribe: () => supabase.removeChannel(channel),
    typing: () => channel.send({ type: 'broadcast', event: 'typing', payload: { from: meId } }).catch(() => {}),
  }
}

export async function markChatRead(coachId, clientId, meId) {
  if (isDevChat(coachId, clientId)) {
    const now = new Date().toISOString()
    const rows = devRead()
    const changed = []
    const next = rows.map((m) => {
      if (m.sender_id === meId || m.read_at) return m
      const row = { ...m, read_at: now }
      changed.push(row)
      return row
    })
    if (changed.length) {
      devWrite(next)
      changed.forEach((row) => devPost({ kind: 'update', row }))
    }
    return
  }
  if (!supabase) return
  const { error } = await supabase.rpc('mark_messages_read', { p_coach: coachId, p_client: clientId })
  if (error && !missing(error)) throw error
}

// The client's side: how many messages from the coach are unread.
export async function fetchMyUnreadCount(userId) {
  if (import.meta.env.DEV && userId === DEV_CLIENT_ID) {
    return devRead().filter((m) => m.sender_id !== userId && !m.read_at).length
  }
  if (!supabase || !userId) return 0
  const { count, error } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', userId)
    .neq('sender_id', userId)
    .is('read_at', null)
  if (error) return 0
  return count || 0
}

// Has this client sent their coach anything yet? Ticks off the "Message your
// coach" step on the dashboard's get-started list.
export async function fetchHasMessaged(userId) {
  if (import.meta.env.DEV && userId === DEV_CLIENT_ID) return devRead().some((m) => m.sender_id === userId)
  if (!supabase || !userId) return false
  const { count, error } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', userId)
    .eq('sender_id', userId)
  return !error && count > 0
}

// The coach's side: unread messages per client account, { clientUserId: n }.
export async function fetchCoachUnread(coachId) {
  if (isDevChat(coachId, null)) {
    const out = {}
    for (const m of devRead()) if (m.sender_id !== coachId && !m.read_at) out[m.client_id] = (out[m.client_id] || 0) + 1
    return out
  }
  if (!supabase || !coachId) return {}
  const { data, error } = await supabase
    .from('messages')
    .select('client_id')
    .eq('coach_id', coachId)
    .neq('sender_id', coachId)
    .is('read_at', null)
  if (error) return {}
  const out = {}
  for (const r of data || []) out[r.client_id] = (out[r.client_id] || 0) + 1
  return out
}

// Every chat this account is in, live: calls onChange whenever a message
// arrives or is read, so unread badges and the inbox refetch. Pass coachId
// (the coach's chats) or clientId (a client's one chat). Returns unsubscribe.
export function subscribeToInbox({ coachId = null, clientId = null }, onChange) {
  if (isDevChat(coachId, clientId)) {
    const bus = devBus()
    const listen = ({ data: e }) => {
      if (e.kind === 'insert' || e.kind === 'update' || e.kind === 'delete') onChange()
    }
    bus?.addEventListener('message', listen)
    return () => bus?.removeEventListener('message', listen)
  }
  if (!supabase || !(coachId || clientId)) return () => {}
  const filter = coachId ? `coach_id=eq.${coachId}` : `client_id=eq.${clientId}`
  // Several of these can be open at once (the top bar, the coach area, the
  // inbox), so each gets its own channel name.
  const channel = supabase
    .channel(`inbox:${coachId || clientId}:${newId()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter }, () => onChange())
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter }, () => onChange())
    .subscribe()
  return () => supabase.removeChannel(channel)
}

// The coach's inbox: the newest message in each of these chats,
// { clientUserId: message }. One small query per client, so a chat that's been
// quiet a while still shows its last word.
export async function fetchCoachInbox(coachId, clientIds) {
  if (!coachId || !clientIds.length) return {}
  if (isDevChat(coachId, null)) {
    const rows = devRead()
    return Object.fromEntries(clientIds.map((id) => [id, rows.filter((m) => m.client_id === id).pop()]).filter(([, m]) => m))
  }
  if (!supabase) return {}
  const latest = await Promise.all(clientIds.map(async (clientId) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('coach_id', coachId)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
    return error ? null : data?.[0] || null
  }))
  return Object.fromEntries(clientIds.map((id, i) => [id, latest[i]]).filter(([, m]) => m))
}

// ---- Sending ---------------------------------------------------------------------

// A picked file, made ready to send: { blob, type: 'image'|'video', ext } or
// { error } with something to say. Photos are shrunk; videos are checked.
export async function prepareMedia(file) {
  if (!file) return { error: 'No file.' }
  if (file.type.startsWith('video/')) {
    if (file.size > VIDEO_MAX_BYTES) return { error: 'That video is over 50 MB — trim it a little and try again.' }
    const ext = file.type === 'video/quicktime' ? 'mov' : file.type === 'video/webm' ? 'webm' : 'mp4'
    return { blob: file, type: 'video', ext, contentType: file.type || 'video/mp4' }
  }
  if (!file.type.startsWith('image/')) return { error: 'Only photos and videos can be sent.' }
  // A GIF would lose its animation through a canvas.
  if (file.type === 'image/gif') {
    if (file.size > 10 * 1024 * 1024) return { error: 'That GIF is too big.' }
    return { blob: file, type: 'image', ext: 'gif', contentType: 'image/gif' }
  }
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close?.()
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82))
    if (!blob) throw new Error('encode failed')
    return { blob, type: 'image', ext: 'jpg', contentType: 'image/jpeg' }
  } catch {
    return { error: 'Couldn’t read that photo.' }
  }
}

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

// Sends text, a prepared file (from prepareMedia), a card (lib/chatCards.js),
// or a mix — optionally as a reply. Returns the row.
export async function sendMessage({ coachId, clientId, senderId, body, media, card = null, replyTo = null }) {
  const text = String(body || '').trim().slice(0, MESSAGE_MAX) || null
  if (!text && !media && !card) return null

  if (isDevChat(coachId, clientId)) {
    const row = {
      id: newId(), coach_id: coachId, client_id: clientId, sender_id: senderId, body: text,
      media_path: media ? await blobToDataUrl(media.blob) : null, media_type: media?.type || null,
      card, reply_to: replyTo, created_at: new Date().toISOString(), read_at: null, reactions: [],
    }
    devWrite([...devRead(), row])
    devPost({ kind: 'insert', row })
    return row
  }

  let mediaPath = null
  if (media) {
    mediaPath = `${coachId}/${clientId}/${newId()}.${media.ext}`
    const { error } = await supabase.storage.from(BUCKET).upload(mediaPath, media.blob, { contentType: media.contentType, upsert: false })
    if (error) throw error
  }
  const insert = { coach_id: coachId, client_id: clientId, sender_id: senderId, body: text, media_path: mediaPath, media_type: media?.type || null }
  // Only named when used, so plain messages still send before schema.sql's
  // newer columns exist.
  if (card) insert.card = card
  if (replyTo) insert.reply_to = replyTo
  const { data, error } = await supabase.from('messages').insert(insert).select().single()
  if (error) {
    // Don't leave an orphaned file behind.
    if (mediaPath) supabase.storage.from(BUCKET).remove([mediaPath]).catch(() => {})
    throw error
  }
  return { ...data, reactions: [] }
}

// Your reaction to a message: an emoji sets (or swaps) it, null takes it off.
export async function setReaction(message, userId, emoji) {
  if (isDevChat(message.coach_id, message.client_id)) {
    const rows = devRead()
    const next = rows.map((m) => {
      if (m.id !== message.id) return m
      const others = (m.reactions || []).filter((r) => r.user_id !== userId)
      return { ...m, reactions: emoji ? [...others, { user_id: userId, emoji }] : others }
    })
    devWrite(next)
    devPost(emoji ? { kind: 'reaction', row: { message_id: message.id, user_id: userId, emoji } } : { kind: 'reaction-gone', row: { message_id: message.id, user_id: userId } })
    return
  }
  const table = supabase.from('message_reactions')
  const { error } = emoji
    ? await table.upsert({ message_id: message.id, user_id: userId, emoji }, { onConflict: 'message_id,user_id' })
    : await table.delete().eq('message_id', message.id).eq('user_id', userId)
  if (error) throw error
}

// Deletes your own message and its file.
export async function deleteMessage(message) {
  if (isDevChat(message.coach_id, message.client_id)) {
    devWrite(devRead().map((m) => (m.reply_to === message.id ? { ...m, reply_to: null } : m)).filter((m) => m.id !== message.id))
    devPost({ kind: 'delete', id: message.id })
    return
  }
  const { error } = await supabase.from('messages').delete().eq('id', message.id)
  if (error) throw error
  if (message.media_path) await supabase.storage.from(BUCKET).remove([message.media_path]).catch(() => {})
}
