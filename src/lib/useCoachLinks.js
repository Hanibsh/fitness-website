// The coach's account links: which client cards are linked to a real account,
// which have an invite out. Loaded once for the whole coach area (CoachLayout)
// and refreshed after each invite or unlink.
import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchCoachLinks, createInvite, endLink, fetchSentPrograms, sendProgram, unsendProgram } from './coach'

export function useCoachLinks(user, clients, ready) {
  const [links, setLinks] = useState([])
  const [linksLoading, setLinksLoading] = useState(true)
  // Only the dev sample reads the cards (to link the first one), so a card edit
  // mustn't trigger a refetch.
  const cards = useRef(clients)
  cards.current = clients

  const reload = useCallback(async () => {
    try {
      setLinks(await fetchCoachLinks(user?.id, cards.current))
    } catch {
      // keep what's on screen
    }
    setLinksLoading(false)
  }, [user])

  useEffect(() => {
    if (ready) reload()
  }, [ready, reload])

  const invite = useCallback(
    async (cardId) => {
      const link = await createInvite(user?.id, cardId)
      await reload()
      return link
    },
    [user, reload]
  )

  const unlink = useCallback(
    async (linkId) => {
      await endLink(linkId)
      await reload()
    },
    [reload]
  )

  return { links, linksLoading, invite, unlink, reloadLinks: reload }
}

// The programs this coach has sent to linked clients ({ programId: row }), and
// sending, stopping, and pushing an edit to one that's out there.
export function useSentPrograms(user, ready) {
  const [sent, setSent] = useState({})
  const sentRef = useRef(sent)
  sentRef.current = sent
  const timers = useRef({})

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    fetchSentPrograms(user?.id)
      .then((rows) => { if (!cancelled) setSent(rows) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user, ready])

  const remember = useCallback((row) => setSent((prev) => ({ ...prev, [row.id]: row })), [])

  const send = useCallback(
    async (clientUserId, program, makeActive) => remember(await sendProgram(user?.id, clientUserId, program, makeActive)),
    [user, remember]
  )

  const unsend = useCallback(
    async (programId) => {
      clearTimeout(timers.current[programId])
      await unsendProgram(user?.id, programId)
      setSent((prev) => {
        const next = { ...prev }
        delete next[programId]
        return next
      })
    },
    [user]
  )

  // An edit to a sent program reaches the client after a pause, like every
  // other save — typing a note doesn't send a request per keystroke.
  const pushProgram = useCallback(
    (program) => {
      const row = sentRef.current[program.id]
      if (!row) return
      clearTimeout(timers.current[program.id])
      timers.current[program.id] = setTimeout(() => {
        sendProgram(user?.id, row.client_id, program, row.make_active).then(remember).catch(() => {})
      }, 700)
    },
    [user, remember]
  )

  return { sent, send, unsend, pushProgram }
}
