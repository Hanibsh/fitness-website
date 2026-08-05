// One closing line for a workout summary, chosen from what actually happened.
//
// The whole value of this is that it's earned. A line that fires regardless of
// the session is noise you learn to skip in a week, and a cheerful one on a day
// you trained hurt reads as though nothing is listening. So every branch below
// is tied to evidence, and there's a deliberate `null` for the ordinary session
// that has nothing particular to say — most workouts are just workouts.
//
// Tone: one sentence, plain, no exclamation marks. It should read like a person
// who happens to know what you did, not like an app congratulating you for
// opening it.

// How far below your recent norm counts as a light session. Generous on purpose
// — normal week-to-week variation shouldn't trip the "you showed up" line, which
// only means something when the session really was a hard one to get through.
const LOW_VOLUME_RATIO = 0.6
const COMPARISON_SESSIONS = 6

// Median rather than mean: one enormous leg day shouldn't drag the baseline up
// and make everything after it look like a bad week.
function median(xs) {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

// `stats` is sessionStats(session) — { exercises, sets, volume }.
// `priorStats` is the same for the sessions before this one, newest first.
export function sessionMessage({ session, stats, priorStats = [], prs = [], annotation = null } = {}) {
  if (!session) return null

  // A day marked sick or injured, trained anyway. This outranks everything,
  // including a PR: if you tell the app you were hurt, the app shouldn't lead
  // with a number. Travel and plain rest days aren't hardship, so they don't
  // get a line — they'd just be filler.
  if (annotation?.reason === 'injury') {
    return 'You logged this on a day you marked as an injury — worth easing off if it still bothers you.'
  }
  if (annotation?.reason === 'sick') {
    return 'Training while ill is rarely the fastest way back. Nothing is lost by giving it a couple of days.'
  }

  if (prs.length) {
    const names = [...new Set(prs.map((p) => p.name))]
    if (names.length === 1) return `A personal best on ${names[0]}.`
    if (names.length === 2) return `Personal bests on ${names[0]} and ${names[1]}.`
    return `Personal bests on ${names.length} lifts.`
  }

  // A short session, judged against your own recent norm rather than any
  // absolute figure. Needs a few sessions behind it before it means anything.
  const baseline = median(priorStats.slice(0, COMPARISON_SESSIONS).map((s) => s.volume).filter((v) => v > 0))
  if (baseline && stats?.volume > 0 && stats.volume < baseline * LOW_VOLUME_RATIO) {
    return 'Lighter than your usual, which still beats the session you skip.'
  }

  return null
}
