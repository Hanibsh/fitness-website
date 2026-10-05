// The coach ↔ client chat (schema.sql section 2j): text, photos and short
// videos between the coach and one linked client, live while either has it
// open. A chat is named by its two people — (coachId, clientId) — and only
// exists while their link is active.
//
// Photos are shrunk on the device before they go (a phone photo is several MB;
// 1600px JPEG is a few hundred KB and still sharp on any screen). Videos go as
// they are, up to 50 MB — the storage bucket's own cap.
//
// Everything degrades to "no messages" until schema.sql has been run.
import { supabase } from './supabase'

export const MESSAGE_MAX = 4000
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024
const PHOTO_MAX_SIDE = 1600
const BUCKET = 'chat-media'
const PAGE = 200

function missing(error) {
  if (!error) return false
  return ['42P01', 'PGRST205', 'PGRST202', '42883'].includes(error.code)
}

// ---- Dev sample ----------------------------------------------------------------
// In local development, signed out, the coach and client dev samples (see
// lib/coach.js) share one chat kept in localStorage; media stays as data: URLs.
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
export const DEV_COACH_ID = 'dev-coach'
export const DEV_CLIENT_ID = 'dev-client'

// ---- Reading ---------------------------------------------------------------------

// The latest messages in one chat, oldest first.
export async function fetchMessages(coachId, clientId) {
  if (isDevChat(coachId, clientId)) return devRead()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(PAGE)
  if (error) {
    if (missing(error)) return []
    throw error
  }
  return (data || []).reverse()
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

// Live changes to one chat. Returns the unsubscribe. `onInsert(row)`,
// `onDelete(id)`; RLS decides what reaches this account.
export function subscribeToChat(coachId, clientId, { onInsert, onDelete }) {
  if (isDevChat(coachId, clientId) || !supabase) return () => {}
  const channel = supabase
    .channel(`chat:${coachId}:${clientId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `client_id=eq.${clientId}` }, (p) => {
      if (p.new?.coach_id === coachId) onInsert(p.new)
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (p) => {
      if (p.old?.id) onDelete(p.old.id)
    })
    .subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}

export async function markChatRead(coachId, clientId) {
  if (isDevChat(coachId, clientId)) return
  if (!supabase) return
  const { error } = await supabase.rpc('mark_messages_read', { p_coach: coachId, p_client: clientId })
  if (error && !missing(error)) throw error
}

// The client's side: how many messages from the coach are unread.
export async function fetchMyUnreadCount(userId) {
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

// The coach's side: unread messages per client account, { clientUserId: n }.
export async function fetchCoachUnread(coachId) {
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

// Sends text, a prepared file (from prepareMedia), or both. Returns the row.
export async function sendMessage({ coachId, clientId, senderId, body, media }) {
  const text = String(body || '').trim().slice(0, MESSAGE_MAX) || null
  if (!text && !media) return null

  if (isDevChat(coachId, clientId)) {
    const row = {
      id: newId(), coach_id: coachId, client_id: clientId, sender_id: senderId, body: text,
      media_path: media ? await blobToDataUrl(media.blob) : null, media_type: media?.type || null,
      created_at: new Date().toISOString(), read_at: null,
    }
    devWrite([...devRead(), row])
    return row
  }

  let mediaPath = null
  if (media) {
    mediaPath = `${coachId}/${clientId}/${newId()}.${media.ext}`
    const { error } = await supabase.storage.from(BUCKET).upload(mediaPath, media.blob, { contentType: media.contentType, upsert: false })
    if (error) throw error
  }
  const { data, error } = await supabase
    .from('messages')
    .insert({ coach_id: coachId, client_id: clientId, sender_id: senderId, body: text, media_path: mediaPath, media_type: media?.type || null })
    .select()
    .single()
  if (error) {
    // Don't leave an orphaned file behind.
    if (mediaPath) supabase.storage.from(BUCKET).remove([mediaPath]).catch(() => {})
    throw error
  }
  return data
}

// Deletes your own message and its file.
export async function deleteMessage(message) {
  if (isDevChat(message.coach_id, message.client_id)) {
    devWrite(devRead().filter((m) => m.id !== message.id))
    return
  }
  const { error } = await supabase.from('messages').delete().eq('id', message.id)
  if (error) throw error
  if (message.media_path) await supabase.storage.from(BUCKET).remove([message.media_path]).catch(() => {})
}
