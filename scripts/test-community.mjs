// Checks for the community feed's pure parts (lib/community.js): what a post
// may hold (check-ins never), comments, names, times, and the reaction chips
// it shares with the chat (lib/messages.js).
//
//   node scripts/test-community.mjs
//
// Loaded through Vite's SSR loader like the audits; reads only, writes nothing.
// Exits 1 on the first failed check.

import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const server = await createServer({ root: ROOT, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const community = await server.ssrLoadModule('/src/lib/community.js')
const cards = await server.ssrLoadModule('/src/lib/chatCards.js')
const messages = await server.ssrLoadModule('/src/lib/messages.js')

let passed = 0
function check(name, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL  ${name}${detail ? `\n      ${detail}` : ''}`)
    server.close()
    process.exit(1)
  }
  passed++
}

const { cleanPost, cleanComment, canPostCard, memberName, postTime, POST_MAX, COMMENT_MAX } = community

// ---- What a post holds ----
const exercise = cards.exerciseCard({ id: 'romanian-deadlift-rdl', name: 'Romanian Deadlift (RDL)', category: 'Legs' })
const split = cards.splitCard({ id: 'p1', name: 'Upper / Lower', days: [{ id: 'd1', kind: 'train', exercises: [] }] })
const session = { id: 's1', date: Date.now(), name: 'Push', exercises: [] }
const workout = cards.workoutCard(session, [session], 'kg')
const checkin = cards.checkinCard({ week_start: '2026-10-05', answers: { sleep: 4 } })

check('a workout can be posted', canPostCard(workout))
check('a split can be posted', canPostCard(split))
check('an exercise can be posted', canPostCard(exercise))
check('a check-in can never be posted', !canPostCard(checkin))
check('a check-in post is refused even with a caption', cleanPost({ body: 'week went well', card: checkin }) === null)
check('junk that isn\'t a card is refused', cleanPost({ body: 'hi', card: { type: 'photo' } }) === null)

check('nothing to post is null', cleanPost({ body: '   ' }) === null)
check('text only is fine', cleanPost({ body: ' New PR! ' })?.body === 'New PR!')
check('card only is fine', cleanPost({ body: '', card: workout })?.card === workout && cleanPost({ body: '', card: workout }).body === null)
check('caption + card keeps both', (() => {
  const p = cleanPost({ body: 'Leg day', card: exercise })
  return p.body === 'Leg day' && p.card === exercise
})())
check('a long caption is cut to the limit', cleanPost({ body: 'x'.repeat(POST_MAX + 50) }).body.length === POST_MAX)

check('an empty comment is null', cleanComment('  \n ') === null)
check('a comment is trimmed', cleanComment('  nice  ') === 'nice')
check('a long comment is cut to the limit', cleanComment('y'.repeat(COMMENT_MAX + 1)).length === COMMENT_MAX)

// ---- Names ----
const names = { a: { name: 'Alex', isCoach: false }, b: { name: null, isCoach: false } }
check('a nickname shows', memberName(names, 'a') === 'Alex')
check('no nickname reads "Member"', memberName(names, 'b') === 'Member')
check('someone unknown reads "Member"', memberName(names, 'zzz') === 'Member' && memberName(null, 'a') === 'Member')

// ---- Times ----
const now = new Date('2026-10-06T12:00:00Z').getTime()
const ago = (ms) => new Date(now - ms).toISOString()
check('under a minute is "Just now"', postTime(ago(20 * 1000), now) === 'Just now')
check('minutes', postTime(ago(5 * 60000), now) === '5m')
check('hours', postTime(ago(3 * 3600000), now) === '3h')
check('older shows the date', postTime(ago(3 * 86400000), now) === '3 Oct', postTime(ago(3 * 86400000), now))
check('another year shows the year', /2025/.test(postTime('2025-12-01T10:00:00Z', now)))

// ---- Reaction chips (shared with the chat) ----
const chips = messages.reactionChips([
  { user_id: 'a', emoji: '🔥' },
  { user_id: 'b', emoji: '💪' },
  { user_id: 'me', emoji: '🔥' },
], 'me')
check('chips group by emoji in first-used order', chips.map((c) => c.emoji).join('') === '🔥💪')
check('chips count', chips[0].count === 2 && chips[1].count === 1)
check('chips mark your own', chips[0].mine && !chips[1].mine)
check('no reactions, no chips', messages.reactionChips(undefined, 'me').length === 0)

server.close()
console.log(`ok  ${passed} checks`)
