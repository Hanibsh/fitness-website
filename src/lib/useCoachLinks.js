// The coach's account links: which client cards are linked to a real account,
// which have an invite out. Loaded once for the whole coach area (CoachLayout)
// and refreshed after each invite or unlink.
import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchCoachLinks, createInvite, endLink } from './coach'

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
